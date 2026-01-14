/**
 * RDF Type Definitions
 * 
 * TypeScript interfaces and types for USA-to-RDF conversion.
 * 
 * @module rdf/rdf-types
 * @version 1.0.0
 */

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

export const DEFAULT_OPTIONS: USAToRDFOptions = {
  baseUri: 'https://chrysalis.dev/agent/',
  includeInstances: true,
  includeEpisodes: true,
  includeConcepts: true,
  includeTraining: false,
  includeProtocols: true,
  includeExecution: true,
  useBlankNodes: true,
};
