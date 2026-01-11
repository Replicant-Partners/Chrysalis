/**
 * AI-Led Adaptive Maintenance System - Repository Monitor
 * 
 * Service for monitoring external repositories for changes that may
 * require adapter updates.
 * 
 * @module ai-maintenance/repository-monitor
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import {
  WatchedRepository,
  RepositoryChange,
  RepositoryType,
  ChangeType,
  ChangeStatus
} from './types';
import { AgentFramework } from '../adapters/protocol-types';

// ============================================================================
// Repository Monitor Configuration
// ============================================================================

/**
 * Configuration for the repository monitor.
 */
export interface RepositoryMonitorConfig {
  /** Default polling interval in milliseconds */
  defaultPollIntervalMs: number;
  /** Maximum concurrent monitors */
  maxConcurrentMonitors: number;
  /** Enable webhook listening */
  enableWebhooks: boolean;
  /** Webhook port */
  webhookPort?: number;
  /** GitHub API token for higher rate limits */
  githubToken?: string;
  /** NPM registry URL */
  npmRegistry?: string;
  /** Enable RSS feed polling */
  enableRssPolling: boolean;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: RepositoryMonitorConfig = {
  defaultPollIntervalMs: 3600000, // 1 hour
  maxConcurrentMonitors: 20,
  enableWebhooks: false,
  npmRegistry: 'https://registry.npmjs.org',
  enableRssPolling: true
};

// ============================================================================
// Repository Monitor Events
// ============================================================================

/**
 * Events emitted by the repository monitor.
 */
export interface RepositoryMonitorEvents {
  'change:detected': (change: RepositoryChange) => void;
  'repository:added': (repo: WatchedRepository) => void;
  'repository:removed': (repositoryId: string) => void;
  'error': (error: Error, repositoryId?: string) => void;
  'poll:started': (repositoryId: string) => void;
  'poll:completed': (repositoryId: string, hasChanges: boolean) => void;
}

// ============================================================================
// Repository Monitor Class
// ============================================================================

/**
 * Repository monitor for detecting changes in external dependencies.
 * 
 * Supports:
 * - Git repository polling
 * - NPM package version watching
 * - RSS/Atom feed monitoring
 * - Webhook handlers (when configured)
 */
export class RepositoryMonitor extends EventEmitter {
  private config: RepositoryMonitorConfig;
  private repositories: Map<string, WatchedRepository> = new Map();
  private pollTimers: Map<string, NodeJS.Timeout> = new Map();
  private changeQueue: RepositoryChange[] = [];
  private running: boolean = false;

  constructor(config: Partial<RepositoryMonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Repository Management
  // ==========================================================================

  /**
   * Add a repository to watch.
   */
  addRepository(repo: WatchedRepository): void {
    if (this.repositories.size >= this.config.maxConcurrentMonitors) {
      throw new Error(
        `Maximum concurrent monitors (${this.config.maxConcurrentMonitors}) reached`
      );
    }

    this.repositories.set(repo.repositoryId, repo);
    this.emit('repository:added', repo);

    // Start polling if monitor is running
    if (this.running && repo.active) {
      this.startPolling(repo.repositoryId);
    }
  }

  /**
   * Remove a repository from watch.
   */
  removeRepository(repositoryId: string): boolean {
    const repo = this.repositories.get(repositoryId);
    if (!repo) return false;

    this.stopPolling(repositoryId);
    this.repositories.delete(repositoryId);
    this.emit('repository:removed', repositoryId);
    return true;
  }

  /**
   * Get all watched repositories.
   */
  getRepositories(): WatchedRepository[] {
    return Array.from(this.repositories.values());
  }

  /**
   * Get a specific repository.
   */
  getRepository(repositoryId: string): WatchedRepository | undefined {
    return this.repositories.get(repositoryId);
  }

  /**
   * Update repository configuration.
   */
  updateRepository(
    repositoryId: string, 
    updates: Partial<WatchedRepository>
  ): boolean {
    const repo = this.repositories.get(repositoryId);
    if (!repo) return false;

    const updated: WatchedRepository = { ...repo, ...updates };
    this.repositories.set(repositoryId, updated);

    // Restart polling if interval changed
    if (updates.pollIntervalMs && this.running && updated.active) {
      this.stopPolling(repositoryId);
      this.startPolling(repositoryId);
    }

    return true;
  }

  // ==========================================================================
  // Monitor Lifecycle
  // ==========================================================================

  /**
   * Start the repository monitor.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Start polling for all active repositories
    this.repositories.forEach((repo, repoId) => {
      if (repo.active) {
        this.startPolling(repoId);
      }
    });
  }

  /**
   * Stop the repository monitor.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    // Stop all poll timers
    Array.from(this.pollTimers.keys()).forEach(repoId => {
      this.stopPolling(repoId);
    });
  }

  /**
   * Check if monitor is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ==========================================================================
  // Polling
  // ==========================================================================

  /**
   * Start polling a repository.
   */
  private startPolling(repositoryId: string): void {
    const repo = this.repositories.get(repositoryId);
    if (!repo) return;

    const interval = repo.pollIntervalMs || this.config.defaultPollIntervalMs;

    // Run immediately
    this.pollRepository(repositoryId);

    // Schedule recurring polls
    const timer = setInterval(() => {
      this.pollRepository(repositoryId);
    }, interval);

    this.pollTimers.set(repositoryId, timer);
  }

  /**
   * Stop polling a repository.
   */
  private stopPolling(repositoryId: string): void {
    const timer = this.pollTimers.get(repositoryId);
    if (timer) {
      clearInterval(timer);
      this.pollTimers.delete(repositoryId);
    }
  }

  /**
   * Poll a single repository for changes.
   */
  async pollRepository(repositoryId: string): Promise<RepositoryChange | null> {
    const repo = this.repositories.get(repositoryId);
    if (!repo) return null;

    this.emit('poll:started', repositoryId);

    try {
      let change: RepositoryChange | null = null;

      switch (repo.type) {
        case 'git':
          change = await this.pollGitRepository(repo);
          break;
        case 'npm':
          change = await this.pollNpmPackage(repo);
          break;
        case 'rss':
          change = await this.pollRssFeed(repo);
          break;
        case 'documentation':
          change = await this.pollDocumentation(repo);
          break;
        case 'api':
          change = await this.pollApi(repo);
          break;
        default:
          // pypi and other types can be added later
          break;
      }

      // Update last checked time
      this.updateRepository(repositoryId, {
        lastCheckedAt: new Date().toISOString()
      });

      const hasChanges = change !== null;
      this.emit('poll:completed', repositoryId, hasChanges);

      if (change) {
        this.changeQueue.push(change);
        this.emit('change:detected', change);
      }

      return change;
    } catch (error) {
      this.emit('error', error as Error, repositoryId);
      return null;
    }
  }

  /**
   * Poll a Git repository for changes.
   */
  private async pollGitRepository(
    repo: WatchedRepository
  ): Promise<RepositoryChange | null> {
    // Extract owner/repo from URL
    const match = repo.url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${repo.url}`);
    }

    const [, owner, repoName] = match;
    const branch = repo.branch || 'main';

    // Fetch latest commit
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/commits/${branch}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Chrysalis-AI-Maintenance'
    };

    if (this.config.githubToken) {
      headers['Authorization'] = `token ${this.config.githubToken}`;
    }

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json() as {
      sha: string;
      commit?: { message?: string }
    };
    const currentSha = data.sha;

    // Check for changes
    if (repo.lastKnownVersion && repo.lastKnownVersion !== currentSha) {
      // Update last known version
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: currentSha
      });

      return {
        changeId: `change-${repo.repositoryId}-${Date.now()}`,
        repositoryId: repo.repositoryId,
        changeType: 'commit',
        previousVersion: repo.lastKnownVersion,
        currentVersion: currentSha,
        detectedAt: new Date().toISOString(),
        summary: `New commit detected: ${data.commit?.message?.split('\n')[0] || 'No message'}`,
        details: data.commit?.message,
        status: 'detected'
      };
    }

    // First run - set baseline
    if (!repo.lastKnownVersion) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: currentSha
      });
    }

    return null;
  }

  /**
   * Poll an NPM package for version changes.
   */
  private async pollNpmPackage(
    repo: WatchedRepository
  ): Promise<RepositoryChange | null> {
    // Extract package name from URL or name
    const packageName = repo.name;
    const registryUrl = this.config.npmRegistry || 'https://registry.npmjs.org';

    const response = await fetch(`${registryUrl}/${packageName}`);
    if (!response.ok) {
      throw new Error(`NPM registry error: ${response.status}`);
    }

    const data = await response.json() as {
      'dist-tags'?: { latest?: string };
      versions?: Record<string, { description?: string }>;
    };
    const latestVersion = data['dist-tags']?.latest;

    if (!latestVersion) {
      throw new Error(`No latest version found for ${packageName}`);
    }

    // Check for version changes
    if (repo.lastKnownVersion && repo.lastKnownVersion !== latestVersion) {
      // Update last known version
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: latestVersion
      });

      // Determine if breaking change (major version bump)
      const isBreaking = this.isMajorVersionBump(
        repo.lastKnownVersion,
        latestVersion
      );

      return {
        changeId: `change-${repo.repositoryId}-${Date.now()}`,
        repositoryId: repo.repositoryId,
        changeType: 'version-release',
        previousVersion: repo.lastKnownVersion,
        currentVersion: latestVersion,
        detectedAt: new Date().toISOString(),
        summary: `New version released: ${latestVersion}${isBreaking ? ' (BREAKING)' : ''}`,
        details: data.versions?.[latestVersion]?.description,
        status: 'detected'
      };
    }

    // First run - set baseline
    if (!repo.lastKnownVersion) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: latestVersion
      });
    }

    return null;
  }

  /**
   * Poll an RSS/Atom feed for updates.
   */
  private async pollRssFeed(
    repo: WatchedRepository
  ): Promise<RepositoryChange | null> {
    if (!this.config.enableRssPolling) return null;

    const response = await fetch(repo.url);
    if (!response.ok) {
      throw new Error(`RSS feed error: ${response.status}`);
    }

    const text = await response.text();
    
    // Simple RSS/Atom parsing - extract latest item date/guid
    const guidMatch = text.match(/<guid[^>]*>([^<]+)<\/guid>/);
    const pubDateMatch = text.match(/<pubDate>([^<]+)<\/pubDate>/);
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/g);
    
    const currentVersion = guidMatch?.[1] || pubDateMatch?.[1] || '';
    const title = titleMatch?.[1]?.replace(/<\/?title>/g, '') || 'Feed update';

    if (repo.lastKnownVersion && repo.lastKnownVersion !== currentVersion) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: currentVersion
      });

      return {
        changeId: `change-${repo.repositoryId}-${Date.now()}`,
        repositoryId: repo.repositoryId,
        changeType: 'documentation-update',
        previousVersion: repo.lastKnownVersion,
        currentVersion: currentVersion,
        detectedAt: new Date().toISOString(),
        summary: title,
        status: 'detected'
      };
    }

    if (!repo.lastKnownVersion && currentVersion) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: currentVersion
      });
    }

    return null;
  }

  /**
   * Poll a documentation site for changes.
   */
  private async pollDocumentation(
    repo: WatchedRepository
  ): Promise<RepositoryChange | null> {
    const response = await fetch(repo.url);
    if (!response.ok) {
      throw new Error(`Documentation fetch error: ${response.status}`);
    }

    const text = await response.text();
    
    // Simple hash of content for change detection
    const contentHash = this.simpleHash(text);

    if (repo.lastKnownVersion && repo.lastKnownVersion !== contentHash) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: contentHash
      });

      return {
        changeId: `change-${repo.repositoryId}-${Date.now()}`,
        repositoryId: repo.repositoryId,
        changeType: 'documentation-update',
        previousVersion: repo.lastKnownVersion,
        currentVersion: contentHash,
        detectedAt: new Date().toISOString(),
        summary: `Documentation content changed at ${repo.url}`,
        status: 'detected'
      };
    }

    if (!repo.lastKnownVersion) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: contentHash
      });
    }

    return null;
  }

  /**
   * Poll an API endpoint for changes.
   */
  private async pollApi(
    repo: WatchedRepository
  ): Promise<RepositoryChange | null> {
    const response = await fetch(repo.url);
    if (!response.ok) {
      throw new Error(`API fetch error: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    
    // Look for version field
    const version = String(
      data.version || data.api_version || data.v ||
      JSON.stringify(data).slice(0, 100)
    );

    if (repo.lastKnownVersion && repo.lastKnownVersion !== version) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: version
      });

      return {
        changeId: `change-${repo.repositoryId}-${Date.now()}`,
        repositoryId: repo.repositoryId,
        changeType: 'version-release',
        previousVersion: repo.lastKnownVersion,
        currentVersion: version,
        detectedAt: new Date().toISOString(),
        summary: `API version changed: ${version}`,
        status: 'detected'
      };
    }

    if (!repo.lastKnownVersion) {
      this.updateRepository(repo.repositoryId, {
        lastKnownVersion: version
      });
    }

    return null;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Check if version bump is a major version change.
   */
  private isMajorVersionBump(from: string, to: string): boolean {
    const fromMatch = from.match(/^v?(\d+)/);
    const toMatch = to.match(/^v?(\d+)/);
    
    if (!fromMatch || !toMatch) return false;
    
    return parseInt(toMatch[1], 10) > parseInt(fromMatch[1], 10);
  }

  /**
   * Simple hash function for content comparison.
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Get pending changes.
   */
  getChangeQueue(): RepositoryChange[] {
    return [...this.changeQueue];
  }

  /**
   * Clear a change from the queue.
   */
  acknowledgeChange(changeId: string): boolean {
    const index = this.changeQueue.findIndex(c => c.changeId === changeId);
    if (index >= 0) {
      this.changeQueue.splice(index, 1);
      return true;
    }
    return false;
  }
}

// ============================================================================
// Pre-configured Repository Templates
// ============================================================================

/**
 * Create a pre-configured repository for common protocols.
 */
export function createProtocolRepository(
  protocol: AgentFramework
): WatchedRepository | null {
  const now = new Date().toISOString();
  
  const templates: Record<string, Partial<WatchedRepository>> = {
    mcp: {
      repositoryId: 'repo-mcp',
      name: '@modelcontextprotocol/sdk',
      type: 'npm',
      url: 'https://registry.npmjs.org/@modelcontextprotocol/sdk',
      protocol: 'mcp',
      pollIntervalMs: 3600000,
      active: true
    },
    langchain: {
      repositoryId: 'repo-langchain',
      name: 'langchain',
      type: 'npm',
      url: 'https://registry.npmjs.org/langchain',
      protocol: 'langchain',
      pollIntervalMs: 3600000,
      active: true
    },
    'openai-agents': {
      repositoryId: 'repo-openai-agents',
      name: 'openai-agents',
      type: 'git',
      url: 'https://github.com/openai/openai-agents-python',
      protocol: 'openai-agents',
      branch: 'main',
      pollIntervalMs: 3600000,
      active: true
    },
    a2a: {
      repositoryId: 'repo-a2a',
      name: 'a2a-python',
      type: 'git',
      url: 'https://github.com/a2aproject/a2a-python',
      protocol: 'a2a',
      branch: 'main',
      pollIntervalMs: 3600000,
      active: true
    },
    anp: {
      repositoryId: 'repo-anp',
      name: 'AgentNetworkProtocol',
      type: 'git',
      url: 'https://github.com/agent-network-protocol/AgentNetworkProtocol',
      protocol: 'anp',
      branch: 'main',
      pollIntervalMs: 3600000,
      active: true
    },
    autogen: {
      repositoryId: 'repo-autogen',
      name: 'autogen',
      type: 'git',
      url: 'https://github.com/microsoft/autogen',
      protocol: 'autogen',
      branch: 'main',
      pollIntervalMs: 3600000,
      active: true
    },
    crewai: {
      repositoryId: 'repo-crewai',
      name: 'crewai',
      type: 'npm',
      url: 'https://registry.npmjs.org/crewai',
      protocol: 'crewai',
      pollIntervalMs: 3600000,
      active: true
    }
  };

  const template = templates[protocol];
  if (!template) return null;

  return {
    ...template,
    lastCheckedAt: now
  } as WatchedRepository;
}

// ============================================================================
// Exports
// ============================================================================

export default RepositoryMonitor;
