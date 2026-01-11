/**
 * SerializeVisitor - Visitor Pattern Implementation for Canvas Node Serialization
 * 
 * Implements the Visitor pattern to serialize different canvas node types
 * to JSON format without coupling serialization logic to node types.
 * 
 * Follows Open/Closed Principle: Adding new serialization formats requires
 * creating new visitor classes, not modifying node types.
 * 
 * @see Design Patterns: Elements of Reusable Object-Oriented Software
 *      Gamma, Helm, Johnson, Vlissides (1994), Chapter: Visitor Pattern
 * @see docs/DESIGN_PATTERN_ANALYSIS.md - Section 1.3: Visitor Pattern
 * 
 * @module ui/components/JSONCanvas/visitors/SerializeVisitor
 */

import type {
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode,
  CanvasNode
} from '@terminal/protocols/types';
import type { CanvasNodeVisitor } from './CanvasNodeVisitor';

/**
 * Serialized node format for JSON Canvas export.
 * Follows JSON Canvas specification: https://jsoncanvas.org/
 */
export interface SerializedNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  [key: string]: unknown;
}

/**
 * Serialization options for customizing output format.
 */
export interface SerializeOptions {
  /** Include position data (x, y, width, height) */
  includePosition?: boolean;
  /** Include color information */
  includeColor?: boolean;
  /** Include widget state (may contain sensitive data) */
  includeWidgetState?: boolean;
  /** Pretty print JSON output */
  prettyPrint?: boolean;
  /** Custom property filter */
  propertyFilter?: (key: string, value: unknown) => boolean;
}

const DEFAULT_OPTIONS: SerializeOptions = {
  includePosition: true,
  includeColor: true,
  includeWidgetState: true,
  prettyPrint: false
};

/**
 * Visitor that serializes canvas nodes to JSON format.
 * 
 * Each visit method receives a correctly typed node and returns
 * a serialized representation suitable for export or storage.
 * 
 * @example
 * ```typescript
 * const visitor = new SerializeVisitor();
 * const serialized = wrappedNode.accept(visitor);
 * const json = JSON.stringify(serialized);
 * ```
 */
export class SerializeVisitor implements CanvasNodeVisitor<SerializedNode> {
  private readonly options: SerializeOptions;
  
  constructor(options: Partial<SerializeOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Serialize base node properties common to all node types.
   */
  private serializeBase(node: CanvasNode): SerializedNode {
    const base: SerializedNode = {
      id: node.id,
      type: node.type
    };
    
    if (this.options.includePosition) {
      base.x = node.x;
      base.y = node.y;
      base.width = node.width;
      base.height = node.height;
    }
    
    if (this.options.includeColor && node.color) {
      base.color = node.color;
    }
    
    return base;
  }
  
  /**
   * Apply property filter if configured.
   */
  private filterProperties(obj: Record<string, unknown>): Record<string, unknown> {
    if (!this.options.propertyFilter) {
      return obj;
    }
    
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.options.propertyFilter(key, value)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }
  
  /**
   * Serialize a text node.
   * 
   * Text nodes contain markdown or plain text content.
   */
  visitTextNode(node: TextNode): SerializedNode {
    return {
      ...this.serializeBase(node),
      text: node.text
    };
  }
  
  /**
   * Serialize a file node.
   * 
   * File nodes reference external files or documents.
   */
  visitFileNode(node: FileNode): SerializedNode {
    const serialized: SerializedNode = {
      ...this.serializeBase(node),
      file: node.file
    };
    
    if (node.subpath) {
      serialized.subpath = node.subpath;
    }
    
    return serialized;
  }
  
  /**
   * Serialize a link node.
   * 
   * Link nodes represent external URLs.
   */
  visitLinkNode(node: LinkNode): SerializedNode {
    return {
      ...this.serializeBase(node),
      url: node.url
    };
  }
  
  /**
   * Serialize a group node.
   * 
   * Group nodes contain other nodes for organization.
   */
  visitGroupNode(node: GroupNode): SerializedNode {
    const serialized: SerializedNode = {
      ...this.serializeBase(node)
    };
    
    if (node.label) {
      serialized.label = node.label;
    }
    
    if (node.background) {
      serialized.background = node.background;
    }
    
    if (node.backgroundStyle) {
      serialized.backgroundStyle = node.backgroundStyle;
    }
    
    return serialized;
  }
  
  /**
   * Serialize a widget node.
   * 
   * Widget nodes are interactive components with props and state.
   * State serialization can be disabled for security.
   */
  visitWidgetNode(node: WidgetNode): SerializedNode {
    const serialized: SerializedNode = {
      ...this.serializeBase(node),
      widgetType: node.widgetType,
      widgetVersion: node.widgetVersion,
      props: this.filterProperties(node.props as Record<string, unknown>),
      createdBy: node.createdBy
    };
    
    if (this.options.includeWidgetState) {
      serialized.state = this.filterProperties(node.state as Record<string, unknown>);
    }
    
    return serialized;
  }
}

/**
 * Visitor that serializes nodes to compact JSON string format.
 * 
 * Useful for clipboard operations or network transmission.
 */
export class CompactSerializeVisitor implements CanvasNodeVisitor<string> {
  private readonly baseVisitor: SerializeVisitor;
  private readonly prettyPrint: boolean;
  
  constructor(options: Partial<SerializeOptions> = {}) {
    this.baseVisitor = new SerializeVisitor(options);
    this.prettyPrint = options.prettyPrint ?? false;
  }
  
  private stringify(obj: SerializedNode): string {
    return this.prettyPrint 
      ? JSON.stringify(obj, null, 2)
      : JSON.stringify(obj);
  }
  
  visitTextNode(node: TextNode): string {
    return this.stringify(this.baseVisitor.visitTextNode(node));
  }
  
  visitFileNode(node: FileNode): string {
    return this.stringify(this.baseVisitor.visitFileNode(node));
  }
  
  visitLinkNode(node: LinkNode): string {
    return this.stringify(this.baseVisitor.visitLinkNode(node));
  }
  
  visitGroupNode(node: GroupNode): string {
    return this.stringify(this.baseVisitor.visitGroupNode(node));
  }
  
  visitWidgetNode(node: WidgetNode): string {
    return this.stringify(this.baseVisitor.visitWidgetNode(node));
  }
}

/**
 * Serialize multiple nodes to JSON Canvas format.
 * 
 * @param nodes - Array of canvas nodes
 * @param options - Serialization options
 * @returns JSON Canvas compatible object
 */
export function serializeCanvas(
  nodes: CanvasNode[],
  edges: Array<{ id: string; fromNode: string; toNode: string; [key: string]: unknown }> = [],
  options: Partial<SerializeOptions> = {}
): { nodes: SerializedNode[]; edges: typeof edges } {
  const visitor = new SerializeVisitor(options);
  const { wrapNode } = require('../../utils/CanvasNodeWrapper');
  
  const serializedNodes = nodes.map(node => {
    const wrapped = wrapNode(node);
    return wrapped.accept(visitor);
  });
  
  return {
    nodes: serializedNodes,
    edges
  };
}
