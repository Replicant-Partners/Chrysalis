/**
 * RDF Module - Semantic Web Infrastructure
 * 
 * Provides RDF (Resource Description Framework) support for the Chrysalis
 * agent system, enabling semantic interoperability with other agent systems
 * and knowledge graphs.
 * 
 * Features:
 * - Temporal RDF store with bitemporal versioning
 * - USA to RDF conversion (canonical representation)
 * - RDF to USA extraction
 * - N-Triples serialization/parsing
 * - SPARQL-like query patterns
 * 
 * @module rdf
 * @version 1.0.0
 */

// Temporal Store
export {
  // Types
  Term,
  TermType,
  NamedNode,
  BlankNode,
  Literal,
  DefaultGraph,
  Subject,
  Predicate,
  QuadObject,
  Graph,
  Quad,
  TemporalMetadata,
  TemporalGraph,
  AgentSnapshot,
  Binding,
  SelectResult,
  ConstructResult,
  TemporalQueryOptions,
  StoreStats,
  DiscoveryCriteria,
  AgentSummary,
  
  // Data Factory
  DataFactory,
  
  // Namespaces
  CHRYSALIS_NS,
  RDF_NS,
  RDFS_NS,
  XSD_NS,
  PROV_NS,
  ns,
  chrysalis,
  rdf,
  rdfs,
  xsd,
  prov,
  
  // Store
  TemporalRDFStore,
  temporalStore,
  
  // Utilities
  serializeNTriples,
  parseNTriples,
} from './temporal-store';

// USA to RDF Conversion
export {
  // Additional Namespaces
  FOAF_NS,
  SCHEMA_NS,
  DCTERMS_NS,
  SKOS_NS,
  foaf,
  schema,
  dcterms,
  skos,
  
  // Conversion Options
  USAToRDFOptions,
  
  // Conversion Functions
  usaToRdf,
  rdfToUsa,
  agentToRdf,
  rdfToAgent,
} from './usa-to-rdf';
