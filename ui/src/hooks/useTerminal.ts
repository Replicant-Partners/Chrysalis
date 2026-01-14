/**
 * YJS React Hooks for ChrysalisTerminal
 * 
 * Provides real-time bindings to the terminal's YJS document,
 * enabling React components to reactively update when terminal state changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { 
  ChatMessage, 
  CanvasNode, 
  CanvasEdge,
  ParticipantId,
  TerminalSession
} from '@terminal/protocols/common-types';

// ============================================================================
// Types
// ============================================================================

export interface TerminalConnection {
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  connected: boolean;
  synced: boolean;
}

export interface ChatPaneState {
  messages: ChatMessage[];
  isTyping: boolean;
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
}

export interface UseTerminalOptions {
  terminalId: string;
  serverUrl?: string;
  autoConnect?: boolean;
}

// ============================================================================
// Terminal Connection Hook
// ============================================================================

/**
 * Hook to establish and manage connection to a ChrysalisTerminal
 */
export function useTerminalConnection(options: UseTerminalOptions): TerminalConnection {
  const { terminalId, serverUrl = 'ws://localhost:1234', autoConnect = true } = options;
  
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    // Create YJS document
    const doc = new Y.Doc();
    docRef.current = doc;

    if (autoConnect) {
      // Create WebSocket provider
      const provider = new WebsocketProvider(
        serverUrl,
        `chrysalis-terminal-${terminalId}`,
        doc
      );
      providerRef.current = provider;

      // Track connection status
      provider.on('status', (event: { status: string }) => {
        setConnected(event.status === 'connected');
      });

      provider.on('sync', (isSynced: boolean) => {
        setSynced(isSynced);
      });
    }

    return () => {
      providerRef.current?.disconnect();
      docRef.current?.destroy();
    };
  }, [terminalId, serverUrl, autoConnect]);

  return {
    doc: docRef.current || new Y.Doc(),
    provider: providerRef.current,
    connected,
    synced
  };
}

// ============================================================================
// Chat Pane Hooks
// ============================================================================

/**
 * Hook to subscribe to a chat pane's messages
 */
export function useChatPane(
  doc: Y.Doc,
  pane: 'left' | 'right'
): ChatPaneState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!doc) return;

    const yMessages = doc.getArray<ChatMessage>(`chat_${pane}_messages`);
    const yTyping = doc.getMap('typing_indicators');

    // Initial load
    setMessages(yMessages.toArray());

    // Subscribe to changes
    const messageObserver = () => {
      setMessages(yMessages.toArray());
    };

    const typingObserver = () => {
      setIsTyping(yTyping.get(pane) === true);
    };

    yMessages.observe(messageObserver);
    yTyping.observe(typingObserver);

    return () => {
      yMessages.unobserve(messageObserver);
      yTyping.unobserve(typingObserver);
    };
  }, [doc, pane]);

  return { messages, isTyping };
}

/**
 * Hook to send messages to a chat pane
 */
export function useSendMessage(doc: Y.Doc, pane: 'left' | 'right') {
  const sendMessage = useCallback((content: string, senderId?: string) => {
    if (!doc) return null;

    const yMessages = doc.getArray<ChatMessage>(`chat_${pane}_messages`);
    
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      senderId: senderId || (pane === 'left' ? 'agent' : 'human'),
      senderType: pane === 'left' ? 'agent' : 'human',
      senderName: senderId || (pane === 'left' ? 'Agent' : 'Human'),
      timestamp: Date.now(),
      metadata: {}
    };

    yMessages.push([message]);
    return message;
  }, [doc, pane]);

  return sendMessage;
}

/**
 * Hook to manage typing indicator
 */
export function useTypingIndicator(doc: Y.Doc, pane: 'left' | 'right') {
  const setTyping = useCallback((isTyping: boolean) => {
    if (!doc) return;
    const yTyping = doc.getMap('typing_indicators');
    yTyping.set(pane, isTyping);
  }, [doc, pane]);

  return setTyping;
}

// ============================================================================
// Canvas Hooks
// ============================================================================

/**
 * Hook to subscribe to canvas state
 */
export function useCanvas(doc: Y.Doc): CanvasState {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (!doc) return;

    const yNodes = doc.getArray<CanvasNode>('canvas_nodes');
    const yEdges = doc.getArray<CanvasEdge>('canvas_edges');
    const yViewport = doc.getMap('canvas_viewport');

    // Initial load
    setNodes(yNodes.toArray());
    setEdges(yEdges.toArray());
    setViewport({
      x: (yViewport.get('x') as number) || 0,
      y: (yViewport.get('y') as number) || 0,
      zoom: (yViewport.get('zoom') as number) || 1
    });

    // Subscribe to changes
    const nodeObserver = () => setNodes(yNodes.toArray());
    const edgeObserver = () => setEdges(yEdges.toArray());
    const viewportObserver = () => {
      setViewport({
        x: (yViewport.get('x') as number) || 0,
        y: (yViewport.get('y') as number) || 0,
        zoom: (yViewport.get('zoom') as number) || 1
      });
    };

    yNodes.observe(nodeObserver);
    yEdges.observe(edgeObserver);
    yViewport.observe(viewportObserver);

    return () => {
      yNodes.unobserve(nodeObserver);
      yEdges.unobserve(edgeObserver);
      yViewport.unobserve(viewportObserver);
    };
  }, [doc]);

  return { nodes, edges, viewport };
}

/**
 * Hook to add/update/remove canvas nodes
 */
export function useCanvasActions(doc: Y.Doc) {
  const addNode = useCallback((node: Omit<CanvasNode, 'id'>) => {
    if (!doc) return null;

    const yNodes = doc.getArray<CanvasNode>('canvas_nodes');
    const newNode: CanvasNode = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } as CanvasNode;

    yNodes.push([newNode]);
    return newNode;
  }, [doc]);

  const updateNode = useCallback((nodeId: string, updates: Partial<CanvasNode>) => {
    if (!doc) return;

    const yNodes = doc.getArray<CanvasNode>('canvas_nodes');
    const nodes = yNodes.toArray();
    const index = nodes.findIndex(n => n.id === nodeId);
    
    if (index !== -1) {
      doc.transact(() => {
        yNodes.delete(index, 1);
        yNodes.insert(index, [{ ...nodes[index], ...updates } as CanvasNode]);
      });
    }
  }, [doc]);

  const removeNode = useCallback((nodeId: string) => {
    if (!doc) return;

    const yNodes = doc.getArray<CanvasNode>('canvas_nodes');
    const nodes = yNodes.toArray();
    const index = nodes.findIndex(n => n.id === nodeId);
    
    if (index !== -1) {
      yNodes.delete(index, 1);
    }
  }, [doc]);

  const addEdge = useCallback((fromNode: string, toNode: string) => {
    if (!doc) return null;

    const yEdges = doc.getArray<CanvasEdge>('canvas_edges');
    const newEdge: CanvasEdge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromNode,
      toNode,
      fromSide: 'right',
      toSide: 'left'
    };

    yEdges.push([newEdge]);
    return newEdge;
  }, [doc]);

  const setViewport = useCallback((x: number, y: number, zoom: number) => {
    if (!doc) return;

    const yViewport = doc.getMap('canvas_viewport');
    doc.transact(() => {
      yViewport.set('x', x);
      yViewport.set('y', y);
      yViewport.set('zoom', zoom);
    });
  }, [doc]);

  return { addNode, updateNode, removeNode, addEdge, setViewport };
}

// ============================================================================
// Session Hooks
// ============================================================================

/**
 * Hook to subscribe to session state (participants, etc.)
 */
export function useSession(doc: Y.Doc): TerminalSession | null {
  const [session, setSession] = useState<TerminalSession | null>(null);

  useEffect(() => {
    if (!doc) return;

    const ySession = doc.getMap('session');

    const updateSession = () => {
      const id = ySession.get('id') as string;
      if (!id) return;

      setSession({
        id,
        name: ySession.get('name') as string || 'Unnamed Session',
        lastActivity: Date.now(),
        participants: (ySession.get('participants') as ParticipantId[]) || [],
        frames: {
          left: { id: 'left', position: 'left', title: 'Agent', messages: [], participants: [], isTyping: [], scrollPosition: 0, metadata: {} },
          center: { id: 'center', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, selectedNodes: [], selectedEdges: [], metadata: {} },
          right: { id: 'right', position: 'right', title: 'Human', messages: [], participants: [], isTyping: [], scrollPosition: 0, metadata: {} }
        },
        metadata: {}
      });
    };

    updateSession();
    ySession.observe(updateSession);

    return () => {
      ySession.unobserve(updateSession);
    };
  }, [doc]);

  return session;
}

/**
 * Hook to manage participants
 */
export function useParticipants(doc: Y.Doc) {
  const addParticipant = useCallback((participant: Participant) => {
    if (!doc) return;

    const ySession = doc.getMap('session');
    const participants = (ySession.get('participants') as Participant[]) || [];
    
    if (!participants.find(p => p.id === participant.id)) {
      ySession.set('participants', [...participants, participant]);
    }
  }, [doc]);

  const removeParticipant = useCallback((participantId: string) => {
    if (!doc) return;

    const ySession = doc.getMap('session');
    const participants = (ySession.get('participants') as Participant[]) || [];
    ySession.set('participants', participants.filter(p => p.id !== participantId));
  }, [doc]);

  return { addParticipant, removeParticipant };
}

// ============================================================================
// Awareness Hook (Cursors, Presence)
// ============================================================================

export interface AwarenessState {
  clientId: number;
  user?: {
    name: string;
    color: string;
    type: 'human' | 'agent';
  };
  cursor?: { x: number; y: number };
}

/**
 * Hook to track awareness state (cursors, presence)
 */
export function useAwareness(provider: WebsocketProvider | null) {
  const [states, setStates] = useState<Map<number, AwarenessState>>(new Map());

  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;

    const updateStates = () => {
      const newStates = new Map<number, AwarenessState>();
      awareness.getStates().forEach((state, clientId) => {
        newStates.set(clientId, { clientId, ...state });
      });
      setStates(newStates);
    };

    updateStates();
    awareness.on('change', updateStates);

    return () => {
      awareness.off('change', updateStates);
    };
  }, [provider]);

  const setLocalState = useCallback((state: Partial<AwarenessState>) => {
    if (!provider) return;
    provider.awareness.setLocalState(state);
  }, [provider]);

  return { states, setLocalState };
}

// ============================================================================
// Combined Terminal Hook
// ============================================================================

/**
 * All-in-one hook for terminal state and actions
 */
export function useTerminal(options: UseTerminalOptions) {
  const connection = useTerminalConnection(options);
  const { doc, provider, connected, synced } = connection;

  const leftPane = useChatPane(doc, 'left');
  const rightPane = useChatPane(doc, 'right');
  const canvas = useCanvas(doc);
  const session = useSession(doc);

  const sendLeftMessage = useSendMessage(doc, 'left');
  const sendRightMessage = useSendMessage(doc, 'right');
  const setLeftTyping = useTypingIndicator(doc, 'left');
  const setRightTyping = useTypingIndicator(doc, 'right');
  const canvasActions = useCanvasActions(doc);
  const { addParticipant, removeParticipant } = useParticipants(doc);
  const awareness = useAwareness(provider);

  return {
    // Connection state
    connected,
    synced,
    doc,
    provider,

    // Chat panes
    leftPane,
    rightPane,

    // Canvas
    canvas,

    // Session
    session,

    // Actions
    actions: {
      sendAgentMessage: sendLeftMessage,
      sendHumanMessage: sendRightMessage,
      setAgentTyping: setLeftTyping,
      setHumanTyping: setRightTyping,
      ...canvasActions,
      addParticipant,
      removeParticipant
    },

    // Awareness (cursors, presence)
    awareness
  };
}