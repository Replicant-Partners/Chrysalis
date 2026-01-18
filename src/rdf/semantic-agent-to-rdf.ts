/**
 * USA to RDF Converter - Canonical RDF Representation
 * 
 * Converts SemanticAgent to RDF quads following the Chrysalis
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

export {
  FOAF_NS,
  SCHEMA_NS,
  DCTERMS_NS,
  SKOS_NS,
  foaf,
  schema,
  dcterms,
  skos,
} from './namespaces';

export {
  USAToRDFOptions,
  DEFAULT_OPTIONS,
} from './rdf-types';

export {
  agentUri,
  typedLiteral,
  dateLiteral,
  intLiteral,
  decimalLiteral,
  boolLiteral,
  nodeOrBlank,
} from './rdf-utils';

export {
  serializeSkill,
  serializeEpisode,
  serializeConcept,
  serializeBelief,
  serializeInstance,
  serializeProtocols,
} from './serializers';

export {
  usaToRdf,
  rdfToUsa,
} from './usa-rdf-converter';

import { usaToRdf, rdfToUsa } from './usa-rdf-converter';

export {
  usaToRdf as default,
  usaToRdf as agentToRdf,
  rdfToUsa as rdfToAgent,
};
