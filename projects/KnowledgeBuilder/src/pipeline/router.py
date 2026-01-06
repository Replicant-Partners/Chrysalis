import logging
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from src.collectors.brave_search_collector import BraveSearchCollector
from src.collectors.exa_collector import ExaCollector
from src.collectors.firecrawl_collector import FirecrawlCollector
from src.collectors.tavily_collector import TavilyCollector
from src.utils.telemetry import TelemetryRecorder, ToolCall
from src.utils.fact_extractor import FactExtractor
from src.utils.sanitize import sanitize_attributes
from src.utils.context_enricher import ContextEnricher, load_domain_rules_from_file
from src.utils.redact import collect_secrets, redact
from src.utils.semantic_merge import SemanticMerger
from src.ground_truth.schema_resolver import SchemaResolver, ResolvedEntity
import os

logger = logging.getLogger(__name__)


@dataclass
class DomainTrust:
    """Domain trust scores plus allowlist/blocklist controls."""

    trust: Dict[str, float] = field(
        default_factory=lambda: {
            "edu": 0.9,
            "gov": 0.9,
            "acm.org": 0.85,
            "apa.org": 0.85,
            "nature.com": 0.85,
            "sciencedirect.com": 0.85,
            "arxiv.org": 0.8,
            "wikipedia.org": 0.75,
            "medium.com": 0.5,
            "substack.com": 0.5,
            "reddit.com": 0.3,
            "twitter.com": 0.3,
        }
    )
    allowlist: Set[str] = field(default_factory=set)
    blocklist: Set[str] = field(
        default_factory=lambda: {
            "malware.test",
            "phishing.test",
            "clickbait.example",
            "ads.example",
            "tracking.example",
        }
    )

    @classmethod
    def from_env(cls) -> "DomainTrust":
        allow = os.getenv("DOMAIN_ALLOWLIST", "")
        block = os.getenv("DOMAIN_BLOCKLIST", "")
        allowlist = {d.strip() for d in allow.split(",") if d.strip()}
        blocklist = {d.strip() for d in block.split(",") if d.strip()}
        rules_file = os.getenv("DOMAIN_RULES_FILE")
        if rules_file:
            rules = load_domain_rules_from_file(rules_file)
            allowlist |= set(rules.get("allowlist", []))
            blocklist |= set(rules.get("blocklist", []))
        return cls(allowlist=allowlist, blocklist=blocklist)

    def score(self, url: str) -> float:
        if any(block in url for block in self.blocklist):
            return 0.05
        if self.allowlist and not any(dom in url for dom in self.allowlist):
            # If allowlist is set, down-rank others
            return 0.2

        for domain, score in self.trust.items():
            if domain in url:
                return score

        # Generic heuristics
        if ".edu" in url or ".gov" in url:
            return 0.9
        if ".org" in url:
            return 0.7
        return 0.5


@dataclass
class SearchResult:
    attributes: Dict[str, str]
    source: str
    cost: float
    trust: float
    urls: List[str] = field(default_factory=list)


class SearchOrchestrator:
    """
    Multi-source orchestration with cost control, trust scoring, and telemetry.

    Current implementation:
      - Brave Search for seeds (always on)
      - Exa, Firecrawl, Tavily are stubbed for future integration
    """

    def __init__(
        self,
        use_exa: bool = True,
        use_firecrawl: bool = True,
        use_tavily: bool = False,  # placeholder; not available in this environment
        retry_attempts: int = 2,
        domain_trust: Optional[DomainTrust] = None,
        brave_cost: float = 0.001,
        exa_cost: float = 0.06,
        firecrawl_cost: float = 0.04,
        tavily_cost: float = 0.06,
        max_cost: float = 0.25,
        telemetry: Optional[TelemetryRecorder] = None,
        brave: Optional[BraveSearchCollector] = None,
        exa_client: Optional[ExaCollector] = None,
        firecrawl_client: Optional[FirecrawlCollector] = None,
        tavily_client: Optional[TavilyCollector] = None,
        per_source_timeout: float = 15.0,
    ) -> None:
        self.use_exa = use_exa
        self.use_firecrawl = use_firecrawl
        self.use_tavily = use_tavily
        self.domain_trust = domain_trust or DomainTrust.from_env()
        self.brave_cost = brave_cost
        self.exa_cost = exa_cost
        self.firecrawl_cost = firecrawl_cost
        self.tavily_cost = tavily_cost
        self.max_cost = max_cost
        self.telemetry = telemetry or TelemetryRecorder()
        self.retry_attempts = max(1, retry_attempts)
        self.per_source_timeout = per_source_timeout
        self.brave = brave or BraveSearchCollector()
        self.exa = exa_client or (self._safe_init(ExaCollector) if use_exa else None)
        self.firecrawl_client = firecrawl_client or (self._safe_init(FirecrawlCollector) if use_firecrawl else None)
        self.tavily_client = tavily_client or (self._safe_init(TavilyCollector) if use_tavily else None)
        self.extractor = FactExtractor()
        self.enricher = ContextEnricher()
        self.schema_resolver = SchemaResolver()
        # Snippet/merge limits scale with budget, but can be overridden via env:
        #   SEMANTIC_SNIPPET_LIMIT, SEMANTIC_MERGE_LIMIT, SEMANTIC_MERGE_THRESHOLD
        env_snip = os.getenv("SEMANTIC_SNIPPET_LIMIT")
        env_merge = os.getenv("SEMANTIC_MERGE_LIMIT")
        if env_snip and env_snip.isdigit():
            self.snippet_limit = int(env_snip)
        else:
            self.snippet_limit = 33 if self.max_cost >= 0.30 else 21
        if env_merge and env_merge.isdigit():
            self.merge_limit = int(env_merge)
        else:
            self.merge_limit = 16 if self.snippet_limit > 21 else 12
        merge_threshold = float(os.getenv("SEMANTIC_MERGE_THRESHOLD", "0.78"))
        self.merger = SemanticMerger(similarity_threshold=merge_threshold)
        self._secrets = collect_secrets()

    def _safe_init(self, cls):
        try:
            return cls()
        except Exception as exc:
            logger.warning("Disabled %s: %s", cls.__name__, exc)
            return None

    def collect(
        self,
        identifier: str,
        entity_type: Optional[str] = None,
        compare_without_enrichment: bool = False,
        fallback_tags: Optional[List[str]] = None,
    ) -> Dict:
        budget_remaining = self.max_cost
        aggregated_attrs: Dict[str, str] = {}
        seen_values: Set[str] = set()
        sources: List[Tuple[str, float]] = []
        collected_urls: List[str] = []
        snippet_buffer: List[Dict[str, str]] = []
        enrichment_used = False

        # Optional enrichment from schema-guided context
        search_term = identifier
        if not entity_type and not fallback_tags:
            raise ValueError("Entity type or fallback_tags must be provided for enrichment fallback.")
        enrichment_info = self.enricher.enrich(identifier, entity_type, fallback_tags=fallback_tags)
        if enrichment_info:
            search_term = enrichment_info["query"]
            enrichment_used = True

        # Tier 1: Brave (cheap, broad)
        brave_result, brave_err, brave_attempts, brave_latency = self._retry_collect(
            lambda: self._run_brave(search_term, entity_type), tool="brave"
        )
        if brave_result is None:
            brave_result = SearchResult(attributes={}, source="brave_search", cost=self.brave_cost, trust=0.0, urls=[])
        budget_remaining -= brave_result.cost
        sources.append((brave_result.source, brave_result.trust))
        self._merge_attributes(aggregated_attrs, seen_values, brave_result.attributes)
        collected_urls.extend(brave_result.urls)
        self.telemetry.record(
            ToolCall(
                tool="brave",
                cost=brave_result.cost,
                latency_ms=brave_latency,
                success=brave_err is None,
                new_facts=len(brave_result.attributes),
                error=str(brave_err) if brave_err else None,
                meta={"attempts": brave_attempts},
            )
        )

        # Tier 2: Exa (semantic deep)
        if self.use_exa and self.exa:
            if not self._can_afford(budget_remaining, self.exa_cost):
                self.telemetry.record(
                    ToolCall(
                        tool="exa",
                        cost=0.0,
                        latency_ms=None,
                        success=False,
                        new_facts=0,
                        error="budget_exhausted",
                        meta={"required_cost": self.exa_cost, "budget_remaining": budget_remaining},
                    )
                )
            else:
                exa_res, exa_err, exa_attempts, exa_latency = self._retry_collect(
                    lambda: self.exa.collect(search_term, entity_type, num_results=self.snippet_limit),
                    tool="exa",
                )
                budget_remaining -= self.exa_cost
                if exa_err is None and exa_res:
                    sources.append((exa_res["source"], 0.6))
                    self._merge_attributes(aggregated_attrs, seen_values, exa_res["attributes"])
                    collected_urls.extend(exa_res.get("urls", []))
                    snippet_buffer.extend(exa_res.get("snippets", [])[: self.snippet_limit])
                self.telemetry.record(
                    ToolCall(
                        tool="exa",
                        cost=self.exa_cost,
                        latency_ms=exa_latency,
                        success=exa_err is None and bool(exa_res),
                        new_facts=len(exa_res["attributes"]) if exa_res else 0,
                        error=str(exa_err) if exa_err else None,
                        meta={"attempts": exa_attempts},
                    )
                )

        # Tier 3: Tavily (broad semantic alt)
        if self.use_tavily and self.tavily_client:
            if not self._can_afford(budget_remaining, self.tavily_cost):
                self.telemetry.record(
                    ToolCall(
                        tool="tavily",
                        cost=0.0,
                        latency_ms=None,
                        success=False,
                        new_facts=0,
                        error="budget_exhausted",
                        meta={"required_cost": self.tavily_cost, "budget_remaining": budget_remaining},
                    )
                )
            else:
                t_res, t_err, t_attempts, t_latency = self._retry_collect(
                    lambda: self.tavily_client.collect(search_term, entity_type, max_results=self.snippet_limit),
                    tool="tavily",
                )
                budget_remaining -= self.tavily_cost
                if t_err is None and t_res:
                    sources.append((t_res["source"], 0.55))
                    self._merge_attributes(aggregated_attrs, seen_values, t_res["attributes"])
                    collected_urls.extend(t_res.get("urls", []))
                    snippet_buffer.extend(t_res.get("snippets", [])[: self.snippet_limit])
                self.telemetry.record(
                    ToolCall(
                        tool="tavily",
                        cost=self.tavily_cost,
                        latency_ms=t_latency,
                        success=t_err is None and bool(t_res),
                        new_facts=len(t_res["attributes"]) if t_res else 0,
                        error=str(t_err) if t_err else None,
                        meta={"attempts": t_attempts},
                    )
                )

        # Tier 4: Firecrawl (targeted URL crawl) - only if we have URLs and budget
        firecrawl_had_text = False
        firecrawl_failed = False
        if self.use_firecrawl and self.firecrawl_client:
            urls_to_crawl = self._rank_urls(collected_urls)
            if urls_to_crawl:
                if not self._can_afford(budget_remaining, self.firecrawl_cost):
                    self.telemetry.record(
                        ToolCall(
                            tool="firecrawl",
                            cost=0.0,
                            latency_ms=None,
                            success=False,
                            new_facts=0,
                            error="budget_exhausted",
                            meta={"required_cost": self.firecrawl_cost, "budget_remaining": budget_remaining},
                        )
                    )
                    firecrawl_failed = True
                else:
                    target_url = urls_to_crawl[0]
                    fc_res, fc_err, fc_attempts, fc_latency = self._retry_collect(
                        lambda: self.firecrawl_client.scrape(target_url), tool="firecrawl"
                    )
                    budget_remaining -= self.firecrawl_cost
                    if fc_err is None and fc_res:
                        sources.append((fc_res["source"], 0.55))
                        self._merge_attributes(
                            aggregated_attrs,
                            seen_values,
                            fc_res["attributes"],
                            content_type=fc_res["attributes"].get("content_type") if isinstance(fc_res.get("attributes"), dict) else None,
                        )
                        firecrawl_had_text = bool(fc_res["attributes"].get("page_text"))
                    else:
                        firecrawl_failed = True
                    self.telemetry.record(
                        ToolCall(
                            tool="firecrawl",
                            cost=self.firecrawl_cost,
                            latency_ms=fc_latency,
                            success=fc_err is None and bool(fc_res),
                            new_facts=len(fc_res["attributes"]) if fc_res else 0,
                            error=str(fc_err) if fc_err else None,
                            meta={"attempts": fc_attempts, "url": target_url},
                        )
                    )
                    if (not firecrawl_had_text) and len(urls_to_crawl) > 1 and budget_remaining >= self.firecrawl_cost:
                        target_url = urls_to_crawl[1]
                        fc_res2, fc_err2, fc_attempts2, fc_latency2 = self._retry_collect(
                            lambda: self.firecrawl_client.scrape(target_url), tool="firecrawl"
                        )
                        budget_remaining -= self.firecrawl_cost
                        if fc_err2 is None and fc_res2:
                            sources.append((fc_res2["source"], 0.55))
                            self._merge_attributes(
                                aggregated_attrs,
                                seen_values,
                                fc_res2["attributes"],
                                content_type=fc_res2["attributes"].get("content_type") if isinstance(fc_res2.get("attributes"), dict) else None,
                            )
                            firecrawl_had_text = bool(fc_res2["attributes"].get("page_text"))
                            firecrawl_failed = False
                        else:
                            firecrawl_failed = True
                        self.telemetry.record(
                            ToolCall(
                                tool="firecrawl",
                                cost=self.firecrawl_cost,
                                latency_ms=fc_latency2,
                                success=fc_err2 is None and bool(fc_res2),
                                new_facts=len(fc_res2["attributes"]) if fc_res2 else 0,
                                error=str(fc_err2) if fc_err2 else None,
                                meta={"attempts": fc_attempts2, "url": target_url},
                            )
                        )

        merge_stats = self._run_semantic_merge(snippet_buffer, target_limit=self.merge_limit)
        merged_snippets = merge_stats["merged"]

        extracted_facts = self._run_fact_extractor(merged_snippets, identifier, entity_type, budget_remaining)
        if extracted_facts:
            aggregated_attrs.setdefault("structured_facts", "see extracted_facts")

        baseline = {}
        if compare_without_enrichment and enrichment_used:
            # Lightweight control: Brave only with raw identifier
            base_brave = self._run_brave(identifier, entity_type)
            baseline = {"attributes": base_brave.attributes, "urls": base_brave.urls}

        return {
            "attributes": aggregated_attrs,
            "extracted_facts": extracted_facts,
            "sources": sources,
            "cost_spent": self.max_cost - budget_remaining,
            "budget_remaining": budget_remaining,
            "telemetry": self.telemetry.summary(),
            "needs_human": self._needs_human(aggregated_attrs, entity_type),
            "enrichment_used": enrichment_used,
            "enrichment_info": enrichment_info,
            "baseline": baseline,
            "merge_stats": merge_stats,
        }

    def _run_brave(self, identifier: str, entity_type: Optional[str]) -> SearchResult:
        data = self.brave.collect(identifier, entity_type)
        attrs = data.get("attributes", {})
        urls = data.get("urls", [])
        trust = 0.5
        for u in urls:
            trust = max(trust, self.domain_trust.score(u))
        return SearchResult(attributes=attrs, source="brave_search", cost=self.brave_cost, trust=trust, urls=urls)

    def _merge_attributes(
        self, agg: Dict[str, str], seen: Set[str], new_attrs: Dict[str, str], content_type: Optional[str] = None
    ) -> None:
        clean_attrs = sanitize_attributes(new_attrs, max_len=4000, content_type=content_type)
        for k, v in clean_attrs.items():
            if v in seen:
                continue
            if k not in agg:
                agg[k] = v
                seen.add(v)

    def _rank_urls(self, urls: List[str]) -> List[str]:
        deduped = list(dict.fromkeys(urls))
        return sorted(deduped, key=lambda u: self.domain_trust.score(u), reverse=True)

    def _run_fact_extractor(
        self, snippets: List[Dict[str, str]], entity: str, entity_type: Optional[str], budget_remaining: float
    ) -> Dict:
        if not snippets:
            return {}
        max_chars = int(float(os.getenv("FACT_EXTRACT_MAX_CHARS", "12000")))
        text_parts = []
        total = 0
        for snip in snippets:
            t = snip.get("snippet", "")
            if not t:
                continue
            if total + len(t) > max_chars:
                t = t[: max_chars - total]
            text_parts.append(t)
            total += len(t)
            if total >= max_chars:
                break
        text = "\n\n".join(text_parts)
        if not text.strip():
            return {}
        facts = self.extractor.extract(text=text, entity=entity, entity_type=entity_type)
        if facts:
            # Approximate LLM cost for telemetry at $0.03 (adjust as needed).
            self.telemetry.record(
                ToolCall(tool="llm_fact_extract", cost=0.03, latency_ms=None, success=True, new_facts=sum(len(v) for v in facts.values()))
            )
        return facts

    def _run_semantic_merge(self, snippets: List[Dict[str, str]], target_limit: int) -> Dict[str, object]:
        merged_info = self.merger.merge(snippets, limit=target_limit)
        self.telemetry.record(
            ToolCall(
                tool="semantic_merge",
                cost=0.0,
                latency_ms=None,
                success=True,
                new_facts=merged_info.get("output_count", 0),
                error=None,
                meta={
                    "input_count": merged_info.get("input_count"),
                    "output_count": merged_info.get("output_count"),
                    "dropped": merged_info.get("dropped"),
                    "threshold": merged_info.get("threshold"),
                    "target_limit": target_limit,
                    "snippet_limit": self.snippet_limit,
                },
            )
        )
        return merged_info

    def _needs_human(self, attrs: Dict[str, str], entity_type: Optional[str]) -> bool:
        if entity_type != "Person":
            return False
        mandatory = ["summary"]
        for m in mandatory:
            if m not in attrs:
                return True
        return False

    def _retry_collect(self, func, tool: str):
        """
        Lightweight retry wrapper to avoid hard failures on flaky sources.
        Returns (result, error, attempts_used, latency_ms).
        """
        last_exc: Optional[Exception] = None
        last_latency_ms: Optional[float] = None
        for attempt in range(self.retry_attempts):
            start = time.monotonic()
            try:
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(func)
                    result = future.result(timeout=self.per_source_timeout)
                last_latency_ms = (time.monotonic() - start) * 1000.0
                return result, None, attempt + 1, last_latency_ms
            except TimeoutError as exc:
                last_exc = exc
                last_latency_ms = (time.monotonic() - start) * 1000.0
                logger.warning("%s attempt %s timed out after %.2f ms", tool, attempt + 1, last_latency_ms)
            except Exception as exc:
                last_exc = exc
                last_latency_ms = (time.monotonic() - start) * 1000.0
                logger.warning("%s attempt %s failed: %s", tool, attempt + 1, exc)
        return None, last_exc, self.retry_attempts, last_latency_ms

    @staticmethod
    def _can_afford(budget_remaining: float, cost: float) -> bool:
        return budget_remaining >= cost


# Placeholder Firecrawl wrapper for future integration
class FirecrawlScraper:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def scrape(self, url: str) -> Dict:
        raise NotImplementedError("Firecrawl integration not yet implemented")
