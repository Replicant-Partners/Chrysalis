/**
 * Widget Renderer Component
 * 
 * Renders widget nodes based on their type.
 * Supports all 10 built-in widget types from the protocol.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WidgetNode } from '../../../../src/terminal/protocols/types';
import { ApiKeyWalletWidget } from '../Wallet';
import styles from './WidgetRenderer.module.css';

// ============================================================================
// Types
// ============================================================================

export interface WidgetRendererProps {
  widget: WidgetNode;
  isSelected?: boolean;
}

// ============================================================================
// Individual Widget Renderers
// ============================================================================

function MarkdownWidget({ props }: { props: Record<string, unknown> }) {
  const content = (props.content as string) || '';
  return (
    <div className={styles.markdownWidget}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeWidget({ props }: { props: Record<string, unknown> }) {
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

function ChartWidget({ props }: { props: Record<string, unknown> }) {
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

function TableWidget({ props }: { props: Record<string, unknown> }) {
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

function ImageWidget({ props }: { props: Record<string, unknown> }) {
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

function ButtonWidget({ props }: { props: Record<string, unknown> }) {
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

function InputWidget({ props }: { props: Record<string, unknown> }) {
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

function MemoryViewerWidget({ props }: { props: Record<string, unknown> }) {
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

function SkillExecutorWidget({ props }: { props: Record<string, unknown> }) {
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

function ConversationWidget({ props }: { props: Record<string, unknown> }) {
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

function SettingsWidget({ props }: { props: Record<string, unknown> }) {
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

// ============================================================================
// Main Widget Renderer
// ============================================================================

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  const { widgetType, props } = widget;

  const renderWidget = () => {
    switch (widgetType) {
      case 'markdown':
        return <MarkdownWidget props={props} />;
      case 'code':
        return <CodeWidget props={props} />;
      case 'chart':
        return <ChartWidget props={props} />;
      case 'table':
        return <TableWidget props={props} />;
      case 'image':
        return <ImageWidget props={props} />;
      case 'button':
        return <ButtonWidget props={props} />;
      case 'input':
        return <InputWidget props={props} />;
      case 'memory-viewer':
        return <MemoryViewerWidget props={props} />;
      case 'skill-executor':
        return <SkillExecutorWidget props={props} />;
      case 'conversation':
        return <ConversationWidget props={props} />;
      case 'api-key-wallet':
        return <ApiKeyWalletWidget props={props} />;
      case 'settings':
        return <SettingsWidget props={props} />;
      default:
        return (
          <div className={styles.unknownWidget}>
            <span>Unknown widget type: {widgetType}</span>
          </div>
        );
    }
  };

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.widgetHeader}>
        <span className={styles.widgetType}>{widgetType}</span>
      </div>
      <div className={styles.widgetBody}>
        {renderWidget()}
      </div>
    </div>
  );
}

export default WidgetRenderer;