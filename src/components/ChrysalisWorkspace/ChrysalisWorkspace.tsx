/**
 * ChrysalisWorkspace Component
 *
 * The main three-frame layout for Chrysalis with:
 * - Left Frame: Chat pane bound to Primary Agent
 * - Center Frame: JSON Canvas workspace
 * - Right Frame: Chat pane bound to Secondary Agent
 *
 * Features:
 * - Resizable panels with drag handles
 * - YJS CRDT sync for real-time collaboration
 * - Document drop-to-learn on canvas
 * - Memory indicators on agent messages
 * - MemU integration for conversation memory persistence
 *
 * @module components/ChrysalisWorkspace/ChrysalisWorkspace
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChatPane } from './ChatPane';
import { AgentCanvas, CanvasTabs, CanvasTab } from '../AgentCanvas';
import { tokens, ThemeMode, useTheme } from '../shared';
import {
  ChrysalisWorkspaceProps,
  ChatMessage,
  ChatPanePosition,
  AgentBinding,
  PanelSizes,
  WorkspaceSession,
  ChatParticipant,
  DEFAULT_WORKSPACE_CONFIG,
} from './types';
import { AgentMemoryAdapter, createAgentMemoryAdapter } from '../../memory/AgentMemoryAdapter';
import { AgentChatController, AgentResponse } from '../../agents/AgentChatController';
import { AgentLearningPipeline, DocumentInput, LegendEmbeddingLoader, LegendEmbeddingFile } from '../../learning';
import { AgentCanvasState, AgentPosition, CanvasAgent, AgentSpecSummary } from '../../terminal/protocols';
import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  workspace: (mode: ThemeMode) => ({
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: tokens.color.surface.base[mode],
    overflow: 'hidden',
  }),
  leftPanel: {
    height: '100%',
    minWidth: 280,
    maxWidth: '40%',
    overflow: 'hidden',
    flexShrink: 0,
  },
  centerPanel: {
    flex: 1,
    height: '100%',
    minWidth: 400,
    overflow: 'hidden',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rightPanel: {
    height: '100%',
    minWidth: 280,
    maxWidth: '40%',
    overflow: 'hidden',
    flexShrink: 0,
  },
  resizeHandle: {
    width: 4,
    height: '100%',
    backgroundColor: 'transparent',
    cursor: 'col-resize',
    flexShrink: 0,
    transition: 'background-color 0.2s',
    zIndex: 10,
  },
  resizeHandleActive: (mode: ThemeMode) => ({
    backgroundColor: tokens.color.text.secondary[mode],
  }),
  resizeHandleHover: (mode: ThemeMode) => ({
    backgroundColor: tokens.color.border.subtle[mode],
  }),
  canvasOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 17, 27, 0.95)',
    pointerEvents: 'none' as const,
  },
  dropOverlay: (mode: ThemeMode) => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface.base[mode],
    border: `2px dashed ${tokens.color.text.secondary[mode]}`,
    borderRadius: 8,
    margin: 8,
    pointerEvents: 'none' as const,
  }),
  dropOverlayText: (mode: ThemeMode) => ({
    color: tokens.color.text.secondary[mode],
    fontSize: 18,
    fontWeight: 600,
    textAlign: 'center' as const,
  }),
  emptyCanvas: (mode: ThemeMode) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: tokens.color.surface.secondaryPane[mode],
    color: tokens.color.text.secondary[mode],
    textAlign: 'center' as const,
    padding: 40,
  }),
  emptyCanvasIcon: {
    fontSize: 64,
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyCanvasTitle: (mode: ThemeMode) => ({
    fontSize: 24,
    fontWeight: 600,
    color: tokens.color.text.primary[mode],
    marginBottom: 12,
  }),
  emptyCanvasSubtitle: {
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 400,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a new chat message
 */
function createMessage(
  content: string,
  senderId: string,
  senderName: string,
  senderType: 'user' | 'agent' | 'system'
): ChatMessage {
  return {
    id: generateId(),
    timestamp: Date.now(),
    senderId,
    senderName,
    senderType,
    content,
  };
}

/**
 * Build a minimal canvas spec from an agent binding.
 */
function buildAgentSpec(agentName: string, agentRole: string): AgentSpecSummary {
  return {
    name: agentName,
    role: agentRole || 'agent',
    goal: 'Assist the user in the commons canvas.',
    version: '0.1.0',
  };
}

function createCanvasAgentFromBinding(binding: AgentBinding, position: AgentPosition): CanvasAgent {
  const spec = buildAgentSpec(binding.agentName, binding.agentType);
  const now = Date.now();
  return {
    id: binding.agentId,
    spec,
    state: 'awake',
    position,
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Resize Handle Component
// =============================================================================

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  position: 'left' | 'right';
  mode: ThemeMode;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, position, mode }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const startXRef = useRef(0);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
  }, []);
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      startXRef.current = e.clientX;
      onResize(position === 'left' ? delta : -delta);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize, position]);
  
  return (
    <div
      style={{
        ...styles.resizeHandle,
        ...(isDragging ? styles.resizeHandleActive(mode) : {}),
        ...(isHovering && !isDragging ? styles.resizeHandleHover(mode) : {}),
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    />
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * ChrysalisWorkspace - Main three-frame layout
 */
export const ChrysalisWorkspace: React.FC<ChrysalisWorkspaceProps> = ({
  sessionId,
  userId,
  userName,
  primaryAgent,
  secondaryAgent,
  yjsDoc,
  memoryAdapter: externalMemoryAdapter,
  config: configOverrides,
  centerContent,
  onSessionStart,
  onSessionEnd,
  onMessageSent,
  onAgentResponse,
  onDocumentDrop,
  onMemoryEvent,
}) => {
  // Merge config with defaults
  const config = useMemo(() => ({
    ...DEFAULT_WORKSPACE_CONFIG,
    ...configOverrides,
    defaultPanelSizes: {
      ...DEFAULT_WORKSPACE_CONFIG.defaultPanelSizes,
      ...configOverrides?.defaultPanelSizes,
    }
  }), [configOverrides]);

  // Optional Go gateway client (lean HTTP bridge)
  const gatewayClient = useMemo(() => new GatewayLLMClient({
    baseUrl: config.gateway?.baseUrl,
    authToken: config.gateway?.authToken,
    defaultModel: config.gateway?.model,
  }), [config.gateway?.authToken, config.gateway?.baseUrl, config.gateway?.model]);
  
  // Panel sizing state
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(config.defaultPanelSizes);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { mode } = useTheme();
  const [canvasTabs, setCanvasTabs] = useState<CanvasTab[]>([
    { id: 'canvas-commons', label: 'Commons', isReady: true },
    { id: 'canvas-scratch', label: 'Scratch', isReady: true },
  ]);
  const [activeCanvasTabId, setActiveCanvasTabId] = useState<string>('canvas-commons');
  
  // Chat state
  const [leftMessages, setLeftMessages] = useState<ChatMessage[]>([]);
  const [rightMessages, setRightMessages] = useState<ChatMessage[]>([]);
  const [leftTyping, setLeftTyping] = useState(false);
  const [rightTyping, setRightTyping] = useState(false);
  const [leftDndState, setLeftDndState] = useState<'off' | 'on'>('off');
  const [rightDndState, setRightDndState] = useState<'off' | 'on'>('off');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(config.canvasSnapToGrid);
  const [showGrid, setShowGrid] = useState<boolean>(config.canvasShowGrid);
  const [gridSize, setGridSize] = useState<number>(config.canvasGridSize);
  const [gatewayStatus, setGatewayStatus] = useState<{ lastRequestId?: string; lastDurationMs?: number; error?: string }>({});
  const [canvasState, setCanvasState] = useState<AgentCanvasState>(() => {
    const now = Date.now();
    return {
      id: `canvas-${now}`,
      metadata: {
        id: `canvas-${now}`,
        name: 'Agent Commons',
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        description: 'Lean agent commons without registries.',
      },
      agents: [],
      layouts: {},
    };
  });

  // Sync canvas toggles if config changes at runtime
  useEffect(() => {
    setSnapToGrid(config.canvasSnapToGrid);
    setShowGrid(config.canvasShowGrid);
    setGridSize(config.canvasGridSize);
  }, [config.canvasSnapToGrid, config.canvasShowGrid, config.canvasGridSize]);
  
  // Session state
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  
  // Document drop state
  const [isDropTarget, setIsDropTarget] = useState(false);
  
  // Memory system refs (persisted across renders)
  const memoryAdapterRef = useRef<AgentMemoryAdapter | null>(null);
  const leftControllerRef = useRef<AgentChatController | null>(null);
  const rightControllerRef = useRef<AgentChatController | null>(null);
  const learningPipelineRef = useRef<AgentLearningPipeline | null>(null);
  
  // Participants
  const participants = useMemo<ChatParticipant[]>(() => [
    {
      id: userId,
      type: 'user',
      name: userName,
      joinedAt: Date.now(),
    },
    {
      id: primaryAgent.agentId,
      type: 'agent',
      name: primaryAgent.agentName,
      joinedAt: Date.now(),
    },
    ...(secondaryAgent ? [{
      id: secondaryAgent.agentId,
      type: 'agent' as const,
      name: secondaryAgent.agentName,
      joinedAt: Date.now(),
    }] : []),
  ], [userId, userName, primaryAgent, secondaryAgent]);

  // Seed canvas with active agents (primary/secondary) in a lean layout.
  useEffect(() => {
    setCanvasState((prev) => {
      const next = { ...prev, agents: [...prev.agents], layouts: { ...prev.layouts } };
      const seen = new Set<string>();

      const upsertAgent = (binding: AgentBinding, position: AgentPosition) => {
        seen.add(binding.agentId);
        const existing = next.agents.find(a => a.id === binding.agentId);
        if (!existing) {
          const agent = createCanvasAgentFromBinding(binding, position);
          next.agents.push(agent);
          next.layouts[agent.id] = {
            agentId: agent.id,
            position,
            collapsed: false,
            pinned: false,
            selected: next.selectedAgentId === agent.id,
            updatedAt: Date.now(),
          };
        }
      };

      upsertAgent(primaryAgent, { x: 120, y: 120, width: 240, height: 140 });
      if (secondaryAgent) {
        upsertAgent(secondaryAgent, { x: 420, y: 120, width: 240, height: 140 });
      }

      // Drop agents that are no longer bound to the workspace.
      next.agents = next.agents.filter(a => seen.has(a.id));
      for (const key of Object.keys(next.layouts)) {
        if (!seen.has(key)) {
          delete next.layouts[key];
        }
      }

      next.metadata = { ...next.metadata, updatedAt: Date.now() };
      return next;
    });
  }, [primaryAgent, secondaryAgent]);
  
  // Initialize memory system
  useEffect(() => {
    // Use external adapter or create internal one
    const adapter = externalMemoryAdapter ?? createAgentMemoryAdapter(config.memoryApiUrl);
    memoryAdapterRef.current = adapter;
    
    // Create learning pipeline for document processing
    learningPipelineRef.current = new AgentLearningPipeline(primaryAgent.agentId, config.memoryApiUrl);
    
    // Create left controller for primary agent
    leftControllerRef.current = new AgentChatController({
      agentId: primaryAgent.agentId,
      systemAgentsUrl: config.systemAgentsUrl,
      memoryUrl: config.memoryApiUrl,
      enableMemory: config.enableMemory,
      enableLearning: config.enableLearning,
    });
    
    // Create right controller for secondary agent (if present)
    if (secondaryAgent) {
      // For secondary agent, we could share the same adapter or create separate
      // Sharing allows cross-agent memory recall which is useful
      rightControllerRef.current = new AgentChatController({
        agentId: secondaryAgent.agentId,
        systemAgentsUrl: config.systemAgentsUrl,
        memoryUrl: config.memoryApiUrl,
        enableMemory: config.enableMemory,
        enableLearning: config.enableLearning,
      });
    }
    
    // Subscribe to memory events for UI feedback
    const maybeEmitter = adapter as any;
    const unsubscribe = typeof maybeEmitter?.on === 'function'
      ? maybeEmitter.on('memory:added', (event: any) => {
          onMemoryEvent?.({
            type: 'added',
            tier: event?.memory?.tier,
            memoryId: event?.memory?.memoryId,
            content: String(event?.memory?.content || '').slice(0, 100),
          });
        })
      : () => undefined;

    return () => {
      unsubscribe();
    };
  }, [primaryAgent.agentId, secondaryAgent?.agentId, userId, userName, externalMemoryAdapter, config.showMemoryIndicators, primaryAgent.agentName, secondaryAgent?.agentName]);
  
  // Initialize session
  useEffect(() => {
    const newSession: WorkspaceSession = {
      id: sessionId || generateId(),
      createdAt: Date.now(),
      primaryAgentId: primaryAgent.agentId,
      secondaryAgentId: secondaryAgent?.agentId,
      userId,
      userName,
    };
    setSession(newSession);
    onSessionStart?.(newSession);
    
    return () => {
      // Consolidate memories on session end
      const endSession = async () => {
        try {
          leftControllerRef.current?.clearHistory();
          rightControllerRef.current?.clearHistory();
        } catch (error) {
          console.error('[ChrysalisWorkspace] Error ending conversation:', error);
        }
      };
      
      endSession();
      
      if (newSession) {
        onSessionEnd?.(newSession);
      }
    };
  }, [sessionId, primaryAgent.agentId, secondaryAgent?.agentId, userId, userName]);
  
  // YJS sync effect (opt-in)
  useEffect(() => {
    if (!config.enableYjs || !yjsDoc) return;
    
    const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
    const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
    
    // Sync local state with YJS
    const syncLeftChat = () => {
      setLeftMessages(leftChatArray.toArray());
    };
    
    const syncRightChat = () => {
      setRightMessages(rightChatArray.toArray());
    };
    
    leftChatArray.observe(syncLeftChat);
    rightChatArray.observe(syncRightChat);
    
    // Initial sync
    syncLeftChat();
    syncRightChat();
    
    return () => {
      leftChatArray.unobserve(syncLeftChat);
      rightChatArray.unobserve(syncRightChat);
    };
  }, [yjsDoc, config.enableYjs]);
  
  // Handle panel resize
  const handleLeftResize = useCallback((delta: number) => {
    if (!workspaceRef.current) return;
    
    const workspaceWidth = workspaceRef.current.offsetWidth;
    const deltaPercent = (delta / workspaceWidth) * 100;
    
    setPanelSizes(prev => {
      const newLeftWidth = Math.max(15, Math.min(40, prev.leftWidth + deltaPercent));
      return {
        ...prev,
        leftWidth: newLeftWidth,
        centerWidth: 100 - newLeftWidth - prev.rightWidth,
      };
    });
  }, []);
  
  const handleRightResize = useCallback((delta: number) => {
    if (!workspaceRef.current) return;
    
    const workspaceWidth = workspaceRef.current.offsetWidth;
    const deltaPercent = (delta / workspaceWidth) * 100;
    
    setPanelSizes(prev => {
      const newRightWidth = Math.max(15, Math.min(40, prev.rightWidth + deltaPercent));
      return {
        ...prev,
        rightWidth: newRightWidth,
        centerWidth: 100 - prev.leftWidth - newRightWidth,
      };
    });
  }, []);

  // Canvas interactions (lean commons)
  const handleSelectCanvasAgent = useCallback((agentId: string) => {
    setCanvasState(prev => ({
      ...prev,
      selectedAgentId: agentId,
      metadata: { ...prev.metadata, updatedAt: Date.now() },
    }));
  }, []);

  const handleAddCanvasAgent = useCallback(() => {
    setCanvasState(prev => {
      const id = `agent-${Date.now()}`;
      const position: AgentPosition = {
        x: 200 + prev.agents.length * 40,
        y: 200,
        width: 220,
        height: 130,
      };
      const spec = buildAgentSpec(`Agent ${prev.agents.length + 1}`, 'auxiliary');
      const newAgent: CanvasAgent = {
        id,
        spec,
        state: 'dormant',
        position,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return {
        ...prev,
        agents: [...prev.agents, newAgent],
        layouts: {
          ...prev.layouts,
          [id]: { agentId: id, position, collapsed: false, pinned: false, selected: false, updatedAt: Date.now() },
        },
        metadata: { ...prev.metadata, updatedAt: Date.now() },
        selectedAgentId: id,
      };
    });
  }, []);

  const handleMoveCanvasAgent = useCallback((agentId: string, position: Partial<AgentPosition>) => {
    setCanvasState(prev => {
      const next = { ...prev, agents: [...prev.agents], layouts: { ...prev.layouts } };
      const agent = next.agents.find(a => a.id === agentId);
      if (!agent) return prev;
      agent.position = { ...agent.position, ...position };
      agent.updatedAt = Date.now();
      if (next.layouts[agentId]) {
        next.layouts[agentId] = {
          ...next.layouts[agentId],
          position: { ...next.layouts[agentId].position, ...position },
          updatedAt: Date.now(),
        };
      }
      next.metadata = { ...next.metadata, updatedAt: Date.now() };
      return next;
    });
  }, []);

  const handleSetCanvasAgentState = useCallback((agentId: string, state: any) => {
    setCanvasState(prev => {
      const next = { ...prev, agents: [...prev.agents] };
      const agent = next.agents.find(a => a.id === agentId);
      if (!agent) return prev;
      agent.state = state;
      agent.updatedAt = Date.now();
      next.metadata = { ...next.metadata, updatedAt: Date.now() };
      return next;
    });
  }, []);
  
  // Handle sending messages - Left pane
  const handleSendLeftMessage = useCallback(async (content: string) => {
    const message = createMessage(content, userId, userName, 'user');
    
    // Add user message to local state or YJS
    if (config.enableYjs && yjsDoc) {
      const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
      leftChatArray.push([message]);
    } else {
      setLeftMessages(prev => [...prev, message]);
    }
    
    onMessageSent?.(message, 'left');
    
    // Process through AgentChatController with MemU integration
    const controller = leftControllerRef.current;
    if (controller) {
      setLeftTyping(true);
      
      try {
        const response: AgentResponse = await controller.sendMessage(content);
        const agentMessage = createMessage(
          response.content,
          primaryAgent.agentId,
          primaryAgent.agentName,
          'agent'
        );
        agentMessage.metadata = response.metadata;
        if (response.memoryUsed && response.memoryUsed.length > 0) {
          agentMessage.memoryIndicators = response.memoryUsed.map((m) => ({
            memoryId: m.id,
            type: 'episodic' as const,
            content: m.content,
            usedInResponse: true,
          }));
          onMemoryEvent?.({
            type: 'recalled',
            tier: 'episodic',
            count: response.memoryUsed.length,
            memoryIds: response.memoryUsed.map((m) => m.id),
          });
        }

        if (config.enableYjs && yjsDoc) {
          const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
          leftChatArray.push([agentMessage]);
        } else {
          setLeftMessages(prev => [...prev, agentMessage]);
        }

        onAgentResponse?.(agentMessage, 'left');
      } catch (error) {
        console.error('[ChrysalisWorkspace] Error processing message:', error);
        
        // Fallback error message
        const errorMessage = createMessage(
          'I encountered an issue processing your message. Please try again.',
          primaryAgent.agentId,
          primaryAgent.agentName,
          'agent'
        );
        
        if (config.enableYjs && yjsDoc) {
          const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
          leftChatArray.push([errorMessage]);
        } else {
          setLeftMessages(prev => [...prev, errorMessage]);
        }
      } finally {
        setLeftTyping(false);
      }
    } else {
      // Fallback to mock response if controller not available
      setLeftTyping(true);
      setTimeout(() => {
        setLeftTyping(false);
        const agentResponse = createMessage(
          `I received your message: "${content}". Memory system not connected.`,
          primaryAgent.agentId,
          primaryAgent.agentName,
          'agent'
        );
        
        if (config.enableYjs && yjsDoc) {
          const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
          leftChatArray.push([agentResponse]);
        } else {
          setLeftMessages(prev => [...prev, agentResponse]);
        }
        
        onAgentResponse?.(agentResponse, 'left');
      }, 500);
    }
  }, [userId, userName, primaryAgent, yjsDoc, onMessageSent, onAgentResponse, onMemoryEvent, config.enableYjs]);
  
  // Handle sending messages - Right pane
  const handleSendRightMessage = useCallback(async (content: string) => {
    if (!secondaryAgent) return;
    
    const message = createMessage(content, userId, userName, 'user');
    
    if (config.enableYjs && yjsDoc) {
      const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
      rightChatArray.push([message]);
    } else {
      setRightMessages(prev => [...prev, message]);
    }
    
    onMessageSent?.(message, 'right');
    
    // Process through AgentChatController with MemU integration
    const controller = rightControllerRef.current;
    if (controller) {
      setRightTyping(true);
      
      try {
        const response: AgentResponse = await controller.sendMessage(content);
        const agentMessage = createMessage(
          response.content,
          secondaryAgent.agentId,
          secondaryAgent.agentName,
          'agent'
        );
        agentMessage.metadata = response.metadata;
        if (response.memoryUsed && response.memoryUsed.length > 0) {
          agentMessage.memoryIndicators = response.memoryUsed.map((m) => ({
            memoryId: m.id,
            type: 'episodic' as const,
            content: m.content,
            usedInResponse: true,
          }));
          onMemoryEvent?.({
            type: 'recalled',
            tier: 'episodic',
            count: response.memoryUsed.length,
            memoryIds: response.memoryUsed.map((m) => m.id),
          });
        }

        if (config.enableYjs && yjsDoc) {
          const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
          rightChatArray.push([agentMessage]);
        } else {
          setRightMessages(prev => [...prev, agentMessage]);
        }

        onAgentResponse?.(agentMessage, 'right');
      } catch (error) {
        console.error('[ChrysalisWorkspace] Error processing message:', error);
        
        const errorMessage = createMessage(
          'I encountered an issue processing your message. Please try again.',
          secondaryAgent.agentId,
          secondaryAgent.agentName,
          'agent'
        );
        
        if (config.enableYjs && yjsDoc) {
          const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
          rightChatArray.push([errorMessage]);
        } else {
          setRightMessages(prev => [...prev, errorMessage]);
        }
      } finally {
        setRightTyping(false);
      }
    } else {
      // Fallback to mock response
      setRightTyping(true);
      setTimeout(() => {
        setRightTyping(false);
        const agentResponse = createMessage(
          `Understood. I'll analyze that and provide my perspective. Memory system not connected.`,
          secondaryAgent.agentId,
          secondaryAgent.agentName,
          'agent'
        );
        
        if (yjsDoc) {
          const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
          rightChatArray.push([agentResponse]);
        } else {
          setRightMessages(prev => [...prev, agentResponse]);
        }
        
        onAgentResponse?.(agentResponse, 'right');
      }, 500);
    }
  }, [userId, userName, secondaryAgent, yjsDoc, onMessageSent, onAgentResponse, onMemoryEvent]);
  
  // Handle clear chat
  const handleClearLeftChat = useCallback(() => {
    if (config.enableYjs && yjsDoc) {
      const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
      leftChatArray.delete(0, leftChatArray.length);
    } else {
      setLeftMessages([]);
    }
  }, [yjsDoc, config.enableYjs]);
  
  const handleClearRightChat = useCallback(() => {
    if (config.enableYjs && yjsDoc) {
      const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
      rightChatArray.delete(0, rightChatArray.length);
    } else {
      setRightMessages([]);
    }
  }, [yjsDoc, config.enableYjs]);

  // Handle permission approvals
  const handlePermissionApprove = useCallback((requestId: string) => {
    console.log('[ChrysalisWorkspace] Permission approved:', requestId);
    
    // Update message status to approved
    const updateMessageStatus = (messages: ChatMessage[]) =>
      messages.map(msg =>
        msg.permissionRequest?.requestId === requestId
          ? {
              ...msg,
              permissionRequest: {
                ...msg.permissionRequest,
                status: 'approved' as const,
              },
            }
          : msg
      );

    if (config.enableYjs && yjsDoc) {
      // Update YJS arrays
      const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
      const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
      const leftMessages = leftChatArray.toArray();
      const rightMessages = rightChatArray.toArray();
      
      leftChatArray.delete(0, leftChatArray.length);
      leftChatArray.push(updateMessageStatus(leftMessages));
      
      rightChatArray.delete(0, rightChatArray.length);
      rightChatArray.push(updateMessageStatus(rightMessages));
    } else {
      setLeftMessages(updateMessageStatus);
      setRightMessages(updateMessageStatus);
    }

    // TODO: Execute the approved action
    // This would typically call back to AdaIntegrationService or AgentChatController
    // to actually perform the action that was approved
  }, [yjsDoc, config.enableYjs]);

  const handlePermissionDeny = useCallback((requestId: string) => {
    console.log('[ChrysalisWorkspace] Permission denied:', requestId);
    
    // Update message status to denied
    const updateMessageStatus = (messages: ChatMessage[]) =>
      messages.map(msg =>
        msg.permissionRequest?.requestId === requestId
          ? {
              ...msg,
              permissionRequest: {
                ...msg.permissionRequest,
                status: 'denied' as const,
              },
            }
          : msg
      );

    if (config.enableYjs && yjsDoc) {
      const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
      const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
      const leftMessages = leftChatArray.toArray();
      const rightMessages = rightChatArray.toArray();
      
      leftChatArray.delete(0, leftChatArray.length);
      leftChatArray.push(updateMessageStatus(leftMessages));
      
      rightChatArray.delete(0, rightChatArray.length);
      rightChatArray.push(updateMessageStatus(rightMessages));
    } else {
      setLeftMessages(updateMessageStatus);
      setRightMessages(updateMessageStatus);
    }

    // TODO: Notify agent that action was denied
    // This would typically call AdaIntegrationService.denyAction()
  }, [yjsDoc, config.enableYjs]);

  const handlePermissionExplain = useCallback((requestId: string) => {
    console.log('[ChrysalisWorkspace] Permission explanation requested:', requestId);
    
    // Find the permission request
    const allMessages = [...leftMessages, ...rightMessages];
    const permissionMessage = allMessages.find(
      msg => msg.permissionRequest?.requestId === requestId
    );

    if (permissionMessage?.permissionRequest) {
      const { action, riskLevel, scopePreview, agentName } = permissionMessage.permissionRequest;
      
      // Generate risk explanation message
      let explanation = `Here's why ${agentName} needs approval:\n\n`;
      explanation += `**Action**: ${action}\n`;
      explanation += `**Risk Level**: ${riskLevel || 'Not assessed'}\n`;
      
      if (scopePreview) {
        explanation += `**Scope**: ${scopePreview}\n`;
      }
      
      explanation += `\nThis request requires your explicit approval before ${agentName} can proceed.`;

      // Add explanation as a system message
      const explanationMessage = createMessage(
        explanation,
        'system',
        'System',
        'system'
      );

      if (config.enableYjs && yjsDoc) {
        // Add to the pane where the original request was
        const leftHasRequest = leftMessages.some(m => m.permissionRequest?.requestId === requestId);
        const chatArray = leftHasRequest
          ? yjsDoc.getArray<ChatMessage>('leftChat')
          : yjsDoc.getArray<ChatMessage>('rightChat');
        chatArray.push([explanationMessage]);
      } else {
        const leftHasRequest = leftMessages.some(m => m.permissionRequest?.requestId === requestId);
        if (leftHasRequest) {
          setLeftMessages(prev => [...prev, explanationMessage]);
        } else {
          setRightMessages(prev => [...prev, explanationMessage]);
        }
      }
    }
  }, [leftMessages, rightMessages, yjsDoc, config.enableYjs, userId, userName]);
  
  // Handle document drop on canvas
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!config.enableDocumentDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(true);
  }, [config.enableDocumentDrop]);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!config.enableDocumentDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
  }, [config.enableDocumentDrop]);
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (!config.enableDocumentDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    
    const files = Array.from(e.dataTransfer.files);
    const supportedFiles = files.filter(f =>
      f.type.includes('json') ||
      f.type.includes('yaml') ||
      f.type.includes('text') ||
      f.type.includes('pdf') ||
      f.name.endsWith('.md')
    );
    
    // Check for embedding files (from builder pipeline)
    const embeddingFiles = files.filter(f =>
      f.name.endsWith('_embeddings.json') ||
      f.name.endsWith('_embeddings_full.json')
    );
    
    // Load embedding files into agent memory
    const leftController = leftControllerRef.current;
    const adapter = memoryAdapterRef.current;
    if (leftController && embeddingFiles.length > 0 && adapter) {
      for (const file of embeddingFiles) {
        try {
          const content = await readFileContent(file);
          const embeddingData: LegendEmbeddingFile = JSON.parse(content);
          await adapter.store({
            content: JSON.stringify(embeddingData),
            agentId: primaryAgent.agentId,
            role: 'system',
            importance: 0.6,
            metadata: {
              source: 'legend_embeddings',
              filename: file.name,
            },
          });
          
          // Emit learning event
          onMemoryEvent?.({
            type: 'learned',
            tier: 'semantic',
            source: file.name,
            factsExtracted: 0,
          });
          
          console.log(`[ChrysalisWorkspace] Loaded legend embeddings from ${file.name}`);
        } catch (error) {
          console.error(`[ChrysalisWorkspace] Error loading embeddings from ${file.name}:`, error);
        }
      }
    }
    
    // Process non-embedding files through AgentLearningPipeline
    const documentFiles = supportedFiles.filter(f =>
      !f.name.endsWith('_embeddings.json') &&
      !f.name.endsWith('_embeddings_full.json')
    );
    
    for (const file of documentFiles) {
      onDocumentDrop?.(file, { x: e.clientX, y: e.clientY });
      
      // Read file content and learn from it
      const pipeline = learningPipelineRef.current;
      if (pipeline) {
        try {
          const content = await readFileContent(file);
          const documentInput: DocumentInput = {
            id: `${Date.now()}-${file.name}`,
            type: file.name.endsWith('.md') ? 'markdown' : (file.type.includes('json') ? 'json' : (file.type.includes('pdf') ? 'pdf' : 'text')),
            content,
            filename: file.name,
            metadata: {
              mimeType: file.type,
              source: 'document_drop',
            },
          };
          
          const result = await pipeline.processDocument(documentInput);
          
          // Emit learning event
          onMemoryEvent?.({
            type: 'learned',
            tier: 'semantic',
            source: file.name,
            factsExtracted: result.memoriesCreated,
          });
          
          console.log(`[ChrysalisWorkspace] Learned ${result.memoriesCreated} facts from ${file.name}`);
        } catch (error) {
          console.error(`[ChrysalisWorkspace] Error learning from ${file.name}:`, error);
        }
      }
    }
  }, [config.enableDocumentDrop, onDocumentDrop, onMemoryEvent]);
  
  return (
    <div ref={workspaceRef} style={styles.workspace(mode)}>
      {/* Left Chat Pane */}
      <div style={{ ...styles.leftPanel, width: `${panelSizes.leftWidth}%` }}>
        <ChatPane
          paneId="left"
          agent={primaryAgent}
          messages={leftMessages}
          participants={participants}
          isAgentTyping={leftTyping}
          showMemoryIndicators={config.showMemoryIndicators}
          maxMessages={config.maxMessagesPerPane}
          dndState={leftDndState}
          onSendMessage={handleSendLeftMessage}
          onClearChat={handleClearLeftChat}
          onInviteClick={() => {
            onMessageSent?.(createMessage('Invite requested', userId, userName, 'system'), 'left');
          }}
          onToggleDnd={setLeftDndState}
          onPermissionApprove={handlePermissionApprove}
          onPermissionDeny={handlePermissionDeny}
          onPermissionExplain={handlePermissionExplain}
        />
      </div>
      
      {/* Left Resize Handle */}
        <ResizeHandle onResize={handleLeftResize} position="left" mode={mode} />
      
      {/* Center Canvas */}
      <div
        style={{ ...styles.centerPanel, width: `${panelSizes.centerWidth}%` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CanvasTabs
          tabs={canvasTabs}
          activeTabId={activeCanvasTabId}
          mode={mode}
          onSelectTab={setActiveCanvasTabId}
          onOpenCanvas={() => {
            const newId = `canvas-${Date.now()}`;
            setCanvasTabs((prev) => [...prev, { id: newId, label: `Canvas ${prev.length + 1}`, isReady: true }]);
            setActiveCanvasTabId(newId);
          }}
        />
        {config.enableYjs && (
          <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 5, fontSize: 12, color: '#9aa4b5' }}>
            YJS sync enabled
          </div>
        )}
        {/* Center content: custom content (e.g., CanvasApp) or default AgentCanvas */}
        {centerContent ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>{centerContent}</div>
        ) : (
          <AgentCanvas
            canvas={canvasState}
            onSelectAgent={handleSelectCanvasAgent}
            onAddAgent={handleAddCanvasAgent}
            onMoveAgent={handleMoveCanvasAgent}
            onStateChange={handleSetCanvasAgentState}
            snapToGrid={snapToGrid}
            gridSize={gridSize}
            showGrid={showGrid}
            onToggleSnap={setSnapToGrid}
            onToggleGrid={setShowGrid}
            onGridSizeChange={setGridSize}
          />
        )}
        
        {/* Drop Overlay for Embedding Files */}
        {isDropTarget && (
          <div style={styles.dropOverlay(mode)}>
            <div style={styles.dropOverlayText(mode)}>
              📄 Drop to learn from document
            </div>
          </div>
        )}
      </div>
      
      {/* Right Resize Handle */}
      <ResizeHandle onResize={handleRightResize} position="right" mode={mode} />

      {/* Right Chat Pane */}
      {secondaryAgent ? (
        <div style={{ ...styles.rightPanel, width: `${panelSizes.rightWidth}%` }}>
          {gatewayStatus.lastRequestId && (
            <div style={{ padding: '4px 8px', fontSize: 12, color: '#9aa4b5' }}>
              Gateway req {gatewayStatus.lastRequestId}
              {typeof gatewayStatus.lastDurationMs === 'number' && ` · ${gatewayStatus.lastDurationMs} ms`}
              {gatewayStatus.error && ` · error: ${gatewayStatus.error}`}
            </div>
          )}
          <ChatPane
            paneId="right"
            agent={secondaryAgent}
            messages={rightMessages}
            participants={participants}
            isAgentTyping={rightTyping}
            showMemoryIndicators={config.showMemoryIndicators}
            maxMessages={config.maxMessagesPerPane}
            dndState={rightDndState}
            onSendMessage={handleSendRightMessage}
            onClearChat={handleClearRightChat}
            onInviteClick={() => {
              onMessageSent?.(createMessage('Invite requested', userId, userName, 'system'), 'right');
            }}
            onToggleDnd={setRightDndState}
            onPermissionApprove={handlePermissionApprove}
            onPermissionDeny={handlePermissionDeny}
            onPermissionExplain={handlePermissionExplain}
          />
        </div>
      ) : (
        <div style={{ ...styles.rightPanel, width: `${panelSizes.rightWidth}%` }}>
          <div style={styles.emptyCanvas(mode)}>
            <div style={styles.emptyCanvasIcon}>🤖</div>
            <div style={styles.emptyCanvasTitle(mode)}>No Secondary Agent</div>
            <div style={styles.emptyCanvasSubtitle}>
              Add a secondary agent to enable multi-agent conversations.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Helper function to read file content as text
 */
async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default ChrysalisWorkspace;