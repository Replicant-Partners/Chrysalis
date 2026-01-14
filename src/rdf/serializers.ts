/**
 * RDF Serialization Functions
 * 
 * Functions for serializing specific USA components to RDF quads.
 * 
 * @module rdf/serializers
 * @version 1.0.0
 */

import {
  DataFactory,
  Quad,
  NamedNode,
  chrysalis,
  rdf,
} from './temporal-store';

import { dcterms, skos } from './namespaces';
import type { USAToRDFOptions } from './rdf-types';
import { nodeOrBlank, dateLiteral, intLiteral, decimalLiteral } from './rdf-utils';

import type {
  Skill,
  Episode,
  Concept,
  Belief,
  InstanceMetadata,
  Protocols,
} from '../core/UniformSemanticAgentV2';

export function serializeSkill(
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

export function serializeEpisode(
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

export function serializeConcept(
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

export function serializeBelief(
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

export function serializeInstance(
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

export function serializeProtocols(
  agentNode: NamedNode,
  protocols: Protocols,
  baseUri: string,
  agentId: string,
  opts: USAToRDFOptions
): Quad[] {
  const quads: Quad[] = [];
  
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
