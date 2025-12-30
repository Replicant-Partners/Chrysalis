"""
Mr. Shoe Leather - AI Investigative Reporter Agent

An autonomous investigative journalism agent that:
- Monitors trending topics across news and social media
- Conducts structured reporter-style investigations
- Dynamically discovers and integrates MCP servers for new data sources
- Coordinates with other agents (Research, Fact-Checker, Writer, Editor)
- Generates synthetic news articles with fact-checking and source attribution

Named after "shoe-leather reporting" - traditional on-the-ground investigative journalism.
"""

from typing import Dict, List, Optional, Any
from src.mcp_integration import MCPServerManager
from src.agents.mcp_agent_mixin import MCPAgentMixin


class MrShoeLeatherAgent(MCPAgentMixin):
    """
    Mr. Shoe Leather - Chief investigative reporter agent.

    This agent serves as the orchestrator for synthetic journalism,
    leveraging MCP servers to access trending data and coordinating
    a team of specialized sub-agents for investigation and writing.

    Example:
        >>> from src.mcp_integration import MCPServerManager
        >>> mcp_manager = MCPServerManager()
        >>> shoe_leather = MrShoeLeatherAgent(mcp_manager)
        >>> trends = await shoe_leather.investigate_trending_topics()
        >>> article = await shoe_leather.generate_article(trends[0])
    """

    def __init__(
        self,
        mcp_manager: MCPServerManager,
        name: str = "Mr. Shoe Leather",
        llm_model: str = "llama3.2",
    ):
        """
        Initialize Mr. Shoe Leather agent.

        Args:
            mcp_manager: MCPServerManager for dynamic MCP integration
            name: Agent name (default: "Mr. Shoe Leather")
            llm_model: LLM model to use for reasoning (default: llama3.2)
        """
        super().__init__(mcp_manager)

        self.name = name
        self.llm_model = llm_model
        self.investigation_history: List[Dict[str, Any]] = []
        self.active_investigations: Dict[str, Dict[str, Any]] = {}

        print(f"👞 {self.name} initialized with model: {llm_model}")
        print(f"📡 Available capabilities: {len(self.available_capabilities)}")

    async def investigate_trending_topics(
        self, limit: int = 10, min_score: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Investigate current trending topics using MCP servers.

        This method:
        1. Requests trending_topics capability from MCP servers
        2. If not available, discovers and adds appropriate servers
        3. Queries servers for current trends
        4. Scores and filters trends by relevance

        Args:
            limit: Maximum number of trends to return
            min_score: Minimum trend score threshold (0.0-1.0)

        Returns:
            List of trending topic dictionaries with scores and metadata

        Example:
            >>> trends = await shoe_leather.investigate_trending_topics(limit=5)
            >>> for trend in trends:
            ...     print(f"{trend['topic']}: {trend['score']}")
        """
        print(f"\n🔍 {self.name}: Investigating trending topics...")

        # Request trending_topics capability
        trends_server = await self.request_mcp_capability(
            capability="trending_topics", server_type="trends"
        )

        if not trends_server:
            print(f"❌ {self.name}: Cannot investigate - no trending data source")
            return []

        print(f"✅ {self.name}: Using {trends_server.name} for trend analysis")

        # Query the MCP server for trends
        # (Placeholder - actual implementation depends on MCP protocol)
        query_data = {"limit": limit, "min_score": min_score, "time_window": "24h"}

        try:
            response = await self.query_mcp_server(trends_server, query_data)

            # Extract trends from response
            # (This is a placeholder structure - adapt to actual MCP response format)
            trends = response.get("trends", [])

            print(f"📊 {self.name}: Found {len(trends)} trending topics")

            # Score and filter trends
            scored_trends = self._score_trends(trends)
            filtered_trends = [t for t in scored_trends if t["score"] >= min_score]

            return filtered_trends[:limit]

        except Exception as e:
            print(f"❌ {self.name}: Failed to fetch trends: {e}")
            return []

    def _score_trends(self, trends: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Score trends based on newsworthiness criteria.

        Scoring factors:
        - Velocity: How quickly the trend is growing
        - Volume: Total mentions/engagement
        - Recency: How recent the trend is
        - Diversity: Spread across multiple sources
        - Relevance: Match to target topics/categories

        Args:
            trends: List of raw trend data from MCP servers

        Returns:
            Trends with added 'score' field (0.0-1.0)
        """
        # Placeholder scoring logic
        # TODO: Implement sophisticated trend scoring algorithm
        for trend in trends:
            # Simple placeholder score based on volume
            volume = trend.get("volume", 0)
            trend["score"] = min(volume / 10000, 1.0)

        # Sort by score descending
        trends.sort(key=lambda t: t["score"], reverse=True)

        return trends

    async def start_investigation(self, topic: str) -> str:
        """
        Start a new investigation on a topic.

        Creates an investigation record and initiates the multi-agent
        investigation process (Research → Interview → Fact-Check → Write → Edit).

        Args:
            topic: Topic to investigate

        Returns:
            Investigation ID for tracking

        Example:
            >>> investigation_id = await shoe_leather.start_investigation(
            ...     "AI regulation in EU"
            ... )
            >>> print(f"Started investigation: {investigation_id}")
        """
        import uuid

        investigation_id = str(uuid.uuid4())[:8]

        print(f"\n📰 {self.name}: Starting investigation '{investigation_id}'")
        print(f"   Topic: {topic}")

        self.active_investigations[investigation_id] = {
            "id": investigation_id,
            "topic": topic,
            "status": "initiated",
            "phase": "research",
            "findings": [],
            "sources": [],
            "questions": [],
            "article_draft": None,
        }

        return investigation_id

    async def discover_data_sources(self, topic: str) -> List[MCPServerConfig]:
        """
        Dynamically discover MCP servers relevant to investigation topic.

        The agent analyzes the topic and searches for relevant MCP servers
        to enhance its investigation capabilities.

        Args:
            topic: Investigation topic

        Returns:
            List of discovered relevant MCP servers

        Example:
            >>> servers = await shoe_leather.discover_data_sources(
            ...     "cryptocurrency regulation"
            ... )
            >>> print(f"Found {len(servers)} relevant data sources")
        """
        print(f"\n🔎 {self.name}: Discovering data sources for '{topic}'...")

        # Extract keywords from topic for search
        keywords = self._extract_keywords(topic)

        discovered_servers = []
        for keyword in keywords:
            # Discover servers related to each keyword
            servers = await self.mcp_manager.discover_servers(query=keyword)

            for server_data in servers:
                # Check if server is relevant and not already added
                if self._is_server_relevant(server_data, topic):
                    try:
                        config = await self.add_mcp_server(
                            name=server_data.get("name", f"{keyword}-server"),
                            server_type=server_data.get("type", "data"),
                            endpoint=server_data["endpoint"],
                            capabilities=server_data.get("capabilities", []),
                        )

                        if config:
                            discovered_servers.append(config)
                            print(f"   ✅ Added: {config.name}")

                    except Exception as e:
                        print(f"   ⚠️  Failed to add {server_data['name']}: {e}")

        print(
            f"📡 {self.name}: Discovered {len(discovered_servers)} new data sources"
        )
        return discovered_servers

    def _extract_keywords(self, text: str) -> List[str]:
        """
        Extract keywords from text for MCP server discovery.

        Args:
            text: Text to extract keywords from

        Returns:
            List of keywords
        """
        # Simple keyword extraction (TODO: Use NLP for better extraction)
        words = text.lower().split()
        # Remove common stop words
        stop_words = {"the", "a", "an", "in", "on", "at", "for", "to", "of", "and"}
        keywords = [w for w in words if w not in stop_words]
        return keywords[:5]  # Top 5 keywords

    def _is_server_relevant(self, server_data: Dict[str, Any], topic: str) -> bool:
        """
        Determine if an MCP server is relevant to investigation topic.

        Args:
            server_data: MCP server metadata
            topic: Investigation topic

        Returns:
            True if server is relevant, False otherwise
        """
        # Simple relevance check based on description and capabilities
        description = server_data.get("description", "").lower()
        capabilities = server_data.get("capabilities", [])

        topic_words = set(topic.lower().split())

        # Check if any topic words appear in description or capabilities
        for word in topic_words:
            if word in description or any(word in cap for cap in capabilities):
                return True

        return False

    async def generate_article(
        self, investigation_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a synthetic news article from investigation findings.

        Coordinates with Writer and Editor agents to produce the final article.

        Args:
            investigation_id: ID of completed investigation

        Returns:
            Article dictionary with content, metadata, and sources

        Example:
            >>> article = await shoe_leather.generate_article(investigation_id)
            >>> if article:
            ...     print(article['headline'])
            ...     print(article['body'])
        """
        investigation = self.active_investigations.get(investigation_id)

        if not investigation:
            print(f"❌ {self.name}: Investigation '{investigation_id}' not found")
            return None

        print(f"\n✍️  {self.name}: Generating article for '{investigation['topic']}'")

        # TODO: Coordinate with Writer and Editor agents
        # For now, return placeholder structure

        article = {
            "investigation_id": investigation_id,
            "topic": investigation["topic"],
            "headline": f"Investigation: {investigation['topic']}",
            "subheadline": "A synthetic journalism piece by Mr. Shoe Leather",
            "byline": f"By {self.name} (AI Reporter)",
            "body": "Article content would be generated here...",
            "sources": investigation.get("sources", []),
            "confidence_score": 0.85,
            "fact_check_status": "pending",
            "generated_by": "ai",
            "disclosure": "This article was generated by AI with human oversight.",
        }

        return article

    def get_investigation_status(
        self, investigation_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get the status of an active investigation.

        Args:
            investigation_id: Investigation ID

        Returns:
            Investigation status dictionary or None if not found
        """
        return self.active_investigations.get(investigation_id)

    def list_active_investigations(self) -> List[Dict[str, Any]]:
        """
        List all active investigations.

        Returns:
            List of investigation status dictionaries
        """
        return list(self.active_investigations.values())

    def __repr__(self) -> str:
        """String representation of Mr. Shoe Leather."""
        return (
            f"MrShoeLeatherAgent("
            f"name='{self.name}', "
            f"model='{self.llm_model}', "
            f"active_investigations={len(self.active_investigations)}, "
            f"capabilities={len(self.available_capabilities)})"
        )
