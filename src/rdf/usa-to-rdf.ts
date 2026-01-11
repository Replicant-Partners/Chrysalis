/**
 * USA to RDF Converter - Canonical RDF Representation
 * 
 * Converts UniformSemanticAgentV2 to RDF quads following the Chrysalis
 * ontology for semantic interoperability with other agent systems.
 * 
 * Features:
 * - Complete agent serialization to RDF
 * - Bidirectional conversion (RDF to USA)
 * - Ontology-aligned predicates
 * - Support for all agent fields
 * - Temporal metadata preservation
 * 
 * @module rdf/usa-to-rdf
 * @version 1.0.0
 */

import {
  DataFactory,
  Quad,
  Subject,
  NamedNode,
  Literal,
  CHRYSALIS_NS,
  RDF_NS,
  RDFS_NS,
  XSD_NS,
  PROV_NS,
  chrysalis,
  rdf,
  rdfs,
  xsd,
  prov,
  ns,
} from './temporal-store';

import type {
  UniformSemanticAgentV2,
  Belief,
  ToolDefinition,
  Skill,
  Episode,
  Concept,
  InstanceMetadata,
  ExperienceSyncConfig,
  Protocols,
} from '../core/UniformSemanticAgentV2';

// ============================================================================
// Additional Namespaces
// ============================================================================

export const FOAF_NS = 'http://xmlns.com/foaf/0.1/';
export const SCHEMA_NS = 'http://schema.org/';
export const DCTERMS_NS = 'http://purl.org/dc/terms/';
export const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';

export const foaf = ns(FOAF_NS);
export const schema = ns(SCHEMA_NS);
export const dcterms = ns(DCTERMS_NS);
export const skos = ns(SKOS_NS);

// ============================================================================
// Conversion Options
// ============================================================================

export interface USAToRDFOptions {
  /** Base URI for the agent */
  baseUri?: string;
  /** Include instance metadata */
  includeInstances?: boolean;
  /** Include episodic memory */
  includeEpisodes?: boolean;
  /** Include semantic concepts */
  includeConcepts?: boolean;
  /** Include training data */
  includeTraining?: boolean;
  /** Include protocol configurations */
  includeProtocols?: boolean;
  /** Include execution configuration */
  includeExecution?: boolean;
  /** Generate blank nodes for nested structures */
  useBlankNodes?: boolean;
}

const DEFAULT_OPTIONS: USAToRDFOptions = {
  baseUri: 'https://chrysalis.dev/agent/',
  includeInstances: true,
  includeEpisodes: true,
  includeConcepts: true,
  includeTraining: false,
  includeProtocols: true,
  includeExecution: true,
  useBlankNodes: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a URI for an agent resource.
 */
function agentUri(baseUri: string, agentId: string, path?: string): NamedNode {
  const uri = path 
    ? `${baseUri}${agentId}/${path}`
    : `${baseUri}${agentId}`;
  return DataFactory.namedNode(uri);
}

/**
 * Create a typed literal.
 */
function typedLiteral(value: string | number | boolean, datatype: string): Literal {
  const strValue = String(value);
  return DataFactory.literal(strValue, DataFactory.namedNode(datatype));
}

/**
 * Create a date literal.
 */
function dateLiteral(date: string | Date): Literal {
  const isoDate = typeof date === 'string' ? date : date.toISOString();
  return typedLiteral(isoDate, `${XSD_NS}dateTime`);
}

/**
 * Create an integer literal.
 */
function intLiteral(value: number): Literal {
  return typedLiteral(Math.floor(value), `${XSD_NS}integer`);
}

/**
 * Create a decimal literal.
 */
function decimalLiteral(value: number): Literal {
  return typedLiteral(value, `${XSD_NS}decimal`);
}

/**
 * Create a boolean literal.
 */
function boolLiteral(value: boolean): Literal {
  return typedLiteral(value, `${XSD_NS}boolean`);
}

/**
 * Generate a blank node or URI based on options.
 */
function nodeOrBlank(
  baseUri: string,
  agentId: string,
  path: string,
  useBlankNodes: boolean
): Subject {
  if (useBlankNodes) {
    return DataFactory.blankNode(`${agentId}_${path.replace(/\//g, '_')}`);
  }
  return agentUri(baseUri, agentId, path);
}

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Convert a UniformSemanticAgentV2 to RDF quads.
 * 
 * @param agent - The agent to convert
 * @param options - Conversion options
 * @returns Array of RDF quads representing the agent
 * 
 * @example
 * ```typescript
 * const agent: UniformSemanticAgentV2 = { ... };
 * const quads = usaToRdf(agent);
 * const ntriples = serializeNTriples(quads);
 * ```
 */
export function usaToRdf(
  agent: UniformSemanticAgentV2,
  options: USAToRDFOptions = {}
): Quad[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const quads: Quad[] = [];
  const baseUri = opts.baseUri!;
  const agentId = agent.identity.id;
  const agentNode = agentUri(baseUri, agentId);

  // ==========================================================================
  // Type Declaration
  // ==========================================================================
  
  quads.push(DataFactory.quad(
    agentNode,
    rdf('type'),
    chrysalis('Agent')
  ));
  
  quads.push(DataFactory.quad(
    agentNode,
    rdf('type'),
    foaf('Agent')
  ));

  // ==========================================================================
  // Schema Version
  // ==========================================================================
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('schemaVersion'),
    DataFactory.literal(agent.schema_version)
  ));

  // ==========================================================================
  // Identity
  // ==========================================================================
  
  const identity = agent.identity;
  
  quads.push(DataFactory.quad(
    agentNode,
    dcterms('identifier'),
    DataFactory.literal(identity.id)
  ));
  
  quads.push(DataFactory.quad(
    agentNode,
    foaf('name'),
    DataFactory.literal(identity.name)
  ));
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('name'),
    DataFactory.literal(identity.name)
  ));
  
  if (identity.designation) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('designation'),
      DataFactory.literal(identity.designation)
    ));
    quads.push(DataFactory.quad(
      agentNode,
      schema('jobTitle'),
      DataFactory.literal(identity.designation)
    ));
  }
  
  if (identity.bio) {
    const bioText = Array.isArray(identity.bio) ? identity.bio.join('\n') : identity.bio;
    quads.push(DataFactory.quad(
      agentNode,
      dcterms('description'),
      DataFactory.literal(bioText)
    ));
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('bio'),
      DataFactory.literal(bioText)
    ));
  }
  
  if (identity.fingerprint) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('fingerprint'),
      DataFactory.literal(identity.fingerprint)
    ));
  }
  
  quads.push(DataFactory.quad(
    agentNode,
    dcterms('created'),
    dateLiteral(identity.created)
  ));
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('version'),
    DataFactory.literal(identity.version)
  ));

  // ==========================================================================
  // Personality
  // ==========================================================================
  
  const personality = agent.personality;
  const personalityNode = nodeOrBlank(baseUri, agentId, 'personality', opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasPersonality'),
    personalityNode
  ));
  
  quads.push(DataFactory.quad(
    personalityNode,
    rdf('type'),
    chrysalis('Personality')
  ));
  
  for (const trait of personality.core_traits) {
    quads.push(DataFactory.quad(
      personalityNode,
      chrysalis('coreTrait'),
      DataFactory.literal(trait)
    ));
  }
  
  for (const value of personality.values) {
    quads.push(DataFactory.quad(
      personalityNode,
      chrysalis('value'),
      DataFactory.literal(value)
    ));
  }
  
  for (const quirk of personality.quirks) {
    quads.push(DataFactory.quad(
      personalityNode,
      chrysalis('quirk'),
      DataFactory.literal(quirk)
    ));
  }
  
  if (personality.fears) {
    for (const fear of personality.fears) {
      quads.push(DataFactory.quad(
        personalityNode,
        chrysalis('fear'),
        DataFactory.literal(fear)
      ));
    }
  }
  
  if (personality.aspirations) {
    for (const aspiration of personality.aspirations) {
      quads.push(DataFactory.quad(
        personalityNode,
        chrysalis('aspiration'),
        DataFactory.literal(aspiration)
      ));
    }
  }

  // ==========================================================================
  // Communication
  // ==========================================================================
  
  const communication = agent.communication;
  const commNode = nodeOrBlank(baseUri, agentId, 'communication', opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasCommunicationStyle'),
    commNode
  ));
  
  quads.push(DataFactory.quad(
    commNode,
    rdf('type'),
    chrysalis('CommunicationStyle')
  ));
  
  for (const [context, rules] of Object.entries(communication.style)) {
    for (const rule of rules) {
      const ruleNode = DataFactory.blankNode();
      quads.push(DataFactory.quad(
        commNode,
        chrysalis('styleRule'),
        ruleNode
      ));
      quads.push(DataFactory.quad(
        ruleNode,
        chrysalis('context'),
        DataFactory.literal(context)
      ));
      quads.push(DataFactory.quad(
        ruleNode,
        chrysalis('rule'),
        DataFactory.literal(rule)
      ));
    }
  }
  
  if (communication.signature_phrases) {
    for (const phrase of communication.signature_phrases) {
      quads.push(DataFactory.quad(
        commNode,
        chrysalis('signaturePhrase'),
        DataFactory.literal(phrase)
      ));
    }
  }

  // ==========================================================================
  // Capabilities
  // ==========================================================================
  
  const capabilities = agent.capabilities;
  
  for (const cap of capabilities.primary) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('primaryCapability'),
      DataFactory.literal(cap)
    ));
  }
  
  for (const cap of capabilities.secondary) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('secondaryCapability'),
      DataFactory.literal(cap)
    ));
  }
  
  for (const domain of capabilities.domains) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('domain'),
      DataFactory.literal(domain)
    ));
  }
  
  // Tools
  if (capabilities.tools) {
    for (let i = 0; i < capabilities.tools.length; i++) {
      const tool = capabilities.tools[i];
      const toolNode = nodeOrBlank(baseUri, agentId, `tool/${i}`, opts.useBlankNodes!);
      
      quads.push(DataFactory.quad(
        agentNode,
        chrysalis('hasTool'),
        toolNode
      ));
      
      quads.push(DataFactory.quad(
        toolNode,
        rdf('type'),
        chrysalis('Tool')
      ));
      
      quads.push(DataFactory.quad(
        toolNode,
        chrysalis('toolName'),
        DataFactory.literal(tool.name)
      ));
      
      quads.push(DataFactory.quad(
        toolNode,
        chrysalis('toolProtocol'),
        DataFactory.literal(tool.protocol)
      ));
      
      if (tool.usage_stats) {
        quads.push(DataFactory.quad(
          toolNode,
          chrysalis('totalInvocations'),
          intLiteral(tool.usage_stats.total_invocations)
        ));
        quads.push(DataFactory.quad(
          toolNode,
          chrysalis('successRate'),
          decimalLiteral(tool.usage_stats.success_rate)
        ));
      }
    }
  }
  
  // Skills
  if (capabilities.learned_skills) {
    for (const skill of capabilities.learned_skills) {
      quads.push(...serializeSkill(agentNode, skill, baseUri, agentId, opts));
    }
  }

  // ==========================================================================
  // Knowledge
  // ==========================================================================
  
  const knowledge = agent.knowledge;
  
  for (const fact of knowledge.facts) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('fact'),
      DataFactory.literal(fact)
    ));
  }
  
  for (const topic of knowledge.topics) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('topic'),
      DataFactory.literal(topic)
    ));
    quads.push(DataFactory.quad(
      agentNode,
      foaf('topic_interest'),
      DataFactory.literal(topic)
    ));
  }
  
  for (const expertise of knowledge.expertise) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('expertise'),
      DataFactory.literal(expertise)
    ));
  }
  
  if (knowledge.accumulated_knowledge) {
    for (const k of knowledge.accumulated_knowledge) {
      const kNode = nodeOrBlank(baseUri, agentId, `knowledge/${k.knowledge_id}`, opts.useBlankNodes!);
      
      quads.push(DataFactory.quad(
        agentNode,
        chrysalis('hasAccumulatedKnowledge'),
        kNode
      ));
      
      quads.push(DataFactory.quad(
        kNode,
        rdf('type'),
        chrysalis('AccumulatedKnowledge')
      ));
      
      quads.push(DataFactory.quad(
        kNode,
        dcterms('identifier'),
        DataFactory.literal(k.knowledge_id)
      ));
      
      quads.push(DataFactory.quad(
        kNode,
        chrysalis('content'),
        DataFactory.literal(k.content)
      ));
      
      quads.push(DataFactory.quad(
        kNode,
        chrysalis('confidence'),
        decimalLiteral(k.confidence)
      ));
      
      quads.push(DataFactory.quad(
        kNode,
        chrysalis('sourceInstance'),
        DataFactory.literal(k.source_instance)
      ));
      
      quads.push(DataFactory.quad(
        kNode,
        dcterms('created'),
        dateLiteral(k.acquired)
      ));
    }
  }

  // ==========================================================================
  // Memory Configuration
  // ==========================================================================
  
  const memory = agent.memory;
  const memoryNode = nodeOrBlank(baseUri, agentId, 'memory', opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasMemoryConfig'),
    memoryNode
  ));
  
  quads.push(DataFactory.quad(
    memoryNode,
    rdf('type'),
    chrysalis('MemoryConfiguration')
  ));
  
  quads.push(DataFactory.quad(
    memoryNode,
    chrysalis('memoryType'),
    DataFactory.literal(memory.type)
  ));
  
  quads.push(DataFactory.quad(
    memoryNode,
    chrysalis('memoryProvider'),
    DataFactory.literal(memory.provider)
  ));
  
  // Episodes
  if (opts.includeEpisodes && memory.collections?.episodic) {
    for (const episode of memory.collections.episodic) {
      quads.push(...serializeEpisode(agentNode, episode, baseUri, agentId, opts));
    }
  }
  
  // Concepts
  if (opts.includeConcepts && memory.collections?.semantic) {
    for (const concept of memory.collections.semantic) {
      quads.push(...serializeConcept(agentNode, concept, baseUri, agentId, opts));
    }
  }

  // ==========================================================================
  // Beliefs
  // ==========================================================================
  
  const beliefs = agent.beliefs;
  
  for (const [category, beliefList] of Object.entries(beliefs)) {
    if (!beliefList) continue;
    for (let i = 0; i < beliefList.length; i++) {
      const belief = beliefList[i];
      quads.push(...serializeBelief(agentNode, belief, category, i, baseUri, agentId, opts));
    }
  }

  // ==========================================================================
  // Instances
  // ==========================================================================
  
  if (opts.includeInstances) {
    for (const instance of agent.instances.active) {
      quads.push(...serializeInstance(agentNode, instance, 'active', baseUri, agentId, opts));
    }
    
    for (const instance of agent.instances.terminated) {
      quads.push(...serializeInstance(agentNode, instance, 'terminated', baseUri, agentId, opts));
    }
  }

  // ==========================================================================
  // Experience Sync
  // ==========================================================================
  
  const syncConfig = agent.experience_sync;
  const syncNode = nodeOrBlank(baseUri, agentId, 'experience-sync', opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasExperienceSync'),
    syncNode
  ));
  
  quads.push(DataFactory.quad(
    syncNode,
    rdf('type'),
    chrysalis('ExperienceSyncConfig')
  ));
  
  quads.push(DataFactory.quad(
    syncNode,
    chrysalis('syncEnabled'),
    boolLiteral(syncConfig.enabled)
  ));
  
  quads.push(DataFactory.quad(
    syncNode,
    chrysalis('defaultProtocol'),
    DataFactory.literal(syncConfig.default_protocol)
  ));
  
  if (syncConfig.merge_strategy) {
    quads.push(DataFactory.quad(
      syncNode,
      chrysalis('conflictResolution'),
      DataFactory.literal(syncConfig.merge_strategy.conflict_resolution)
    ));
    quads.push(DataFactory.quad(
      syncNode,
      chrysalis('memoryDeduplication'),
      boolLiteral(syncConfig.merge_strategy.memory_deduplication)
    ));
    quads.push(DataFactory.quad(
      syncNode,
      chrysalis('skillAggregation'),
      DataFactory.literal(syncConfig.merge_strategy.skill_aggregation)
    ));
  }

  // ==========================================================================
  // Protocols
  // ==========================================================================
  
  if (opts.includeProtocols && agent.protocols) {
    quads.push(...serializeProtocols(agentNode, agent.protocols, baseUri, agentId, opts));
  }

  // ==========================================================================
  // Execution
  // ==========================================================================
  
  if (opts.includeExecution && agent.execution) {
    const execNode = nodeOrBlank(baseUri, agentId, 'execution', opts.useBlankNodes!);
    
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('hasExecution'),
      execNode
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      rdf('type'),
      chrysalis('ExecutionConfig')
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      chrysalis('llmProvider'),
      DataFactory.literal(agent.execution.llm.provider)
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      chrysalis('llmModel'),
      DataFactory.literal(agent.execution.llm.model)
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      chrysalis('temperature'),
      decimalLiteral(agent.execution.llm.temperature)
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      chrysalis('maxTokens'),
      intLiteral(agent.execution.llm.max_tokens)
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      chrysalis('timeout'),
      intLiteral(agent.execution.runtime.timeout)
    ));
    
    quads.push(DataFactory.quad(
      execNode,
      chrysalis('maxIterations'),
      intLiteral(agent.execution.runtime.max_iterations)
    ));
  }

  // ==========================================================================
  // Metadata
  // ==========================================================================
  
  const metadata = agent.metadata;
  
  quads.push(DataFactory.quad(
    agentNode,
    dcterms('modified'),
    dateLiteral(metadata.updated)
  ));
  
  if (metadata.author) {
    quads.push(DataFactory.quad(
      agentNode,
      dcterms('creator'),
      DataFactory.literal(metadata.author)
    ));
  }
  
  if (metadata.tags) {
    for (const tag of metadata.tags) {
      quads.push(DataFactory.quad(
        agentNode,
        chrysalis('tag'),
        DataFactory.literal(tag)
      ));
    }
  }
  
  if (metadata.source_framework) {
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('sourceFramework'),
      DataFactory.literal(metadata.source_framework)
    ));
  }
  
  if (metadata.evolution) {
    const evoNode = nodeOrBlank(baseUri, agentId, 'evolution', opts.useBlankNodes!);
    
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('hasEvolution'),
      evoNode
    ));
    
    quads.push(DataFactory.quad(
      evoNode,
      rdf('type'),
      chrysalis('EvolutionMetrics')
    ));
    
    quads.push(DataFactory.quad(
      evoNode,
      chrysalis('totalDeployments'),
      intLiteral(metadata.evolution.total_deployments)
    ));
    
    quads.push(DataFactory.quad(
      evoNode,
      chrysalis('totalSyncs'),
      intLiteral(metadata.evolution.total_syncs)
    ));
    
    quads.push(DataFactory.quad(
      evoNode,
      chrysalis('totalSkillsLearned'),
      intLiteral(metadata.evolution.total_skills_learned)
    ));
    
    quads.push(DataFactory.quad(
      evoNode,
      chrysalis('evolutionRate'),
      decimalLiteral(metadata.evolution.evolution_rate)
    ));
  }

  return quads;
}

// ============================================================================
// Serialization Helpers
// ============================================================================

function serializeSkill(
  agentNode: NamedNode,
  skill: Skill,
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  const skillNode = nodeOrBlank(baseUri, agentId, `skill/${skill.skill_id}`, opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasSkill'),
    skillNode
  ));
  
  quads.push(DataFactory.quad(
    skillNode,
    rdf('type'),
    chrysalis('Skill')
  ));
  
  quads.push(DataFactory.quad(
    skillNode,
    dcterms('identifier'),
    DataFactory.literal(skill.skill_id)
  ));
  
  quads.push(DataFactory.quad(
    skillNode,
    chrysalis('skillName'),
    DataFactory.literal(skill.name)
  ));
  
  quads.push(DataFactory.quad(
    skillNode,
    chrysalis('category'),
    DataFactory.literal(skill.category)
  ));
  
  quads.push(DataFactory.quad(
    skillNode,
    chrysalis('proficiency'),
    decimalLiteral(skill.proficiency)
  ));
  
  quads.push(DataFactory.quad(
    skillNode,
    dcterms('created'),
    dateLiteral(skill.acquired)
  ));
  
  for (const sourceInstance of skill.source_instances) {
    quads.push(DataFactory.quad(
      skillNode,
      chrysalis('sourceInstance'),
      DataFactory.literal(sourceInstance)
    ));
  }
  
  if (skill.usage) {
    quads.push(DataFactory.quad(
      skillNode,
      chrysalis('totalInvocations'),
      intLiteral(skill.usage.total_invocations)
    ));
    quads.push(DataFactory.quad(
      skillNode,
      chrysalis('successRate'),
      decimalLiteral(skill.usage.success_rate)
    ));
  }
  
  return quads;
}

function serializeEpisode(
  agentNode: NamedNode,
  episode: Episode,
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  const episodeNode = nodeOrBlank(baseUri, agentId, `episode/${episode.episode_id}`, opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasEpisode'),
    episodeNode
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    rdf('type'),
    chrysalis('Episode')
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    dcterms('identifier'),
    DataFactory.literal(episode.episode_id)
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    dcterms('date'),
    dateLiteral(episode.timestamp)
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    chrysalis('sourceInstance'),
    DataFactory.literal(episode.source_instance)
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    chrysalis('duration'),
    intLiteral(episode.duration)
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    chrysalis('outcome'),
    DataFactory.literal(episode.outcome)
  ));
  
  quads.push(DataFactory.quad(
    episodeNode,
    chrysalis('effectivenessRating'),
    decimalLiteral(episode.effectiveness_rating)
  ));
  
  for (const lesson of episode.lessons_learned) {
    quads.push(DataFactory.quad(
      episodeNode,
      chrysalis('lessonLearned'),
      DataFactory.literal(lesson)
    ));
  }
  
  return quads;
}

function serializeConcept(
  agentNode: NamedNode,
  concept: Concept,
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  const conceptNode = nodeOrBlank(baseUri, agentId, `concept/${concept.concept_id}`, opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasConcept'),
    conceptNode
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    rdf('type'),
    skos('Concept')
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    rdf('type'),
    chrysalis('SemanticConcept')
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    dcterms('identifier'),
    DataFactory.literal(concept.concept_id)
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    skos('prefLabel'),
    DataFactory.literal(concept.name)
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    skos('definition'),
    DataFactory.literal(concept.definition)
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    chrysalis('confidence'),
    decimalLiteral(concept.confidence)
  ));
  
  quads.push(DataFactory.quad(
    conceptNode,
    chrysalis('usageCount'),
    intLiteral(concept.usage_count)
  ));
  
  for (const related of concept.related_concepts) {
    quads.push(DataFactory.quad(
      conceptNode,
      skos('related'),
      DataFactory.literal(related)
    ));
  }
  
  return quads;
}

function serializeBelief(
  agentNode: NamedNode,
  belief: Belief,
  category: string,
  index: number,
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  const beliefNode = nodeOrBlank(baseUri, agentId, `belief/${category}/${index}`, opts.useBlankNodes!);
  
  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('hasBelief'),
    beliefNode
  ));
  
  quads.push(DataFactory.quad(
    beliefNode,
    rdf('type'),
    chrysalis('Belief')
  ));
  
  quads.push(DataFactory.quad(
    beliefNode,
    chrysalis('beliefCategory'),
    DataFactory.literal(category)
  ));
  
  quads.push(DataFactory.quad(
    beliefNode,
    chrysalis('content'),
    DataFactory.literal(belief.content)
  ));
  
  quads.push(DataFactory.quad(
    beliefNode,
    chrysalis('conviction'),
    decimalLiteral(belief.conviction)
  ));
  
  quads.push(DataFactory.quad(
    beliefNode,
    chrysalis('privacy'),
    DataFactory.literal(belief.privacy)
  ));
  
  quads.push(DataFactory.quad(
    beliefNode,
    chrysalis('source'),
    DataFactory.literal(belief.source)
  ));
  
  if (belief.tags) {
    for (const tag of belief.tags) {
      quads.push(DataFactory.quad(
        beliefNode,
        chrysalis('tag'),
        DataFactory.literal(tag)
      ));
    }
  }
  
  return quads;
}

function serializeInstance(
  agentNode: NamedNode,
  instance: InstanceMetadata,
  status: 'active' | 'terminated',
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  const instanceNode = nodeOrBlank(baseUri, agentId, `instance/${instance.instance_id}`, opts.useBlankNodes!);
  
  const predicate = status === 'active' 
    ? chrysalis('hasActiveInstance')
    : chrysalis('hasTerminatedInstance');
  
  quads.push(DataFactory.quad(
    agentNode,
    predicate,
    instanceNode
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    rdf('type'),
    chrysalis('AgentInstance')
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    dcterms('identifier'),
    DataFactory.literal(instance.instance_id)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('instanceType'),
    DataFactory.literal(instance.type)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('framework'),
    DataFactory.literal(instance.framework)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('deploymentContext'),
    DataFactory.literal(instance.deployment_context)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    dcterms('created'),
    dateLiteral(instance.created)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('lastSync'),
    dateLiteral(instance.last_sync)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('status'),
    DataFactory.literal(instance.status)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('syncProtocol'),
    DataFactory.literal(instance.sync_protocol)
  ));
  
  quads.push(DataFactory.quad(
    instanceNode,
    chrysalis('endpoint'),
    DataFactory.literal(instance.endpoint)
  ));
  
  // Health
  if (instance.health) {
    quads.push(DataFactory.quad(
      instanceNode,
      chrysalis('healthStatus'),
      DataFactory.literal(instance.health.status)
    ));
    quads.push(DataFactory.quad(
      instanceNode,
      chrysalis('errorRate'),
      decimalLiteral(instance.health.error_rate)
    ));
  }
  
  // Statistics
  if (instance.statistics) {
    quads.push(DataFactory.quad(
      instanceNode,
      chrysalis('totalSyncs'),
      intLiteral(instance.statistics.total_syncs)
    ));
    quads.push(DataFactory.quad(
      instanceNode,
      chrysalis('memoriesContributed'),
      intLiteral(instance.statistics.memories_contributed)
    ));
    quads.push(DataFactory.quad(
      instanceNode,
      chrysalis('skillsLearned'),
      intLiteral(instance.statistics.skills_learned)
    ));
  }
  
  return quads;
}

function serializeProtocols(
  agentNode: NamedNode,
  protocols: Protocols,
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  
  // MCP Protocol
  if (protocols.mcp?.enabled) {
    const mcpNode = nodeOrBlank(baseUri, agentId, 'protocol/mcp', opts.useBlankNodes!);
    
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('supportsProtocol'),
      mcpNode
    ));
    
    quads.push(DataFactory.quad(
      mcpNode,
      rdf('type'),
      chrysalis('MCPProtocolBinding')
    ));
    
    quads.push(DataFactory.quad(
      mcpNode,
      chrysalis('protocolRole'),
      DataFactory.literal(protocols.mcp.role)
    ));
    
    for (const tool of protocols.mcp.tools) {
      quads.push(DataFactory.quad(
        mcpNode,
        chrysalis('exposedTool'),
        DataFactory.literal(tool)
      ));
    }
  }
  
  // A2A Protocol
  if (protocols.a2a?.enabled) {
    const a2aNode = nodeOrBlank(baseUri, agentId, 'protocol/a2a', opts.useBlankNodes!);
    
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('supportsProtocol'),
      a2aNode
    ));
    
    quads.push(DataFactory.quad(
      a2aNode,
      rdf('type'),
      chrysalis('A2AProtocolBinding')
    ));
    
    quads.push(DataFactory.quad(
      a2aNode,
      chrysalis('protocolRole'),
      DataFactory.literal(protocols.a2a.role)
    ));
    
    quads.push(DataFactory.quad(
      a2aNode,
      chrysalis('endpoint'),
      DataFactory.literal(protocols.a2a.endpoint)
    ));
  }
  
  // Agent Protocol
  if (protocols.agent_protocol?.enabled) {
    const apNode = nodeOrBlank(baseUri, agentId, 'protocol/agent-protocol', opts.useBlankNodes!);
    
    quads.push(DataFactory.quad(
      agentNode,
      chrysalis('supportsProtocol'),
      apNode
    ));
    
    quads.push(DataFactory.quad(
      apNode,
      rdf('type'),
      chrysalis('AgentProtocolBinding')
    ));
    
    quads.push(DataFactory.quad(
      apNode,
      chrysalis('endpoint'),
      DataFactory.literal(protocols.agent_protocol.endpoint)
    ));
    
    for (const cap of protocols.agent_protocol.capabilities) {
      quads.push(DataFactory.quad(
        apNode,
        chrysalis('capability'),
        DataFactory.literal(cap)
      ));
    }
  }
  
  return quads;
}

// ============================================================================
// Reverse Conversion (RDF to USA)
// ============================================================================

/**
 * Extract a UniformSemanticAgentV2 from RDF quads.
 * 
 * Note: This is a partial implementation that extracts core fields.
 * Complex nested structures may require additional processing.
 * 
 * @param quads - RDF quads representing an agent
 * @param agentUri - URI of the agent to extract
 * @returns Partial agent object
 */
export function rdfToUsa(
  quads: Quad[],
  agentUri: string
): Partial<UniformSemanticAgentV2> {
  const agent: Partial<UniformSemanticAgentV2> = {
    identity: {
      id: '',
      name: '',
      designation: '',
      bio: '',
      fingerprint: '',
      created: new Date().toISOString(),
      version: '1.0.0',
    },
    personality: {
      core_traits: [],
      values: [],
      quirks: [],
    },
    capabilities: {
      primary: [],
      secondary: [],
      domains: [],
    },
    knowledge: {
      facts: [],
      topics: [],
      expertise: [],
    },
    beliefs: {
      who: [],
      what: [],
      why: [],
      how: [],
    },
  };

  // Filter quads for this agent
  const agentQuads = quads.filter(q => q.subject.value === agentUri);

  for (const quad of agentQuads) {
    const predicate = quad.predicate.value;
    const objectValue = quad.object.value;

    // Identity
    if (predicate === `${DCTERMS_NS}identifier`) {
      agent.identity!.id = objectValue;
    } else if (predicate === `${FOAF_NS}name` || predicate === `${CHRYSALIS_NS}name`) {
      agent.identity!.name = objectValue;
    } else if (predicate === `${CHRYSALIS_NS}designation`) {
      agent.identity!.designation = objectValue;
    } else if (predicate === `${CHRYSALIS_NS}bio` || predicate === `${DCTERMS_NS}description`) {
      agent.identity!.bio = objectValue;
    } else if (predicate === `${CHRYSALIS_NS}fingerprint`) {
      agent.identity!.fingerprint = objectValue;
    } else if (predicate === `${DCTERMS_NS}created`) {
      agent.identity!.created = objectValue;
    } else if (predicate === `${CHRYSALIS_NS}version`) {
      agent.identity!.version = objectValue;
    }
    // Capabilities
    else if (predicate === `${CHRYSALIS_NS}primaryCapability`) {
      agent.capabilities!.primary.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}secondaryCapability`) {
      agent.capabilities!.secondary.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}domain`) {
      agent.capabilities!.domains.push(objectValue);
    }
    // Knowledge
    else if (predicate === `${CHRYSALIS_NS}fact`) {
      agent.knowledge!.facts.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}topic` || predicate === `${FOAF_NS}topic_interest`) {
      if (!agent.knowledge!.topics.includes(objectValue)) {
        agent.knowledge!.topics.push(objectValue);
      }
    } else if (predicate === `${CHRYSALIS_NS}expertise`) {
      agent.knowledge!.expertise.push(objectValue);
    }
  }

  // Extract personality from linked node
  const personalityQuads = quads.filter(q => 
    agentQuads.some(aq => 
      aq.predicate.value === `${CHRYSALIS_NS}hasPersonality` && 
      aq.object.value === q.subject.value
    )
  );

  for (const quad of personalityQuads) {
    const predicate = quad.predicate.value;
    const objectValue = quad.object.value;

    if (predicate === `${CHRYSALIS_NS}coreTrait`) {
      agent.personality!.core_traits.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}value`) {
      agent.personality!.values.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}quirk`) {
      agent.personality!.quirks.push(objectValue);
    }
  }

  return agent;
}

// ============================================================================
// Exports
// ============================================================================

export {
  usaToRdf as default,
  usaToRdf as agentToRdf,
  rdfToUsa as rdfToAgent,
};
