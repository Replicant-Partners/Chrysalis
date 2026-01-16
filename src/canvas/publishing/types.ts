/**
 * Widget Publishing Framework Types
 *
 * Defines the system for widget packaging, versioning, and distribution:
 * - Package manifest
 * - Version management
 * - Dependency declaration
 * - Capability negotiation
 * - Documentation standards
 */

import type { CanvasKind } from '../core/types';
import type { WidgetDefinition, WidgetCapabilities, ServiceType } from '../widgets/types';

// =============================================================================
// Package Identity
// =============================================================================

/**
 * Unique package identifier following npm-style naming.
 * Format: @scope/package-name or package-name
 */
export type PackageId = string;

/**
 * Semantic version string.
 * Format: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-prerelease+build
 */
export type SemVer = string;

/**
 * Version range for dependencies.
 * Supports npm-style ranges: ^1.0.0, ~1.0.0, >=1.0.0 <2.0.0, etc.
 */
export type VersionRange = string;

// =============================================================================
// Package Manifest
// =============================================================================

/**
 * Widget package manifest (similar to package.json).
 * This is the main configuration file for a widget package.
 */
export interface WidgetPackageManifest {
  /** Package identifier */
  id: PackageId;

  /** Package version */
  version: SemVer;

  /** Human-readable name */
  name: string;

  /** Short description */
  description: string;

  /** Long description (markdown) */
  readme?: string;

  /** Author information */
  author: {
    name: string;
    email?: string;
    url?: string;
  };

  /** License identifier (SPDX) */
  license: string;

  /** Repository URL */
  repository?: {
    type: 'git' | 'svn' | 'hg';
    url: string;
  };

  /** Homepage URL */
  homepage?: string;

  /** Bug tracker URL */
  bugs?: string;

  /** Keywords for search */
  keywords: string[];

  /** Minimum canvas system version required */
  canvasSystemVersion: VersionRange;

  /** Widgets provided by this package */
  widgets: WidgetExport[];

  /** Dependencies on other widget packages */
  dependencies?: Record<PackageId, VersionRange>;

  /** Peer dependencies (must be provided by host) */
  peerDependencies?: Record<PackageId, VersionRange>;

  /** Services required from the host */
  requiredServices: ServiceType[];

  /** Optional services that enhance functionality */
  optionalServices?: ServiceType[];

  /** Capabilities this package provides */
  capabilities?: string[];

  /** Icon URL or path */
  icon?: string;

  /** Screenshots/previews */
  screenshots?: Array<{
    url: string;
    caption?: string;
  }>;

  /** Changelog URL or inline */
  changelog?: string;

  /** Funding information */
  funding?: {
    type: string;
    url: string;
  };

  /** Package metadata for publishing */
  publishConfig?: {
    registry?: string;
    access?: 'public' | 'restricted';
  };
}

/**
 * Widget export definition in a package.
 */
export interface WidgetExport {
  /** Widget type ID (scoped to package: @scope/package/widget-id) */
  typeId: string;

  /** Path to the widget module */
  module: string;

  /** Export name (default or named) */
  export?: string;

  /** Which canvas types this widget supports */
  canvases: CanvasKind[] | '*';

  /** Category for organization */
  category: string;
}

// =============================================================================
// Version Management
// =============================================================================

/**
 * Parsed semantic version.
 */
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Version comparison result.
 */
export type VersionComparison = -1 | 0 | 1;

// =============================================================================
// Capability Negotiation
// =============================================================================

/**
 * Capability requirements from a widget.
 */
export interface CapabilityRequirement {
  /** Capability identifier */
  id: string;

  /** Is this capability required? */
  required: boolean;

  /** Minimum version of capability */
  minVersion?: SemVer;

  /** Fallback behavior if not available */
  fallback?: 'disable' | 'degrade' | 'error';
}

/**
 * Capability provided by the host.
 */
export interface CapabilityProvider {
  /** Capability identifier */
  id: string;

  /** Version of the capability */
  version: SemVer;

  /** Is this capability enabled? */
  enabled: boolean;

  /** Configuration for this capability */
  config?: Record<string, unknown>;
}

/**
 * Result of capability negotiation.
 */
export interface CapabilityNegotiationResult {
  /** All required capabilities are satisfied */
  satisfied: boolean;

  /** Capabilities that are available */
  available: string[];

  /** Capabilities that are missing */
  missing: string[];

  /** Capabilities with version mismatches */
  versionMismatches: Array<{
    capability: string;
    required: SemVer;
    available: SemVer;
  }>;

  /** Warnings about optional capabilities */
  warnings: string[];
}

// =============================================================================
// Documentation Standards
// =============================================================================

/**
 * Widget documentation structure.
 */
export interface WidgetDocumentation {
  /** Widget type ID */
  typeId: string;

  /** Overview (markdown) */
  overview: string;

  /** Installation instructions */
  installation?: string;

  /** Usage examples */
  examples: DocumentationExample[];

  /** Configuration options */
  configuration: DocumentationConfig[];

  /** API reference */
  api?: DocumentationAPI;

  /** Changelog */
  changelog?: DocumentationChangelogEntry[];

  /** Migration guides between versions */
  migrations?: DocumentationMigration[];
}

export interface DocumentationExample {
  title: string;
  description?: string;
  code: string;
  language: string;
  preview?: string; // URL to screenshot/demo
}

export interface DocumentationConfig {
  name: string;
  type: string;
  description: string;
  default?: unknown;
  required: boolean;
  examples?: unknown[];
}

export interface DocumentationAPI {
  props: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  events: Array<{
    name: string;
    payload: string;
    description: string;
  }>;
  methods: Array<{
    name: string;
    signature: string;
    description: string;
  }>;
}

export interface DocumentationChangelogEntry {
  version: SemVer;
  date: string;
  changes: Array<{
    type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
    description: string;
  }>;
}

export interface DocumentationMigration {
  from: SemVer;
  to: SemVer;
  guide: string; // Markdown
  breaking: boolean;
}

// =============================================================================
// Package Registry
// =============================================================================

/**
 * Package registry entry.
 */
export interface PackageRegistryEntry {
  /** Package manifest */
  manifest: WidgetPackageManifest;

  /** Available versions */
  versions: SemVer[];

  /** Latest stable version */
  latestStable: SemVer;

  /** Latest version (including prereleases) */
  latest: SemVer;

  /** Download counts */
  downloads: {
    total: number;
    weekly: number;
  };

  /** Publication timestamps */
  publishedAt: Record<SemVer, number>;

  /** Deprecation info */
  deprecated?: {
    message: string;
    replacement?: PackageId;
  };

  /** Verification status */
  verified: boolean;

  /** Security audit status */
  securityAudit?: {
    lastAudit: number;
    vulnerabilities: number;
    severity: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  };
}

/**
 * Search result from registry.
 */
export interface PackageSearchResult {
  packageId: PackageId;
  name: string;
  description: string;
  version: SemVer;
  author: string;
  downloads: number;
  keywords: string[];
  score: number;
}

// =============================================================================
// Installation
// =============================================================================

/**
 * Installation options.
 */
export interface InstallOptions {
  /** Target version (default: latest) */
  version?: SemVer | 'latest';

  /** Save to manifest dependencies */
  save?: boolean;

  /** Install as dev dependency */
  dev?: boolean;

  /** Force installation even if checks fail */
  force?: boolean;

  /** Skip peer dependency checks */
  skipPeerCheck?: boolean;
}

/**
 * Installation result.
 */
export interface InstallResult {
  success: boolean;
  packageId: PackageId;
  version: SemVer;

  /** Installed dependencies */
  installed: Array<{ packageId: PackageId; version: SemVer }>;

  /** Warnings during installation */
  warnings: string[];

  /** Errors (if success is false) */
  errors?: string[];
}

// =============================================================================
// Publishing Events
// =============================================================================

export type PublishingEventType =
  | 'package:installed'
  | 'package:uninstalled'
  | 'package:updated'
  | 'package:deprecated'
  | 'registry:synced'
  | 'capability:negotiated'
  | 'validation:failed';

export interface PublishingEvent<T = unknown> {
  type: PublishingEventType;
  timestamp: number;
  payload: T;
}
