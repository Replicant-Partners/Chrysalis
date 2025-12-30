/**
 * Lossless Agent Morphing System
 * 
 * Enables bidirectional conversion between CrewAI and ElizaOS without data loss.
 * Uses encryption to preserve framework-specific information in "shadow" fields.
 */

import * as crypto from 'crypto';
import type { UniversalAgent, CrewAIConfig, ElizaOSConfig } from './universal_agent_types';

// ===== Type Definitions =====

/**
 * Shadow data - encrypted framework-specific information
 */
interface ShadowData {
  framework: 'crewai' | 'elizaos';
  version: string;
  timestamp: number;
  data: any;  // Original framework-specific data
  checksum: string;  // For integrity verification
}

/**
 * Morphable agent - contains visible data + encrypted shadow
 */
interface MorphableAgent {
  // Visible cross-framework data
  visible: UniversalAgent;
  
  // Encrypted shadow containing framework-specific data
  shadow: {
    encrypted: string;  // Base64 encoded encrypted data
    algorithm: string;  // Encryption algorithm used
    iv: string;         // Initialization vector
    signature: string;  // Digital signature for verification
  };
  
  // Agent identity for verification
  identity: {
    agentId: string;
    publicKey: string;   // For signature verification
    fingerprint: string; // Unique agent fingerprint
  };
}

/**
 * Conversion result with restoration capability
 */
interface ConversionResult {
  converted: CrewAIConfig | ElizaOSConfig;
  morphable: MorphableAgent;
  restorationKey: string;  // Key for decrypting shadow data
}

// ===== Core Morphing System =====

export class AgentMorphingSystem {
  private algorithm = 'aes-256-gcm';
  
  /**
   * Generate agent identity fingerprint
   */
  private generateFingerprint(agent: any): string {
    const data = JSON.stringify({
      name: agent.name || agent.identity?.name,
      designation: agent.designation || agent.identity?.designation,
      timestamp: agent.metadata?.created || Date.now()
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Generate encryption key from agent identity
   */
  private deriveKey(agentFingerprint: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(agentFingerprint, salt, 100000, 32, 'sha256');
  }
  
  /**
   * Encrypt data
   */
  private encrypt(data: any, key: Buffer): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    
    const authTag = (cipher as any).getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }
  
  /**
   * Decrypt data
   */
  private decrypt(
    encrypted: string,
    key: Buffer,
    iv: string,
    authTag: string
  ): any {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'base64')
    );
    
    (decipher as any).setAuthTag(Buffer.from(authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }
  
  /**
   * Generate digital signature
   */
  private sign(data: string, privateKey: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'base64');
  }
  
  /**
   * Verify digital signature
   */
  private verify(data: string, signature: string, publicKey: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  }
  
  /**
   * Create shadow data with checksum
   */
  private createShadow(
    framework: 'crewai' | 'elizaos',
    data: any
  ): ShadowData {
    const shadow: ShadowData = {
      framework,
      version: '1.0.0',
      timestamp: Date.now(),
      data,
      checksum: crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex')
    };
    
    return shadow;
  }
  
  /**
   * Verify shadow data integrity
   */
  private verifyShadow(shadow: ShadowData): boolean {
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(shadow.data))
      .digest('hex');
    
    return checksum === shadow.checksum;
  }
  
  // ===== ElizaOS → CrewAI Conversion =====
  
  /**
   * Convert ElizaOS character to CrewAI agent (lossless)
   */
  async elizaOSToCrewAI(
    elizaOS: ElizaOSConfig,
    privateKey?: string
  ): Promise<ConversionResult> {
    // 1. Extract what maps naturally to CrewAI
    const crewAIConfig: CrewAIConfig = {
      agent: {
        role: elizaOS.name,
        goal: this.deriveGoalFromElizaOS(elizaOS),
        backstory: this.buildBackstoryFromElizaOS(elizaOS),
        tools: this.mapElizaOSPluginsToTools(elizaOS.plugins),
        verbose: true,
        allow_delegation: false
      },
      system_prompt: this.buildSystemPromptFromElizaOS(elizaOS),
      tools_config: []
    };
    
    // 2. Identify ElizaOS-specific data that doesn't map to CrewAI
    const elizaOSSpecific = {
      messageExamples: elizaOS.messageExamples,
      postExamples: elizaOS.postExamples,
      style: elizaOS.style,
      templates: elizaOS.templates,
      plugins: elizaOS.plugins,
      settings: elizaOS.settings,
      secrets: elizaOS.secrets,
      beliefs: elizaOS.beliefs,
      adjectives: elizaOS.adjectives,
      topics: elizaOS.topics,
      username: elizaOS.username,
      
      // Store original ElizaOS config for perfect restoration
      _original_elizaos_config: elizaOS
    };
    
    // 3. Create shadow data
    const shadow = this.createShadow('elizaos', elizaOSSpecific);
    
    // 4. Generate agent fingerprint
    const fingerprint = this.generateFingerprint(elizaOS);
    
    // 5. Generate encryption key from agent identity
    const salt = crypto.randomBytes(16).toString('base64');
    const key = this.deriveKey(fingerprint, salt);
    
    // 6. Encrypt shadow data
    const { encrypted, iv, authTag } = this.encrypt(shadow, key);
    
    // 7. Generate signature (if private key provided)
    const dataToSign = `${encrypted}:${iv}:${authTag}:${fingerprint}`;
    const signature = privateKey 
      ? this.sign(dataToSign, privateKey)
      : crypto.createHash('sha256').update(dataToSign).digest('base64');
    
    // 8. Create morphable agent
    const morphable: MorphableAgent = {
      visible: this.elizaOSToUniversal(elizaOS),
      shadow: {
        encrypted,
        algorithm: this.algorithm,
        iv,
        signature
      },
      identity: {
        agentId: elizaOS.name,
        publicKey: privateKey ? this.extractPublicKey(privateKey) : '',
        fingerprint
      }
    };
    
    // 9. Embed shadow in CrewAI config (in backstory or custom field)
    const crewAIWithShadow = this.embedShadowInCrewAI(crewAIConfig, morphable);
    
    // 10. Create restoration key
    const restorationKey = `${salt}:${authTag}`;
    
    return {
      converted: crewAIWithShadow,
      morphable,
      restorationKey
    };
  }
  
  /**
   * Restore ElizaOS from CrewAI agent (lossless)
   */
  async crewAIToElizaOS(
    crewAI: CrewAIConfig,
    restorationKey: string,
    publicKey?: string
  ): Promise<ElizaOSConfig> {
    // 1. Extract morphable agent from CrewAI config
    const morphable = this.extractShadowFromCrewAI(crewAI);
    
    if (!morphable) {
      throw new Error('No shadow data found - this agent was not morphed from ElizaOS');
    }
    
    // 2. Parse restoration key
    const [salt, authTag] = restorationKey.split(':');
    
    // 3. Verify signature (if public key provided)
    if (publicKey) {
      const dataToSign = `${morphable.shadow.encrypted}:${morphable.shadow.iv}:${authTag}:${morphable.identity.fingerprint}`;
      const isValid = this.verify(dataToSign, morphable.shadow.signature, publicKey);
      
      if (!isValid) {
        throw new Error('Signature verification failed - agent identity cannot be confirmed');
      }
    }
    
    // 4. Derive decryption key from agent fingerprint
    const key = this.deriveKey(morphable.identity.fingerprint, salt);
    
    // 5. Decrypt shadow data
    const shadow: ShadowData = this.decrypt(
      morphable.shadow.encrypted,
      key,
      morphable.shadow.iv,
      authTag
    );
    
    // 6. Verify shadow integrity
    if (!this.verifyShadow(shadow)) {
      throw new Error('Shadow data integrity check failed - data may be corrupted');
    }
    
    // 7. Verify it's ElizaOS shadow
    if (shadow.framework !== 'elizaos') {
      throw new Error(`Expected ElizaOS shadow, found ${shadow.framework}`);
    }
    
    // 8. Restore original ElizaOS configuration
    const restored: ElizaOSConfig = shadow.data._original_elizaos_config;
    
    // 9. Merge any updates from CrewAI (optional)
    // If the CrewAI agent was modified, we can choose to merge changes
    const merged = this.mergeCrewAIChanges(restored, crewAI);
    
    return merged;
  }
  
  // ===== CrewAI → ElizaOS Conversion =====
  
  /**
   * Convert CrewAI agent to ElizaOS character (lossless)
   */
  async crewAIToElizaOSMorph(
    crewAI: CrewAIConfig,
    privateKey?: string
  ): Promise<ConversionResult> {
    // 1. Extract what maps naturally to ElizaOS
    const elizaOSConfig: ElizaOSConfig = {
      name: crewAI.agent.role,
      bio: crewAI.agent.backstory,
      adjectives: this.extractTraitsFromBackstory(crewAI.agent.backstory),
      topics: this.inferTopicsFromGoal(crewAI.agent.goal),
      knowledge: [],
      style: {
        all: ['Be professional', 'Be thorough', 'Complete tasks systematically']
      },
      plugins: this.mapCrewAIToolsToPlugins(crewAI.agent.tools),
      settings: {
        model: 'gpt-4',
        temperature: 0.7
      }
    };
    
    // 2. Identify CrewAI-specific data that doesn't map to ElizaOS
    const crewAISpecific = {
      goal: crewAI.agent.goal,
      tools: crewAI.agent.tools,
      verbose: crewAI.agent.verbose,
      allow_delegation: crewAI.agent.allow_delegation,
      max_iter: crewAI.agent.max_iter,
      max_rpm: crewAI.agent.max_rpm,
      system_prompt: crewAI.system_prompt,
      tools_config: crewAI.tools_config,
      
      // Store original CrewAI config for perfect restoration
      _original_crewai_config: crewAI
    };
    
    // 3. Create shadow data
    const shadow = this.createShadow('crewai', crewAISpecific);
    
    // 4. Generate agent fingerprint
    const fingerprint = this.generateFingerprint(crewAI.agent);
    
    // 5. Generate encryption key from agent identity
    const salt = crypto.randomBytes(16).toString('base64');
    const key = this.deriveKey(fingerprint, salt);
    
    // 6. Encrypt shadow data
    const { encrypted, iv, authTag } = this.encrypt(shadow, key);
    
    // 7. Generate signature
    const dataToSign = `${encrypted}:${iv}:${authTag}:${fingerprint}`;
    const signature = privateKey 
      ? this.sign(dataToSign, privateKey)
      : crypto.createHash('sha256').update(dataToSign).digest('base64');
    
    // 8. Create morphable agent
    const morphable: MorphableAgent = {
      visible: this.crewAIToUniversal(crewAI),
      shadow: {
        encrypted,
        algorithm: this.algorithm,
        iv,
        signature
      },
      identity: {
        agentId: crewAI.agent.role,
        publicKey: privateKey ? this.extractPublicKey(privateKey) : '',
        fingerprint
      }
    };
    
    // 9. Embed shadow in ElizaOS config
    const elizaOSWithShadow = this.embedShadowInElizaOS(elizaOSConfig, morphable);
    
    // 10. Create restoration key
    const restorationKey = `${salt}:${authTag}`;
    
    return {
      converted: elizaOSWithShadow,
      morphable,
      restorationKey
    };
  }
  
  /**
   * Restore CrewAI from ElizaOS character (lossless)
   */
  async elizaOSToCrewAIMorph(
    elizaOS: ElizaOSConfig,
    restorationKey: string,
    publicKey?: string
  ): Promise<CrewAIConfig> {
    // 1. Extract morphable agent from ElizaOS config
    const morphable = this.extractShadowFromElizaOS(elizaOS);
    
    if (!morphable) {
      throw new Error('No shadow data found - this agent was not morphed from CrewAI');
    }
    
    // 2. Parse restoration key
    const [salt, authTag] = restorationKey.split(':');
    
    // 3. Verify signature (if public key provided)
    if (publicKey) {
      const dataToSign = `${morphable.shadow.encrypted}:${morphable.shadow.iv}:${authTag}:${morphable.identity.fingerprint}`;
      const isValid = this.verify(dataToSign, morphable.shadow.signature, publicKey);
      
      if (!isValid) {
        throw new Error('Signature verification failed - agent identity cannot be confirmed');
      }
    }
    
    // 4. Derive decryption key from agent fingerprint
    const key = this.deriveKey(morphable.identity.fingerprint, salt);
    
    // 5. Decrypt shadow data
    const shadow: ShadowData = this.decrypt(
      morphable.shadow.encrypted,
      key,
      morphable.shadow.iv,
      authTag
    );
    
    // 6. Verify shadow integrity
    if (!this.verifyShadow(shadow)) {
      throw new Error('Shadow data integrity check failed - data may be corrupted');
    }
    
    // 7. Verify it's CrewAI shadow
    if (shadow.framework !== 'crewai') {
      throw new Error(`Expected CrewAI shadow, found ${shadow.framework}`);
    }
    
    // 8. Restore original CrewAI configuration
    const restored: CrewAIConfig = shadow.data._original_crewai_config;
    
    // 9. Merge any updates from ElizaOS (optional)
    const merged = this.mergeElizaOSChanges(restored, elizaOS);
    
    return merged;
  }
  
  // ===== Helper Methods =====
  
  private deriveGoalFromElizaOS(elizaOS: ElizaOSConfig): string {
    const topics = elizaOS.topics?.slice(0, 3).join(', ') || 'assist users';
    return `Provide expert assistance in ${topics}`;
  }
  
  private buildBackstoryFromElizaOS(elizaOS: ElizaOSConfig): string {
    const bio = Array.isArray(elizaOS.bio) ? elizaOS.bio.join(' ') : elizaOS.bio;
    const traits = elizaOS.adjectives?.join(', ') || 'helpful';
    return `${bio}\n\nKnown for being ${traits}.`;
  }
  
  private buildSystemPromptFromElizaOS(elizaOS: ElizaOSConfig): string {
    return elizaOS.system || `You are ${elizaOS.name}.`;
  }
  
  private mapElizaOSPluginsToTools(plugins: string[]): string[] {
    return plugins
      .filter(p => !p.includes('bootstrap') && !p.includes('sql'))
      .map(p => {
        if (p.includes('search')) return 'SerperDevTool()';
        if (p.includes('web')) return 'WebScraperTool()';
        return 'BaseTool()';
      });
  }
  
  private mapCrewAIToolsToPlugins(tools: string[]): string[] {
    const plugins = ['@elizaos/plugin-bootstrap', '@elizaos/plugin-sql'];
    
    if (tools.some(t => t.includes('Search') || t.includes('Serper'))) {
      plugins.push('@elizaos/plugin-web-search');
    }
    
    return plugins;
  }
  
  private extractTraitsFromBackstory(backstory: string): string[] {
    const match = backstory.match(/Known for being ([^.]+)/);
    if (match) {
      return match[1].split(',').map(t => t.trim());
    }
    return ['professional', 'thorough'];
  }
  
  private inferTopicsFromGoal(goal: string): string[] {
    // Simple topic extraction
    return goal.toLowerCase().split(' ')
      .filter(w => w.length > 5)
      .slice(0, 5);
  }
  
  /**
   * Embed shadow in CrewAI config (in metadata or custom field)
   */
  private embedShadowInCrewAI(
    config: CrewAIConfig,
    morphable: MorphableAgent
  ): any {
    return {
      ...config,
      // Store shadow in a custom metadata field that CrewAI ignores
      _agent_metadata: {
        morphable_agent: morphable,
        framework_version: '1.0.0',
        created: new Date().toISOString()
      }
    };
  }
  
  /**
   * Extract shadow from CrewAI config
   */
  private extractShadowFromCrewAI(config: any): MorphableAgent | null {
    return config._agent_metadata?.morphable_agent || null;
  }
  
  /**
   * Embed shadow in ElizaOS config (in settings or custom field)
   */
  private embedShadowInElizaOS(
    config: ElizaOSConfig,
    morphable: MorphableAgent
  ): any {
    return {
      ...config,
      // Store shadow in settings (ElizaOS allows custom settings)
      settings: {
        ...config.settings,
        _agent_metadata: {
          morphable_agent: morphable,
          framework_version: '1.0.0',
          created: new Date().toISOString()
        }
      }
    };
  }
  
  /**
   * Extract shadow from ElizaOS config
   */
  private extractShadowFromElizaOS(config: any): MorphableAgent | null {
    return config.settings?._agent_metadata?.morphable_agent || null;
  }
  
  /**
   * Merge CrewAI changes back into ElizaOS
   */
  private mergeCrewAIChanges(
    original: ElizaOSConfig,
    crewAI: CrewAIConfig
  ): ElizaOSConfig {
    // If backstory was updated, merge it back
    if (crewAI.agent.backstory !== this.buildBackstoryFromElizaOS(original)) {
      return {
        ...original,
        bio: crewAI.agent.backstory
      };
    }
    return original;
  }
  
  /**
   * Merge ElizaOS changes back into CrewAI
   */
  private mergeElizaOSChanges(
    original: CrewAIConfig,
    elizaOS: ElizaOSConfig
  ): CrewAIConfig {
    // If bio was updated, merge it back
    const newBio = Array.isArray(elizaOS.bio) ? elizaOS.bio.join(' ') : elizaOS.bio;
    if (newBio !== original.agent.backstory) {
      return {
        ...original,
        agent: {
          ...original.agent,
          backstory: newBio
        }
      };
    }
    return original;
  }
  
  // Placeholder conversions to Universal format
  private elizaOSToUniversal(elizaOS: ElizaOSConfig): UniversalAgent {
    // Simplified conversion
    return {
      identity: {
        name: elizaOS.name,
        designation: elizaOS.name,
        bio: elizaOS.bio
      },
      personality: {
        core_traits: elizaOS.adjectives || [],
        values: [],
        quirks: []
      },
      communication: {
        style: elizaOS.style || { all: [] }
      },
      capabilities: {
        primary: elizaOS.topics || [],
        secondary: [],
        domains: elizaOS.topics || []
      },
      knowledge: {
        facts: Array.isArray(elizaOS.knowledge) 
          ? elizaOS.knowledge.filter(k => typeof k === 'string')
          : [],
        topics: elizaOS.topics || [],
        expertise: []
      },
      memory: {
        type: 'hybrid',
        provider: 'qdrant',
        settings: {}
      },
      beliefs: elizaOS.beliefs || { who: [], what: [], why: [], how: [] }
    } as UniversalAgent;
  }
  
  private crewAIToUniversal(crewAI: CrewAIConfig): UniversalAgent {
    // Simplified conversion
    return {
      identity: {
        name: crewAI.agent.role,
        designation: crewAI.agent.role,
        bio: crewAI.agent.backstory
      },
      personality: {
        core_traits: this.extractTraitsFromBackstory(crewAI.agent.backstory),
        values: [],
        quirks: []
      },
      communication: {
        style: {
          all: ['Be professional', 'Be thorough']
        }
      },
      capabilities: {
        primary: [crewAI.agent.role.toLowerCase()],
        secondary: [],
        domains: []
      },
      knowledge: {
        facts: [],
        topics: [],
        expertise: [crewAI.agent.role]
      },
      memory: {
        type: 'hybrid',
        provider: 'qdrant',
        settings: {}
      },
      beliefs: { who: [], what: [], why: [], how: [] }
    } as UniversalAgent;
  }
  
  private extractPublicKey(privateKey: string): string {
    // In real implementation, extract actual public key from private key
    return crypto.createHash('sha256').update(privateKey).digest('base64');
  }
}

// ===== Export =====
export { ShadowData, MorphableAgent, ConversionResult };
