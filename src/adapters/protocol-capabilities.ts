/**
 * Chrysalis Protocol Capabilities
 * 
 * Capability declarations and feature compatibility definitions
 * for multi-protocol agent framework support.
 * 
 * @module adapters/protocol-capabilities
 * @version 1.0.0
 * @see {@link ../plans/phase-1a-enhanced-type-system-spec.md}
 */

import { AgentFramework, PROTOCOL_METADATA, ProtocolMaturity } from './protocol-types';

// ============================================================================
// Protocol Features
// ============================================================================

/**
 * Protocol feature enumeration.
 * 
 * Covers all capabilities across supported protocols:
 * - MCP: tools, resources, prompts, sampling
 * - A2A: tasks, streaming, push notifications, skills
 * - ANP: DID, discovery, meta-protocol
 * - ACP: enterprise messaging, audit logging
 */
export type ProtocolFeature = 
  // Discovery & Identity
  | 'agent-discovery'           // Find agents by capability
  | 'capability-advertisement'  // Publish agent capabilities
  | 'identity-verification'     // Verify agent identity
  | 'did-resolution'            // W3C DID resolution (ANP)
  | 'agent-card'                // A2A-style agent card
  // Task Management
  | 'task-delegation'           // Delegate tasks to other agents
  | 'task-streaming'            // Stream task progress
  | 'task-cancellation'         // Cancel running tasks
  | 'task-history'              // Access task state history
  | 'multi-turn-conversation'   // Multi-turn conversational tasks
  | 'push-notifications'        // Push notifications for task updates
  // Tool Operations
  | 'tool-invocation'           // Invoke remote tools
  | 'tool-list'                 // List available tools
  | 'tool-schema-validation'    // JSON Schema validation for tools
  | 'dynamic-tools'             // Tools that can be added/removed at runtime
  // Resource Operations
  | 'resource-access'           // Access external resources
  | 'resource-subscription'     // Subscribe to resource changes
  | 'resource-templates'        // URI template support
  // Prompt Operations
  | 'prompt-templates'          // Parameterized prompt templates
  | 'prompt-arguments'          // Prompt arguments support
  // Communication Patterns
  | 'synchronous-request'       // Request/response pattern
  | 'asynchronous-callback'     // Callback-based async
  | 'server-sent-events'        // SSE streaming
  | 'websocket-streaming'       // WebSocket communication
  | 'http-transport'            // HTTP transport
  | 'stdio-transport'           // Standard I/O transport
  // Security & Authentication
  | 'oauth2-authentication'     // OAuth 2.0 flows
  | 'jwt-authentication'        // JWT-based auth
  | 'api-key-authentication'    // API key auth
  | 'did-authentication'        // DID-based auth (ANP)
  | 'mtls'                      // Mutual TLS
  // Advanced Features
  | 'capability-negotiation'    // Negotiate capabilities at runtime
  | 'protocol-translation'      // Translate between protocols
  | 'experience-sync'           // Sync experiences across instances
  | 'audit-logging'             // Enterprise audit logging
  | 'rate-limiting'             // Rate limiting support
  // Observability
  | 'distributed-tracing'       // Distributed tracing support
  | 'logging'                   // Structured logging
  | 'metrics'                   // Metrics export
  // Multi-Agent
  | 'agent-handoff'             // Hand off tasks to other agents
  | 'agent-collaboration'       // Multi-agent collaboration
  | 'orchestration';            // Agent orchestration support

// ============================================================================
// Capability Levels
// ============================================================================

/**
 * Capability implementation level.
 */
export type CapabilityLevel = 
  | 'full'        // Complete implementation
  | 'partial'     // Subset of feature implemented
  | 'read-only'   // Can consume but not produce
  | 'experimental'// Unstable implementation
  | 'planned'     // Not yet implemented but planned
  | 'unsupported';// Will not be implemented

// ============================================================================
// Protocol Capability Declaration
// ============================================================================

/**
 * Protocol capability declaration.
 * 
 * Describes what a protocol adapter can do.
 */
export interface ProtocolCapability {
  /** Protocol identifier */
  protocol: AgentFramework;
  /** Adapter version */
  adapterVersion: string;
  /** Protocol specification version supported */
  specVersion: string;
  /** Overall capability level */
  level: CapabilityLevel;
  /** Specific features supported */
  features: FeatureDeclaration[];
  /** Known limitations */
  limitations?: string[];
  /** Dependencies on other protocols */
  dependencies?: AgentFramework[];
}

/**
 * Individual feature declaration.
 */
export interface FeatureDeclaration {
  /** Feature identifier */
  feature: ProtocolFeature;
  /** Implementation level */
  level: CapabilityLevel;
  /** Feature version (if applicable) */
  version?: string;
  /** Feature-specific configuration */
  config?: Record<string, unknown>;
  /** Notes about the implementation */
  notes?: string;
}

// ============================================================================
// Feature Compatibility
// ============================================================================

/**
 * Feature compatibility between protocols.
 */
export interface FeatureCompatibility {
  /** Source protocol */
  sourceProtocol: AgentFramework;
  /** Target protocol */
  targetProtocol: AgentFramework;
  /** Feature being compared */
  feature: ProtocolFeature;
  /** Compatibility result */
  compatibility: CompatibilityResult;
  /** Translation fidelity (0.0 - 1.0) */
  translationFidelity?: number;
  /** Notes about compatibility */
  notes?: string;
}

/**
 * Compatibility result.
 */
export type CompatibilityResult = 
  | 'native'        // Direct support in both protocols
  | 'translated'    // Can be translated via Chrysalis
  | 'partial'       // Some aspects work
  | 'degraded'      // Works but with loss of functionality
  | 'unsupported';  // Cannot interoperate

// ============================================================================
// Protocol Capability Registry
// ============================================================================

/**
 * Default capability declarations for each protocol.
 * 
 * Based on protocol specifications as of January 2026.
 */
export const PROTOCOL_CAPABILITIES: Record<AgentFramework, ProtocolCapability> = {
  // === Chrysalis Uniform Semantic Agent ===
  usa: {
    protocol: 'usa',
    adapterVersion: '1.0.0',
    specVersion: '2.0.0',
    level: 'full',
    features: [
      { feature: 'experience-sync', level: 'full' },
      { feature: 'protocol-translation', level: 'full' },
      { feature: 'capability-negotiation', level: 'full' },
      { feature: 'agent-discovery', level: 'full' },
      { feature: 'identity-verification', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'orchestration', level: 'full' },
      { feature: 'distributed-tracing', level: 'full' }
    ]
  },

  // === Anthropic Model Context Protocol ===
  mcp: {
    protocol: 'mcp',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'full',
    features: [
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'tool-list', level: 'full' },
      { feature: 'tool-schema-validation', level: 'full' },
      { feature: 'resource-access', level: 'full' },
      { feature: 'resource-subscription', level: 'full' },
      { feature: 'resource-templates', level: 'full' },
      { feature: 'prompt-templates', level: 'full' },
      { feature: 'prompt-arguments', level: 'full' },
      { feature: 'stdio-transport', level: 'full' },
      { feature: 'http-transport', level: 'full' },
      { feature: 'server-sent-events', level: 'full' },
      { feature: 'logging', level: 'full' },
      { feature: 'synchronous-request', level: 'full' }
    ],
    limitations: [
      'No native agent discovery',
      'No native task management',
      'Single client-server model'
    ]
  },

  // === Google Agent-to-Agent Protocol ===
  a2a: {
    protocol: 'a2a',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'full',
    features: [
      { feature: 'task-delegation', level: 'full' },
      { feature: 'task-streaming', level: 'full' },
      { feature: 'task-cancellation', level: 'full' },
      { feature: 'task-history', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'push-notifications', level: 'full' },
      { feature: 'agent-card', level: 'full' },
      { feature: 'capability-advertisement', level: 'full' },
      { feature: 'agent-discovery', level: 'partial', notes: 'Via agent cards' },
      { feature: 'http-transport', level: 'full' },
      { feature: 'server-sent-events', level: 'full' },
      { feature: 'oauth2-authentication', level: 'full' },
      { feature: 'jwt-authentication', level: 'full' },
      { feature: 'api-key-authentication', level: 'full' },
      { feature: 'synchronous-request', level: 'full' },
      { feature: 'asynchronous-callback', level: 'full' }
    ],
    limitations: [
      'No native tool protocol (uses external)',
      'Agent discovery requires well-known URLs'
    ]
  },

  // === Agent Network Protocol ===
  anp: {
    protocol: 'anp',
    adapterVersion: '1.0.0',
    specVersion: '0.9.0',
    level: 'partial',
    features: [
      { feature: 'did-resolution', level: 'full' },
      { feature: 'did-authentication', level: 'full' },
      { feature: 'identity-verification', level: 'full' },
      { feature: 'agent-discovery', level: 'full' },
      { feature: 'capability-advertisement', level: 'full' },
      { feature: 'capability-negotiation', level: 'full' },
      { feature: 'http-transport', level: 'full' },
      { feature: 'websocket-streaming', level: 'partial' }
    ],
    limitations: [
      'Specification still evolving',
      'Limited SDK support',
      'No native task management'
    ]
  },

  // === IBM Agent Communication Protocol ===
  acp: {
    protocol: 'acp',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'partial',
    features: [
      { feature: 'audit-logging', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'agent-collaboration', level: 'full' },
      { feature: 'http-transport', level: 'full' },
      { feature: 'oauth2-authentication', level: 'full' },
      { feature: 'rate-limiting', level: 'full' },
      { feature: 'metrics', level: 'full' }
    ],
    limitations: [
      'Enterprise-focused, limited public documentation',
      'BeeAI framework dependency'
    ]
  },

  // === OpenAI Agents SDK ===
  'openai-agents': {
    protocol: 'openai-agents',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'full',
    features: [
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'tool-list', level: 'full' },
      { feature: 'tool-schema-validation', level: 'full' },
      { feature: 'agent-handoff', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'distributed-tracing', level: 'full' },
      { feature: 'http-transport', level: 'full' },
      { feature: 'synchronous-request', level: 'full' },
      { feature: 'asynchronous-callback', level: 'full' }
    ],
    limitations: [
      'OpenAI API dependency',
      'No cross-vendor support'
    ]
  },

  // === LangChain ===
  langchain: {
    protocol: 'langchain',
    adapterVersion: '1.0.0',
    specVersion: '0.3.0',
    level: 'full',
    features: [
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'tool-list', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'orchestration', level: 'full' },
      { feature: 'agent-collaboration', level: 'partial' },
      { feature: 'distributed-tracing', level: 'full', notes: 'Via LangSmith' },
      { feature: 'logging', level: 'full' }
    ]
  },

  // === CrewAI ===
  crewai: {
    protocol: 'crewai',
    adapterVersion: '1.0.0',
    specVersion: '0.95.0',
    level: 'full',
    features: [
      { feature: 'agent-collaboration', level: 'full' },
      { feature: 'orchestration', level: 'full' },
      { feature: 'task-delegation', level: 'full' },
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' }
    ]
  },

  // === Microsoft AutoGen ===
  autogen: {
    protocol: 'autogen',
    adapterVersion: '1.0.0',
    specVersion: '0.4.0',
    level: 'full',
    features: [
      { feature: 'agent-collaboration', level: 'full' },
      { feature: 'orchestration', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'distributed-tracing', level: 'partial' }
    ]
  },

  // === Eclipse LMOS ===
  lmos: {
    protocol: 'lmos',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'partial',
    features: [
      { feature: 'agent-discovery', level: 'full' },
      { feature: 'capability-advertisement', level: 'full' },
      { feature: 'http-transport', level: 'full' },
      { feature: 'audit-logging', level: 'full' },
      { feature: 'metrics', level: 'full' }
    ],
    limitations: [
      'Enterprise-focused',
      'Eclipse ecosystem dependency'
    ]
  },

  // === OpenAI Function Calling (Legacy) ===
  openai: {
    protocol: 'openai',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'full',
    features: [
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'tool-schema-validation', level: 'full' },
      { feature: 'synchronous-request', level: 'full' },
      { feature: 'http-transport', level: 'full' }
    ]
  },

  // === AutoGPT ===
  autogpt: {
    protocol: 'autogpt',
    adapterVersion: '1.0.0',
    specVersion: '0.5.0',
    level: 'partial',
    features: [
      { feature: 'orchestration', level: 'full' },
      { feature: 'tool-invocation', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' }
    ]
  },

  // === Microsoft Semantic Kernel ===
  'semantic-kernel': {
    protocol: 'semantic-kernel',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'full',
    features: [
      { feature: 'tool-invocation', level: 'full', notes: 'Plugins' },
      { feature: 'orchestration', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'distributed-tracing', level: 'full' }
    ]
  },

  // === AGNTCY ===
  agntcy: {
    protocol: 'agntcy',
    adapterVersion: '1.0.0',
    specVersion: '0.1.0',
    level: 'experimental',
    features: [
      { feature: 'agent-discovery', level: 'experimental' },
      { feature: 'capability-advertisement', level: 'experimental' },
      { feature: 'http-transport', level: 'full' }
    ],
    limitations: [
      'Very early stage',
      'Specification may change significantly'
    ]
  },

  // === FIPA (Foundation for Intelligent Physical Agents) ===
  fipa: {
    protocol: 'fipa',
    adapterVersion: '1.0.0',
    specVersion: '1.0.0',
    level: 'partial',
    features: [
      { feature: 'agent-discovery', level: 'full' },
      { feature: 'capability-advertisement', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'task-delegation', level: 'full' },
      { feature: 'agent-collaboration', level: 'full' },
      { feature: 'synchronous-request', level: 'full' },
      { feature: 'asynchronous-callback', level: 'full' }
    ],
    limitations: [
      'Legacy standard (IEEE SC00061)',
      'Limited modern tooling',
      'No native streaming support'
    ]
  },

  // === JADE (Java Agent Development Framework) ===
  jade: {
    protocol: 'jade',
    adapterVersion: '1.0.0',
    specVersion: '4.6.0',
    level: 'partial',
    features: [
      { feature: 'agent-discovery', level: 'full', notes: 'Via DF (Directory Facilitator)' },
      { feature: 'capability-advertisement', level: 'full' },
      { feature: 'multi-turn-conversation', level: 'full' },
      { feature: 'task-delegation', level: 'full' },
      { feature: 'agent-collaboration', level: 'full' },
      { feature: 'synchronous-request', level: 'full' },
      { feature: 'asynchronous-callback', level: 'full' },
      { feature: 'distributed-tracing', level: 'partial' }
    ],
    limitations: [
      'Java-only implementation',
      'FIPA ACL message format',
      'Older architecture patterns',
      'Limited cloud-native support'
    ]
  },

  // === ROS2 (Robot Operating System 2) ===
  ros2: {
    protocol: 'ros2',
    adapterVersion: '1.0.0',
    specVersion: 'humble',
    level: 'partial',
    features: [
      { feature: 'agent-discovery', level: 'full', notes: 'Via DDS discovery' },
      { feature: 'capability-advertisement', level: 'full' },
      { feature: 'task-delegation', level: 'partial', notes: 'Via action servers' },
      { feature: 'synchronous-request', level: 'full', notes: 'Services' },
      { feature: 'asynchronous-callback', level: 'full', notes: 'Topics/subscribers' },
      { feature: 'distributed-tracing', level: 'partial' },
      { feature: 'logging', level: 'full' },
      { feature: 'metrics', level: 'full' }
    ],
    limitations: [
      'Robotics-focused design',
      'DDS middleware dependency',
      'Complex deployment model',
      'Not designed for general agent communication'
    ]
  }
};

// ============================================================================
// Capability Query Functions
// ============================================================================

/**
 * Get capability declaration for a protocol.
 */
export function getProtocolCapability(protocol: AgentFramework): ProtocolCapability {
  return PROTOCOL_CAPABILITIES[protocol];
}

/**
 * Check if a protocol supports a specific feature.
 */
export function supportsFeature(
  protocol: AgentFramework,
  feature: ProtocolFeature
): boolean {
  const capability = PROTOCOL_CAPABILITIES[protocol];
  return capability.features.some(
    f => f.feature === feature && f.level !== 'unsupported' && f.level !== 'planned'
  );
}

/**
 * Get the implementation level for a feature.
 */
export function getFeatureLevel(
  protocol: AgentFramework,
  feature: ProtocolFeature
): CapabilityLevel {
  const capability = PROTOCOL_CAPABILITIES[protocol];
  const featureDecl = capability.features.find(f => f.feature === feature);
  return featureDecl?.level ?? 'unsupported';
}

/**
 * Get all features supported by a protocol.
 */
export function getSupportedFeatures(protocol: AgentFramework): ProtocolFeature[] {
  const capability = PROTOCOL_CAPABILITIES[protocol];
  return capability.features
    .filter(f => f.level !== 'unsupported' && f.level !== 'planned')
    .map(f => f.feature);
}

/**
 * Get protocols that support a specific feature.
 */
export function getProtocolsWithFeature(
  feature: ProtocolFeature,
  minLevel: CapabilityLevel = 'partial'
): AgentFramework[] {
  const levelOrder: CapabilityLevel[] = ['full', 'partial', 'read-only', 'experimental', 'planned', 'unsupported'];
  const minLevelIndex = levelOrder.indexOf(minLevel);
  
  return Object.entries(PROTOCOL_CAPABILITIES)
    .filter(([_, cap]) => {
      const featureDecl = cap.features.find(f => f.feature === feature);
      if (!featureDecl) return false;
      const featureLevelIndex = levelOrder.indexOf(featureDecl.level);
      return featureLevelIndex <= minLevelIndex;
    })
    .map(([protocol]) => protocol as AgentFramework);
}

/**
 * Get common features between two protocols.
 */
export function getCommonFeatures(
  protocolA: AgentFramework,
  protocolB: AgentFramework
): ProtocolFeature[] {
  const featuresA = getSupportedFeatures(protocolA);
  const featuresB = getSupportedFeatures(protocolB);
  return featuresA.filter(f => featuresB.includes(f));
}

/**
 * Calculate feature overlap percentage between two protocols.
 */
export function calculateFeatureOverlap(
  protocolA: AgentFramework,
  protocolB: AgentFramework
): number {
  const featuresA = getSupportedFeatures(protocolA);
  const featuresB = getSupportedFeatures(protocolB);
  const common = getCommonFeatures(protocolA, protocolB);
  const total = new Set([...featuresA, ...featuresB]).size;
  return total > 0 ? common.length / total : 0;
}

// ============================================================================
// Feature Compatibility Matrix
// ============================================================================

/**
 * Get compatibility between two protocols for a specific feature.
 */
export function getFeatureCompatibility(
  sourceProtocol: AgentFramework,
  targetProtocol: AgentFramework,
  feature: ProtocolFeature
): FeatureCompatibility {
  const sourceLevel = getFeatureLevel(sourceProtocol, feature);
  const targetLevel = getFeatureLevel(targetProtocol, feature);
  
  let compatibility: CompatibilityResult;
  let fidelity: number;
  
  if (sourceLevel === 'unsupported' || targetLevel === 'unsupported') {
    compatibility = 'unsupported';
    fidelity = 0;
  } else if (sourceLevel === 'full' && targetLevel === 'full') {
    compatibility = 'native';
    fidelity = 1.0;
  } else if (sourceLevel === 'full' && targetLevel === 'partial') {
    compatibility = 'degraded';
    fidelity = 0.7;
  } else if (sourceLevel === 'partial' && targetLevel === 'full') {
    compatibility = 'translated';
    fidelity = 0.8;
  } else if (sourceLevel === 'partial' && targetLevel === 'partial') {
    compatibility = 'partial';
    fidelity = 0.5;
  } else {
    compatibility = 'translated';
    fidelity = 0.6;
  }
  
  return {
    sourceProtocol,
    targetProtocol,
    feature,
    compatibility,
    translationFidelity: fidelity
  };
}

/**
 * Get all feature compatibilities between two protocols.
 */
export function getAllFeatureCompatibilities(
  sourceProtocol: AgentFramework,
  targetProtocol: AgentFramework
): FeatureCompatibility[] {
  const allFeatures = new Set([
    ...getSupportedFeatures(sourceProtocol),
    ...getSupportedFeatures(targetProtocol)
  ]);
  
  return Array.from(allFeatures).map(feature =>
    getFeatureCompatibility(sourceProtocol, targetProtocol, feature)
  );
}

/**
 * Calculate overall translation fidelity between two protocols.
 */
export function calculateTranslationFidelity(
  sourceProtocol: AgentFramework,
  targetProtocol: AgentFramework
): number {
  const compatibilities = getAllFeatureCompatibilities(sourceProtocol, targetProtocol);
  if (compatibilities.length === 0) return 0;
  
  const totalFidelity = compatibilities.reduce(
    (sum, c) => sum + (c.translationFidelity ?? 0),
    0
  );
  return totalFidelity / compatibilities.length;
}

// ============================================================================
// Capability Recommendations
// ============================================================================

/**
 * Get recommended protocol for a set of required features.
 */
export function getRecommendedProtocol(
  requiredFeatures: ProtocolFeature[],
  preferredMaturity: ProtocolMaturity = 'production'
): AgentFramework | null {
  const candidates = Object.entries(PROTOCOL_CAPABILITIES)
    .filter(([protocol, cap]) => {
      // Check maturity
      const metadata = PROTOCOL_METADATA[protocol as AgentFramework];
      if (preferredMaturity === 'production' && metadata.maturity !== 'production') {
        return false;
      }
      // Check all required features
      return requiredFeatures.every(feature =>
        cap.features.some(f => f.feature === feature && f.level !== 'unsupported')
      );
    })
    .map(([protocol, cap]) => {
      // Score by coverage and level
      const score = cap.features
        .filter(f => requiredFeatures.includes(f.feature))
        .reduce((sum, f) => {
          switch (f.level) {
            case 'full': return sum + 1.0;
            case 'partial': return sum + 0.7;
            case 'read-only': return sum + 0.5;
            case 'experimental': return sum + 0.3;
            default: return sum;
          }
        }, 0);
      return { protocol: protocol as AgentFramework, score };
    })
    .sort((a, b) => b.score - a.score);
  
  return candidates.length > 0 ? candidates[0].protocol : null;
}

/**
 * Get protocol combination for comprehensive feature coverage.
 */
export function getProtocolCombination(
  requiredFeatures: ProtocolFeature[]
): AgentFramework[] {
  const coverage: Map<ProtocolFeature, AgentFramework> = new Map();
  const selected: Set<AgentFramework> = new Set();
  
  // Greedy algorithm: pick protocol with most uncovered features
  while (coverage.size < requiredFeatures.length) {
    let bestProtocol: AgentFramework | null = null;
    let bestCoverage = 0;
    
    for (const [protocol, cap] of Object.entries(PROTOCOL_CAPABILITIES)) {
      const uncovered = requiredFeatures.filter(f => !coverage.has(f));
      const covers = uncovered.filter(f =>
        cap.features.some(fd => fd.feature === f && fd.level !== 'unsupported')
      );
      
      if (covers.length > bestCoverage) {
        bestCoverage = covers.length;
        bestProtocol = protocol as AgentFramework;
      }
    }
    
    if (!bestProtocol || bestCoverage === 0) break;
    
    selected.add(bestProtocol);
    const cap = PROTOCOL_CAPABILITIES[bestProtocol];
    for (const feature of requiredFeatures) {
      if (cap.features.some(f => f.feature === feature && f.level !== 'unsupported')) {
        coverage.set(feature, bestProtocol);
      }
    }
  }
  
  return Array.from(selected);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  PROTOCOL_CAPABILITIES,
  getProtocolCapability,
  supportsFeature,
  getFeatureLevel,
  getSupportedFeatures,
  getProtocolsWithFeature,
  getCommonFeatures,
  calculateFeatureOverlap,
  getFeatureCompatibility,
  getAllFeatureCompatibilities,
  calculateTranslationFidelity,
  getRecommendedProtocol,
  getProtocolCombination
};
