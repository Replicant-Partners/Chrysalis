import React, { useMemo } from 'react';
import { AgentCanvasState, CanvasAgent, AgentPosition, AgentState } from '../../terminal/protocols';
import { useRef, useEffect } from 'react';

/**
 * Lean Agent Canvas (commons) with no widget registry.
 * Renders a simple grid of agent cards with selection hooks.
 */
export interface AgentCanvasProps {
  canvas?: AgentCanvasState;
  onSelectAgent?: (id: string) => void;
  onAddAgent?: () => void;
  onMoveAgent?: (id: string, position: Partial<AgentPosition>) => void;
  onStateChange?: (id: string, state: AgentState) => void;
  snapToGrid?: boolean;
  gridSize?: number;
  showGrid?: boolean;
  onToggleSnap?: (value: boolean) => void;
  onToggleGrid?: (value: boolean) => void;
  onGridSizeChange?: (value: number) => void;
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: '#0f1116',
    color: '#e6e9f0',
    padding: '16px',
    gap: '12px',
    boxSizing: 'border-box' as const,
  },
  controls: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  controlButton: {
    background: '#1b2434',
    color: '#d8e3ff',
    border: '1px solid #2f3b55',
    borderRadius: 6,
    padding: '4px 6px',
    fontSize: 12,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
  },
  badge: {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 6,
    background: '#1c2333',
    color: '#9fb2ff',
    border: '1px solid #2b3550',
  },
  toggles: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  toggleButton: {
    background: '#1b2434',
    color: '#d8e3ff',
    border: '1px solid #2f3b55',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
  },
  gridInput: {
    background: '#0f1624',
    color: '#d8e3ff',
    border: '1px solid #2f3b55',
    borderRadius: 6,
    padding: '4px 6px',
    width: 64,
    fontSize: 12,
  },
  canvasArea: {
    position: 'relative' as const,
    flex: 1,
    overflow: 'auto' as const,
    border: '1px solid #1f2737',
    borderRadius: 12,
    backgroundColor: '#0d1018',
    minHeight: 240,
  },
  card: {
    background: '#121722',
    border: '1px solid #1f2737',
    borderRadius: 10,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.15s',
    position: 'absolute' as const,
    minWidth: 220,
  },
  cardDragging: {
    opacity: 0.8,
    borderColor: '#6aa9ff',
  },
  cardSelected: {
    borderColor: '#6aa9ff',
    boxShadow: '0 0 0 1px #6aa9ff33',
  },
  name: { fontWeight: 600, fontSize: 15 },
  role: { fontSize: 13, color: '#9aa4b5' },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    color: '#8b95a9',
  },
  state: {
    padding: '2px 6px',
    borderRadius: 999,
    background: '#1d2636',
    color: '#c0d2ff',
    border: '1px solid #27334a',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    border: '1px dashed #27334a',
    borderRadius: 12,
    padding: '24px',
    color: '#8b95a9',
    textAlign: 'center' as const,
    gap: '8px',
    background: '#0d1018',
  },
  addButton: {
    background: '#24304a',
    color: '#d8e3ff',
    border: '1px solid #2f3b55',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    cursor: 'pointer',
  }
};

function formatPosition(pos?: AgentPosition) {
  if (!pos) return 'free';
  const { x = 0, y = 0 } = pos;
  return `(${Math.round(x)}, ${Math.round(y)})`;
}

function stateLabel(state: AgentState) {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export const AgentCanvas: React.FC<AgentCanvasProps> = ({
  canvas,
  onSelectAgent,
  onAddAgent,
  onMoveAgent,
  onStateChange,
  snapToGrid = true,
  gridSize = 20,
  showGrid = true,
  onToggleSnap,
  onToggleGrid,
  onGridSizeChange,
}) => {
  const draggingRef = useRef<{ id: string; startX: number; startY: number; orig: AgentPosition } | null>(null);

  useEffect(() => {
    if (!onMoveAgent) return;

    const handleMove = (e: MouseEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      onMoveAgent(drag.id, {
        x: snapToGrid ? Math.round(((drag.orig.x ?? 0) + dx) / gridSize) * gridSize : (drag.orig.x ?? 0) + dx,
        y: snapToGrid ? Math.round(((drag.orig.y ?? 0) + dy) / gridSize) * gridSize : (drag.orig.y ?? 0) + dy,
      });
    };

    const handleUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [onMoveAgent]);
  const fallbackCanvas = useMemo<AgentCanvasState>(() => {
    const now = Date.now();
    return {
      id: `canvas-${now}`,
      metadata: {
        id: `canvas-${now}`,
        name: 'Agent Commons',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        description: 'Lean agent team commons without widget registry.',
      },
      agents: [],
      layouts: {},
    };
  }, []);

  const activeCanvas = canvas || fallbackCanvas;
  const agents = activeCanvas.agents || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>{activeCanvas.metadata.name}</div>
        <div style={styles.badge}>Commons · Lean</div>
        {onAddAgent && (
          <button style={styles.addButton} onClick={onAddAgent}>
            + Add agent
          </button>
        )}
        <div style={styles.toggles}>
          {onToggleSnap && (
            <button
              style={styles.toggleButton}
              onClick={() => onToggleSnap(!snapToGrid)}
              aria-pressed={snapToGrid}
            >
              Snap: {snapToGrid ? 'On' : 'Off'}
            </button>
          )}
          {onToggleGrid && (
            <button
              style={styles.toggleButton}
              onClick={() => onToggleGrid(!showGrid)}
              aria-pressed={showGrid}
            >
              Grid: {showGrid ? 'On' : 'Off'}
            </button>
          )}
          {onGridSizeChange && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#9aa4b5' }}>Size</span>
              <input
                type="number"
                min={4}
                max={200}
                step={2}
                value={gridSize}
                onChange={(e) => onGridSizeChange(Number(e.target.value) || gridSize)}
                style={styles.gridInput as React.CSSProperties}
              />
            </label>
          )}
        </div>
      </div>

      <div
        style={{
          ...styles.canvasArea,
          backgroundImage: showGrid
            ? `linear-gradient(to right, #1a2233 1px, transparent 1px), linear-gradient(to bottom, #1a2233 1px, transparent 1px)`
            : undefined,
          backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : undefined,
        }}
      >
        {agents.length === 0 ? (
          <div style={{ ...styles.empty, position: 'absolute', inset: 12 }}>
            <div>Drop an agent into the canvas to activate the team.</div>
            <div style={{ fontSize: 12 }}>
              No registries or visitors — just agents, positions, and state.
            </div>
          </div>
        ) : (
          agents.map((agent: CanvasAgent, idx: number) => {
            const selected = activeCanvas.selectedAgentId === agent.id;
            const position = agent.position || {
              x: 60 + idx * 40,
              y: 60,
              width: 240,
              height: 140,
            };
            const snappedTop = snapToGrid ? Math.round((position.y ?? 0) / gridSize) * gridSize : position.y ?? 0;
            const snappedLeft = snapToGrid ? Math.round((position.x ?? 0) / gridSize) * gridSize : position.x ?? 0;
            return (
              <div
                key={agent.id}
                style={{
                  ...styles.card,
                  ...(selected ? styles.cardSelected : {}),
                  ...(draggingRef.current?.id === agent.id ? styles.cardDragging : {}),
                  top: snappedTop,
                  left: snappedLeft,
                  width: position.width ?? 240,
                  height: position.height ?? 'auto',
                }}
                onClick={() => onSelectAgent?.(agent.id)}
                onMouseDown={(e) => {
                  if (!onMoveAgent) return;
                  draggingRef.current = {
                    id: agent.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    orig: {
                      x: position?.x ?? snappedLeft,
                      y: position?.y ?? snappedTop,
                      width: position?.width ?? 0,
                      height: position?.height ?? 0,
                    },
                  };
                }}
              >
                <div style={styles.name}>{agent.spec.name}</div>
                <div style={styles.role}>{agent.spec.role}</div>
                {agent.spec.goal && (
                  <div style={{ fontSize: 12, color: '#9fb2ff' }}>
                    Goal: {agent.spec.goal}
                  </div>
                )}
                <div style={styles.footer}>
                  <span style={styles.state}>{stateLabel(agent.state)}</span>
                  <span>{formatPosition(position)}</span>
                </div>
                <div style={styles.controls}>
                  {onMoveAgent && (
                    <>
                      <button
                        style={styles.controlButton}
                        onClick={(e) => { e.stopPropagation(); onMoveAgent(agent.id, { y: (position?.y ?? 0) - gridSize }); }}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        style={styles.controlButton}
                        onClick={(e) => { e.stopPropagation(); onMoveAgent(agent.id, { y: (position?.y ?? 0) + gridSize }); }}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        style={styles.controlButton}
                        onClick={(e) => { e.stopPropagation(); onMoveAgent(agent.id, { x: (position?.x ?? 0) - gridSize }); }}
                        aria-label="Move left"
                      >
                        ←
                      </button>
                      <button
                        style={styles.controlButton}
                        onClick={(e) => { e.stopPropagation(); onMoveAgent(agent.id, { x: (position?.x ?? 0) + gridSize }); }}
                        aria-label="Move right"
                      >
                        →
                      </button>
                    </>
                  )}
                  {onStateChange && (
                    <button
                      style={styles.controlButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = agent.state === 'awake' ? 'sleeping' : 'awake';
                        onStateChange(agent.id, next);
                      }}
                    >
                      {agent.state === 'awake' ? 'Sleep' : 'Wake'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
