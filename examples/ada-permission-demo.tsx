/**
 * Ada Permission System Demo
 * 
 * Demonstrates the integration of Ada's action approval system with
 * the inline permission UI in ChrysalisWorkspace.
 * 
 * Run this demo to see:
 * - Ada proposing actions that require approval
 * - Permission cards appearing inline in chat
 * - User approving/denying/explaining permissions
 * - Ada executing approved actions
 * 
 * @module examples/ada-permission-demo
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChrysalisWorkspace } from '../src/components/ChrysalisWorkspace';
import { ThemeProvider } from '../src/components/shared';
import { getAdaService, AdaPermissionBridge } from '../src/components/Ada';
import type { ChatMessage } from '../src/components/ChrysalisWorkspace/types';

// =============================================================================
// Demo Component
// =============================================================================

export const AdaPermissionDemo: React.FC = () => {
  const [adaMessages, setAdaMessages] = useState<ChatMessage[]>([]);
  const bridgeRef = useRef<AdaPermissionBridge | null>(null);
  const adaServiceRef = useRef(getAdaService({
    apiBaseUrl: 'http://localhost:3001/api/system-agents',
    agentId: 'ada',
    enableAutoAssist: true,
  }));

  // Initialize Ada permission bridge
  useEffect(() => {
    const adaService = adaServiceRef.current;

    // Create bridge that converts Ada proposals to permission messages
    bridgeRef.current = new AdaPermissionBridge({
      adaService,
      agentId: 'ada',
      agentName: 'Ada',
      onPermissionMessage: (message) => {
        console.log('[Demo] Permission message received:', message);
        setAdaMessages(prev => [...prev, message]);
      },
    });

    // Activate Ada (now using Ollama with ministral-3:3b)
    adaService.activate();

    // Simulate Ada detecting an error and offering help
    setTimeout(() => {
      adaService.reportError('TypeScript compilation error in ChatPane.tsx');
    }, 2000);

    return () => {
      bridgeRef.current?.dispose();
      adaService.deactivate();
    };
  }, []);

  // Permission callback handlers
  const handlePermissionApprove = async (requestId: string) => {
    console.log('[Demo] User approved permission:', requestId);
    
    // Update message status
    setAdaMessages(prev => prev.map(msg =>
      msg.permissionRequest?.requestId === requestId
        ? {
            ...msg,
            permissionRequest: {
              ...msg.permissionRequest,
              status: 'approved' as const,
            },
          }
        : msg
    ));

    // Execute via Ada bridge
    if (bridgeRef.current) {
      await bridgeRef.current.handleApproval(requestId);
    }
  };

  const handlePermissionDeny = (requestId: string) => {
    console.log('[Demo] User denied permission:', requestId);
    
    // Update message status
    setAdaMessages(prev => prev.map(msg =>
      msg.permissionRequest?.requestId === requestId
        ? {
            ...msg,
            permissionRequest: {
              ...msg.permissionRequest,
              status: 'denied' as const,
            },
          }
        : msg
    ));

    // Notify Ada via bridge
    if (bridgeRef.current) {
      bridgeRef.current.handleDenial(requestId);
    }
  };

  const handlePermissionExplain = (requestId: string) => {
    console.log('[Demo] User requested explanation:', requestId);
    
    if (!bridgeRef.current) return;

    const explanation = bridgeRef.current.generateExplanation(requestId);
    
    // Add explanation as system message
    const explanationMessage: ChatMessage = {
      id: `explain-${Date.now()}`,
      timestamp: Date.now(),
      senderId: 'system',
      senderName: 'System',
      senderType: 'system',
      content: explanation,
    };

    setAdaMessages(prev => [...prev, explanationMessage]);
  };

  return (
    <ThemeProvider defaultMode="dark">
      <div style={{ width: '100vw', height: '100vh' }}>
        <ChrysalisWorkspace
          userId="demo-user"
          userName="Demo User"
          primaryAgent={{
            agentId: 'ada',
            agentName: 'Ada',
            agentType: 'primary',
          }}
          config={{
            showMemoryIndicators: true,
            enableAutoAssist: true,
          }}
          onMessageSent={(message) => {
            console.log('[Demo] Message sent:', message);
          }}
          onAgentResponse={(message) => {
            console.log('[Demo] Agent response:', message);
          }}
        />

        {/* Dev Console Overlay */}
        <div style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 400,
          maxHeight: 300,
          backgroundColor: '#1e1e2e',
          border: '1px solid #2f3b55',
          borderRadius: 8,
          padding: 12,
          fontSize: 12,
          fontFamily: 'monospace',
          color: '#d8e3ff',
          overflowY: 'auto',
          zIndex: 9999,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Ada State Monitor</div>
          <div>State: {adaServiceRef.current.getState()}</div>
          <div>Messages: {adaMessages.length}</div>
          <div>Pending Permissions: {adaMessages.filter(m => m.permissionRequest?.status === 'pending').length}</div>
          
          {/* Test buttons */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => adaServiceRef.current.requestHelp('Help me fix this error')}
              style={{
                padding: '4px 8px',
                background: '#24304a',
                border: '1px solid #2f3b55',
                borderRadius: 4,
                color: '#d8e3ff',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Request Help
            </button>
            <button
              onClick={() => adaServiceRef.current.reportError('Simulated error')}
              style={{
                padding: '4px 8px',
                background: '#24304a',
                border: '1px solid #2f3b55',
                borderRadius: 4,
                color: '#d8e3ff',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Report Error
            </button>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default AdaPermissionDemo;