"""
MCPAgentMixin: Provides MCP integration capabilities to LeatherLadder agents.

This mixin enables any agent (Mr. Shoe Leather, Research Agent, etc.) to:
- Discover and request new MCP servers dynamically
- Query available capabilities
- Add new servers as needed during investigations
- Check server availability before making requests
"""

from typing import Dict, List, Optional, Any
from src.mcp_integration import MCPServerManager, MCPServerConfig


class MCPAgentMixin:
    """
    Mixin class providing MCP server integration capabilities to agents.

    Any agent class can inherit from this mixin to gain the ability to
    dynamically discover, add, and use MCP servers during their operations.

    Example:
        >>> class MrShoeLeatherAgent(MCPAgentMixin):
        ...     def __init__(self, mcp_manager):
        ...         super().__init__(mcp_manager)
        ...         self.name = "Mr. Shoe Leather"
        ...
        ...     async def investigate_trends(self):
        ...         # Agent automatically finds/adds trend server
        ...         server = await self.request_mcp_capability("trending_topics")
        ...         if server:
        ...             # Use server for investigation
        ...             trends = await self.query_mcp_server(server, {...})
    """

    def __init__(self, mcp_manager: MCPServerManager):
        """
        Initialize MCPAgentMixin.

        Args:
            mcp_manager: MCPServerManager instance for server management
        """
        self.mcp_manager = mcp_manager
        self.available_capabilities = set()
        self._update_capabilities()

    def _update_capabilities(self):
        """Update available capabilities from enabled MCP servers."""
        self.available_capabilities.clear()

        for server in self.mcp_manager.list_servers(enabled_only=True):
            self.available_capabilities.update(server.capabilities)

        print(
            f"📡 Agent has access to {len(self.available_capabilities)} MCP capabilities"
        )

    async def request_mcp_capability(
        self, capability: str, server_type: Optional[str] = None, auto_add: bool = True
    ) -> Optional[MCPServerConfig]:
        """
        Request an MCP server with a specific capability.

        This is the primary method agents use to access MCP servers. The method:
        1. Checks if an existing server has the capability
        2. If not found and auto_add=True, discovers and adds a new server
        3. Returns the server configuration for use

        Args:
            capability: Required capability (e.g., "trending_topics", "news_search")
            server_type: Preferred server type (e.g., "trends", "news")
            auto_add: Automatically discover and add server if not found

        Returns:
            MCPServerConfig if found/added, None if unavailable

        Example:
            >>> # Agent needs trending topics capability
            >>> server = await agent.request_mcp_capability("trending_topics")
            >>> if server:
            ...     print(f"Using {server.name} for trend analysis")
            ... else:
            ...     print("No trending server available")
        """
        # First, check existing enabled servers
        servers = self.mcp_manager.find_servers_by_capability(capability)

        # Filter by type if specified
        if server_type:
            servers = [s for s in servers if s.server_type == server_type]

        if servers:
            # Return the first matching server
            server = servers[0]
            print(f"✅ Using existing MCP server: {server.name}")
            return server

        # No existing server found
        if not auto_add:
            print(f"❌ No MCP server with capability '{capability}' found")
            return None

        # Attempt to discover and add new server
        print(f"🔍 Discovering MCP servers with capability: {capability}")

        try:
            discovered = await self.mcp_manager.discover_servers(query=capability)

            # Find best matching server from discovery results
            for server_data in discovered:
                server_caps = server_data.get("capabilities", [])
                if capability in server_caps:
                    # Filter by type if specified
                    if server_type and server_data.get("type") != server_type:
                        continue

                    # Add this server
                    config = await self.mcp_manager.add_server(
                        name=server_data.get("name", f"discovered-{capability}"),
                        server_type=server_data.get("type", "unknown"),
                        endpoint=server_data["endpoint"],
                        capabilities=server_caps,
                        metadata=server_data.get("metadata", {}),
                    )

                    print(f"✅ Agent added new MCP server: {config.name}")
                    self._update_capabilities()
                    return config

        except Exception as e:
            print(f"❌ Failed to discover MCP servers: {e}")

        print(f"❌ No MCP server found with capability: {capability}")
        return None

    def has_capability(self, capability: str) -> bool:
        """
        Check if any enabled MCP server provides a capability.

        Args:
            capability: Capability to check

        Returns:
            True if capability is available, False otherwise

        Example:
            >>> if agent.has_capability("trending_topics"):
            ...     trends = await agent.analyze_trends()
        """
        return capability in self.available_capabilities

    def list_capabilities(
        self, server_type: Optional[str] = None
    ) -> Dict[str, List[str]]:
        """
        List all available capabilities, optionally filtered by server type.

        Args:
            server_type: Optional filter by server type

        Returns:
            Dictionary mapping capability names to list of servers providing it

        Example:
            >>> capabilities = agent.list_capabilities(server_type="trends")
            >>> for cap, servers in capabilities.items():
            ...     print(f"{cap}: {[s.name for s in servers]}")
        """
        capabilities: Dict[str, List[MCPServerConfig]] = {}

        for server in self.mcp_manager.list_servers(
            server_type=server_type, enabled_only=True
        ):
            for capability in server.capabilities:
                if capability not in capabilities:
                    capabilities[capability] = []
                capabilities[capability].append(server)

        return capabilities

    async def add_mcp_server(
        self,
        name: str,
        server_type: str,
        endpoint: str,
        api_key: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
    ) -> Optional[MCPServerConfig]:
        """
        Manually add an MCP server (agent-initiated).

        Agents can use this method to explicitly add a known MCP server
        rather than using the automatic discovery process.

        Args:
            name: Server name
            server_type: Server type (trends, news, social, data)
            endpoint: MCP endpoint URL
            api_key: Optional API key
            capabilities: List of capabilities (auto-detected if None)

        Returns:
            MCPServerConfig if successful, None otherwise

        Example:
            >>> # Agent learned about a custom MCP server
            >>> config = await agent.add_mcp_server(
            ...     name="custom-trends",
            ...     server_type="trends",
            ...     endpoint="mcp://custom-server",
            ...     capabilities=["trending_topics", "trend_analysis"]
            ... )
        """
        try:
            config = await self.mcp_manager.add_server(
                name=name,
                server_type=server_type,
                endpoint=endpoint,
                api_key=api_key,
                capabilities=capabilities,
                auto_detect=capabilities is None,
            )

            self._update_capabilities()
            print(f"✅ Agent successfully added MCP server: {name}")
            return config

        except Exception as e:
            print(f"❌ Agent failed to add MCP server '{name}': {e}")
            return None

    def get_servers_by_type(self, server_type: str) -> List[MCPServerConfig]:
        """
        Get all enabled servers of a specific type.

        Args:
            server_type: Server type to filter by

        Returns:
            List of enabled servers of the specified type

        Example:
            >>> trend_servers = agent.get_servers_by_type("trends")
            >>> print(f"Agent has access to {len(trend_servers)} trend servers")
        """
        return self.mcp_manager.list_servers(
            server_type=server_type, enabled_only=True
        )

    async def query_mcp_server(
        self, server: MCPServerConfig, query_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Query an MCP server (placeholder for actual MCP protocol implementation).

        This method should be overridden or extended with actual MCP protocol
        communication logic based on the specific MCP server being queried.

        Args:
            server: MCPServerConfig for the server to query
            query_data: Query parameters specific to the server/capability

        Returns:
            Response data from the MCP server

        Example:
            >>> server = await agent.request_mcp_capability("trending_topics")
            >>> if server:
            ...     response = await agent.query_mcp_server(
            ...         server,
            ...         {"query": "artificial intelligence", "limit": 10}
            ...     )
            ...     trends = response.get("trends", [])
        """
        # TODO: Implement actual MCP protocol communication
        # This is a placeholder that should be replaced with real MCP client logic
        print(f"🔧 Querying MCP server: {server.name}")
        print(f"   Endpoint: {server.endpoint}")
        print(f"   Query: {query_data}")

        return {
            "status": "not_implemented",
            "message": "MCP protocol communication not yet implemented",
            "server": server.name,
        }

    def refresh_capabilities(self):
        """
        Refresh the agent's view of available MCP capabilities.

        Call this after external changes to MCP server configuration.
        """
        self._update_capabilities()

    def __repr__(self) -> str:
        """String representation of agent's MCP integration."""
        return (
            f"MCPAgentMixin("
            f"capabilities={len(self.available_capabilities)}, "
            f"servers={len(self.mcp_manager.list_servers())})"
        )
