/**
 * Canvas Node Wrapper - Visitor Pattern Implementation
 * 
 * Provides Visitor pattern support for canvas nodes while maintaining
 * CRDT compatibility with plain TypeScript interfaces.
 * 
 * This wrapper adds the `accept()` method required for double-dispatch
 * visitor pattern without modifying the node interface definitions
 * (which must remain plain objects for YJS serialization).
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Visitor Pattern
 * @see docs/frontend-development-verified-report.md - Section 3.3
 * 
 * @module ui/utils/CanvasNodeWrapper
 */

import type {
  CanvasNode,
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode
} from '@terminal/protocols/types';
import type { CanvasNodeVisitor } from '../components/JSONCanvas/visitors/CanvasNodeVisitor';

/**
 * Wrapper class that adds Visitor pattern support to canvas nodes.
 * 
 * Usage:
 * ```typescript
 * const node: CanvasNode = { type: 'text', text: 'Hello', ... };
 * const wrapped = new CanvasNodeWrapper(node);
 * const element = wrapped.accept(renderVisitor);
 * ```
 * 
 * The wrapper is lightweight and should be created only for visitor operations,
 * not stored long-term. Nodes should remain as plain objects for CRDT sync.
 * 
 * @template T - The specific node type being wrapped
 */
export class CanvasNodeWrapper<T extends CanvasNode> {
  constructor(private readonly node: T) {}
  
  /**
   * Accept a visitor and dispatch to the appropriate visit method.
   * 
   * Implements double-dispatch pattern:
   * 1. Client calls: wrappedNode.accept(visitor)
   * 2. Wrapper calls: visitor.visitXNode(node)
   * 3. Visitor executes with correctly typed node
   * 
   * @param visitor - The visitor to accept
   * @returns The result of the visitor operation
   * 
   * @example
   * ```typescript
   * const renderVisitor = new RenderVisitor();
   * const element = wrappedNode.accept(renderVisitor);
   * ```
   */
  accept<R>(visitor: CanvasNodeVisitor<R>): R {
    // Dispatch to appropriate visitor method based on node type
    switch (this.node.type) {
      case 'text':
        return visitor.visitTextNode(this.node as TextNode);
      case 'file':
        return visitor.visitFileNode(this.node as FileNode);
      case 'link':
        return visitor.visitLinkNode(this.node as LinkNode);
      case 'group':
        return visitor.visitGroupNode(this.node as GroupNode);
      case 'widget':
        return visitor.visitWidgetNode(this.node as WidgetNode);
      default:
        // TypeScript exhaustiveness check - should never reach here
        const exhaustiveCheck: never = this.node;
        throw new Error(`Unknown node type: ${(exhaustiveCheck as any).type}`);
    }
  }
  
  /**
   * Unwrap the node to get the original plain object.
   * 
   * Use this when you need the plain node for CRDT operations
   * or when passing to non-visitor code.
   * 
   * @returns The original unwrapped node
   */
  unwrap(): T {
    return this.node;
  }
  
  /**
   * Get the node type without unwrapping.
   * Convenience method for type checking.
   */
  getType(): T['type'] {
    return this.node.type;
  }
}

/**
 * Factory function to wrap a canvas node.
 * Provides a convenient way to create wrappers with correct typing.
 * 
 * @param node - The canvas node to wrap
 * @returns A wrapped node that supports the visitor pattern
 * 
 * @example
 * ```typescript
 * const nodes: CanvasNode[] = [textNode, fileNode, widgetNode];
 * const wrappedNodes = nodes.map(wrapNode);
 * const elements = wrappedNodes.map(n => n.accept(renderVisitor));
 * ```
 */
export function wrapNode<T extends CanvasNode>(node: T): CanvasNodeWrapper<T> {
  return new CanvasNodeWrapper(node);
}

/**
 * Batch wrap multiple nodes.
 * Useful for wrapping arrays of nodes for visitor operations.
 * 
 * @param nodes - Array of canvas nodes to wrap
 * @returns Array of wrapped nodes
 */
export function wrapNodes<T extends CanvasNode>(nodes: T[]): CanvasNodeWrapper<T>[] {
  return nodes.map(wrapNode);
}