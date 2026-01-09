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
import { MemUAdapter } from '../../memory/MemUAdapter';
import { AgentChatController, AgentResponse } from '../../agents/AgentChatController';
import { AgentLearningPipeline, DocumentInput, LegendEmbeddingLoader, LegendEmbeddingFile } from '../../learning';

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
  memoryAdapter: externalMemoryAdapter,
  config: configOverrides,
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
  
  // Memory system refs (persisted across renders)
  const memoryAdapterRef = useRef<MemUAdapter | null>(null);
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
  
  // Initialize memory system
  useEffect(() => {
    // Use external adapter or create internal one
    const adapter = externalMemoryAdapter ?? new MemUAdapter(primaryAgent.agentId);
    memoryAdapterRef.current = adapter;
    
    // Create learning pipeline for document processing
    learningPipelineRef.current = new AgentLearningPipeline(adapter, primaryAgent.agentId);
    
    // Create left controller for primary agent
    leftControllerRef.current = new AgentChatController(
      primaryAgent,
      'left',
      adapter,
      userId,
      userName,
      undefined, // No terminal client for now (uses mock responses)
      { showMemoryIndicators: config.showMemoryIndicators }
    );
    
    // Create right controller for secondary agent (if present)
    if (secondaryAgent) {
      // For secondary agent, we could share the same adapter or create separate
      // Sharing allows cross-agent memory recall which is useful
      rightControllerRef.current = new AgentChatController(
        secondaryAgent,
        'right',
        adapter, // Shared memory adapter
        userId,
        userName,
        undefined,
        { showMemoryIndicators: config.showMemoryIndicators }
      );
    }
    
    // Subscribe to memory events for UI feedback
    const unsubscribe = adapter.on('memory:added', (event) => {
      onMemoryEvent?.({
        type: 'added',
        tier: event.memory.tier,
        memoryId: event.memory.memoryId,
        content: event.memory.content.slice(0, 100),
      });
    });
    
    return () => {
      unsubscribe();
    };
  }, [primaryAgent.agentId, secondaryAgent?.agentId, userId, userName, externalMemoryAdapter, config.showMemoryIndicators]);
  
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
          if (leftControllerRef.current) {
            await leftControllerRef.current.endConversation();
          }
          if (rightControllerRef.current) {
            await rightControllerRef.current.endConversation();
          }
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
  
  // Handle sending messages - Left pane (Primary Agent with MemU)
  const handleSendLeftMessage = useCallback(async (content: string) => {
    const message = createMessage(content, userId, userName, 'user');
    
    // Add user message to local state or YJS
    if (yjsDoc) {
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
        const response: AgentResponse = await controller.processUserMessage({ content });
        
        // Add agent response with memory indicators
        if (yjsDoc) {
          const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
          leftChatArray.push([response.message]);
        } else {
          setLeftMessages(prev => [...prev, response.message]);
        }
        
        onAgentResponse?.(response.message, 'left');
        
        // Emit memory event if memories were recalled
        if (response.recalledMemories.length > 0) {
          onMemoryEvent?.({
            type: 'recalled',
            tier: 'episodic',
            count: response.recalledMemories.length,
            memoryIds: response.recalledMemories.map(m => m.memoryId),
          });
        }
      } catch (error) {
        console.error('[ChrysalisWorkspace] Error processing message:', error);
        
        // Fallback error message
        const errorMessage = createMessage(
          'I encountered an issue processing your message. Please try again.',
          primaryAgent.agentId,
          primaryAgent.agentName,
          'agent'
        );
        
        if (yjsDoc) {
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
        
        if (yjsDoc) {
          const leftChatArray = yjsDoc.getArray<ChatMessage>('leftChat');
          leftChatArray.push([agentResponse]);
        } else {
          setLeftMessages(prev => [...prev, agentResponse]);
        }
        
        onAgentResponse?.(agentResponse, 'left');
      }, 500);
    }
  }, [userId, userName, primaryAgent, yjsDoc, onMessageSent, onAgentResponse, onMemoryEvent]);
  
  // Handle sending messages - Right pane (Secondary Agent with MemU)
  const handleSendRightMessage = useCallback(async (content: string) => {
    if (!secondaryAgent) return;
    
    const message = createMessage(content, userId, userName, 'user');
    
    if (yjsDoc) {
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
        const response: AgentResponse = await controller.processUserMessage({ content });
        
        if (yjsDoc) {
          const rightChatArray = yjsDoc.getArray<ChatMessage>('rightChat');
          rightChatArray.push([response.message]);
        } else {
          setRightMessages(prev => [...prev, response.message]);
        }
        
        onAgentResponse?.(response.message, 'right');
        
        // Emit memory event if memories were recalled
        if (response.recalledMemories.length > 0) {
          onMemoryEvent?.({
            type: 'recalled',
            tier: 'episodic',
            count: response.recalledMemories.length,
            memoryIds: response.recalledMemories.map(m => m.memoryId),
          });
        }
      } catch (error) {
        console.error('[ChrysalisWorkspace] Error processing message:', error);
        
        const errorMessage = createMessage(
          'I encountered an issue processing your message. Please try again.',
          secondaryAgent.agentId,
          secondaryAgent.agentName,
          'agent'
        );
        
        if (yjsDoc) {
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
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
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
    
    // Check for embedding files (from builder pipeline)
    const embeddingFiles = files.filter(f =>
      f.name.endsWith('_embeddings.json') ||
      f.name.endsWith('_embeddings_full.json')
    );
    
    // Load embedding files into agent memory
    const leftController = leftControllerRef.current;
    if (leftController && embeddingFiles.length > 0) {
      for (const file of embeddingFiles) {
        try {
          const content = await readFileContent(file);
          const embeddingData: LegendEmbeddingFile = JSON.parse(content);
          await leftController.loadSingleLegend(embeddingData);
          
          // Emit learning event
          onMemoryEvent?.({
            type: 'learned',
            tier: 'semantic',
            source: file.name,
            factsExtracted: embeddingData.knowledge_builder?.embeddings.length || 0,
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
            fileName: file.name,
            content,
            mimeType: file.type,
          };
          
          const extractedFacts = await pipeline.learnFromDocument(documentInput);
          
          // Emit learning event
          onMemoryEvent?.({
            type: 'learned',
            tier: 'semantic',
            source: file.name,
            factsExtracted: extractedFacts.length,
          });
          
          console.log(`[ChrysalisWorkspace] Learned ${extractedFacts.length} facts from ${file.name}`);
        } catch (error) {
          console.error(`[ChrysalisWorkspace] Error learning from ${file.name}:`, error);
        }
      }
    }
  }, [config.enableDocumentDrop, onDocumentDrop, onMemoryEvent]);
  
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
        {/* AgentCanvas Component */}
        <AgentCanvas
          showToolbar={true}
          showMinimap={false}
          onAgentSelect={(agentId) => {
            console.log('[ChrysalisWorkspace] Agent selected:', agentId);
          }}
          onChatRequest={(agentId) => {
            console.log('[ChrysalisWorkspace] Chat requested with:', agentId);
          }}
          onImportComplete={(result) => {
            console.log('[ChrysalisWorkspace] Import complete:', result);
          }}
        />
        
        {/* Drop Overlay for Embedding Files */}
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