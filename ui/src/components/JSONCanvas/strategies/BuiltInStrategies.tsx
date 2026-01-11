/**
 * Built-in Widget Rendering Strategies
 * 
 * Strategy implementations for all built-in widget types.
 * Each strategy encapsulates the rendering logic for one or more widget types.
 * 
 * @module ui/components/JSONCanvas/strategies/BuiltInStrategies
 */

import React, { type ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WidgetRenderStrategy } from './WidgetRenderStrategy';
import { ApiKeyWalletWidget } from '../../Wallet';
import styles from '../WidgetRenderer.module.css';

// ============================================================================
// Markdown Strategy
// ============================================================================

export class MarkdownStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'markdown';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    const content = (props.content as string) || '';
    return (
      <div className={styles.markdownWidget}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }
}

// ============================================================================
// Code Strategy
// ============================================================================

export class CodeStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'code';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    const code = (props.code as string) || '';
    const language = (props.language as string) || 'text';
    
    return (
      <div className={styles.codeWidget}>
        <div className={styles.codeHeader}>
          <span className={styles.codeLanguage}>{language}</span>
          <button 
            className={styles.copyButton}
            onClick={() => navigator.clipboard.writeText(code)}
          >
            📋
          </button>
        </div>
        <pre className={styles.codeBlock}>
          <code>{code}</code>
        </pre>
      </div>
    );
  }
}

// ============================================================================
// Chart Strategy
// ============================================================================

export class ChartStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'chart';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    const chartType = (props.chartType as string) || 'bar';
    const data = props.data as { labels?: string[]; datasets?: unknown[] } | undefined;
    
    return (
      <div className={styles.chartWidget}>
        <div className={styles.chartPlaceholder}>
          <span className={styles.chartIcon}>📊</span>
          <span>{chartType} chart</span>
          {data?.labels && (
            <span className={styles.chartInfo}>
              {data.labels.length} data points
            </span>
          )}
        </div>
      </div>
    );
  }
}

// ============================================================================
// Table Strategy
// ============================================================================

export class TableStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'table';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    const headers = (props.headers as string[]) || [];
    const rows = (props.rows as string[][]) || [];
    
    return (
      <div className={styles.tableWidget}>
        <table className={styles.table}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

// ============================================================================
// Image Strategy
// ============================================================================

export class ImageStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'image';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    const src = (props.src as string) || '';
    const alt = (props.alt as string) || 'Image';
    
    return (
      <div className={styles.imageWidget}>
        {src ? (
          <img src={src} alt={alt} className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>🖼️</span>
            <span>No image source</span>
          </div>
        )}
      </div>
    );
  }
}

// ============================================================================
// Interactive Widgets Strategy (Button + Input)
// ============================================================================

export class InteractiveWidgetsStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'button' || widgetType === 'input';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    // Determine which widget to render based on props
    if ('label' in props && !('placeholder' in props)) {
      return this.renderButton(props);
    }
    return this.renderInput(props);
  }
  
  private renderButton(props: Record<string, unknown>): ReactElement {
    const label = (props.label as string) || 'Button';
    const variant = (props.variant as string) || 'primary';
    
    return (
      <div className={styles.buttonWidget}>
        <button 
          className={`${styles.button} ${styles[variant] || ''}`}
          onClick={() => console.log('Button clicked:', props.action)}
        >
          {label}
        </button>
      </div>
    );
  }
  
  private renderInput(props: Record<string, unknown>): ReactElement {
    const placeholder = (props.placeholder as string) || '';
    const inputType = (props.inputType as string) || 'text';
    const label = props.label as string;
    
    return (
      <div className={styles.inputWidget}>
        {label && <label className={styles.inputLabel}>{label}</label>}
        {inputType === 'textarea' ? (
          <textarea 
            className={styles.textarea} 
            placeholder={placeholder}
          />
        ) : (
          <input 
            className={styles.input}
            type={inputType}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  }
}

// ============================================================================
// Agent-Specific Widgets Strategy
// ============================================================================

export class AgentWidgetsStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'memory-viewer' || widgetType === 'skill-executor';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    if (props.skillName) {
      return this.renderSkillExecutor(props);
    }
    return this.renderMemoryViewer(props);
  }
  
  private renderMemoryViewer(props: Record<string, unknown>): ReactElement {
    const agentId = (props.agentId as string) || 'unknown';
    const filter = props.filter as Record<string, unknown> | undefined;
    
    return (
      <div className={styles.memoryViewerWidget}>
        <div className={styles.memoryHeader}>
          <span className={styles.memoryIcon}>🧠</span>
          <span>Memory Viewer</span>
        </div>
        <div className={styles.memoryContent}>
          <div className={styles.memoryInfo}>
            <span>Agent: {agentId}</span>
            {filter && (
              <span>Filter: {JSON.stringify(filter)}</span>
            )}
          </div>
          <div className={styles.memoryPlaceholder}>
            Memory entries will appear here
          </div>
        </div>
      </div>
    );
  }
  
  private renderSkillExecutor(props: Record<string, unknown>): ReactElement {
    const skillName = (props.skillName as string) || 'unknown';
    const agentId = (props.agentId as string) || 'unknown';
    
    return (
      <div className={styles.skillExecutorWidget}>
        <div className={styles.skillHeader}>
          <span className={styles.skillIcon}>⚡</span>
          <span>Skill: {skillName}</span>
        </div>
        <div className={styles.skillContent}>
          <div className={styles.skillInfo}>
            Agent: {agentId}
          </div>
          <button className={styles.executeButton}>
            ▶️ Execute
          </button>
        </div>
      </div>
    );
  }
}

// ============================================================================
// System Widgets Strategy
// ============================================================================

export class SystemWidgetsStrategy implements WidgetRenderStrategy {
  supports(widgetType: string): boolean {
    return widgetType === 'conversation' || 
           widgetType === 'api-key-wallet' || 
           widgetType === 'settings';
  }
  
  render(props: Record<string, unknown>): ReactElement {
    if (props.category) {
      return this.renderSettings(props);
    }
    if ('conversationId' in props) {
      return this.renderConversation(props);
    }
    return <ApiKeyWalletWidget props={props} />;
  }
  
  private renderConversation(props: Record<string, unknown>): ReactElement {
    const conversationId = (props.conversationId as string) || '';
    
    return (
      <div className={styles.conversationWidget}>
        <div className={styles.conversationHeader}>
          <span className={styles.conversationIcon}>💬</span>
          <span>Conversation</span>
        </div>
        <div className={styles.conversationContent}>
          <span className={styles.conversationId}>
            ID: {conversationId || 'Not set'}
          </span>
          <div className={styles.conversationPlaceholder}>
            Conversation thread will appear here
          </div>
        </div>
      </div>
    );
  }
  
  private renderSettings(props: Record<string, unknown>): ReactElement {
    const category = (props.category as string) || 'general';
    
    return (
      <div className={styles.settingsWidget}>
        <div className={styles.settingsHeader}>
          <span className={styles.settingsIcon}>⚙️</span>
          <span>Settings</span>
        </div>
        <div className={styles.settingsContent}>
          <div className={styles.settingsCategory}>
            Category: {category}
          </div>
          <div className={styles.settingsPlaceholder}>
            Settings panel will appear here
          </div>
        </div>
      </div>
    );
  }
}