/**
 * RenderVisitor - Visitor Pattern Implementation for Canvas Node Rendering
 * 
 * Implements the Visitor pattern to render different canvas node types
 * without coupling the rendering logic to the node types themselves.
 * 
 * @module ui/components/JSONCanvas/visitors/RenderVisitor
 */

import React from 'react';
import type {
  TextNode,
  FileNode,
  LinkNode,
  GroupNode,
  WidgetNode
} from '@terminal/protocols/types';
import type { CanvasNodeVisitor } from './CanvasNodeVisitor';
import { WidgetRenderer } from '../WidgetRenderer';
import styles from '../JSONCanvas.module.css';

/**
 * Visitor that renders canvas nodes to React elements.
 * 
 * Each visit method receives a correctly typed node and returns
 * the appropriate React element for that node type.
 */
export class RenderVisitor implements CanvasNodeVisitor<React.ReactElement> {
  constructor(
    private readonly isSelected: boolean = false
  ) {}
  
  /**
   * Render a text node.
   */
  visitTextNode(node: TextNode): React.ReactElement {
    return (
      <div className={styles.textNode}>
        {node.text}
      </div>
    );
  }
  
  /**
   * Render a file node.
   */
  visitFileNode(node: FileNode): React.ReactElement {
    return (
      <div className={styles.fileNode}>
        📄 {node.file}
        {node.subpath && <span className={styles.subpath}>{node.subpath}</span>}
      </div>
    );
  }
  
  /**
   * Render a link node.
   */
  visitLinkNode(node: LinkNode): React.ReactElement {
    return (
      <div className={styles.linkNode}>
        🔗 {(node as any).url || 'Link'}
      </div>
    );
  }
  
  /**
   * Render a group node.
   */
  visitGroupNode(node: GroupNode): React.ReactElement {
    return (
      <div className={styles.groupNode}>
        📁 {(node as any).label || 'Group'}
      </div>
    );
  }
  
  /**
   * Render a widget node.
   */
  visitWidgetNode(node: WidgetNode): React.ReactElement {
    return (
      <WidgetRenderer 
        widget={node} 
        isSelected={this.isSelected}
      />
    );
  }
}