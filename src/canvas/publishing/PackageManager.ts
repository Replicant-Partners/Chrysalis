/**
 * Package Manager
 *
 * Manages widget package installation, updates, and dependency resolution:
 * - Package installation/uninstallation
 * - Version resolution
 * - Dependency management
 * - Capability negotiation
 */

import { EventEmitter } from 'events';
import { getWidgetRegistry, WidgetRegistry } from '../widgets/WidgetRegistry';
import type { WidgetDefinition } from '../widgets/types';
import {
  PackageId,
  SemVer,
  VersionRange,
  ParsedVersion,
  VersionComparison,
  WidgetPackageManifest,
  PackageRegistryEntry,
  PackageSearchResult,
  InstallOptions,
  InstallResult,
  CapabilityRequirement,
  CapabilityProvider,
  CapabilityNegotiationResult,
  PublishingEvent,
  PublishingEventType,
} from './types';

// =============================================================================
// Version Utilities
// =============================================================================

/**
 * Parse a semantic version string.
 */
export function parseVersion(version: SemVer): ParsedVersion {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Compare two versions.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: SemVer, b: SemVer): VersionComparison {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

  // Prerelease versions have lower precedence
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease < pb.prerelease ? -1 : pa.prerelease > pb.prerelease ? 1 : 0;
  }

  return 0;
}

/**
 * Check if a version satisfies a version range.
 */
export function satisfiesRange(version: SemVer, range: VersionRange): boolean {
  const parsed = parseVersion(version);

  // Exact version
  if (/^\d+\.\d+\.\d+$/.test(range)) {
    return compareVersions(version, range) === 0;
  }

  // Caret range (^1.0.0) - compatible with major version
  if (range.startsWith('^')) {
    const rangeVersion = parseVersion(range.slice(1));
    if (parsed.major !== rangeVersion.major) return false;
    return compareVersions(version, range.slice(1)) >= 0;
  }

  // Tilde range (~1.0.0) - compatible with minor version
  if (range.startsWith('~')) {
    const rangeVersion = parseVersion(range.slice(1));
    if (parsed.major !== rangeVersion.major) return false;
    if (parsed.minor !== rangeVersion.minor) return false;
    return compareVersions(version, range.slice(1)) >= 0;
  }

  // Greater than or equal (>=1.0.0)
  if (range.startsWith('>=')) {
    return compareVersions(version, range.slice(2)) >= 0;
  }

  // Greater than (>1.0.0)
  if (range.startsWith('>')) {
    return compareVersions(version, range.slice(1)) > 0;
  }

  // Less than or equal (<=1.0.0)
  if (range.startsWith('<=')) {
    return compareVersions(version, range.slice(2)) <= 0;
  }

  // Less than (<1.0.0)
  if (range.startsWith('<')) {
    return compareVersions(version, range.slice(1)) < 0;
  }

  // Wildcard (*)
  if (range === '*') {
    return true;
  }

  // Default: treat as exact version
  return compareVersions(version, range) === 0;
}

// =============================================================================
// Package Manager
// =============================================================================

export class PackageManager {
  private installed: Map<PackageId, {
    manifest: WidgetPackageManifest;
    version: SemVer;
    widgets: WidgetDefinition[];
  }> = new Map();

  private capabilities: Map<string, CapabilityProvider> = new Map();
  private widgetRegistry: WidgetRegistry;
  private emitter = new EventEmitter();

  // Mock registry for demo (in production, this would be a remote service)
  private mockRegistry: Map<PackageId, PackageRegistryEntry> = new Map();

  constructor(widgetRegistry?: WidgetRegistry) {
    this.widgetRegistry = widgetRegistry ?? getWidgetRegistry();
  }

  // ===========================================================================
  // Installation
  // ===========================================================================

  /**
   * Install a package.
   */
  async install(packageId: PackageId, options: InstallOptions = {}): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      packageId,
      version: options.version || 'latest',
      installed: [],
      warnings: [],
    };

    try {
      // Fetch package info from registry
      const registryEntry = await this.fetchPackageInfo(packageId);
      if (!registryEntry) {
        result.errors = [`Package not found: ${packageId}`];
        return result;
      }

      // Resolve version
      const version = this.resolveVersion(registryEntry, options.version);
      if (!version) {
        result.errors = [`No matching version found for ${packageId}@${options.version}`];
        return result;
      }
      result.version = version;

      // Fetch manifest for specific version
      const manifest = await this.fetchManifest(packageId, version);
      if (!manifest) {
        result.errors = [`Failed to fetch manifest for ${packageId}@${version}`];
        return result;
      }

      // Check canvas system version compatibility
      if (!satisfiesRange('1.0.0', manifest.canvasSystemVersion)) {
        result.errors = [`Package requires canvas system ${manifest.canvasSystemVersion}`];
        return result;
      }

      // Negotiate capabilities
      const capabilityResult = this.negotiateCapabilities(
        manifest.requiredServices.map(s => ({ id: s, required: true }))
      );
      if (!capabilityResult.satisfied && !options.force) {
        result.errors = [
          `Missing required capabilities: ${capabilityResult.missing.join(', ')}`
        ];
        return result;
      }
      if (capabilityResult.warnings.length > 0) {
        result.warnings.push(...capabilityResult.warnings);
      }

      // Install dependencies
      if (manifest.dependencies && !options.force) {
        for (const [depId, depRange] of Object.entries(manifest.dependencies)) {
          if (!this.installed.has(depId)) {
            const depResult = await this.install(depId, { version: depRange });
            if (!depResult.success) {
              result.errors = [`Failed to install dependency ${depId}: ${depResult.errors?.join(', ')}`];
              return result;
            }
            result.installed.push(...depResult.installed);
          }
        }
      }

      // Load widgets from package
      const widgets = await this.loadWidgets(manifest);

      // Register widgets
      for (const widget of widgets) {
        try {
          this.widgetRegistry.register(widget);
        } catch (err) {
          result.warnings.push(`Failed to register widget ${widget.typeId}: ${err}`);
        }
      }

      // Store installed package
      this.installed.set(packageId, { manifest, version, widgets });
      result.installed.push({ packageId, version });

      result.success = true;
      this.emit('package:installed', { packageId, version });

    } catch (error) {
      result.errors = [`Installation failed: ${error}`];
    }

    return result;
  }

  /**
   * Uninstall a package.
   */
  async uninstall(packageId: PackageId): Promise<boolean> {
    const pkg = this.installed.get(packageId);
    if (!pkg) return false;

    // Unregister widgets
    for (const widget of pkg.widgets) {
      this.widgetRegistry.unregister(widget.typeId);
    }

    this.installed.delete(packageId);
    this.emit('package:uninstalled', { packageId });
    return true;
  }

  /**
   * Update a package to a new version.
   */
  async update(packageId: PackageId, version?: SemVer): Promise<InstallResult> {
    // Uninstall current version
    await this.uninstall(packageId);

    // Install new version
    const result = await this.install(packageId, { version: version || 'latest' });

    if (result.success) {
      this.emit('package:updated', { packageId, version: result.version });
    }

    return result;
  }

  /**
   * Check if a package is installed.
   */
  isInstalled(packageId: PackageId): boolean {
    return this.installed.has(packageId);
  }

  /**
   * Get installed package info.
   */
  getInstalled(packageId: PackageId): { manifest: WidgetPackageManifest; version: SemVer } | undefined {
    const pkg = this.installed.get(packageId);
    if (!pkg) return undefined;
    return { manifest: pkg.manifest, version: pkg.version };
  }

  /**
   * List all installed packages.
   */
  listInstalled(): Array<{ packageId: PackageId; version: SemVer; name: string }> {
    return Array.from(this.installed.entries()).map(([packageId, pkg]) => ({
      packageId,
      version: pkg.version,
      name: pkg.manifest.name,
    }));
  }

  // ===========================================================================
  // Registry Operations
  // ===========================================================================

  /**
   * Search the package registry.
   */
  async search(query: string): Promise<PackageSearchResult[]> {
    // In production, this would call a remote registry
    const results: PackageSearchResult[] = [];

    this.mockRegistry.forEach((entry, packageId) => {
      const score = this.calculateSearchScore(query, entry.manifest);
      if (score > 0) {
        results.push({
          packageId,
          name: entry.manifest.name,
          description: entry.manifest.description,
          version: entry.latestStable,
          author: entry.manifest.author.name,
          downloads: entry.downloads.total,
          keywords: entry.manifest.keywords,
          score,
        });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Register a mock package (for testing/demo).
   */
  registerMockPackage(entry: PackageRegistryEntry): void {
    this.mockRegistry.set(entry.manifest.id, entry);
  }

  private async fetchPackageInfo(packageId: PackageId): Promise<PackageRegistryEntry | null> {
    // In production: fetch from remote registry
    return this.mockRegistry.get(packageId) ?? null;
  }

  private async fetchManifest(packageId: PackageId, version: SemVer): Promise<WidgetPackageManifest | null> {
    const entry = this.mockRegistry.get(packageId);
    if (!entry || !entry.versions.includes(version)) return null;
    return { ...entry.manifest, version };
  }

  private resolveVersion(entry: PackageRegistryEntry, requested?: SemVer | 'latest'): SemVer | null {
    if (!requested || requested === 'latest') {
      return entry.latestStable;
    }

    // Check if it's a range
    if (requested.includes('^') || requested.includes('~') ||
        requested.includes('>') || requested.includes('<')) {
      const matching = entry.versions
        .filter(v => satisfiesRange(v, requested))
        .sort((a, b) => -compareVersions(a, b)); // Sort descending
      return matching[0] ?? null;
    }

    // Exact version
    return entry.versions.includes(requested) ? requested : null;
  }

  private async loadWidgets(manifest: WidgetPackageManifest): Promise<WidgetDefinition[]> {
    // In production: dynamically import widget modules
    // For now, return empty array (widgets would be loaded from manifest.widgets)
    return [];
  }

  private calculateSearchScore(query: string, manifest: WidgetPackageManifest): number {
    const q = query.toLowerCase();
    let score = 0;

    if (manifest.id.toLowerCase().includes(q)) score += 10;
    if (manifest.name.toLowerCase().includes(q)) score += 8;
    if (manifest.description.toLowerCase().includes(q)) score += 5;
    if (manifest.keywords.some(k => k.toLowerCase().includes(q))) score += 3;

    return score;
  }

  // ===========================================================================
  // Capability Management
  // ===========================================================================

  /**
   * Register a capability provider.
   */
  registerCapability(capability: CapabilityProvider): void {
    this.capabilities.set(capability.id, capability);
  }

  /**
   * Unregister a capability provider.
   */
  unregisterCapability(capabilityId: string): void {
    this.capabilities.delete(capabilityId);
  }

  /**
   * Negotiate capabilities between requirements and providers.
   */
  negotiateCapabilities(requirements: CapabilityRequirement[]): CapabilityNegotiationResult {
    const result: CapabilityNegotiationResult = {
      satisfied: true,
      available: [],
      missing: [],
      versionMismatches: [],
      warnings: [],
    };

    for (const req of requirements) {
      const provider = this.capabilities.get(req.id);

      if (!provider || !provider.enabled) {
        if (req.required) {
          result.satisfied = false;
          result.missing.push(req.id);
        } else {
          result.warnings.push(`Optional capability '${req.id}' not available`);
        }
        continue;
      }

      // Check version if specified
      if (req.minVersion && compareVersions(provider.version, req.minVersion) < 0) {
        result.versionMismatches.push({
          capability: req.id,
          required: req.minVersion,
          available: provider.version,
        });
        if (req.required) {
          result.satisfied = false;
        }
        continue;
      }

      result.available.push(req.id);
    }

    this.emit('capability:negotiated', result);
    return result;
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  on(event: PublishingEventType, handler: (e: PublishingEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: PublishingEventType, handler: (e: PublishingEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit<T>(type: PublishingEventType, payload: T): void {
    const event: PublishingEvent<T> = {
      type,
      timestamp: Date.now(),
      payload,
    };
    this.emitter.emit(type, event);
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Uninstall all packages and clean up.
   */
  dispose(): void {
    this.installed.forEach((_, packageId) => {
      this.uninstall(packageId);
    });
    this.capabilities.clear();
    this.emitter.removeAllListeners();
  }
}

// =============================================================================
// Singleton
// =============================================================================

let globalPackageManager: PackageManager | null = null;

export function getPackageManager(): PackageManager {
  if (!globalPackageManager) {
    globalPackageManager = new PackageManager();
  }
  return globalPackageManager;
}

export function resetPackageManager(): void {
  globalPackageManager?.dispose();
  globalPackageManager = null;
}
