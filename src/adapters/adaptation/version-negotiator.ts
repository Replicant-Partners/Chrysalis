/**
 * Version Negotiator
 *
 * Handles version negotiation for protocol adapters.
 *
 * @module adapters/adaptation/version-negotiator
 */

import { EventEmitter } from 'events';
import { AgentFramework } from '../protocol-types';
import { VersionCompatibility } from '../protocol-registry';
import { ProtocolFeature } from '../protocol-capabilities';

/**
 * Version negotiation strategy.
 */
export type NegotiationStrategy =
  | 'latest' // Use latest compatible version
  | 'stable' // Prefer stable versions
  | 'minimum-compatible' // Use minimum compatible version
  | 'exact' // Require exact version
  | 'best-effort'; // Try best effort, fallback gracefully

/**
 * Version negotiation request.
 */
export interface NegotiationRequest {
  protocol: AgentFramework;
  requestedVersion?: string;
  minimumVersion?: string;
  maximumVersion?: string;
  strategy: NegotiationStrategy;
  features?: ProtocolFeature[];
}

/**
 * Version negotiation result.
 */
export interface NegotiationResult {
  success: boolean;
  selectedVersion?: string;
  compatibility: VersionCompatibility;
  fallbackUsed: boolean;
  fallbackVersion?: string;
  warnings: string[];
  unsupportedFeatures: ProtocolFeature[];
}

/**
 * Negotiation history entry.
 */
export interface NegotiationHistoryEntry {
  timestamp: string;
  request: NegotiationRequest;
  result: NegotiationResult;
}

/**
 * Handles version negotiation for protocol adapters.
 */
export class VersionNegotiator extends EventEmitter {
  private versionCache: Map<string, string[]> = new Map();
  private negotiationHistory: NegotiationHistoryEntry[] = [];
  private fallbackVersions: Map<AgentFramework, string> = new Map();

  constructor() {
    super();
    this.initializeDefaultFallbacks();
  }

  /**
   * Initialize default fallback versions for protocols.
   */
  private initializeDefaultFallbacks(): void {
    this.fallbackVersions.set('mcp', '2024.11');
    this.fallbackVersions.set('a2a', '1.0.0');
    this.fallbackVersions.set('anp', '0.1.0');
    this.fallbackVersions.set('langchain', '0.1.0');
    this.fallbackVersions.set('openai', '1.0.0');
    this.fallbackVersions.set('autogen', '0.2.0');
    this.fallbackVersions.set('crewai', '0.1.0');
    this.fallbackVersions.set('semantic-kernel', '1.0.0');
    this.fallbackVersions.set('fipa', '1.0.0');
    this.fallbackVersions.set('jade', '4.5.0');
    this.fallbackVersions.set('ros2', 'humble');
    this.fallbackVersions.set('usa', '2.0.0');
    this.fallbackVersions.set('lmos', '1.0.0');
  }

  /**
   * Negotiate a version for a protocol.
   */
  async negotiate(request: NegotiationRequest): Promise<NegotiationResult> {
    const { protocol, requestedVersion, strategy, features } = request;

    const result: NegotiationResult = {
      success: false,
      compatibility: {
        compatible: false,
        level: 'none',
      },
      fallbackUsed: false,
      warnings: [],
      unsupportedFeatures: [],
    };

    try {
      // Get available versions
      const availableVersions = await this.getAvailableVersions(protocol);

      // Apply negotiation strategy
      const selectedVersion = this.selectVersion(
        availableVersions,
        requestedVersion,
        request.minimumVersion,
        request.maximumVersion,
        strategy
      );

      if (selectedVersion) {
        result.success = true;
        result.selectedVersion = selectedVersion;
        result.compatibility = {
          compatible: true,
          level: selectedVersion === requestedVersion ? 'full' : 'backward',
        };

        // Check feature support
        if (features && features.length > 0) {
          result.unsupportedFeatures = await this.checkFeatureSupport(
            protocol,
            selectedVersion,
            features
          );

          if (result.unsupportedFeatures.length > 0) {
            result.warnings.push(
              `${result.unsupportedFeatures.length} requested feature(s) not supported in ${selectedVersion}`
            );
          }
        }
      } else {
        // Try fallback
        const fallbackVersion = this.fallbackVersions.get(protocol);
        if (fallbackVersion && strategy !== 'exact') {
          result.success = true;
          result.selectedVersion = fallbackVersion;
          result.fallbackUsed = true;
          result.fallbackVersion = fallbackVersion;
          result.compatibility = {
            compatible: true,
            level: 'partial',
            upgradePath: [`Migration to ${fallbackVersion} may require adapter updates`],
          };
          result.warnings.push(`Using fallback version ${fallbackVersion}`);
        }
      }

      // Record history
      this.recordNegotiation(request, result);

      this.emit('negotiation:complete', request, result);
      return result;
    } catch (error) {
      result.warnings.push(error instanceof Error ? error.message : String(error));
      this.emit('negotiation:error', request, error);
      return result;
    }
  }

  /**
   * Get available versions for a protocol.
   *
   * @stub Returns hardcoded version lists. In production, should query:
   *   - Protocol registry (src/adapters/universal/registry-v2.ts)
   *   - Upstream protocol spec endpoints
   *   - Local version cache with TTL
   *
   * The hardcoded defaults are reasonable fallbacks but may become stale.
   * Last verified: 2026-01-14
   */
  private async getAvailableVersions(protocol: AgentFramework): Promise<string[]> {
    // TODO: Query PROTOCOL_REGISTRY_V2 for version information
    // TODO: Add upstream version discovery with caching
    // TODO: Emit warning when using fallback defaults

    // Hardcoded defaults - VERIFY PERIODICALLY
    // These are fallback values when dynamic version discovery is unavailable
    const FALLBACK_VERSIONS: Record<AgentFramework, string[]> = {
      mcp: ['2024.11', '2024.12', '2025.01'],
      a2a: ['1.0.0', '1.1.0'],
      anp: ['0.1.0', '0.2.0'],
      langchain: ['0.1.0', '0.2.0', '0.3.0'],
      openai: ['1.0.0', '1.1.0', '1.2.0'],
      autogen: ['0.2.0', '0.3.0'],
      crewai: ['0.1.0', '0.2.0', '0.3.0'],
      'semantic-kernel': ['1.0.0', '1.1.0'],
      'openai-agents': ['1.0.0'],
      autogpt: ['0.5.0'],
      agntcy: ['0.1.0'],
      acp: ['0.1.0'],
      fipa: ['1.0.0'],
      jade: ['4.5.0', '4.6.0'],
      ros2: ['humble', 'iron', 'jazzy'],
      usa: ['2.0.0', '2.1.0'],
      lmos: ['1.0.0'],
    };

    const versions = FALLBACK_VERSIONS[protocol];
    if (!versions) {
      console.warn(`[VersionNegotiator] No version info for protocol '${protocol}', using default '1.0.0'`);
      return ['1.0.0'];
    }

    return versions;
  }

  /**
   * Select version based on strategy.
   */
  private selectVersion(
    available: string[],
    requested?: string,
    minimum?: string,
    maximum?: string,
    strategy: NegotiationStrategy = 'stable'
  ): string | undefined {
    if (available.length === 0) return undefined;

    // Filter by constraints
    let candidates = [...available];

    if (minimum) {
      candidates = candidates.filter((v) => this.compareVersions(v, minimum) >= 0);
    }
    if (maximum) {
      candidates = candidates.filter((v) => this.compareVersions(v, maximum) <= 0);
    }

    if (candidates.length === 0) return undefined;

    switch (strategy) {
      case 'exact':
        return requested && candidates.includes(requested) ? requested : undefined;

      case 'latest':
        return candidates.sort((a, b) => this.compareVersions(b, a))[0];

      case 'stable':
        // Prefer versions without pre-release tags
        const stable = candidates.filter(
          (v) => !v.includes('-') && !v.includes('alpha') && !v.includes('beta')
        );
        if (stable.length > 0) {
          return stable.sort((a, b) => this.compareVersions(b, a))[0];
        }
        return candidates.sort((a, b) => this.compareVersions(b, a))[0];

      case 'minimum-compatible':
        if (requested && candidates.includes(requested)) return requested;
        return candidates.sort((a, b) => this.compareVersions(a, b))[0];

      case 'best-effort':
        if (requested && candidates.includes(requested)) return requested;
        return candidates.sort((a, b) => this.compareVersions(b, a))[0];

      default:
        return candidates[0];
    }
  }

  /**
   * Compare two version strings.
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
      return v
        .replace(/^v/, '')
        .split(/[.-]/)
        .map((p) => {
          const num = parseInt(p, 10);
          return isNaN(num) ? 0 : num;
        });
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal > bVal) return 1;
      if (aVal < bVal) return -1;
    }
    return 0;
  }

  /**
   * Check feature support for a version.
   *
   * @stub Returns empty array (assumes all features supported).
   * In production, should check against a capability matrix that maps
   * protocol versions to supported features.
   *
   * @returns Array of UNSUPPORTED features (empty = all supported)
   */
  private async checkFeatureSupport(
    protocol: AgentFramework,
    version: string,
    features: ProtocolFeature[]
  ): Promise<ProtocolFeature[]> {
    // TODO: Build capability matrix from protocol specs
    // TODO: Check each feature against version support
    // For now, assume all features are supported (optimistic)
    if (features.length > 0) {
      console.warn(`[VersionNegotiator] Feature support check is a stub - assuming all ${features.length} features supported for ${protocol}@${version}`);
    }
    return [];
  }

  /**
   * Record negotiation for history tracking.
   */
  private recordNegotiation(request: NegotiationRequest, result: NegotiationResult): void {
    this.negotiationHistory.push({
      timestamp: new Date().toISOString(),
      request,
      result,
    });

    // Keep history bounded
    if (this.negotiationHistory.length > 1000) {
      this.negotiationHistory = this.negotiationHistory.slice(-500);
    }
  }

  /**
   * Get negotiation history.
   */
  getHistory(protocol?: AgentFramework): NegotiationHistoryEntry[] {
    if (protocol) {
      return this.negotiationHistory.filter((e) => e.request.protocol === protocol);
    }
    return [...this.negotiationHistory];
  }

  /**
   * Set fallback version for a protocol.
   */
  setFallbackVersion(protocol: AgentFramework, version: string): void {
    this.fallbackVersions.set(protocol, version);
  }
}
