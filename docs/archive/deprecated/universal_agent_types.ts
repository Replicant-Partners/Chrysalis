/**
 * Universal Agent Type Definitions
 * 
 * Framework-agnostic agent definitions that can be converted to
 * either CrewAI or ElizaOS configurations.
 */

/**
 * Core belief structure representing agent's mental model
 */
export interface Belief {
  content: string;
  conviction: number;  // 0-1 scale
  privacy: 'PUBLIC' | 'PRIVATE';
  source: 'experience' | 'reasoned' | 'public' | 'introspection' | 'internal_reasoning' | 'private_experience';
}

/**
 * Emotional state definition
 */
export interface EmotionalState {
  triggers: string[];
  expressions: string[];
  voice?: {
    speed: number;
    pitch: number;
  };
}

/**
 * Knowledge source (file or directory reference)
 */
export interface KnowledgeSource {
  path?: string;
  directory?: string;
  shared?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  type: 'vector' | 'graph' | 'hybrid';
  provider: 'qdrant' | 'pinecone' | 'chromadb' | 'weaviate' | 'postgres';
  settings: {
    collection?: string;
    vector_size?: number;
    distance_metric?: 'cosine' | 'euclidean' | 'dot';
    [key: string]: any;
  };
}

/**
 * Universal Agent - Framework-agnostic agent definition
 */
export interface UniversalAgent {
  // Core Identity
  identity: {
    name: string;
    designation: string;  // Role/title
    bio: string | string[];
    username?: string;  // For social platforms
  };

  // Personality (rich definition)
  personality: {
    core_traits: string[];
    values: string[];
    quirks: string[];
    fears?: string[];
    aspirations?: string[];
  };

  // Communication styles
  communication: {
    style: {
      all: string[];         // General communication rules
      work?: string[];       // Professional/task-oriented
      casual?: string[];     // Informal conversation
      formal?: string[];     // Formal communication
      social?: string[];     // Social media
      introspective?: string[];  // Self-reflection
    };
    signature_phrases?: string[];
    emotional_ranges?: Record<string, EmotionalState>;
  };

  // Capabilities (framework-agnostic)
  capabilities: {
    primary: string[];      // Main skills
    secondary: string[];    // Supporting skills
    domains: string[];      // Knowledge domains
    tools?: string[];       // Tool names/identifiers
  };

  // Knowledge Base
  knowledge: {
    facts: string[];
    topics: string[];
    expertise: string[];
    sources?: KnowledgeSource[];
    lore?: string[];  // Background information
  };

  // Memory Configuration
  memory: MemoryConfig;

  // Beliefs & Mental Models (for consistent reasoning)
  beliefs: {
    who: Belief[];    // Identity beliefs
    what: Belief[];   // Factual beliefs
    why: Belief[];    // Motivational beliefs
    how: Belief[];    // Methodological beliefs
    where?: Belief[]; // Location/context beliefs
    when?: Belief[];  // Temporal beliefs
    huh?: Belief[];   // Uncertainties/questions
  };

  // Training examples (for fine-tuning behavior)
  examples?: {
    conversations?: Array<Array<{
      role: 'user' | 'agent' | 'system';
      content: string;
    }>>;
    posts?: string[];  // Example social media posts
    outputs?: Array<{
      input: string;
      output: string;
      context?: string;
    }>;
  };

  // Avatar/appearance (optional)
  avatar?: {
    description?: string;
    appearance?: Record<string, any>;
    animations?: Record<string, string>;
    image_url?: string;
  };

  // Voice configuration (optional)
  voice?: {
    model?: string;
    speaker?: string;
    characteristics?: string[];
    speed?: number;
    pitch?: number;
  };

  // Framework-Specific Adapters (optional overrides)
  adapters?: {
    crewai?: CrewAIAdapter;
    elizaos?: ElizaOSAdapter;
  };

  // Metadata
  metadata?: {
    version?: string;
    created?: string;
    updated?: string;
    author?: string;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * CrewAI-specific adapter configuration
 */
export interface CrewAIAdapter {
  // Agent configuration overrides
  agent?: {
    role?: string;
    goal?: string;
    backstory?: string;
    verbose?: boolean;
    allow_delegation?: boolean;
    max_iter?: number;
    max_rpm?: number;
    temperature?: number;
  };

  // System prompt customization
  system_prompt?: string;
  prompt_template?: string;

  // Tools mapping
  tools?: Array<{
    name: string;
    import_path: string;
    config?: Record<string, any>;
  }>;

  // Memory configuration
  memory?: {
    enabled?: boolean;
    type?: 'short_term' | 'long_term' | 'entity';
  };

  // LLM configuration
  llm?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };
}

/**
 * ElizaOS-specific adapter configuration
 */
export interface ElizaOSAdapter {
  // Character configuration overrides
  character?: {
    system?: string;
    templates?: Record<string, string | Function>;
    adjectives?: string[];
  };

  // Plugin configuration
  plugins?: string[];

  // Custom actions
  actions?: Array<{
    name: string;
    description: string;
    implementation?: string;  // Path to implementation
  }>;

  // Custom providers
  providers?: Array<{
    name: string;
    implementation?: string;
  }>;

  // Custom evaluators
  evaluators?: Array<{
    name: string;
    description: string;
    implementation?: string;
  }>;

  // Settings
  settings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };

  // Secrets (sensitive configuration)
  secrets?: Record<string, string>;
}

/**
 * Memory interface for universal storage
 */
export interface UniversalMemory {
  id: string;
  agentId: string;
  type: 'conversation' | 'fact' | 'event' | 'relationship' | 'task' | 'reflection';
  content: string;
  embedding?: number[];
  timestamp: Date;
  privacy: 'PUBLIC' | 'PRIVATE';
  source: string;
  metadata?: Record<string, any>;
  relationships?: Array<{
    targetId: string;
    type: string;
    strength: number;
  }>;
}

/**
 * Unified context structure
 */
export interface UniversalContext {
  memories: UniversalMemory[];
  facts: Record<string, any>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    properties: Record<string, any>;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
  }>;
  temporal: {
    timestamp: Date;
    timezone: string;
  };
}

/**
 * Action/Tool definition (framework-agnostic)
 */
export interface UniversalAction {
  name: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    default?: any;
  }>;
  examples?: Array<{
    input: Record<string, any>;
    output: any;
    explanation?: string;
  }>;
  validation?: {
    rules: string[];
    errorMessage?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Conversion result types
 */
export interface CrewAIConfig {
  agent: {
    role: string;
    goal: string;
    backstory: string;
    tools: string[];
    verbose: boolean;
    allow_delegation: boolean;
    max_iter?: number;
    max_rpm?: number;
  };
  system_prompt: string;
  tools_config: Array<{
    name: string;
    import_statement: string;
  }>;
}

export interface ElizaOSConfig {
  name: string;
  username?: string;
  bio: string | string[];
  system?: string;
  templates?: Record<string, string>;
  adjectives: string[];
  topics: string[];
  knowledge: Array<string | KnowledgeSource>;
  messageExamples?: Array<Array<{
    name: string;
    content: { text: string };
  }>>;
  postExamples?: string[];
  style: {
    all: string[];
    chat?: string[];
    post?: string[];
  };
  plugins: string[];
  settings: Record<string, any>;
  secrets?: Record<string, string>;
  beliefs?: {
    who: Belief[];
    what: Belief[];
    why: Belief[];
    how: Belief[];
    huh?: Belief[];
  };
}
