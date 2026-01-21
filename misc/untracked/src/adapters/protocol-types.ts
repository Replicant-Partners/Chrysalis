/**
 * Chrysalis Protocol Types
 * 
 * Extended type definitions for multi-protocol agent framework support.
 * Provides backward-compatible extensions to the existing AgentFramework type.
 * 
 * @module adapters/protocol-types
 * @version 1.0.0
 * @see {@link ../plans/phase-1a-enhanced-type-system-spec.md}
 */

// ============================================================================
// Extended Agent Framework Type
// ============================================================================

/**
 * Extended AgentFramework enumeration supporting all target protocols.
 * 
 * Backward compatible - all existing values preserved.
 * New protocols added for comprehensive multi-protocol support.
 */
export type AgentFramework =
  // === Existing (unchanged for backward compatibility) ===
  | 'usa'             // Chrysalis Uniform Semantic Agent
  | 'lmos'            // Eclipse LMOS Protocol
  | 'mcp'             // Anthropic Model Context Protocol
  | 'langchain'       // LangChain Agent
  | 'openai'          // OpenAI Function Calling (legacy)
  | 'autogpt'         // AutoGPT
  | 'semantic-kernel' // Microsoft Semantic Kernel
  // === New Protocols (Phase 1A) ===
  | 'a2a'             // Google Agent2Agent Protocol
  | 'anp'             // Agent Network Protocol
  | 'acp'             // IBM Agent Communication Protocol
  | 'openai-agents'   // OpenAI Agents SDK (distinct from legacy 'openai')
  | 'crewai'          // CrewAI Framework
  | 'autogen'         // Microsoft AutoGen
  | 'agntcy'          // AGNTCY Discovery Layer (Linux Foundation)
  // === Legacy/Research Protocols ===
  | 'fipa'            // FIPA ACL (Foundation for Intelligent Physical Agents)
  | 'jade'            // JADE (Java Agent DEvelopment Framework)
  | 'ros2';           // ROS2 (Robot Operating System 2)

/**
 * Legacy AgentFramework type alias for backward compatibility.
 * Use AgentFramework for new code.
 * @deprecated Use AgentFramework instead
 */
export type LegacyAgentFramework = 
  | 'usa'
  | 'lmos'
  | 'mcp'
  | 'langchain'
  | 'openai'
  | 'autogpt'
  | 'semantic-kernel';

/**
 * New protocols added in Phase 1A.
 */
export type NewAgentFramework =
  | 'a2a'
  | 'anp'
  | 'acp'
  | 'openai-agents'
  | 'crewai'
  | 'autogen'
  | 'agntcy';

// ============================================================================
// Protocol Family Classification
// ============================================================================

/**
 * Protocol family groupings for capability matching and routing.
 * 
 * Protocols are grouped by their primary function:
 * - tool-protocol: Extends agent capabilities with external tools
 * - coordination-protocol: Enables agent-to-agent coordination
 * - identity-protocol: Provides decentralized identity and trust
 * - enterprise-protocol: Enterprise-grade messaging and audit
 * - orchestration-framework: Multi-agent orchestration and workflow
 */
export type ProtocolFamily = 
  | 'tool-protocol'          // MCP, OpenAI function calling
  | 'coordination-protocol'  // A2A, AGNTCY
  | 'identity-protocol'      // ANP
  | 'enterprise-protocol'    // ACP, LMOS
  | 'orchestration-framework'; // LangChain, CrewAI, AutoGen, USA

/**
 * Map frameworks to their protocol families.
 * Used for capability routing and compatibility checking.
 */
export const PROTOCOL_FAMILIES: Record<AgentFramework, ProtocolFamily> = {
  // Orchestration frameworks
  usa: 'orchestration-framework',
  langchain: 'orchestration-framework',
  autogpt: 'orchestration-framework',
  crewai: 'orchestration-framework',
  autogen: 'orchestration-framework',
  'semantic-kernel': 'orchestration-framework',
  
  // Tool protocols
  mcp: 'tool-protocol',
  openai: 'tool-protocol',
  'openai-agents': 'tool-protocol',
  
  // Coordination protocols
  a2a: 'coordination-protocol',
  agntcy: 'coordination-protocol',
  fipa: 'coordination-protocol',
  jade: 'coordination-protocol',
  ros2: 'coordination-protocol',
  
  // Identity protocols
  anp: 'identity-protocol',
  
  // Enterprise protocols
  lmos: 'enterprise-protocol',
  acp: 'enterprise-protocol'
};

// ============================================================================
// Protocol Metadata
// ============================================================================

/**
 * Protocol metadata including official documentation and SDK references.
 */
export interface ProtocolMetadata {
  /** Protocol identifier */
  framework: AgentFramework;
  /** Human-readable name */
  displayName: string;
  /** Protocol family */
  family: ProtocolFamily;
  /** Official specification URL */
  specificationUrl?: string;
  /** Official SDK repository */
  sdkRepository?: string;
  /** Organization/maintainer */
  maintainer: string;
  /** Protocol maturity level */
  maturity: ProtocolMaturity;
  /** Year of initial release */
  releaseYear: number;
  /** License type */
  license?: string;
}

/**
 * Protocol maturity levels.
 */
export type ProtocolMaturity = 
  | 'production'   // Stable, widely adopted
  | 'beta'         // Feature complete, testing
  | 'alpha'        // Early development
  | 'experimental' // Research/proof of concept
  | 'deprecated';  // Being phased out

/**
 * Protocol metadata registry.
 * Contains metadata for all supported protocols.
 */
export const PROTOCOL_METADATA: Record<AgentFramework, ProtocolMetadata> = {
  usa: {
    framework: 'usa',
    displayName: 'Uniform Semantic Agent',
    family: 'orchestration-framework',
    maintainer: 'Chrysalis',
    maturity: 'production',
    releaseYear: 2024,
    license: 'Apache-2.0'
  },
  lmos: {
    framework: 'lmos',
    displayName: 'Eclipse LMOS',
    family: 'enterprise-protocol',
    specificationUrl: 'https://eclipse.dev/lmos/',
    sdkRepository: 'https://github.com/eclipse-lmos',
    maintainer: 'Eclipse Foundation',
    maturity: 'beta',
    releaseYear: 2024,
    license: 'EPL-2.0'
  },
  mcp: {
    framework: 'mcp',
    displayName: 'Model Context Protocol',
    family: 'tool-protocol',
    specificationUrl: 'https://modelcontextprotocol.io/',
    sdkRepository: 'https://github.com/modelcontextprotocol',
    maintainer: 'Anthropic',
    maturity: 'production',
    releaseYear: 2024,
    license: 'MIT'
  },
  langchain: {
    framework: 'langchain',
    displayName: 'LangChain',
    family: 'orchestration-framework',
    specificationUrl: 'https://langchain.com/',
    sdkRepository: 'https://github.com/langchain-ai/langchain',
    maintainer: 'LangChain Inc.',
    maturity: 'production',
    releaseYear: 2022,
    license: 'MIT'
  },
  openai: {
    framework: 'openai',
    displayName: 'OpenAI Function Calling',
    family: 'tool-protocol',
    specificationUrl: 'https://platform.openai.com/docs/guides/function-calling',
    maintainer: 'OpenAI',
    maturity: 'production',
    releaseYear: 2023,
    license: 'Proprietary'
  },
  autogpt: {
    framework: 'autogpt',
    displayName: 'AutoGPT',
    family: 'orchestration-framework',
    sdkRepository: 'https://github.com/Significant-Gravitas/AutoGPT',
    maintainer: 'Significant Gravitas',
    maturity: 'beta',
    releaseYear: 2023,
    license: 'MIT'
  },
  'semantic-kernel': {
    framework: 'semantic-kernel',
    displayName: 'Microsoft Semantic Kernel',
    family: 'orchestration-framework',
    specificationUrl: 'https://learn.microsoft.com/semantic-kernel/',
    sdkRepository: 'https://github.com/microsoft/semantic-kernel',
    maintainer: 'Microsoft',
    maturity: 'production',
    releaseYear: 2023,
    license: 'MIT'
  },
  a2a: {
    framework: 'a2a',
    displayName: 'Agent-to-Agent Protocol',
    family: 'coordination-protocol',
    specificationUrl: 'https://a2aprotocol.ai/',
    sdkRepository: 'https://github.com/a2aproject/a2a-python',
    maintainer: 'Google / Linux Foundation',
    maturity: 'production',
    releaseYear: 2025,
    license: 'Apache-2.0'
  },
  anp: {
    framework: 'anp',
    displayName: 'Agent Network Protocol',
    family: 'identity-protocol',
    specificationUrl: 'https://agent-network-protocol.com/',
    sdkRepository: 'https://github.com/agent-network-protocol/AgentNetworkProtocol',
    maintainer: 'ANP Community',
    maturity: 'beta',
    releaseYear: 2025,
    license: 'MIT'
  },
  acp: {
    framework: 'acp',
    displayName: 'Agent Communication Protocol',
    family: 'enterprise-protocol',
    sdkRepository: 'https://github.com/i-am-bee/beeai-framework',
    maintainer: 'IBM',
    maturity: 'beta',
    releaseYear: 2025,
    license: 'Apache-2.0'
  },
  'openai-agents': {
    framework: 'openai-agents',
    displayName: 'OpenAI Agents SDK',
    family: 'tool-protocol',
    specificationUrl: 'https://platform.openai.com/docs/guides/agents',
    sdkRepository: 'https://github.com/openai/openai-agents-python',
    maintainer: 'OpenAI',
    maturity: 'production',
    releaseYear: 2025,
    license: 'MIT'
  },
  crewai: {
    framework: 'crewai',
    displayName: 'CrewAI',
    family: 'orchestration-framework',
    specificationUrl: 'https://crewai.com/',
    sdkRepository: 'https://github.com/crewAIInc/crewAI',
    maintainer: 'CrewAI Inc.',
    maturity: 'production',
    releaseYear: 2024,
    license: 'MIT'
  },
  autogen: {
    framework: 'autogen',
    displayName: 'Microsoft AutoGen',
    family: 'orchestration-framework',
    specificationUrl: 'https://microsoft.github.io/autogen/',
    sdkRepository: 'https://github.com/microsoft/autogen',
    maintainer: 'Microsoft',
    maturity: 'production',
    releaseYear: 2023,
    license: 'MIT'
  },
  agntcy: {
    framework: 'agntcy',
    displayName: 'AGNTCY',
    family: 'coordination-protocol',
    specificationUrl: 'https://agntcy.org/',
    sdkRepository: 'https://github.com/agntcy',
    maintainer: 'Linux Foundation',
    maturity: 'alpha',
    releaseYear: 2025,
    license: 'Apache-2.0'
  },
  fipa: {
    framework: 'fipa',
    displayName: 'FIPA ACL',
    family: 'coordination-protocol',
    specificationUrl: 'http://www.fipa.org/specs/',
    maintainer: 'IEEE Computer Society',
    maturity: 'deprecated',
    releaseYear: 2002,
    license: 'Open Standard'
  },
  jade: {
    framework: 'jade',
    displayName: 'JADE Framework',
    family: 'coordination-protocol',
    specificationUrl: 'https://jade.tilab.com/',
    sdkRepository: 'https://jade.tilab.com/dl.php',
    maintainer: 'Telecom Italia',
    maturity: 'deprecated',
    releaseYear: 2000,
    license: 'LGPL'
  },
  ros2: {
    framework: 'ros2',
    displayName: 'ROS 2',
    family: 'coordination-protocol',
    specificationUrl: 'https://docs.ros.org/en/jazzy/',
    sdkRepository: 'https://github.com/ros2/ros2',
    maintainer: 'Open Robotics',
    maturity: 'production',
    releaseYear: 2017,
    license: 'Apache-2.0'
  }
};

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * List of all valid AgentFramework values.
 */
export const ALL_FRAMEWORKS: AgentFramework[] = [
  'usa', 'lmos', 'mcp', 'langchain', 'openai', 'autogpt', 'semantic-kernel',
  'a2a', 'anp', 'acp', 'openai-agents', 'crewai', 'autogen', 'agntcy',
  'fipa', 'jade', 'ros2'
];

/**
 * List of legacy framework values for backward compatibility.
 */
export const LEGACY_FRAMEWORKS: LegacyAgentFramework[] = [
  'usa', 'lmos', 'mcp', 'langchain', 'openai', 'autogpt', 'semantic-kernel'
];

/**
 * List of new framework values added in Phase 1A.
 */
export const NEW_FRAMEWORKS: NewAgentFramework[] = [
  'a2a', 'anp', 'acp', 'openai-agents', 'crewai', 'autogen', 'agntcy'
];

/**
 * Type guard to check if a string is a valid AgentFramework.
 */
export function isAgentFramework(value: string): value is AgentFramework {
  return ALL_FRAMEWORKS.includes(value as AgentFramework);
}

/**
 * Type guard to check if a framework is a legacy framework.
 */
export function isLegacyFramework(framework: AgentFramework): framework is LegacyAgentFramework {
  return LEGACY_FRAMEWORKS.includes(framework as LegacyAgentFramework);
}

/**
 * Type guard to check if a framework is a new framework.
 */
export function isNewFramework(framework: AgentFramework): framework is NewAgentFramework {
  return NEW_FRAMEWORKS.includes(framework as NewAgentFramework);
}

/**
 * Get the protocol family for a framework.
 */
export function getProtocolFamily(framework: AgentFramework): ProtocolFamily {
  return PROTOCOL_FAMILIES[framework];
}

/**
 * Get frameworks by protocol family.
 */
export function getFrameworksByFamily(family: ProtocolFamily): AgentFramework[] {
  return ALL_FRAMEWORKS.filter(f => PROTOCOL_FAMILIES[f] === family);
}

/**
 * Get protocol metadata for a framework.
 */
export function getProtocolMetadata(framework: AgentFramework): ProtocolMetadata {
  return PROTOCOL_METADATA[framework];
}

/**
 * Check if a framework is production-ready.
 */
export function isProductionReady(framework: AgentFramework): boolean {
  return PROTOCOL_METADATA[framework].maturity === 'production';
}

// ============================================================================
// Protocol Compatibility
// ============================================================================

/**
 * Protocol compatibility level between two frameworks.
 */
export type CompatibilityLevel = 
  | 'native'      // Direct communication supported
  | 'translated'  // Requires translation via Chrysalis
  | 'partial'     // Some features work
  | 'incompatible'; // Cannot interoperate

/**
 * Compatibility matrix entry.
 */
export interface CompatibilityEntry {
  source: AgentFramework;
  target: AgentFramework;
  level: CompatibilityLevel;
  notes?: string;
}

/**
 * Get compatibility level between two frameworks.
 * 
 * @param source - Source framework
 * @param target - Target framework
 * @returns Compatibility level
 */
export function getCompatibilityLevel(
  source: AgentFramework,
  target: AgentFramework
): CompatibilityLevel {
  // Same framework is always native
  if (source === target) return 'native';
  
  // All frameworks can be translated via USA canonical format
  const sourceFamily = PROTOCOL_FAMILIES[source];
  const targetFamily = PROTOCOL_FAMILIES[target];
  
  // Same family frameworks have better compatibility
  if (sourceFamily === targetFamily) {
    return 'translated';
  }
  
  // Tool protocols work well with orchestration frameworks
  if (
    (sourceFamily === 'tool-protocol' && targetFamily === 'orchestration-framework') ||
    (sourceFamily === 'orchestration-framework' && targetFamily === 'tool-protocol')
  ) {
    return 'translated';
  }
  
  // Coordination protocols work with most
  if (sourceFamily === 'coordination-protocol' || targetFamily === 'coordination-protocol') {
    return 'translated';
  }
  
  // Identity protocols can augment any framework
  if (sourceFamily === 'identity-protocol' || targetFamily === 'identity-protocol') {
    return 'translated';
  }
  
  // Default to partial compatibility through canonical format
  return 'partial';
}

// ============================================================================
// Exports
// ============================================================================

export default {
  ALL_FRAMEWORKS,
  LEGACY_FRAMEWORKS,
  NEW_FRAMEWORKS,
  PROTOCOL_FAMILIES,
  PROTOCOL_METADATA,
  isAgentFramework,
  isLegacyFramework,
  isNewFramework,
  getProtocolFamily,
  getFrameworksByFamily,
  getProtocolMetadata,
  isProductionReady,
  getCompatibilityLevel
};
