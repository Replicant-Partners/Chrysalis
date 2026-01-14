/**
 * RDF Namespace Constants
 * 
 * Additional namespace prefixes for USA-to-RDF conversion beyond
 * the core namespaces defined in temporal-store.
 * 
 * @module rdf/namespaces
 * @version 1.0.0
 */

import { ns } from './temporal-store';

export const FOAF_NS = 'http://xmlns.com/foaf/0.1/';
export const SCHEMA_NS = 'http://schema.org/';
export const DCTERMS_NS = 'http://purl.org/dc/terms/';
export const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';

export const foaf = ns(FOAF_NS);
export const schema = ns(SCHEMA_NS);
export const dcterms = ns(DCTERMS_NS);
export const skos = ns(SKOS_NS);
