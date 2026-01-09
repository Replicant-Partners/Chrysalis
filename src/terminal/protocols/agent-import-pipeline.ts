/**
 * Agent Import Pipeline
 * 
 * Orchestrates the import of agent specifications from various formats
 * (ElizaOS, CrewAI, Replicant) and converts them to uSA (Uniform Semantic Agent) format.
 * 
 * Workflow:
 * 1. Accept file (drag-drop, file picker, URL)
 * 2. Parse content (JSON/YAML)
 * 3. Detect source format
 * 4. Convert to uSA v2
 * 5. Validate and return
 */

import {
  AgentSourceFormat,
  CanvasAgent,
  createCanvasAgent,
  AGENT_CANVAS_CONSTANTS
} from './agent-canvas';

// =============================================================================
// Security Utilities
// =============================================================================

/**
 * URL validation result
 */
interface URLValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * URLValidator prevents SSRF attacks by validating URLs before fetch
 * Blocks internal network addresses, localhost, and cloud metadata endpoints
 */
export class URLValidator {
  /** Blocked hostnames that could be internal/sensitive */
  private static readonly BLOCKED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    'metadata.google.internal',
    'metadata.goog',
    '169.254.169.254',  // AWS/GCP metadata endpoint
    'fd00::',  // IPv6 unique local
  ]);

  /** Regex patterns for private IP ranges */
  private static readonly BLOCKED_PATTERNS = [
    /^10\./,                          // 10.0.0.0/8 private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 private
    /^192\.168\./,                    // 192.168.0.0/16 private
    /^169\.254\./,                    // 169.254.0.0/16 link-local
    /^127\./,                         // 127.0.0.0/8 loopback
    /\.internal$/,                    // Internal TLD
    /\.local$/,                       // Local TLD
    /\.localhost$/,                   // Localhost TLD
    /^fc00:/i,                        // IPv6 unique local (fc00::/7)
    /^fe80:/i,                        // IPv6 link-local
  ];

  /** Allowed protocols for agent import */
  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

  /**
   * Validate a URL for safe fetching
   * @param url - The URL to validate
   * @returns Validation result with reason if invalid
   */
  static validate(url: string): URLValidationResult {
    try {
      const parsed = new URL(url);
      
      // Protocol check
      if (!this.ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        return {
          valid: false,
          reason: `Protocol "${parsed.protocol}" not allowed. Only HTTP(S) URLs are permitted.`
        };
      }
      
      // Direct hostname check
      const hostname = parsed.hostname.toLowerCase();
      if (this.BLOCKED_HOSTS.has(hostname)) {
        return {
          valid: false,
          reason: `Host "${hostname}" is blocked for security reasons.`
        };
      }
      
      // Private IP pattern check
      for (const pattern of this.BLOCKED_PATTERNS) {
        if (pattern.test(hostname)) {
          return {
            valid: false,
            reason: `Host "${hostname}" matches a blocked private network pattern.`
          };
        }
      }
      
      // Port check - block common internal service ports
      const blockedPorts = new Set(['22', '23', '25', '110', '143', '3306', '5432', '6379', '11211', '27017']);
      if (parsed.port && blockedPorts.has(parsed.port)) {
        return {
          valid: false,
          reason: `Port ${parsed.port} is commonly used by internal services and is blocked.`
        };
      }
      
      return { valid: true };
    } catch (e) {
      return {
        valid: false,
        reason: `Invalid URL format: ${e instanceof Error ? e.message : 'malformed URL'}`
      };
    }
  }
}

/**
 * Dangerous keys that could enable prototype pollution
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitize input object to prevent prototype pollution attacks
 * Recursively removes dangerous keys from objects
 * @param obj - Object to sanitize
 * @returns Sanitized copy of the object
 */
export function sanitizeInput<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeInput(item)) as T;
  }
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }
    // Recursively sanitize nested objects
    result[key] = sanitizeInput(value);
  }
  
  return result as T;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Import source types supported by the pipeline
 */
export type ImportSourceType = 'file' | 'url' | 'text' | 'clipboard';

/**
 * Import result status
 */
export type ImportStatus = 'success' | 'error' | 'partial' | 'unsupported';

/**
 * Result of an import operation
 */
export interface ImportResult {
  status: ImportStatus;
  agent?: CanvasAgent;
  sourceFormat: AgentSourceFormat;
  errors: ImportError[];
  warnings: string[];
  metadata: ImportMetadata;
}

/**
 * Import error details
 */
export interface ImportError {
  code: ImportErrorCode;
  message: string;
  field?: string;
  recoverable: boolean;
}

export type ImportErrorCode = 
  | 'PARSE_ERROR'
  | 'FORMAT_UNKNOWN'
  | 'VALIDATION_FAILED'
  | 'CONVERSION_ERROR'
  | 'MISSING_REQUIRED'
  | 'FILE_READ_ERROR'
  | 'NETWORK_ERROR'
  | 'UNSUPPORTED_FORMAT';

/**
 * Metadata about the import operation
 */
export interface ImportMetadata {
  sourceName: string;
  sourceType: ImportSourceType;
  detectedFormat: AgentSourceFormat;
  importTimestamp: number;
  conversionDuration: number;
  originalSize: number;
  convertedSize: number;
}

/**
 * Configuration for the import pipeline
 */
export interface ImportPipelineConfig {
  /** Enable strict validation (reject any validation errors) */
  strictValidation: boolean;
  /** Automatically generate missing required fields */
  autoFillRequired: boolean;
  /** Preserve original spec in _import_metadata */
  preserveOriginal: boolean;
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Allowed file extensions */
  allowedExtensions: string[];
}

const DEFAULT_CONFIG: ImportPipelineConfig = {
  strictValidation: false,
  autoFillRequired: true,
  preserveOriginal: true,
  maxFileSize: AGENT_CANVAS_CONSTANTS.MAX_AGENT_SPEC_SIZE,
  allowedExtensions: ['.json', '.yaml', '.yml'],
};

// =============================================================================
// Format Detection
// =============================================================================

/**
 * Detect the format of an agent specification
 */
export function detectAgentFormat(data: Record<string, unknown>): AgentSourceFormat {
  if (!data || typeof data !== 'object') {
    return 'unknown';
  }

  // Check for uSA format
  if (typeof data.apiVersion === 'string' && data.apiVersion.startsWith('usa/')) {
    return 'usa';
  }
  if (data.kind === 'Agent' && 'identity' in data) {
    return 'usa';
  }

  // Check for Replicant format
  if ('designation' in data && 'personality' in data) {
    return 'replicant';
  }
  if ('beliefs' in data && typeof data.beliefs === 'object' && data.beliefs !== null) {
    const beliefs = data.beliefs as Record<string, unknown>;
    if (['who', 'what', 'why', 'how', 'huh'].some(k => k in beliefs)) {
      return 'replicant';
    }
  }
  if ('emotional_ranges' in data) {
    return 'replicant';
  }

  // Check for ElizaOS format
  if ('plugins' in data && ('topics' in data || 'adjectives' in data)) {
    return 'eliza';
  }
  if ('system' in data && ('topics' in data || 'adjectives' in data)) {
    return 'eliza';
  }

  // Check for CrewAI format
  if ('agent' in data) {
    const inner = data.agent as Record<string, unknown>;
    if (inner && typeof inner === 'object' && ('role' in inner || 'backstory' in inner)) {
      return 'crewai';
    }
  }
  if ('role' in data && 'backstory' in data && 'goal' in data) {
    if (!('apiVersion' in data)) {
      return 'crewai';
    }
  }

  return 'unknown';
}

// =============================================================================
// Format Converters (TypeScript implementations)
// =============================================================================

/**
 * uSA v2 specification structure
 */
export interface USASpec {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  identity: {
    role: string;
    goal: string;
    backstory: string;
    personality_traits?: Record<string, unknown>;
    constraints?: string[];
  };
  capabilities: {
    tools?: Array<{ name: string; protocol?: string; config?: Record<string, unknown> }>;
    skills?: Array<{ name: string; type?: string; parameters?: Record<string, unknown> }>;
    reasoning?: {
      strategy?: string;
      max_iterations?: number;
      allow_backtracking?: boolean;
    };
    memory?: Record<string, unknown>;
  };
  protocols: {
    mcp?: { enabled: boolean; role?: string; servers?: unknown[] };
    a2a?: { enabled: boolean };
  };
  execution?: {
    llm?: {
      provider?: string;
      model?: string;
      temperature?: number;
      max_tokens?: number;
    };
    runtime?: {
      timeout?: number;
      max_iterations?: number;
      error_handling?: string;
    };
  };
  deployment?: {
    context?: string;
    environment?: Record<string, unknown>;
  };
  _import_metadata?: Record<string, unknown>;
}

/**
 * Convert ElizaOS persona to uSA format
 */
export function elizaPersonaToUSA(persona: Record<string, unknown>): USASpec {
  const name = (persona.name as string) || 'usa-eliza';
  const bio = Array.isArray(persona.bio) ? (persona.bio as string[]).join('\n') : (persona.bio as string) || '';
  const system = persona.system as string || '';
  const backstory = `${system}\n\n${bio}`.trim();
  
  // Build style object
  const styleAll = Array.isArray(persona.style?.all) ? persona.style.all : [];
  const styleChat = Array.isArray(persona.style?.chat) ? persona.style.chat : [];
  
  // Extract tools from plugins
  const plugins = persona.plugins as string[] || [];
  const tools = plugins.map(p => ({
    name: typeof p === 'string' ? p : String(p),
    protocol: 'eliza-plugin' as const,
    config: {}
  }));

  return {
    apiVersion: 'usa/v2',
    kind: 'Agent',
    metadata: {
      name,
      version: '1.0.0',
      description: `Imported from ElizaOS persona`,
      author: 'ElizaOS Import',
      tags: ['eliza', 'imported', ...(persona.topics as string[] || []).slice(0, 3)]
    },
    identity: {
      role: (persona.adjectives as string[] || [])[0] || 'AI Assistant',
      goal: `Assist users with ${(persona.topics as string[] || ['general topics']).join(', ')}`,
      backstory,
      personality_traits: {
        adjectives: persona.adjectives || [],
        topics: persona.topics || [],
        style: {
          all: styleAll,
          chat: styleChat
        }
      }
    },
    capabilities: {
      tools,
      skills: [],
      reasoning: {
        strategy: 'conversational',
        max_iterations: 10
      },
      memory: {
        architecture: 'simple',
        working: { enabled: true, max_tokens: 4096 },
        episodic: { enabled: true }
      }
    },
    protocols: {
      mcp: { enabled: false, role: 'client', servers: [] },
      a2a: { enabled: false }
    },
    execution: {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 4096
      }
    },
    deployment: {
      context: 'agent-canvas',
      environment: {}
    },
    _import_metadata: {
      source_format: 'eliza',
      original_plugins: plugins,
      message_examples: persona.messageExamples || []
    }
  };
}

/**
 * Convert CrewAI agent to uSA format
 */
export function crewaiAgentToUSA(agent: Record<string, unknown>): USASpec {
  const inner = (agent.agent as Record<string, unknown>) || agent;
  const name = (inner.role as string) || 'usa-crewai';
  const backstory = (inner.backstory as string) || '';
  const goal = (inner.goal as string) || '';
  const toolsList = (inner.tools as unknown[]) || [];
  
  const tools = toolsList.map(t => ({
    name: typeof t === 'string' ? t : String(t),
    description: 'CrewAI tool',
    protocol: 'crewai' as const,
    config: {}
  }));

  return {
    apiVersion: 'usa/v2',
    kind: 'Agent',
    metadata: {
      name,
      version: '1.0.0',
      description: goal,
      author: 'CrewAI Import',
      tags: ['crewai', 'imported']
    },
    identity: {
      role: (inner.role as string) || 'AI Assistant',
      goal,
      backstory
    },
    capabilities: {
      tools,
      skills: [],
      memory: {
        architecture: 'simple',
        working: { enabled: true }
      }
    },
    protocols: {
      mcp: { enabled: false },
      a2a: { enabled: false }
    },
    execution: {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7
      }
    },
    deployment: {
      context: 'agent-canvas',
      environment: {}
    },
    _import_metadata: {
      source_format: 'crewai',
      allow_delegation: inner.allow_delegation,
      verbose: inner.verbose
    }
  };
}

/**
 * Convert Replicant to uSA format
 */
export function replicantToUSA(replicant: Record<string, unknown>): USASpec {
  const name = (replicant.name as string) || 'Unknown Replicant';
  const designation = (replicant.designation as string) || '';
  const bio = (replicant.bio as string) || '';

  // Extract personality
  const personality = (replicant.personality as Record<string, unknown>) || {};
  const coreTraits = (personality.core_traits as string[]) || [];
  const quirks = (personality.quirks as string[]) || [];
  const values = (personality.values as string[]) || [];
  const fears = (personality.fears as string[]) || [];
  const aspirations = (personality.aspirations as string[]) || [];

  // Communication style
  const commStyle = (replicant.communication_style as Record<string, unknown>) || {};
  const signaturePhrases = (replicant.signature_phrases as string[]) || [];

  // Build backstory
  const backstoryParts = [bio];
  if (commStyle.all && Array.isArray(commStyle.all)) {
    backstoryParts.push(...(commStyle.all as string[]));
  }
  if (signaturePhrases.length > 0) {
    backstoryParts.push(`Characteristic phrases: ${signaturePhrases.slice(0, 3).join('; ')}`);
  }
  const backstory = backstoryParts.filter(Boolean).join(' ');

  // Extract capabilities
  const capabilitiesRaw = (replicant.capabilities as Record<string, unknown>) || {};
  const primaryCaps = (capabilitiesRaw.primary as string[]) || [];
  const secondaryCaps = (capabilitiesRaw.secondary as string[]) || [];
  const toolNames = (capabilitiesRaw.tools as string[]) || [];

  const tools = toolNames.map(t => ({
    name: t,
    protocol: 'native' as const,
    config: {}
  }));

  const skills = [
    ...primaryCaps.map(cap => ({ name: cap, type: 'primary', parameters: {} })),
    ...secondaryCaps.map(cap => ({ name: cap, type: 'secondary', parameters: {} }))
  ];

  // Extract beliefs for semantic memory
  const beliefs = (replicant.beliefs as Record<string, unknown[]>) || {};
  const beliefContent: Array<{ category: string; content: string; conviction: number }> = [];
  for (const [category, items] of Object.entries(beliefs)) {
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          const beliefItem = item as Record<string, unknown>;
          const content = beliefItem.content as string;
          const conviction = (beliefItem.conviction as number) || 0.5;
          if (content) {
            beliefContent.push({ category, content, conviction });
          }
        }
      }
    }
  }

  // Extract emotional ranges for procedural memory
  const emotionalRanges = (replicant.emotional_ranges as Record<string, unknown>) || {};
  const emotionalProcedures: Array<Record<string, unknown>> = [];
  for (const [emotion, config] of Object.entries(emotionalRanges)) {
    if (typeof config === 'object' && config !== null) {
      const emotionConfig = config as Record<string, unknown>;
      emotionalProcedures.push({
        name: `express_${emotion}`,
        triggers: emotionConfig.triggers || [],
        expressions: emotionConfig.expressions || [],
        voice_modifiers: emotionConfig.voice || {}
      });
    }
  }

  // Avatar and voice
  const avatar = (replicant.avatar as Record<string, unknown>) || {};
  const voice = (replicant.voice as Record<string, unknown>) || {};

  const goal = aspirations[0] || `Fulfill role as ${designation}`;

  return {
    apiVersion: 'usa/v2',
    kind: 'Agent',
    metadata: {
      name,
      version: '1.0.0',
      description: designation,
      author: 'Replicant Import',
      tags: ['replicant', 'imported', ...coreTraits.slice(0, 3)]
    },
    identity: {
      role: designation || 'AI Assistant',
      goal,
      backstory,
      personality_traits: {
        core_traits: coreTraits,
        quirks,
        values,
        fears,
        aspirations
      },
      constraints: fears
    },
    capabilities: {
      tools,
      skills,
      reasoning: {
        strategy: 'chain_of_thought',
        max_iterations: 20,
        allow_backtracking: true
      },
      memory: {
        architecture: 'hierarchical',
        working: { enabled: true, max_tokens: 8192 },
        episodic: { enabled: true, storage: 'vector_db' },
        semantic: {
          enabled: true,
          storage: 'hybrid',
          initial_knowledge: beliefContent
        },
        procedural: {
          enabled: true,
          storage: 'structured',
          initial_procedures: emotionalProcedures
        },
        core: {
          enabled: true,
          blocks: [
            { name: 'persona', content: bio, editable: false },
            { name: 'traits', content: coreTraits.join(', '), editable: false }
          ]
        }
      }
    },
    protocols: {
      mcp: { enabled: false, role: 'client', servers: [] },
      a2a: { enabled: false }
    },
    execution: {
      llm: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 4096
      },
      runtime: {
        timeout: 300,
        max_iterations: 20,
        error_handling: 'graceful_degradation'
      }
    },
    deployment: {
      context: 'agent-canvas',
      environment: {}
    },
    _import_metadata: {
      source_format: 'replicant',
      avatar: {
        type: avatar.base_model || 'generated',
        appearance: avatar.appearance || {},
        animations: avatar.animations || {}
      },
      voice: {
        model: voice.model || 'default',
        speaker: voice.speaker || 'default',
        characteristics: voice.characteristics || [],
        speed: voice.speed || 1.0,
        pitch: voice.pitch || 1.0
      },
      communication_style: commStyle,
      signature_phrases: signaturePhrases,
      privacy_preferences: replicant.privacy_preferences || {}
    }
  };
}

/**
 * Convert any supported format to uSA
 */
export function convertToUSA(
  data: Record<string, unknown>, 
  sourceFormat?: AgentSourceFormat
): USASpec {
  const format = sourceFormat || detectAgentFormat(data);

  switch (format) {
    case 'usa':
      return data as unknown as USASpec;
    case 'eliza':
      return elizaPersonaToUSA(data);
    case 'crewai':
      return crewaiAgentToUSA(data);
    case 'replicant':
      return replicantToUSA(data);
    default:
      throw new Error(`Unknown or unsupported agent format: ${format}`);
  }
}

// =============================================================================
// YAML Parser (minimal implementation)
// =============================================================================

/**
 * Simple YAML-like parser for basic agent specs
 * For full YAML support, use js-yaml library
 */
function parseSimpleYAML(content: string): Record<string, unknown> {
  // This is a simplified parser - for production use js-yaml
  const lines = content.split('\n');
  const result: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [{ indent: -1, obj: result }];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    const colonIndex = trimmed.indexOf(':');
    
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    let value: string | unknown = trimmed.substring(colonIndex + 1).trim();

    // Pop stack to find correct parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (value === '' || value === '|' || value === '>') {
      // Nested object or multiline string
      const nested: Record<string, unknown> = {};
      parent[key] = nested;
      stack.push({ indent, obj: nested });
    } else {
      // Simple value - try to parse as JSON, fallback to string
      try {
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value === 'null') value = null;
        else if (/^-?\d+$/.test(value as string)) value = parseInt(value as string, 10);
        else if (/^-?\d+\.\d+$/.test(value as string)) value = parseFloat(value as string);
        else if ((value as string).startsWith('[') || (value as string).startsWith('{')) {
          value = JSON.parse(value as string);
        } else if ((value as string).startsWith('"') || (value as string).startsWith("'")) {
          value = (value as string).slice(1, -1);
        }
      } catch {
        // Keep as string
      }
      parent[key] = value;
    }
  }

  return result;
}

// =============================================================================
// Import Pipeline Class
// =============================================================================

/**
 * AgentImportPipeline orchestrates the import of agent specifications
 */
export class AgentImportPipeline {
  private config: ImportPipelineConfig;

  constructor(config: Partial<ImportPipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Import from a File object (browser File API)
   */
  async importFromFile(file: File): Promise<ImportResult> {
    const startTime = performance.now();
    const errors: ImportError[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'VALIDATION_FAILED',
          message: `File size ${file.size} exceeds maximum ${this.config.maxFileSize}`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata(file.name, 'file', 'unknown', startTime, 0, file.size)
      };
    }

    // Check extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'UNSUPPORTED_FORMAT',
          message: `File extension ${ext} not supported. Allowed: ${this.config.allowedExtensions.join(', ')}`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata(file.name, 'file', 'unknown', startTime, 0, file.size)
      };
    }

    // Read file content
    let content: string;
    try {
      content = await file.text();
    } catch (e) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata(file.name, 'file', 'unknown', startTime, 0, file.size)
      };
    }

    return this.importFromText(content, file.name, 'file', file.size, startTime);
  }

  /**
   * Import from a URL
   * Validates URL against SSRF attacks before fetching
   */
  async importFromURL(url: string): Promise<ImportResult> {
    const startTime = performance.now();

    // SECURITY: Validate URL to prevent SSRF attacks
    const validation = URLValidator.validate(url);
    if (!validation.valid) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'VALIDATION_FAILED',
          message: `URL validation failed: ${validation.reason}`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata(url, 'url', 'unknown', startTime, 0, 0)
      };
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10) || content.length;
      
      return this.importFromText(content, url, 'url', contentLength, startTime);
    } catch (e) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'NETWORK_ERROR',
          message: `Failed to fetch URL: ${e instanceof Error ? e.message : String(e)}`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata(url, 'url', 'unknown', startTime, 0, 0)
      };
    }
  }

  /**
   * Import from raw text content
   * Includes input validation for size limits and sanitization
   */
  async importFromText(
    content: string,
    sourceName: string = 'text-import',
    sourceType: ImportSourceType = 'text',
    originalSize?: number,
    startTime?: number
  ): Promise<ImportResult> {
    const start = startTime ?? performance.now();
    const size = originalSize ?? content.length;
    const errors: ImportError[] = [];
    const warnings: string[] = [];

    // SECURITY: Check content size before processing
    if (size > this.config.maxFileSize) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'VALIDATION_FAILED',
          message: `Content size ${size} bytes exceeds maximum allowed ${this.config.maxFileSize} bytes`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata(sourceName, sourceType, 'unknown', start, 0, size)
      };
    }

    // Parse content
    let data: Record<string, unknown>;
    try {
      // Try JSON first
      data = JSON.parse(content);
      // SECURITY: Sanitize parsed data to prevent prototype pollution
      data = sanitizeInput(data);
    } catch {
      // Try YAML
      try {
        data = parseSimpleYAML(content);
        if (Object.keys(data).length === 0) {
          throw new Error('Empty YAML result');
        }
        // SECURITY: Sanitize parsed data to prevent prototype pollution
        data = sanitizeInput(data);
        warnings.push('Parsed as YAML - for complex YAML, consider using JSON');
      } catch (e) {
        return {
          status: 'error',
          sourceFormat: 'unknown',
          errors: [{
            code: 'PARSE_ERROR',
            message: `Failed to parse content as JSON or YAML: ${e instanceof Error ? e.message : String(e)}`,
            recoverable: false
          }],
          warnings: [],
          metadata: this.createMetadata(sourceName, sourceType, 'unknown', start, 0, size)
        };
      }
    }

    // Detect format
    const sourceFormat = detectAgentFormat(data);
    if (sourceFormat === 'unknown') {
      return {
        status: 'unsupported',
        sourceFormat: 'unknown',
        errors: [{
          code: 'FORMAT_UNKNOWN',
          message: 'Could not detect agent format. Supported: uSA, ElizaOS, CrewAI, Replicant',
          recoverable: false
        }],
        warnings,
        metadata: this.createMetadata(sourceName, sourceType, 'unknown', start, 0, size)
      };
    }

    // Convert to uSA
    let usaSpec: USASpec;
    try {
      usaSpec = convertToUSA(data, sourceFormat);
    } catch (e) {
      return {
        status: 'error',
        sourceFormat,
        errors: [{
          code: 'CONVERSION_ERROR',
          message: `Failed to convert to uSA: ${e instanceof Error ? e.message : String(e)}`,
          recoverable: false
        }],
        warnings,
        metadata: this.createMetadata(sourceName, sourceType, sourceFormat, start, 0, size)
      };
    }

    // Validate required fields
    const validationErrors = this.validateUSASpec(usaSpec);
    if (validationErrors.length > 0) {
      if (this.config.strictValidation) {
        return {
          status: 'error',
          sourceFormat,
          errors: validationErrors,
          warnings,
          metadata: this.createMetadata(sourceName, sourceType, sourceFormat, start, 0, size)
        };
      } else {
        // Auto-fill if configured
        if (this.config.autoFillRequired) {
          usaSpec = this.autoFillMissing(usaSpec);
          warnings.push('Some required fields were auto-filled');
        }
        errors.push(...validationErrors.map(e => ({ ...e, recoverable: true })));
      }
    }

    // Preserve original if configured
    if (this.config.preserveOriginal && !usaSpec._import_metadata) {
      usaSpec._import_metadata = {};
    }
    if (this.config.preserveOriginal && usaSpec._import_metadata) {
      usaSpec._import_metadata.original_spec = data;
    }

    // Create canvas agent
    const convertedSize = JSON.stringify(usaSpec).length;
    const agent = createCanvasAgent(usaSpec, sourceFormat);

    return {
      status: errors.length > 0 ? 'partial' : 'success',
      agent,
      sourceFormat,
      errors,
      warnings,
      metadata: this.createMetadata(sourceName, sourceType, sourceFormat, start, convertedSize, size)
    };
  }

  /**
   * Import from clipboard
   */
  async importFromClipboard(): Promise<ImportResult> {
    const startTime = performance.now();
    
    try {
      const text = await navigator.clipboard.readText();
      return this.importFromText(text, 'clipboard', 'clipboard', text.length, startTime);
    } catch (e) {
      return {
        status: 'error',
        sourceFormat: 'unknown',
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read clipboard: ${e instanceof Error ? e.message : String(e)}`,
          recoverable: false
        }],
        warnings: [],
        metadata: this.createMetadata('clipboard', 'clipboard', 'unknown', startTime, 0, 0)
      };
    }
  }

  /**
   * Validate uSA specification
   */
  private validateUSASpec(spec: USASpec): ImportError[] {
    const errors: ImportError[] = [];

    if (!spec.metadata?.name) {
      errors.push({
        code: 'MISSING_REQUIRED',
        message: 'Missing required field: metadata.name',
        field: 'metadata.name',
        recoverable: true
      });
    }

    if (!spec.identity?.role) {
      errors.push({
        code: 'MISSING_REQUIRED',
        message: 'Missing required field: identity.role',
        field: 'identity.role',
        recoverable: true
      });
    }

    if (!spec.identity?.goal) {
      errors.push({
        code: 'MISSING_REQUIRED',
        message: 'Missing required field: identity.goal',
        field: 'identity.goal',
        recoverable: true
      });
    }

    return errors;
  }

  /**
   * Auto-fill missing required fields
   */
  private autoFillMissing(spec: USASpec): USASpec {
    const filled = { ...spec };

    if (!filled.metadata) {
      filled.metadata = { name: 'Unknown Agent', version: '1.0.0' };
    }
    if (!filled.metadata.name) {
      filled.metadata.name = 'Imported Agent';
    }
    if (!filled.metadata.version) {
      filled.metadata.version = '1.0.0';
    }

    if (!filled.identity) {
      filled.identity = { role: 'AI Assistant', goal: 'Assist users', backstory: '' };
    }
    if (!filled.identity.role) {
      filled.identity.role = 'AI Assistant';
    }
    if (!filled.identity.goal) {
      filled.identity.goal = 'Assist users with their tasks';
    }

    return filled;
  }

  /**
   * Create metadata object
   */
  private createMetadata(
    sourceName: string,
    sourceType: ImportSourceType,
    detectedFormat: AgentSourceFormat,
    startTime: number,
    convertedSize: number,
    originalSize: number
  ): ImportMetadata {
    return {
      sourceName,
      sourceType,
      detectedFormat,
      importTimestamp: Date.now(),
      conversionDuration: performance.now() - startTime,
      originalSize,
      convertedSize
    };
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): ImportPipelineConfig {
    return { ...this.config };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(config: Partial<ImportPipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultPipeline: AgentImportPipeline | null = null;

/**
 * Get the default import pipeline instance
 */
export function getDefaultImportPipeline(): AgentImportPipeline {
  if (!defaultPipeline) {
    defaultPipeline = new AgentImportPipeline();
  }
  return defaultPipeline;
}

/**
 * Quick import from file using default pipeline
 */
export async function importAgentFile(file: File): Promise<ImportResult> {
  return getDefaultImportPipeline().importFromFile(file);
}

/**
 * Quick import from URL using default pipeline
 */
export async function importAgentURL(url: string): Promise<ImportResult> {
  return getDefaultImportPipeline().importFromURL(url);
}

/**
 * Quick import from text using default pipeline
 */
export async function importAgentText(text: string): Promise<ImportResult> {
  return getDefaultImportPipeline().importFromText(text);
}