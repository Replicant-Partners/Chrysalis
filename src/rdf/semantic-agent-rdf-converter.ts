/**
 * USA to RDF Converter - Main Conversion Logic
 * 
 * Core conversion functions for transforming SemanticAgent
 * to and from RDF quads.
 * 
 * @module rdf/usa-rdf-converter
 * @version 1.0.0
 */

import {
  DataFactory,
  Quad,
  CHRYSALIS_NS,
  chrysalis,
  rdf,
} from './temporal-store';

import { FOAF_NS, DCTERMS_NS, foaf, schema, dcterms } from './namespaces';
import type { USAToRDFOptions } from './rdf-types';
import { DEFAULT_OPTIONS } from './rdf-types';
import {
  agentUri,
  nodeOrBlank,
  dateLiteral,
  intLiteral,
  decimalLiteral,
  boolLiteral,
} from './rdf-utils';
import {
  serializeSkill,
  serializeEpisode,
  serializeConcept,
  serializeBelief,
  serializeInstance,
  serializeProtocols,
} from './serializers';

import type { SemanticAgent } from './core/SemanticAgent';

/**
 * Convert a SemanticAgent to RDF quads.
 * 
 * @param agent - The agent to convert
 * @param options - Conversion options
 * @returns Array of RDF quads representing the agent
 * 
 * @example
 * ```typescript
 * const agent: SemanticAgent = { ... };
 * const quads = usaToRdf(agent);
 * const ntriples = serializeNTriples(quads);
 * ```
 */
export function usaToRdf(
  agent: SemanticAgent,
  options: USAToRDFOptions = {}
): Quad[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const quads: Quad[] = [];
  const baseUri = opts.baseUri!;
  const agentId = agent.identity.id;
  const agentNode = agentUri(baseUri, agentId);

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

  quads.push(DataFactory.quad(
    agentNode,
    chrysalis('schemaVersion'),
    DataFactory.literal(agent.schema_version)
  ));

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
  
  if (capabilities.learned_skills) {
    for (const skill of capabilities.learned_skills) {
      quads.push(...serializeSkill(agentNode, skill, baseUri, agentId, opts));
    }
  }

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
  
  if (opts.includeEpisodes && memory.collections?.episodic) {
    for (const episode of memory.collections.episodic) {
      quads.push(...serializeEpisode(agentNode, episode, baseUri, agentId, opts));
    }
  }
  
  if (opts.includeConcepts && memory.collections?.semantic) {
    for (const concept of memory.collections.semantic) {
      quads.push(...serializeConcept(agentNode, concept, baseUri, agentId, opts));
    }
  }

  const beliefs = agent.beliefs;
  
  for (const [category, beliefList] of Object.entries(beliefs)) {
    if (!beliefList) continue;
    for (let i = 0; i < beliefList.length; i++) {
      const belief = beliefList[i];
      quads.push(...serializeBelief(agentNode, belief, category, i, baseUri, agentId, opts));
    }
  }

  if (opts.includeInstances) {
    for (const instance of agent.instances.active) {
      quads.push(...serializeInstance(agentNode, instance, 'active', baseUri, agentId, opts));
    }
    
    for (const instance of agent.instances.terminated) {
      quads.push(...serializeInstance(agentNode, instance, 'terminated', baseUri, agentId, opts));
    }
  }

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

  if (opts.includeProtocols && agent.protocols) {
    quads.push(...serializeProtocols(agentNode, agent.protocols, baseUri, agentId, opts));
  }

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

/**
 * Extract a SemanticAgent from RDF quads.
 * 
 * Note: This is a partial implementation that extracts core fields.
 * Complex nested structures may require additional processing.
 * 
 * @param quads - RDF quads representing an agent
 * @param agentUriStr - URI of the agent to extract
 * @returns Partial agent object
 */
export function rdfToUsa(
  quads: Quad[],
  agentUriStr: string
): Partial<SemanticAgent> {
  const agent: Partial<SemanticAgent> = {
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

  const agentQuads = quads.filter(q => q.subject.value === agentUriStr);

  for (const quad of agentQuads) {
    const predicate = quad.predicate.value;
    const objectValue = quad.object.value;

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
    } else if (predicate === `${CHRYSALIS_NS}primaryCapability`) {
      agent.capabilities!.primary.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}secondaryCapability`) {
      agent.capabilities!.secondary.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}domain`) {
      agent.capabilities!.domains.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}fact`) {
      agent.knowledge!.facts.push(objectValue);
    } else if (predicate === `${CHRYSALIS_NS}topic` || predicate === `${FOAF_NS}topic_interest`) {
      if (!agent.knowledge!.topics.includes(objectValue)) {
        agent.knowledge!.topics.push(objectValue);
      }
    } else if (predicate === `${CHRYSALIS_NS}expertise`) {
      agent.knowledge!.expertise.push(objectValue);
    }
  }

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
