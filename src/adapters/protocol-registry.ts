/**
 * Chrysalis Protocol Version Registry
 * 
 * Centralized registry for protocol version information, compatibility tracking,
 * and semantic versioning utilities for multi-protocol agent framework support.
 * 
 * @module adapters/protocol-registry
 * @version 1.0.0
 * @see {@link ../plans/phase-1a-enhanced-type-system-spec.md}
 */

import { AgentFramework, PROTOCOL_METADATA, ProtocolMaturity } from './protocol-types';

// ============================================================================
// Version Types
// ============================================================================

/**
 * Semantic version components.
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Protocol version information.
 */
export interface ProtocolVersionInfo {
  /** Protocol identifier */
  protocol: AgentFramework;
  /** Current specification version */
  specVersion: string;
  /** Chrysalis adapter version */
  adapterVersion: string;
  /** Minimum supported spec version */
  minSpecVersion: string;
  /** Maximum supported spec version */
  maxSpecVersion: string;
  /** Release date of current spec version */
  specReleaseDate?: string;
  /** Official specification URL */
  specUrl?: string;
  /** Changelog/release notes URL */
  changelogUrl?: string;
  /** Deprecation warnings */
  deprecations?: DeprecationWarning[];
  /** Breaking changes from previous version */
  breakingChanges?: BreakingChange[];
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Deprecation warning.
 */
export interface DeprecationWarning {
  /** Deprecated feature/method */
  feature: string;
  /** Version when deprecated */
  deprecatedInVersion: string;
  /** Version when will be removed */
  removeInVersion?: string;
  /** Replacement recommendation */
  replacement?: string;
  /** Additional notes */
  notes?: string;
}

/**
 * Breaking change record.
 */
export interface BreakingChange {
  /** Version introducing the change */
  version: string;
  /** Description of the change */
  description: string;
  /** Migration guidance */
  migration?: string;
  /** Affected components */
  affected?: string[];
}

/**
 * Version compatibility result.
 */
export interface VersionCompatibility {
  /** Are versions compatible? */
  compatible: boolean;
  /** Compatibility level */
  level: CompatibilityLevel;
  /** Compatibility issues */
  issues?: CompatibilityIssue[];
  /** Upgrade path if incompatible */
  upgradePath?: string[];
}

/**
 * Compatibility level.
 */
export type CompatibilityLevel = 
  | 'full'       // Fully compatible
  | 'backward'   // Backward compatible (older can work with newer)
  | 'forward'    // Forward compatible (newer can work with older)
  | 'partial'    // Partially compatible with known issues
  | 'none';      // Incompatible

/**
 * Compatibility issue.
 */
export interface CompatibilityIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue description */
  description: string;
  /** Affected feature */
  feature?: string;
  /** Workaround if available */
  workaround?: string;
}

// ============================================================================
// Protocol Version Registry Data
// ============================================================================

/**
 * Protocol version registry with current version information.
 * 
 * Data as of January 2026.
 */
export const PROTOCOL_VERSION_REGISTRY: Record<AgentFramework, ProtocolVersionInfo> = {
  // === Chrysalis Uniform Semantic Agent ===
  usa: {
    protocol: 'usa',
    specVersion: '2.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '1.0.0',
    maxSpecVersion: '2.0.0',
    specReleaseDate: '2026-01-01',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === Anthropic Model Context Protocol ===
  mcp: {
    protocol: 'mcp',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.8.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2025-11-01',
    specUrl: 'https://spec.modelcontextprotocol.io',
    changelogUrl: 'https://github.com/modelcontextprotocol/specification/releases',
    lastUpdated: '2026-01-11T00:00:00Z',
    breakingChanges: [
      {
        version: '1.0.0',
        description: 'Sampling API stabilized with changes from preview',
        migration: 'Update sampling request format per 1.0 spec'
      }
    ]
  },

  // === Google Agent-to-Agent Protocol ===
  a2a: {
    protocol: 'a2a',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.9.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2025-04-01',
    specUrl: 'https://google.github.io/A2A/',
    changelogUrl: 'https://github.com/google/A2A/releases',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === Agent Network Protocol ===
  anp: {
    protocol: 'anp',
    specVersion: '0.9.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.5.0',
    maxSpecVersion: '0.9.0',
    specReleaseDate: '2025-12-01',
    specUrl: 'https://agent-network-protocol.com',
    changelogUrl: 'https://github.com/agent-network-protocol/anp-spec/releases',
    lastUpdated: '2026-01-11T00:00:00Z',
    deprecations: [
      {
        feature: 'Legacy discovery format',
        deprecatedInVersion: '0.8.0',
        removeInVersion: '1.0.0',
        replacement: 'Use DID-based discovery'
      }
    ]
  },

  // === IBM Agent Communication Protocol ===
  acp: {
    protocol: 'acp',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.5.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2025-10-01',
    specUrl: 'https://github.com/i-am-bee/acp',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === OpenAI Agents SDK ===
  'openai-agents': {
    protocol: 'openai-agents',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.5.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2025-03-01',
    specUrl: 'https://openai.github.io/openai-agents-python/',
    changelogUrl: 'https://github.com/openai/openai-agents-python/releases',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === LangChain ===
  langchain: {
    protocol: 'langchain',
    specVersion: '0.3.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.2.0',
    maxSpecVersion: '0.3.0',
    specReleaseDate: '2025-09-01',
    specUrl: 'https://python.langchain.com/docs/',
    changelogUrl: 'https://github.com/langchain-ai/langchain/releases',
    lastUpdated: '2026-01-11T00:00:00Z',
    breakingChanges: [
      {
        version: '0.3.0',
        description: 'LCEL as primary composition pattern',
        migration: 'Migrate legacy chains to LCEL'
      }
    ]
  },

  // === CrewAI ===
  crewai: {
    protocol: 'crewai',
    specVersion: '0.95.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.50.0',
    maxSpecVersion: '0.95.0',
    specReleaseDate: '2025-12-01',
    specUrl: 'https://docs.crewai.com',
    changelogUrl: 'https://github.com/joaomdmoura/crewAI/releases',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === Microsoft AutoGen ===
  autogen: {
    protocol: 'autogen',
    specVersion: '0.4.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.3.0',
    maxSpecVersion: '0.4.0',
    specReleaseDate: '2025-11-01',
    specUrl: 'https://microsoft.github.io/autogen/',
    changelogUrl: 'https://github.com/microsoft/autogen/releases',
    lastUpdated: '2026-01-11T00:00:00Z',
    breakingChanges: [
      {
        version: '0.4.0',
        description: 'Complete rewrite with AgentChat API',
        migration: 'Use new AutoGen AgentChat patterns, legacy v0.2 is deprecated'
      }
    ]
  },

  // === Eclipse LMOS ===
  lmos: {
    protocol: 'lmos',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.5.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2025-06-01',
    specUrl: 'https://eclipse.dev/lmos/',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === OpenAI Function Calling (Legacy) ===
  openai: {
    protocol: 'openai',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '1.0.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2023-06-01',
    specUrl: 'https://platform.openai.com/docs/guides/function-calling',
    lastUpdated: '2026-01-11T00:00:00Z',
    deprecations: [
      {
        feature: 'functions parameter',
        deprecatedInVersion: '1.0.0',
        replacement: 'Use tools parameter with type: function'
      }
    ]
  },

  // === AutoGPT ===
  autogpt: {
    protocol: 'autogpt',
    specVersion: '0.5.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.4.0',
    maxSpecVersion: '0.5.0',
    specReleaseDate: '2025-01-01',
    specUrl: 'https://docs.agpt.co',
    changelogUrl: 'https://github.com/Significant-Gravitas/AutoGPT/releases',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === Microsoft Semantic Kernel ===
  'semantic-kernel': {
    protocol: 'semantic-kernel',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.9.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2024-02-01',
    specUrl: 'https://learn.microsoft.com/en-us/semantic-kernel/',
    changelogUrl: 'https://github.com/microsoft/semantic-kernel/releases',
    lastUpdated: '2026-01-11T00:00:00Z'
  },

  // === AGNTCY ===
  agntcy: {
    protocol: 'agntcy',
    specVersion: '0.1.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '0.1.0',
    maxSpecVersion: '0.1.0',
    specReleaseDate: '2025-06-01',
    specUrl: 'https://docs.agntcy.org',
    lastUpdated: '2026-01-11T00:00:00Z',
    deprecations: [
      {
        feature: 'All APIs',
        deprecatedInVersion: '0.1.0',
        notes: 'Specification is in early development, expect breaking changes'
      }
    ]
  },

  // === FIPA (Foundation for Intelligent Physical Agents) ===
  fipa: {
    protocol: 'fipa',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '1.0.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2002-12-01',
    specUrl: 'http://www.fipa.org/specifications/',
    lastUpdated: '2026-01-11T00:00:00Z',
    deprecations: [
      {
        feature: 'Full standard',
        deprecatedInVersion: '1.0.0',
        notes: 'Legacy IEEE standard (SC00061), superseded by modern protocols'
      }
    ]
  },

  // === JADE (Java Agent Development Framework) ===
  jade: {
    protocol: 'jade',
    specVersion: '4.6.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '4.5.0',
    maxSpecVersion: '4.6.0',
    specReleaseDate: '2022-01-01',
    specUrl: 'https://jade.tilab.com/',
    changelogUrl: 'https://jade.tilab.com/doc/',
    lastUpdated: '2026-01-11T00:00:00Z',
    deprecations: [
      {
        feature: 'Legacy agent lifecycle',
        deprecatedInVersion: '4.5.0',
        notes: 'Consider modern containerized approaches for new deployments'
      }
    ]
  },

  // === ROS2 (Robot Operating System 2) ===
  ros2: {
    protocol: 'ros2',
    specVersion: '1.0.0',
    adapterVersion: '1.0.0',
    minSpecVersion: '1.0.0',
    maxSpecVersion: '1.0.0',
    specReleaseDate: '2022-05-01',
    specUrl: 'https://docs.ros.org/en/humble/',
    changelogUrl: 'https://github.com/ros2/ros2/releases',
    lastUpdated: '2026-01-11T00:00:00Z',
    breakingChanges: [
      {
        version: '1.0.0',
        description: 'ROS2 Humble LTS distribution base',
        migration: 'Follow ROS2 migration guides from ROS1 if applicable'
      }
    ]
  }
};

// ============================================================================
// Semantic Version Utilities
// ============================================================================

/**
 * Parse a semantic version string.
 */
export function parseVersion(version: string): SemanticVersion {
  const match = version.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/
  );
  
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5]
  };
}

/**
 * Format a semantic version object to string.
 */
export function formatVersion(version: SemanticVersion): string {
  let str = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) str += `-${version.prerelease}`;
  if (version.build) str += `+${version.build}`;
  return str;
}

/**
 * Compare two semantic versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  
  // Compare major.minor.patch
  if (va.major !== vb.major) return va.major - vb.major > 0 ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor - vb.minor > 0 ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch - vb.patch > 0 ? 1 : -1;
  
  // Compare prerelease (no prerelease > prerelease)
  if (va.prerelease && !vb.prerelease) return -1;
  if (!va.prerelease && vb.prerelease) return 1;
  if (va.prerelease && vb.prerelease) {
    return va.prerelease.localeCompare(vb.prerelease);
  }
  
  return 0;
}

/**
 * Check if version satisfies a version range.
 */
export function satisfiesRange(version: string, min: string, max: string): boolean {
  return compareVersions(version, min) >= 0 && compareVersions(version, max) <= 0;
}

/**
 * Check if version is compatible with another version (same major).
 */
export function isSameMajor(a: string, b: string): boolean {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  return va.major === vb.major;
}

/**
 * Increment version component.
 */
export function incrementVersion(
  version: string,
  component: 'major' | 'minor' | 'patch'
): string {
  const v = parseVersion(version);
  switch (component) {
    case 'major':
      return formatVersion({ major: v.major + 1, minor: 0, patch: 0 });
    case 'minor':
      return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 });
    case 'patch':
      return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 });
  }
}

// ============================================================================
// Registry Query Functions
// ============================================================================

/**
 * Get version info for a protocol.
 */
export function getProtocolVersionInfo(protocol: AgentFramework): ProtocolVersionInfo {
  return PROTOCOL_VERSION_REGISTRY[protocol];
}

/**
 * Get current spec version for a protocol.
 */
export function getCurrentSpecVersion(protocol: AgentFramework): string {
  return PROTOCOL_VERSION_REGISTRY[protocol].specVersion;
}

/**
 * Get adapter version for a protocol.
 */
export function getAdapterVersion(protocol: AgentFramework): string {
  return PROTOCOL_VERSION_REGISTRY[protocol].adapterVersion;
}

/**
 * Check if a specific spec version is supported.
 */
export function isSpecVersionSupported(
  protocol: AgentFramework,
  version: string
): boolean {
  const info = PROTOCOL_VERSION_REGISTRY[protocol];
  return satisfiesRange(version, info.minSpecVersion, info.maxSpecVersion);
}

/**
 * Get all deprecation warnings for a protocol.
 */
export function getDeprecations(protocol: AgentFramework): DeprecationWarning[] {
  return PROTOCOL_VERSION_REGISTRY[protocol].deprecations ?? [];
}

/**
 * Get all breaking changes for a protocol.
 */
export function getBreakingChanges(protocol: AgentFramework): BreakingChange[] {
  return PROTOCOL_VERSION_REGISTRY[protocol].breakingChanges ?? [];
}

// ============================================================================
// Compatibility Checking
// ============================================================================

/**
 * Check version compatibility between adapter and spec version.
 */
export function checkVersionCompatibility(
  protocol: AgentFramework,
  requestedVersion: string
): VersionCompatibility {
  const info = PROTOCOL_VERSION_REGISTRY[protocol];
  const issues: CompatibilityIssue[] = [];
  
  // Check if version is in supported range
  if (!satisfiesRange(requestedVersion, info.minSpecVersion, info.maxSpecVersion)) {
    const compareToMin = compareVersions(requestedVersion, info.minSpecVersion);
    const compareToMax = compareVersions(requestedVersion, info.maxSpecVersion);
    
    if (compareToMin < 0) {
      // Version is older than minimum
      return {
        compatible: false,
        level: 'none',
        issues: [{
          severity: 'error',
          description: `Version ${requestedVersion} is older than minimum supported ${info.minSpecVersion}`,
          workaround: `Upgrade to at least version ${info.minSpecVersion}`
        }],
        upgradePath: [requestedVersion, info.minSpecVersion, info.specVersion]
      };
    }
    
    if (compareToMax > 0) {
      // Version is newer than maximum
      return {
        compatible: false,
        level: 'none',
        issues: [{
          severity: 'error',
          description: `Version ${requestedVersion} is newer than maximum supported ${info.maxSpecVersion}`,
          workaround: 'Update the Chrysalis adapter to support the newer version'
        }]
      };
    }
  }
  
  // Check for deprecations
  const deprecations = info.deprecations ?? [];
  for (const dep of deprecations) {
    if (compareVersions(requestedVersion, dep.deprecatedInVersion) >= 0) {
      if (dep.removeInVersion && compareVersions(requestedVersion, dep.removeInVersion) >= 0) {
        issues.push({
          severity: 'error',
          description: `Feature "${dep.feature}" was removed in version ${dep.removeInVersion}`,
          workaround: dep.replacement
        });
      } else {
        issues.push({
          severity: 'warning',
          description: `Feature "${dep.feature}" is deprecated since ${dep.deprecatedInVersion}`,
          feature: dep.feature,
          workaround: dep.replacement
        });
      }
    }
  }
  
  // Check for breaking changes
  const breakingChanges = info.breakingChanges ?? [];
  for (const change of breakingChanges) {
    if (compareVersions(requestedVersion, change.version) >= 0) {
      issues.push({
        severity: 'info',
        description: `Breaking change in ${change.version}: ${change.description}`,
        workaround: change.migration
      });
    }
  }
  
  // Determine compatibility level
  let level: CompatibilityLevel = 'full';
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');
  
  if (hasErrors) {
    level = 'none';
  } else if (hasWarnings) {
    level = 'partial';
  } else if (isSameMajor(requestedVersion, info.specVersion)) {
    level = 'full';
  } else {
    level = 'backward';
  }
  
  return {
    compatible: !hasErrors,
    level,
    issues: issues.length > 0 ? issues : undefined
  };
}

/**
 * Get migration path between two versions.
 */
export function getMigrationPath(
  protocol: AgentFramework,
  fromVersion: string,
  toVersion: string
): string[] {
  const info = PROTOCOL_VERSION_REGISTRY[protocol];
  const path: string[] = [fromVersion];
  const breakingVersions: string[] = [];
  
  // Find all versions with breaking changes between from and to
  for (const change of info.breakingChanges ?? []) {
    if (
      compareVersions(change.version, fromVersion) > 0 &&
      compareVersions(change.version, toVersion) <= 0
    ) {
      breakingVersions.push(change.version);
    }
  }
  
  // Sort and add to path
  breakingVersions.sort(compareVersions);
  path.push(...breakingVersions);
  
  // Add destination
  if (!path.includes(toVersion)) {
    path.push(toVersion);
  }
  
  return path;
}

// ============================================================================
// Protocol Health Status
// ============================================================================

/**
 * Protocol health status.
 */
export interface ProtocolHealth {
  /** Protocol identifier */
  protocol: AgentFramework;
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'deprecated' | 'unknown';
  /** Health score (0-100) */
  score: number;
  /** Last spec update age in days */
  specAgeDays: number;
  /** Has active deprecations */
  hasDeprecations: boolean;
  /** Is actively maintained */
  isActive: boolean;
  /** Recommendation */
  recommendation?: string;
}

/**
 * Calculate protocol health status.
 */
export function getProtocolHealth(protocol: AgentFramework): ProtocolHealth {
  const info = PROTOCOL_VERSION_REGISTRY[protocol];
  const metadata = PROTOCOL_METADATA[protocol];
  
  // Calculate spec age
  const specDate = info.specReleaseDate 
    ? new Date(info.specReleaseDate) 
    : new Date(info.lastUpdated);
  const now = new Date();
  const specAgeDays = Math.floor((now.getTime() - specDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check deprecations
  const hasDeprecations = (info.deprecations?.length ?? 0) > 0;
  const hasBreakingChanges = (info.breakingChanges?.length ?? 0) > 0;
  
  // Determine if actively maintained based on maturity
  const isActive = metadata.maturity !== 'deprecated';
  
  // Calculate health score
  let score = 100;
  
  // Deduct for age
  if (specAgeDays > 365) score -= 20;
  else if (specAgeDays > 180) score -= 10;
  else if (specAgeDays > 90) score -= 5;
  
  // Deduct for deprecations
  if (hasDeprecations) score -= 15;
  if (hasBreakingChanges) score -= 10;
  
  // Deduct for maturity
  switch (metadata.maturity) {
    case 'deprecated': score -= 50; break;
    case 'experimental': score -= 20; break;
    case 'beta': score -= 10; break;
    case 'alpha': score -= 25; break;
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine status
  let status: ProtocolHealth['status'];
  let recommendation: string | undefined;
  
  if (metadata.maturity === 'deprecated') {
    status = 'deprecated';
    recommendation = 'Consider migrating to a supported protocol';
  } else if (score >= 70) {
    status = 'healthy';
  } else if (score >= 40) {
    status = 'degraded';
    recommendation = 'Monitor for updates and deprecation notices';
  } else {
    status = 'unknown';
    recommendation = 'Protocol may have limited support';
  }
  
  return {
    protocol,
    status,
    score,
    specAgeDays,
    hasDeprecations,
    isActive,
    recommendation
  };
}

/**
 * Get health status for all protocols.
 */
export function getAllProtocolHealth(): ProtocolHealth[] {
  return Object.keys(PROTOCOL_VERSION_REGISTRY).map(
    protocol => getProtocolHealth(protocol as AgentFramework)
  );
}

/**
 * Get protocols sorted by health score.
 */
export function getProtocolsByHealth(minScore: number = 0): AgentFramework[] {
  return getAllProtocolHealth()
    .filter(h => h.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(h => h.protocol);
}

// ============================================================================
// Registry Management
// ============================================================================

/**
 * Mutable registry for runtime updates.
 */
const runtimeRegistry: Map<AgentFramework, ProtocolVersionInfo> = new Map();

/**
 * Register or update a protocol version at runtime.
 */
export function registerProtocolVersion(info: ProtocolVersionInfo): void {
  runtimeRegistry.set(info.protocol, info);
}

/**
 * Get effective version info (runtime override or default).
 */
export function getEffectiveVersionInfo(protocol: AgentFramework): ProtocolVersionInfo {
  return runtimeRegistry.get(protocol) ?? PROTOCOL_VERSION_REGISTRY[protocol];
}

/**
 * Clear runtime registry.
 */
export function clearRuntimeRegistry(): void {
  runtimeRegistry.clear();
}

// ============================================================================
// Exports
// ============================================================================

export default {
  PROTOCOL_VERSION_REGISTRY,
  parseVersion,
  formatVersion,
  compareVersions,
  satisfiesRange,
  isSameMajor,
  incrementVersion,
  getProtocolVersionInfo,
  getCurrentSpecVersion,
  getAdapterVersion,
  isSpecVersionSupported,
  getDeprecations,
  getBreakingChanges,
  checkVersionCompatibility,
  getMigrationPath,
  getProtocolHealth,
  getAllProtocolHealth,
  getProtocolsByHealth,
  registerProtocolVersion,
  getEffectiveVersionInfo,
  clearRuntimeRegistry
};
