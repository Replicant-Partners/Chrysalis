/**
 * Terminal Canvas - Embed xterm.js terminals
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { Button } from '../design-system';
import styles from './TerminalCanvas.module.css';

interface TerminalInstance {
  id: string;
  title: string;
  terminal: Terminal;
  element: HTMLDivElement;
}

export const TerminalCanvas: React.FC = () => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const createTerminal = () => {
    const id = `terminal-${Date.now()}`;
    const element = document.createElement('div');
    element.style.width = '100%';
    element.style.height = '100%';

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      theme: {
        background: '#0F172A',
        foreground: '#E2E8F0',
        cursor: '#06B6D4',
        selectionBackground: 'rgba(6, 182, 212, 0.3)',
        black: '#1E293B',
        red: '#F43F5E',
        green: '#34D399',
        yellow: '#FBBF24',
        blue: '#3B82F6',
        magenta: '#A855F7',
        cyan: '#06B6D4',
        white: '#F1F5F9',
        brightBlack: '#475569',
        brightRed: '#FB7185',
        brightGreen: '#6EE7B7',
        brightYellow: '#FCD34D',
        brightBlue: '#60A5FA',
        brightMagenta: '#C084FC',
        brightCyan: '#22D3EE',
        brightWhite: '#F8FAFC',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(element);

    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon not supported, falling back to canvas renderer');
    }

    fitAddon.fit();

    // Welcome message
    terminal.writeln('\x1b[1;36mChrysalis Terminal\x1b[0m');
    terminal.writeln('');
    terminal.writeln('Ready for input. Backend connection pending...');
    terminal.writeln('');

    const instance: TerminalInstance = {
      id,
      title: `Terminal ${terminals.length + 1}`,
      terminal,
      element,
    };

    setTerminals((prev) => [...prev, instance]);
    setActiveTerminalId(id);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(element);

    return instance;
  };

  const closeTerminal = (id: string) => {
    setTerminals((prev) => {
      const terminal = prev.find((t) => t.id === id);
      if (terminal) {
        terminal.terminal.dispose();
      }
      const updated = prev.filter((t) => t.id !== id);
      if (activeTerminalId === id && updated.length > 0) {
        setActiveTerminalId(updated[0].id);
      }
      return updated;
    });
  };

  useEffect(() => {
    return () => {
      terminals.forEach((t) => t.terminal.dispose());
    };
  }, []);

  return (
    <div className={styles.canvas}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {terminals.map((t) => (
            <div
              key={t.id}
              className={`${styles.tab} ${
                t.id === activeTerminalId ? styles.active : ''
              }`}
              onClick={() => setActiveTerminalId(t.id)}
            >
              <TerminalIcon size={14} />
              <span>{t.title}</span>
              <button
                className={styles.closeTab}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(t.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={createTerminal}
          iconBefore={<Plus size={16} />}
        >
          New Terminal
        </Button>
      </div>

      <div className={styles.terminalContainer} ref={containerRef}>
        {terminals.length === 0 ? (
          <div className={styles.empty}>
            <TerminalIcon size={48} />
            <p>No terminals open</p>
            <Button onClick={createTerminal}>Create Terminal</Button>
          </div>
        ) : (
          terminals.map((t) => (
            <div
              key={t.id}
              ref={(el) => {
                if (el && !el.contains(t.element)) {
                  el.appendChild(t.element);
                }
              }}
              className={styles.terminalWrapper}
              style={{
                display: t.id === activeTerminalId ? 'block' : 'none',
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};