/**
 * InMemoryAgent - Simple agent that works without external services
 * 
 * Provides intelligent responses using pattern matching and context
 * without requiring the Rust system agents backend.
 */

import type { AgentResponse, ChatMessage } from './AgentChatController';
import type { MemoryEntry } from '../memory/AgentMemoryAdapter';

/**
 * Simple agent brain that generates contextual responses
 */
export class InMemoryAgent {
  private agentName: string;
  private agentType: string;

  constructor(agentName: string, agentType: string) {
    this.agentName = agentName;
    this.agentType = agentType;
  }

  /**
   * Generate a response based on message and context
   */
  async generateResponse(
    message: string,
    history: ChatMessage[],
    memoryContext: MemoryEntry[]
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    // Analyze the message
    const lowerMessage = message.toLowerCase();
    let response = '';

    // Contextual responses based on keywords
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      response = `Hello! I'm ${this.agentName}, your ${this.agentType} agent. How can I help you today?`;
    } else if (lowerMessage.includes('help')) {
      response = `I can help you with various tasks:\n- Answer questions about the Chrysalis system\n- Manage canvas workspaces\n- Store and retrieve information\n- Collaborate with other agents\n\nWhat would you like to do?`;
    } else if (lowerMessage.includes('canvas') || lowerMessage.includes('workspace')) {
      response = `The canvas system allows you to create and organize information visually. You can:\n- Switch between Settings, Scrapbook, and Research canvases\n- Add notes, links, and artifacts\n- Drag and drop to organize\n- Pan and zoom to navigate\n\nTry clicking on the canvas tabs above!`;
    } else if (lowerMessage.includes('memory') || lowerMessage.includes('remember')) {
      if (memoryContext.length > 0) {
        response = `I found ${memoryContext.length} related memories:\n\n` +
          memoryContext.slice(0, 2).map(m => `• ${m.content.slice(0, 80)}...`).join('\n') +
          `\n\nI'm using these to provide better context for my response.`;
      } else {
        response = `I'm storing our conversation in memory so I can provide better assistance. Everything we discuss is saved for future reference.`;
      }
    } else if (lowerMessage.includes('settings') || lowerMessage.includes('config')) {
      response = `The Settings canvas lets you configure connections and API keys. Click on the "Settings" tab in the canvas area to access configuration options.`;
    } else if (lowerMessage.includes('chat') || lowerMessage.includes('talk') || lowerMessage.includes('conversation')) {
      response = `We're currently having a conversation across ${history.length} messages. I maintain context from our discussion and can recall previous points. The memory system helps me provide more relevant responses over time.`;
    } else if (lowerMessage.includes('agent') || lowerMessage.includes('ada') || lowerMessage.includes('specialist')) {
      response = `I'm ${this.agentName}, a ${this.agentType} agent. I work alongside other agents in the Chrysalis workspace. Each agent can have specialized knowledge and capabilities. You can chat with multiple agents simultaneously using the left and right panes.`;
    } else if (lowerMessage.includes('feature') || lowerMessage.includes('can you') || lowerMessage.includes('what')) {
      response = `As ${this.agentName}, I can:\n- Engage in contextual conversations\n- Remember our discussion history\n- Search through past conversations\n- Help you organize information on the canvas\n- Collaborate with other agents\n- Learn from documents you share\n\nWhat specific task can I help you with?`;
    } else if (lowerMessage.includes('how') || lowerMessage.includes('tutorial')) {
      response = `Here's how to use the Chrysalis workspace:\n\n1. **Chat**: Type messages in the input box (like you're doing now!)\n2. **Canvas**: Switch tabs and drag widgets to organize information\n3. **Resize**: Drag the panel dividers to adjust sizes\n4. **Multi-agent**: Use both left and right panes for parallel conversations\n5. **Memory**: Everything is automatically saved for context\n\nTry exploring the interface!`;
    } else {
      // Contextual response with memory integration
      const contextPhrase = memoryContext.length > 0
        ? ` I've reviewed ${memoryContext.length} related memories from our conversations.`
        : '';
      
      response = `I understand you're asking about "${message.slice(0, 50)}...". ${contextPhrase}\n\nAs your ${this.agentType} agent, I'm here to help with your tasks in the Chrysalis workspace. Could you provide more details about what you'd like me to do?\n\nTip: Try asking about the canvas system, memory features, or how to use specific tools!`;
    }

    const latencyMs = Date.now() - startTime;

    return {
      agentId: this.agentName.toLowerCase(),
      content: response,
      confidence: 0.85,
      memoryUsed: memoryContext,
      latencyMs,
      metadata: {
        agentName: this.agentName,
        agentType: this.agentType,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export default InMemoryAgent;
