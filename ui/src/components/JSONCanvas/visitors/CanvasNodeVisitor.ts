/**
 * Canvas Node Visitor Interface
 * 
 * Implements Visitor pattern (Gang of Four, 1994) for performing operations
 * on heterogeneous canvas node types without modifying node classes.
 * 
 * Enables adding new operations (rendering, serialization, validation, export, etc.)
 * without changing node type definitions, following Open/Closed Principle.
 * 
 * @template T - Return type of visit operations
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Visitor Pattern
 * @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 1.3: Visitor Pattern
 * @see plans/PATTERN_IMPLEMENTATION_PLAN.md - Task P0-2
 * 
 * @module ui/components/JSONCanvas/visitors
 */

import type {
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode,
  CanvasNode
} from '@terminal/protocols/types';

/**
 * Visitor interface for canvas node operations.
 * 
 * Double-dispatch pattern:
 * 1. Client calls node.accept(visitor)
 * 2. Node calls visitor.visitXXXNode(this)
 * 3. Appropriate visitor method executes with correct type
 * 
 * Type safety: Each visit method receives correctly typed node parameter,
 * eliminating need for type assertions or type guards.
 * 
 * Extensibility: Adding new operation requires:
 * - Create new class implementing CanvasNodeVisitor<T>
 * - Implement visit methods for all node types
 * - No changes to node classes required
 * 
 * Example usage:
 * ```typescript
 * const renderVisitor = new RenderVisitor();
 * const element = node.accept(renderVisitor);
 * ```
 */
export interface CanvasNodeVisitor<T> {
  /**
   * Visit text node.
   * 
   * Text nodes contain markdown or plain text content displayed on canvas.
   * 
   * @param node - Text node instance
   * @returns Operation result of type T
   * 
   * @example
   * ```typescript
   * visitTextNode(node: TextNode): ReactElement {
   *   return <div>{node.text}</div>;
   * }
   * ```
   */
  visitTextNode(node: TextNode): T;
  
  /**
   * Visit file node.
   * 
   * File nodes reference external files or documents.
   * 
   * @param node - File node instance
   * @returns Operation result of type T
   * 
   * @example
   * ```typescript
   * visitFileNode(node: FileNode): ReactElement {
   *   return <FileIcon filename={node.file} />;
   * }
   * ```
   */
  visitFileNode(node: FileNode): T;
  
  /**
   * Visit link node.
   * 
   * Link nodes represent external URLs or canvas references.
   * 
   * @param node - Link node instance
   * @returns Operation result of type T
   * 
   * @example
   * ```typescript
   * visitLinkNode(node: LinkNode): ReactElement {
   *   return <a href={node.url}>{node.url}</a>;
   * }
   * ```
   */
  visitLinkNode(node: LinkNode): T;
  
  /**
   * Visit group node.
   * 
   * Group nodes contain other nodes for organizational purposes.
   * Acts as container in Composite pattern.
   * 
   * @param node - Group node instance
   * @returns Operation result of type T
   * 
   * @example
   * ```typescript
   * visitGroupNode(node: GroupNode): ReactElement {
   *   return <div className="group">{node.label}</div>;
   * }
   * ```
   */
  visitGroupNode(node: GroupNode): T;
  
  /**
   * Visit widget node.
   * 
   * Widget nodes are interactive components created by agents.
   * Support 12+ built-in widget types (markdown, code, chart, table, etc.)
   * plus custom agent-defined widgets.
   * 
   * @param node - Widget node instance
   * @returns Operation result of type T
   * 
   * @example
   * ```typescript
   * visitWidgetNode(node: WidgetNode): ReactElement {
   *   return <WidgetRenderer widget={node} />;
   * }
   * ```
   */
  visitWidgetNode(node: WidgetNode): T;
}

/**
 * Type guard to determine if node can accept visitor.
 * 
 * Validates that node implements accept() method before visitor dispatch.
 * 
 * @param node - Candidate node
 * @returns True if node is visitable
 */
export function isVisitable(node: unknown): node is CanvasNode & { accept<T>(visitor: CanvasNodeVisitor<T>): T } {
  return (
    node !== null &&
    typeof node === 'object' &&
    'accept' in node &&
    typeof (node as any).accept === 'function'
  );
}

/**
 * Abstract base visitor providing default implementations.
 * 
 * Concrete visitors can extend this class and override only methods they need,
 * with default implementation throwing error for unsupported node types.
 * 
 * Useful for visitors that only handle subset of node types.
 * 
 * @template T - Return type of visit operations
 * 
 * @example
 * ```typescript
 * class ExportVisitor extends AbstractCanvasNodeVisitor<string> {
 *   visitTextNode(node: TextNode): string {
 *     return node.text; // Only implement what's needed
 *   }
 *   // Other visit methods use default (throw)
 * }
 * ```
 */
export abstract class AbstractCanvasNodeVisitor<T> implements CanvasNodeVisitor<T> {
  visitTextNode(node: TextNode): T {
    throw new Error(`visitTextNode not implemented in ${this.constructor.name}`);
  }
  
  visitFileNode(node: FileNode): T {
    throw new Error(`visitFileNode not implemented in ${this.constructor.name}`);
  }
  
  visitLinkNode(node: LinkNode): T {
    throw new Error(`visitLinkNode not implemented in ${this.constructor.name}`);
  }
  
  visitGroupNode(node: GroupNode): T {
    throw new Error(`visitGroupNode not implemented in ${this.constructor.name}`);
  }
  
  visitWidgetNode(node: WidgetNode): T {
    throw new Error(`visitWidgetNode not implemented in ${this.constructor.name}`);
  }
}

/**
 * Node type enumeration for runtime type checking.
 * 
 * Exhaustive list of all canvas node types. Update when adding new node types.
 * Used for validation and type guards.
 */
export const CANVAS_NODE_TYPES = [
  'text',
  'file',
  'link',
  'group',
  'widget'
] as const;

export type CanvasNodeType = typeof CANVAS_NODE_TYPES[number];

/**
 * Visitor method mapping for each node type.
 * 
 * Maps node.type string to corresponding visitor method name.
 * Used for validation and documentation.
 */
export const VISITOR_METHOD_MAP: Record<CanvasNodeType, keyof CanvasNodeVisitor<unknown>> = {
  text: 'visitTextNode',
  file: 'visitFileNode',
  link: 'visitLinkNode',
  group: 'visitGroupNode',
  widget: 'visitWidgetNode'
};

/**
 * Validate visitor implementation completeness.
 * 
 * Checks that visitor implements all required visit methods.
 * Useful for testing new visitor implementations.
 * 
 * @param visitor - Visitor instance to validate
 * @returns Validation result with missing methods
 * 
 * @example
 * ```typescript
 * const visitor = new MyCustomVisitor();
 * const validation = validateVisitorImplementation(visitor);
 * if (!validation.valid) {
 *   console.error('Missing methods:', validation.missingMethods);
 * }
 * ```
 */
export function validateVisitorImplementation<T>(
  visitor: CanvasNodeVisitor<T>
): { valid: boolean; missingMethods: string[] } {
  const missingMethods: string[] = [];
  
  for (const method of Object.values(VISITOR_METHOD_MAP)) {
    if (typeof visitor[method] !== 'function') {
      missingMethods.push(method);
    }
  }
  
  return {
    valid: missingMethods.length === 0,
    missingMethods
  };
}

/**
 * Convenience function to visit array of nodes.
 * 
 * Maps visitor over all nodes, collecting results into array.
 * 
 * @param nodes - Array of canvas nodes
 * @param visitor - Visitor to apply
 * @returns Array of operation results
 * 
 * @example
 * ```typescript
 * const nodes: CanvasNode[] = getNodes();
 * const elements = visitAll(nodes, new RenderVisitor());
 * // elements: ReactElement[]
 * ```
 */
export function visitAll<T>(
  nodes: CanvasNode[],
  visitor: CanvasNodeVisitor<T>
): T[] {
  return nodes.map(node => {
    if (!isVisitable(node)) {
      throw new Error(`Node ${(node as any).id} does not implement accept() method`);
    }
    return node.accept(visitor);
  });
}
