/**
 * Canvas Node Visitors - Visitor Pattern Implementations
 * 
 * This module exports all visitor implementations for canvas node operations.
 * The Visitor pattern enables adding new operations without modifying node types.
 * 
 * Available Visitors:
 * - RenderVisitor: Renders nodes to React elements
 * - SerializeVisitor: Serializes nodes to JSON format
 * - ValidationVisitor: Validates node structure and content
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Visitor Pattern
 * @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 1.3: Visitor Pattern
 * 
 * @module ui/components/JSONCanvas/visitors
 */

// Core visitor interface and utilities
export {
  type CanvasNodeVisitor,
  AbstractCanvasNodeVisitor,
  isVisitable,
  validateVisitorImplementation,
  visitAll,
  CANVAS_NODE_TYPES,
  type CanvasNodeType,
  VISITOR_METHOD_MAP
} from './CanvasNodeVisitor';

// Render visitor for React element generation
export { RenderVisitor } from './RenderVisitor';

// Serialize visitor for JSON export
export {
  SerializeVisitor,
  CompactSerializeVisitor,
  serializeCanvas,
  type SerializedNode,
  type SerializeOptions
} from './SerializeVisitor';

// Validation visitor for node validation
export {
  ValidationVisitor,
  validateCanvas,
  isCanvasValid,
  type ValidationResult,
  type ValidationIssue,
  type ValidationSeverity,
  type ValidationOptions,
  type CustomValidator
} from './ValidationVisitor';
