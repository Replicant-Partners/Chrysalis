/**
 * Agent Protocols Component
 * 
 * Manages protocol configurations (MCP, A2A, Agent Protocol).
 * 
 * Single Responsibility: Protocol configuration and management
 */

import { Protocols, MCPServer, AgentCard, AuthConfig } from '../UniformSemanticAgentV2';

/**
 * Agent Protocols Manager
 */
export class AgentProtocols {
  private data: Protocols;

  constructor(data?: Partial<Protocols>) {
    this.data = {
      mcp: data?.mcp || {
        enabled: false,
        role: 'client',
        servers: [],
        tools: [],
      },
      a2a: data?.a2a,
      agent_protocol: data?.agent_protocol,
    };
  }

  // ============================================================================
  // MCP Protocol
  // ============================================================================

  /**
   * Enable MCP protocol
   */
  enableMCP(role: 'client' | 'server' | 'both' = 'client'): void {
    if (!this.data.mcp) {
      this.data.mcp = { enabled: true, role, servers: [], tools: [] };
    } else {
      this.data.mcp.enabled = true;
      this.data.mcp.role = role;
    }
  }

  /**
   * Disable MCP protocol
   */
  disableMCP(): void {
    if (this.data.mcp) {
      this.data.mcp.enabled = false;
    }
  }

  /**
   * Add MCP server
   */
  addMCPServer(server: MCPServer): void {
    if (!this.data.mcp) {
      this.enableMCP();
    }
    const existing = this.data.mcp!.servers.findIndex(s => s.name === server.name);
    if (existing !== -1) {
      this.data.mcp!.servers[existing] = server;
    } else {
      this.data.mcp!.servers.push(server);
    }
  }

  /**
   * Remove MCP server
   */
  removeMCPServer(name: string): void {
    if (this.data.mcp) {
      this.data.mcp.servers = this.data.mcp.servers.filter(s => s.name !== name);
    }
  }

  /**
   * Add MCP tool
   */
  addMCPTool(tool: string): void {
    if (!this.data.mcp) {
      this.enableMCP();
    }
    if (!this.data.mcp!.tools.includes(tool)) {
      this.data.mcp!.tools.push(tool);
    }
  }

  // ============================================================================
  // A2A Protocol
  // ============================================================================

  /**
   * Enable A2A protocol
   */
  enableA2A(config: {
    role: 'client' | 'server' | 'both';
    endpoint: string;
    agent_card: AgentCard;
    authentication: AuthConfig;
  }): void {
    this.data.a2a = {
      enabled: true,
      role: config.role,
      endpoint: config.endpoint,
      agent_card: config.agent_card,
      authentication: config.authentication,
      peers: [],
    };
  }

  /**
   * Disable A2A protocol
   */
  disableA2A(): void {
    if (this.data.a2a) {
      this.data.a2a.enabled = false;
    }
  }

  /**
   * Add A2A peer
   */
  addA2APeer(peer: string): void {
    if (this.data.a2a && !this.data.a2a.peers.includes(peer)) {
      this.data.a2a.peers.push(peer);
    }
  }

  /**
   * Remove A2A peer
   */
  removeA2APeer(peer: string): void {
    if (this.data.a2a) {
      this.data.a2a.peers = this.data.a2a.peers.filter(p => p !== peer);
    }
  }

  // ============================================================================
  // Agent Protocol
  // ============================================================================

  /**
   * Enable Agent Protocol
   */
  enableAgentProtocol(config: {
    endpoint: string;
    capabilities: string[];
    task_types: string[];
  }): void {
    this.data.agent_protocol = {
      enabled: true,
      endpoint: config.endpoint,
      capabilities: config.capabilities,
      task_types: config.task_types,
    };
  }

  /**
   * Disable Agent Protocol
   */
  disableAgentProtocol(): void {
    if (this.data.agent_protocol) {
      this.data.agent_protocol.enabled = false;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get enabled protocols
   */
  getEnabledProtocols(): string[] {
    const enabled: string[] = [];
    if (this.data.mcp?.enabled) enabled.push('mcp');
    if (this.data.a2a?.enabled) enabled.push('a2a');
    if (this.data.agent_protocol?.enabled) enabled.push('agent_protocol');
    return enabled;
  }

  /**
   * Check if any protocol is enabled
   */
  hasEnabledProtocol(): boolean {
    return this.getEnabledProtocols().length > 0;
  }

  /**
   * Get protocol summary
   */
  getSummary(): {
    mcp: { enabled: boolean; servers: number; tools: number };
    a2a: { enabled: boolean; peers: number };
    agent_protocol: { enabled: boolean; capabilities: number };
  } {
    return {
      mcp: {
        enabled: this.data.mcp?.enabled || false,
        servers: this.data.mcp?.servers.length || 0,
        tools: this.data.mcp?.tools.length || 0,
      },
      a2a: {
        enabled: this.data.a2a?.enabled || false,
        peers: this.data.a2a?.peers.length || 0,
      },
      agent_protocol: {
        enabled: this.data.agent_protocol?.enabled || false,
        capabilities: this.data.agent_protocol?.capabilities.length || 0,
      },
    };
  }

  // Getters
  get mcp(): Protocols['mcp'] { return this.data.mcp; }
  get a2a(): Protocols['a2a'] { return this.data.a2a; }
  get agentProtocol(): Protocols['agent_protocol'] { return this.data.agent_protocol; }

  toData(): Protocols {
    return { ...this.data };
  }
}

export function validateProtocols(data: unknown): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Protocols must be an object'], warnings };
  }
  
  const protocols = data as Protocols;
  
  // Check if at least one protocol is enabled
  const hasEnabled = 
    protocols.mcp?.enabled ||
    protocols.a2a?.enabled ||
    protocols.agent_protocol?.enabled;
  
  if (!hasEnabled) {
    warnings.push('No protocols enabled - agent may not be functional');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}
