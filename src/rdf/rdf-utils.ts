/**
 * RDF Utility Functions
 * 
 * Helper functions for creating RDF terms and literals.
 * 
 * @module rdf/rdf-utils
 * @version 1.0.0
 */

import {
  DataFactory,
  Subject,
  NamedNode,
  Literal,
  XSD_NS,
} from './temporal-store';

/**
 * Create a URI for an agent resource.
 */
export function agentUri(baseUri: string, agentId: string, path?: string): NamedNode {
  const uri = path 
    ? `${baseUri}${agentId}/${path}`
    : `${baseUri}${agentId}`;
  return DataFactory.namedNode(uri);
}

/**
 * Create a typed literal.
 */
export function typedLiteral(value: string | number | boolean, datatype: string): Literal {
  const strValue = String(value);
  return DataFactory.literal(strValue, DataFactory.namedNode(datatype));
}

/**
 * Create a date literal.
 */
export function dateLiteral(date: string | Date): Literal {
  const isoDate = typeof date === 'string' ? date : date.toISOString();
  return typedLiteral(isoDate, `${XSD_NS}dateTime`);
}

/**
 * Create an integer literal.
 */
export function intLiteral(value: number): Literal {
  return typedLiteral(Math.floor(value), `${XSD_NS}integer`);
}

/**
 * Create a decimal literal.
 */
export function decimalLiteral(value: number): Literal {
  return typedLiteral(value, `${XSD_NS}decimal`);
}

/**
 * Create a boolean literal.
 */
export function boolLiteral(value: boolean): Literal {
  return typedLiteral(value, `${XSD_NS}boolean`);
}

/**
 * Generate a blank node or URI based on options.
 */
export function nodeOrBlank(
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
