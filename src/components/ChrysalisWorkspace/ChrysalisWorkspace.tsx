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
 * 
 * @module components/ChrysalisWorkspace/ChrysalisWorkspace
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { ChatPane } from './ChatPane';
import { AgentCanvas } from '../AgentCanvas';
import {
  ChrysalisWorkspaceProps,
  ChatMessage,
  ChatPanePosition,
  PanelSizes,
  WorkspaceSession,
  ChatParticipant,
  DEFAULT_WORKSPACE_CONFIG,
} from './types';

// =============================================================================
// Styles
// =============================================================================

const styles = {
  workspace: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#11111b',
    overflow: 'hidden',
  },
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
  resizeHandleActive: {
    backgroundColor: '#89b4fa',
  },
  resizeHandleHover: {
    backgroundColor: '#45475a',
  },
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
  dropOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(137, 180, 250, 0.1)',
    border: '2px dashed #89b4fa',
    borderRadius: 8,
    margin: 8,
    pointerEvents: 'none' as const,
  },
  dropOverlayText: {
    color: '#89b4fa',
    fontSize: 18,
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  emptyCanvas: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#1e1e2e',
    color: '#6c7086',
    textAlign: 'center' as const,
    padding: 40,
  },
  emptyCanvasIcon: {
    fontSize: 64,
    marginBottom: 24,
    opacity: 0.5,
  },
  emptyCanvasTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: '#cdd6f4',
    marginBottom: 12,
  },
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

// =============================================================================
// Resize Handle Component
// =============================================================================

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  position: 'left' | 'right';
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, position }) => {
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
        ...(isDragging ? styles.resizeHandleActive : {}),
        ...(isHovering && !isDragging ? styles.resizeHandleHover : {}),
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
  config: configOverrides,
  onSessionStart,
  onSessionEnd,
  onMessageSent,
  onAgentResponse,
  onDocumentDrop,
}) => {
  // Merge config with defaults
  const config = useMemo(() => ({
    ...DEFAULT_WORKSPACE_CONFIG,
    ...configOverrides,
  }), [configOverrides]);
  
  // Panel sizing state
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(config.defaultPanelSizes);
  const workspaceRef = useRef<HTMLDivElement>(null);
  
  // Chat state
  const [leftMessages, setLeftMessages] = useState<ChatMessage[]>([]);
  const [rightMessages, setRightMessages] = useState<ChatMessage[]>([]);
  const [leftTyping, setLeftTyping] = useState(false);
  const [rightTyping, setRightTyping] = useState(false);
  
  // Session state
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  
  // Document drop state
  const [isDropTarget, setIsDropTarget] = useState(false);
  
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
      if (newSession) {
        onSessionEnd?.(newSession);
      }
    };
  }, [sessionId, primaryAgent.agentId, secondaryAgent?.agentId, userId, userName]);
  
  // YJS sync effect (if yjsDoc provided)
  useEffect(() => {
    if (!yjsDoc) return;
    
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
  }, [yjsDoc]);
  
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
  
  // Handle sending messages
  const handleSendLeftMessage = useCallback((content: string) => {
    const message = createMessage(content, userId, userName, 'user');
    
    // Add to local state or YJS
    if (yjsDoc) {
      const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
      leftChatArray.push([message]);
    } else {
      setLeftMessages(prev => [...prev, message]);
    }
    
    onMessageSent?.(message, 'left');
    
    // Simulate agent response (in real implementation, this would go through AgentTerminalClient)
    setLeftTyping(true);
    setTimeout(() => {
      setLeftTyping(false);
      const agentResponse = createMessage(
        `I received your message: "${content}". Let me think about that...`,
        primaryAgent.agentId,
        primaryAgent.agentName,
        'agent'
      );
      
      if (yjsDoc) {
        const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
        leftChatArray.push([agentResponse]);
      } else {
        setLeftMessages(prev => [...prev, agentResponse]);
      }
      
      onAgentResponse?.(agentResponse, 'left');
    }, 1500);
  }, [userId, userName, primaryAgent, yjsDoc, onMessageSent, onAgentResponse]);
  
  const handleSendRightMessage = useCallback((content: string) => {
    if (!secondaryAgent) return;
    
    const message = createMessage(content, userId, userName, 'user');
    
    if (yjsDoc) {
      const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
      rightChatArray.push([message]);
    } else {
      setRightMessages(prev => [...prev, message]);
    }
    
    onMessageSent?.(message, 'right');
    
    // Simulate agent response
    setRightTyping(true);
    setTimeout(() => {
      setRightTyping(false);
      const agentResponse = createMessage(
        `Understood. I'll analyze that and provide my perspective.`,
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
    }, 1500);
  }, [userId, userName, secondaryAgent, yjsDoc, onMessageSent, onAgentResponse]);
  
  // Handle clear chat
  const handleClearLeftChat = useCallback(() => {
    if (yjsDoc) {
      const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
      leftChatArray.delete(0, leftChatArray.length);
    } else {
      setLeftMessages([]);
    }
  }, [yjsDoc]);
  
  const handleClearRightChat = useCallback(() => {
    if (yjsDoc) {
      const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
      rightChatArray.delete(0, rightChatArray.length);
    } else {
      setRightMessages([]);
    }
  }, [yjsDoc]);
  
  // Handle document drop on canvas
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (config.enableDocumentDrop) {
      setIsDropTarget(true);
    }
  }, [config.enableDocumentDrop]);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    
    if (!config.enableDocumentDrop) return;
    
    const files = Array.from(e.dataTransfer.files);
    const supportedFiles = files.filter(f => 
      f.type.includes('json') ||
      f.type.includes('yaml') ||
      f.type.includes('text') ||
      f.type.includes('pdf') ||
      f.name.endsWith('.md')
    );
    
    for (const file of supportedFiles) {
      onDocumentDrop?.(file, { x: e.clientX, y: e.clientY });
    }
  }, [config.enableDocumentDrop, onDocumentDrop]);
  
  return (
    <div ref={workspaceRef} style={styles.workspace}>
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
          onSendMessage={handleSendLeftMessage}
          onClearChat={handleClearLeftChat}
        />
      </div>
      
      {/* Left Resize Handle */}
      <ResizeHandle onResize={handleLeftResize} position="left" />
      
      {/* Center Canvas */}
      <div 
        style={{ ...styles.centerPanel, width: `${panelSizes.centerWidth}%` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Placeholder for AgentCanvas - will integrate with existing component */}
        <div style={styles.emptyCanvas}>
          <div style={styles.emptyCanvasIcon}>🦋</div>
          <div style={styles.emptyCanvasTitle}>Agent Canvas</div>
          <div style={styles.emptyCanvasSubtitle}>
            Drop documents here to teach your agents.
            <br />
            Drag agents from the import menu to add them to the workspace.
          </div>
        </div>
        
        {/* Drop Overlay */}
        {isDropTarget && (
          <div style={styles.dropOverlay}>
            <div style={styles.dropOverlayText}>
              📄 Drop to learn from document
            </div>
          </div>
        )}
      </div>
      
      {/* Right Resize Handle */}
      <ResizeHandle onResize={handleRightResize} position="right" />
      
      {/* Right Chat Pane */}
      {secondaryAgent ? (
        <div style={{ ...styles.rightPanel, width: `${panelSizes.rightWidth}%` }}>
          <ChatPane
            paneId="right"
            agent={secondaryAgent}
            messages={rightMessages}
            participants={participants}
            isAgentTyping={rightTyping}
            showMemoryIndicators={config.showMemoryIndicators}
            maxMessages={config.maxMessagesPerPane}
            onSendMessage={handleSendRightMessage}
            onClearChat={handleClearRightChat}
          />
        </div>
      ) : (
        <div style={{ ...styles.rightPanel, width: `${panelSizes.rightWidth}%`, backgroundColor: '#181825' }}>
          <div style={{ ...styles.emptyCanvas, backgroundColor: '#181825' }}>
            <div style={styles.emptyCanvasIcon}>🤖</div>
            <div style={styles.emptyCanvasTitle}>No Secondary Agent</div>
            <div style={styles.emptyCanvasSubtitle}>
              Add a secondary agent to enable multi-agent conversations.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChrysalisWorkspace;