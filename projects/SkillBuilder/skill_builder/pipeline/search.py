"""
Search backend abstraction for SkillBuilder.

Semantic Requirements (from docs/architecture/overview.md):
- HTTP fast path (web_search_backend: http): Tavily + Brave direct APIs
- MCP stdio (web_search_backend: mcp): VS Code-style mcp.json servers
- Auto (web_search_backend: auto): try MCP, fall back to HTTP

Design Patterns:
- Strategy: SearchProvider interface with concrete implementations
- Factory: create_search_backend() selects provider based on config
- Adapter: Each HTTP provider adapts vendor API to common SearchResult
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional, Protocol, Sequence
from urllib.parse import urlencode

import httpx

from semantic_mode.pipeline.models import (
    FrontendSpec,
    HTTPProvider,
    SearchBackend,
    SearchHit,
    SearchResult,
)
from semantic_mode.pipeline.sanitizer import (
    compute_trust_score,
    sanitize_web_content,
    BLOCKED_DOMAINS,
)
from semantic_mode.pipeline.telemetry import (
    TelemetryEvent,
    TelemetryWriter,
    event_backend_selected,
    event_query_start,
    event_query_done,
    event_tool_ok,
    event_tool_error,
)


# =============================================================================
# Search Provider Protocol (Strategy Interface)
# =============================================================================

class SearchProvider(Protocol):
    """Protocol for search backend implementations.
    
    Strategy Pattern: All providers implement the same interface.
    """
    
    @property
    def name(self) -> str:
        """Provider identifier for telemetry."""
        ...
    
    def search(self, query: str, max_results: int = 10) -> SearchResult:
        """Execute search and return results.
        
        Must sanitize results before returning.
        """
        ...
    
    def is_available(self) -> bool:
        """Check if provider is configured and ready."""
        ...


# =============================================================================
# HTTP Provider Implementations
# =============================================================================

class TavilyProvider:
    """Tavily Search API provider.
    
    Semantic Requirement: HTTP fast path provider.
    Environment: TAVILY_API_KEY
    """
    
    name = "tavily"
    _base_url = "https://api.tavily.com/search"
    
    def __init__(self, api_key: Optional[str] = None, timeout: float = 30.0):
        self._api_key = api_key or os.environ.get("TAVILY_API_KEY", "")
        self._timeout = timeout
        self._client = httpx.Client(timeout=timeout)
    
    def is_available(self) -> bool:
        return bool(self._api_key)
    
    def search(self, query: str, max_results: int = 10) -> SearchResult:
        """Execute Tavily search."""
        if not self.is_available():
            return SearchResult(
                query=query,
                hits=(),
                provider=self.name,
                raw_count=0,
                error="TAVILY_API_KEY not set",
            )
        
        start = time.perf_counter()
        
        try:
            response = self._client.post(
                self._base_url,
                json={
                    "api_key": self._api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": max_results,
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            response.raise_for_status()
            data = response.json()
            
            raw_results = data.get("results", [])
            hits = self._transform_results(raw_results)
            
            return SearchResult(
                query=query,
                hits=hits,
                provider=self.name,
                raw_count=len(raw_results),
                duration_ms=(time.perf_counter() - start) * 1000,
            )
            
        except httpx.HTTPError as e:
            return SearchResult(
                query=query,
                hits=(),
                provider=self.name,
                raw_count=0,
                duration_ms=(time.perf_counter() - start) * 1000,
                error=str(e),
            )
    
    def _transform_results(self, raw_results: list[dict[str, Any]]) -> tuple[SearchHit, ...]:
        """Transform Tavily results to SearchHit, with sanitization."""
        hits = []
        
        for r in raw_results:
            url = r.get("url", "")
            domain = _extract_domain(url)
            
            # Skip blocked domains
            if any(blocked in domain.lower() for blocked in BLOCKED_DOMAINS):
                continue
            
            # Sanitize snippet
            snippet_result = sanitize_web_content(r.get("content", ""))
            
            hit = SearchHit(
                title=r.get("title", ""),
                url=url,
                snippet=snippet_result.text,
                score=r.get("score", 0.0),
                domain=domain,
                provider=self.name,
            )
            hits.append(hit)
        
        return tuple(hits)


class BraveProvider:
    """Brave Search API provider.
    
    Semantic Requirement: HTTP fast path provider.
    Environment: BRAVE_API_KEY
    """
    
    name = "brave"
    _base_url = "https://api.search.brave.com/res/v1/web/search"
    
    def __init__(self, api_key: Optional[str] = None, timeout: float = 30.0):
        self._api_key = api_key or os.environ.get("BRAVE_API_KEY", "")
        self._timeout = timeout
        self._client = httpx.Client(timeout=timeout)
    
    def is_available(self) -> bool:
        return bool(self._api_key)
    
    def search(self, query: str, max_results: int = 10) -> SearchResult:
        """Execute Brave search."""
        if not self.is_available():
            return SearchResult(
                query=query,
                hits=(),
                provider=self.name,
                raw_count=0,
                error="BRAVE_API_KEY not set",
            )
        
        start = time.perf_counter()
        
        try:
            response = self._client.get(
                self._base_url,
                params={"q": query, "count": max_results},
                headers={
                    "X-Subscription-Token": self._api_key,
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
            
            raw_results = data.get("web", {}).get("results", [])
            hits = self._transform_results(raw_results)
            
            return SearchResult(
                query=query,
                hits=hits,
                provider=self.name,
                raw_count=len(raw_results),
                duration_ms=(time.perf_counter() - start) * 1000,
            )
            
        except httpx.HTTPError as e:
            return SearchResult(
                query=query,
                hits=(),
                provider=self.name,
                raw_count=0,
                duration_ms=(time.perf_counter() - start) * 1000,
                error=str(e),
            )
    
    def _transform_results(self, raw_results: list[dict[str, Any]]) -> tuple[SearchHit, ...]:
        """Transform Brave results to SearchHit, with sanitization."""
        hits = []
        
        for r in raw_results:
            url = r.get("url", "")
            domain = _extract_domain(url)
            
            # Skip blocked domains
            if any(blocked in domain.lower() for blocked in BLOCKED_DOMAINS):
                continue
            
            # Sanitize description
            snippet_result = sanitize_web_content(r.get("description", ""))
            
            hit = SearchHit(
                title=r.get("title", ""),
                url=url,
                snippet=snippet_result.text,
                score=0.0,  # Brave doesn't provide scores
                domain=domain,
                provider=self.name,
            )
            hits.append(hit)
        
        return tuple(hits)


# =============================================================================
# Composite Search Backend
# =============================================================================

@dataclass
class CompositeSearchBackend:
    """Aggregates multiple search providers with fallback.
    
    Semantic Requirement: Backend flexibility with fallback.
    
    Behavior:
    - Queries all available providers in parallel (future: async)
    - Deduplicates results by URL
    - Ranks by trust score and provider priority
    """
    
    providers: tuple[SearchProvider, ...]
    telemetry: TelemetryWriter
    
    def search(
        self,
        query: str,
        max_results: int = 10,
        stage: int = 1
    ) -> SearchResult:
        """Execute search across all providers.
        
        Deduplicates and ranks results.
        """
        all_hits: list[SearchHit] = []
        raw_count = 0
        start = time.perf_counter()
        errors: list[str] = []
        per_provider_metrics: dict[str, dict[str, float | int | str | None]] = defaultdict(dict)
        
        # Query each provider
        for provider in self.providers:
            if not provider.is_available():
                continue
            
            self.telemetry.emit(event_query_start(query, stage, provider.name))
            
            provider_start = time.perf_counter()
            result = provider.search(query, max_results)
            provider_duration_ms = (time.perf_counter() - provider_start) * 1000
            per_provider_metrics[provider.name] = {
                "duration_ms": provider_duration_ms,
                "raw_count": result.raw_count,
                "kept": len(result.hits),
                "status": "error" if result.error else "ok",
            }
            
            if result.error:
                self.telemetry.emit(event_tool_error("search", provider.name, result.error))
                errors.append(f"{provider.name}: {result.error}")
            else:
                self.telemetry.emit(event_tool_ok("search", provider.name, len(result.hits)))
                all_hits.extend(result.hits)
                raw_count += result.raw_count
        
        # Deduplicate by URL
        unique_hits = _deduplicate_hits(all_hits)
        
        # Sort by trust score
        ranked_hits = sorted(
            unique_hits,
            key=lambda h: compute_trust_score(h.domain, h.title, h.snippet),
            reverse=True,
        )
        
        # Limit to max_results
        final_hits = tuple(ranked_hits[:max_results])
        duration_ms = (time.perf_counter() - start) * 1000
        
        # Emit aggregated result telemetry
        self.telemetry.emit(event_query_done(
            query=query,
            hits_total=raw_count,
            hits_kept=len(final_hits),
            duration_ms=duration_ms,
            provider="composite",
        ))

        # Emit per-provider metrics
        for pname, metrics in per_provider_metrics.items():
            self.telemetry.emit(TelemetryEvent(
                event_type="search.provider.metrics",
                data={
                    "provider": pname,
                    "duration_ms": metrics.get("duration_ms", 0.0),
                    "raw_count": metrics.get("raw_count", 0),
                    "kept": metrics.get("kept", 0),
                    "status": metrics.get("status", "unknown"),
                    "dedupe_placeholder": {
                        "trust_distribution": "TODO: compute trust histogram",
                        "dedupe_count": metrics.get("raw_count", 0) - metrics.get("kept", 0),
                    },
                },
            ))
        
        error_msg = "; ".join(errors) if errors else None
        
        return SearchResult(
            query=query,
            hits=final_hits,
            provider="composite",
            raw_count=raw_count,
            duration_ms=duration_ms,
            error=None if final_hits else error_msg,  # Only error if no results
        )


# =============================================================================
# Factory Functions
# =============================================================================

def create_http_providers(
    provider_list: Sequence[HTTPProvider],
) -> tuple[SearchProvider, ...]:
    """Create HTTP provider instances from config.
    
    Factory Pattern: Creates concrete providers from enum config.
    """
    providers: list[SearchProvider] = []
    
    for p in provider_list:
        if p == HTTPProvider.TAVILY:
            providers.append(TavilyProvider())
        elif p == HTTPProvider.BRAVE:
            providers.append(BraveProvider())
    
    return tuple(providers)


def create_search_backend(
    spec: FrontendSpec,
    telemetry: TelemetryWriter,
) -> CompositeSearchBackend:
    """Create search backend based on spec configuration.
    
    Factory Pattern: Selects and configures backend based on spec.
    
    Semantic Requirement: web_search_backend selection.
    - HTTP: Direct HTTP providers only
    - MCP: MCP servers only (not implemented in this version)
    - AUTO: Try MCP, fall back to HTTP
    """
    backend = spec.web_search_backend
    
    # For now, we only implement HTTP fast path
    # MCP support would be added here with similar structure
    
    if backend == SearchBackend.HTTP:
        providers = create_http_providers(spec.http_search_providers)
        telemetry.emit(event_backend_selected("http", "configured as http backend"))
        
    elif backend == SearchBackend.AUTO:
        # AUTO: would check MCP first, then fall back to HTTP
        # For now, just use HTTP
        providers = create_http_providers(spec.http_search_providers)
        telemetry.emit(event_backend_selected("http", "auto fallback to http (mcp not available)"))
        
    else:  # MCP
        # MCP not implemented yet - fall back to HTTP with warning
        providers = create_http_providers(spec.http_search_providers)
        telemetry.emit(event_backend_selected(
            "http",
            "mcp requested but not implemented, falling back to http",
            fallback=True,
        ))
    
    # Filter to only available providers
    available = tuple(p for p in providers if p.is_available())
    
    if not available:
        # No providers available - this will produce errors on search
        telemetry.emit(event_tool_error(
            "backend_init",
            "none",
            "No search providers available (check API keys)",
        ))
    
    return CompositeSearchBackend(providers=available, telemetry=telemetry)


# =============================================================================
# Utility Functions
# =============================================================================

def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    import re
    match = re.match(r"https?://([^/]+)", url)
    return match.group(1) if match else ""


def _deduplicate_hits(hits: Sequence[SearchHit]) -> list[SearchHit]:
    """Deduplicate search hits by URL.
    
    Keeps the first occurrence (assumed to be from higher-priority provider).
    """
    seen_urls: set[str] = set()
    unique: list[SearchHit] = []
    
    for hit in hits:
        if hit.url not in seen_urls:
            seen_urls.add(hit.url)
            unique.append(hit)
    
    return unique


def expand_query_template(
    template: str,
    name: str,
    field: str = "",
    **kwargs: str
) -> str:
    """Expand a query template with variables.
    
    Supported variables: {name}, {field}, plus any additional kwargs.
    """
    return template.format(
        name=name,
        field=field,
        **kwargs,
    )
