/**
 * Agent Capabilities Component
 * 
 * Manages tools, skills, and domain expertise.
 * Capabilities expand through learning and experience.
 * 
 * Single Responsibility: Capability and skill management
 */

/**
 * Tool definition with usage statistics
 */
export interface ToolDefinition {
  name: string;
  protocol: 'mcp' | 'native' | 'api';
  config: Record<string, unknown>;
  description?: string;
  usage_stats?: {
    total_invocations: number;
    success_rate: number;
    average_latency_ms: number;
    last_used: string;
    preferred_contexts: string[];
  };
}

/**
 * Skill with learning tracking
 */
export interface Skill {
  skill_id: string;
  name: string;
  category: string;
  proficiency: number;  // 0.0 - 1.0
  acquired: string;
  source_instances: string[];
  
  learning_curve: {
    timestamp: string;
    proficiency: number;
    event: string;
  }[];
  
  usage: {
    total_invocations: number;
    success_rate: number;
    contexts: string[];
    last_used: string;
  };
  
  prerequisites: string[];
  enables: string[];
  synergies: {
    skill_id: string;
    synergy_strength: number;
  }[];
}

/**
 * Capabilities data structure
 */
export interface AgentCapabilitiesData {
  primary: string[];
  secondary: string[];
  domains: string[];
  tools?: ToolDefinition[];
  learned_skills?: Skill[];
}

/**
 * Tool invocation result
 */
export interface ToolInvocationResult {
  success: boolean;
  latency_ms: number;
  context?: string;
}

/**
 * Agent Capabilities Manager
 * 
 * Handles tools, skills, and their evolution through usage.
 */
export class AgentCapabilities {
  private data: AgentCapabilitiesData;

  constructor(data?: Partial<AgentCapabilitiesData>) {
    this.data = {
      primary: data?.primary || [],
      secondary: data?.secondary || [],
      domains: data?.domains || [],
      tools: data?.tools || [],
      learned_skills: data?.learned_skills || [],
    };
  }

  // ============================================================================
  // Capability Management
  // ============================================================================

  /**
   * Add a primary capability
   */
  addPrimaryCapability(capability: string): void {
    if (!this.data.primary.includes(capability)) {
      this.data.primary.push(capability);
    }
  }

  /**
   * Add a secondary capability
   */
  addSecondaryCapability(capability: string): void {
    if (!this.data.secondary.includes(capability)) {
      this.data.secondary.push(capability);
    }
  }

  /**
   * Add a domain
   */
  addDomain(domain: string): void {
    if (!this.data.domains.includes(domain)) {
      this.data.domains.push(domain);
    }
  }

  /**
   * Check if agent has a capability
   */
  hasCapability(capability: string): boolean {
    return this.data.primary.includes(capability) || 
           this.data.secondary.includes(capability);
  }

  // ============================================================================
  // Tool Management
  // ============================================================================

  /**
   * Add a tool
   */
  addTool(tool: ToolDefinition): void {
    if (!this.data.tools) {
      this.data.tools = [];
    }
    
    const existing = this.data.tools.findIndex(t => t.name === tool.name);
    if (existing !== -1) {
      this.data.tools[existing] = tool;
    } else {
      this.data.tools.push(tool);
    }
  }

  /**
   * Remove a tool
   */
  removeTool(name: string): void {
    if (this.data.tools) {
      this.data.tools = this.data.tools.filter(t => t.name !== name);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.data.tools?.find(t => t.name === name);
  }

  /**
   * Record tool invocation
   */
  recordToolInvocation(name: string, result: ToolInvocationResult): void {
    const tool = this.getTool(name);
    if (!tool) return;

    if (!tool.usage_stats) {
      tool.usage_stats = {
        total_invocations: 0,
        success_rate: 1.0,
        average_latency_ms: 0,
        last_used: new Date().toISOString(),
        preferred_contexts: [],
      };
    }

    const stats = tool.usage_stats;
    const prevTotal = stats.total_invocations;
    
    stats.total_invocations++;
    stats.success_rate = (stats.success_rate * prevTotal + (result.success ? 1 : 0)) / stats.total_invocations;
    stats.average_latency_ms = (stats.average_latency_ms * prevTotal + result.latency_ms) / stats.total_invocations;
    stats.last_used = new Date().toISOString();
    
    if (result.context && !stats.preferred_contexts.includes(result.context)) {
      stats.preferred_contexts.push(result.context);
    }
  }

  /**
   * Get tools by protocol
   */
  getToolsByProtocol(protocol: ToolDefinition['protocol']): ToolDefinition[] {
    return this.data.tools?.filter(t => t.protocol === protocol) || [];
  }

  // ============================================================================
  // Skill Management
  // ============================================================================

  /**
   * Add or update a skill
   */
  addSkill(skill: Skill): void {
    if (!this.data.learned_skills) {
      this.data.learned_skills = [];
    }

    const existing = this.data.learned_skills.findIndex(s => s.skill_id === skill.skill_id);
    if (existing !== -1) {
      // Merge skill data
      const existingSkill = this.data.learned_skills[existing];
      existingSkill.proficiency = Math.max(existingSkill.proficiency, skill.proficiency);
      existingSkill.source_instances = [...new Set([
        ...existingSkill.source_instances,
        ...skill.source_instances,
      ])];
      existingSkill.learning_curve.push(...skill.learning_curve);
    } else {
      this.data.learned_skills.push(skill);
    }
  }

  /**
   * Get a skill by ID
   */
  getSkill(skillId: string): Skill | undefined {
    return this.data.learned_skills?.find(s => s.skill_id === skillId);
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: string): Skill[] {
    return this.data.learned_skills?.filter(s => s.category === category) || [];
  }

  /**
   * Update skill proficiency
   */
  updateSkillProficiency(skillId: string, proficiency: number, event: string): void {
    const skill = this.getSkill(skillId);
    if (!skill) return;

    skill.proficiency = Math.max(0, Math.min(1, proficiency));
    skill.learning_curve.push({
      timestamp: new Date().toISOString(),
      proficiency: skill.proficiency,
      event,
    });
  }

  /**
   * Record skill usage
   */
  recordSkillUsage(skillId: string, success: boolean, context?: string): void {
    const skill = this.getSkill(skillId);
    if (!skill) return;

    const prevTotal = skill.usage.total_invocations;
    skill.usage.total_invocations++;
    skill.usage.success_rate = (skill.usage.success_rate * prevTotal + (success ? 1 : 0)) / skill.usage.total_invocations;
    skill.usage.last_used = new Date().toISOString();
    
    if (context && !skill.usage.contexts.includes(context)) {
      skill.usage.contexts.push(context);
    }
  }

  /**
   * Get skill synergies
   */
  getSkillSynergies(skillId: string): { skill: Skill; strength: number }[] {
    const skill = this.getSkill(skillId);
    if (!skill) return [];

    return skill.synergies
      .map(s => ({
        skill: this.getSkill(s.skill_id),
        strength: s.synergy_strength,
      }))
      .filter((s): s is { skill: Skill; strength: number } => s.skill !== undefined);
  }

  /**
   * Calculate overall capability score
   */
  getCapabilityScore(): number {
    const toolScore = (this.data.tools?.length || 0) * 0.1;
    const skillScore = (this.data.learned_skills?.reduce((sum, s) => sum + s.proficiency, 0) || 0) * 0.2;
    const capabilityScore = (this.data.primary.length + this.data.secondary.length * 0.5) * 0.1;
    
    return Math.min(1, toolScore + skillScore + capabilityScore);
  }

  // Getters
  get primary(): readonly string[] { return this.data.primary; }
  get secondary(): readonly string[] { return this.data.secondary; }
  get domains(): readonly string[] { return this.data.domains; }
  get tools(): readonly ToolDefinition[] { return this.data.tools || []; }
  get skills(): readonly Skill[] { return this.data.learned_skills || []; }

  /**
   * Export capabilities data
   */
  toData(): AgentCapabilitiesData {
    return { ...this.data };
  }

  /**
   * Merge with another capabilities set
   */
  merge(other: AgentCapabilities): void {
    // Merge capabilities
    other.data.primary.forEach(c => this.addPrimaryCapability(c));
    other.data.secondary.forEach(c => this.addSecondaryCapability(c));
    other.data.domains.forEach(d => this.addDomain(d));

    // Merge tools
    other.data.tools?.forEach(t => this.addTool(t));

    // Merge skills
    other.data.learned_skills?.forEach(s => this.addSkill(s));
  }
}

/**
 * Validate capabilities data structure
 */
export function validateCapabilities(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Capabilities must be an object'] };
  }

  const caps = data as Record<string, unknown>;

  if (!Array.isArray(caps.primary)) {
    errors.push('Capabilities must have primary array');
  }

  if (!Array.isArray(caps.secondary)) {
    errors.push('Capabilities must have secondary array');
  }

  if (!Array.isArray(caps.domains)) {
    errors.push('Capabilities must have domains array');
  }

  return { valid: errors.length === 0, errors };
}
