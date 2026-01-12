/**
 * SerenaBridge - Agent bridge for Serena (oraios/serena)
 * 
 * Connects Serena code agent to ChrysalisTerminal via MCP protocol.
 * 
 * Serena capabilities:
 * - Language server integration (Python, TypeScript, etc.)
 * - Code navigation (find_symbol, find_referencing_symbols)
 * - Code editing (create_text_file, replace_lines, insert_at_line)
 * - Shell command execution
 * - Project-specific memory
 * - Onboarding and context management
 * 
 * @module agents/bridges/SerenaBridge
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BaseBridge } from './BaseBridge';
import {
  BridgeConfig,
  AgentInfo,
  AgentMessage,
  AgentResponse,
  AgentContext,
  AgentCapability,
  AgentType,
  AgentTool
} from './types';

/**
 * Serena-specific configuration
 */
export interface SerenaConfig extends BridgeConfig {
  type: 'serena';
  projectPath: string;
  languages?: string[];
  encoding?: string;
  readOnly?: boolean;
  excludedTools?: string[];
  initialPrompt?: string;
  pythonPath?: string;
  serverPath?: string;
}

/**
 * Default Serena configuration
 */
const DEFAULT_SERENA_CONFIG: Partial<SerenaConfig> = {
  languages: ['python', 'typescript'],
  encoding: 'utf-8',
  readOnly: false,
  excludedTools: [],
  timeout: 60000 // Serena operations can be slow
};

/**
 * Serena tool names from the project config
 */
const SERENA_TOOLS = [
  'activate_project',
  'check_onboarding_performed',
  'create_text_file',
  'delete_lines',
  'delete_memory',
  'execute_shell_command',
  'find_referencing_code_snippets',
  'find_referencing_symbols',
  'find_symbol',
  'get_current_config',
  'get_symbols_overview',
  'initial_instructions',
  'insert_after_symbol',
  'insert_at_line',
  'insert_before_symbol',
  'list_dir',
  'list_memories',
  'onboarding',
  'prepare_for_new_conversation',
  'read_file',
  'read_memory',
  'remove_project',
  'replace_lines',
  'replace_symbol_body',
  'restart_language_server',
  'search_for_pattern',
  'summarize_changes',
  'switch_modes',
  'think_about_collected_information',
  'think_about_task_adherence',
  'think_about_whether_you_are_done',
  'write_memory'
] as const;

type SerenaToolName = typeof SERENA_TOOLS[number];

/**
 * SerenaBridge - Connects to Serena MCP server
 */
export class SerenaBridge extends BaseBridge {
  private client?: Client;
  private transport?: StdioClientTransport;
  private serenaConfig: SerenaConfig;
  private projectActivated: boolean = false;
  private onboardingComplete: boolean = false;
  
  constructor(config: SerenaConfig) {
    super({
      ...DEFAULT_SERENA_CONFIG,
      ...config
    });
    this.serenaConfig = {
      ...DEFAULT_SERENA_CONFIG,
      ...config
    } as SerenaConfig;
    
    // Register Serena tools
    this.registerSerenaTools();
  }
  
  // ============================================================================
  // Identity
  // ============================================================================
  
  get agentType(): AgentType {
    return 'serena';
  }
  
  get capabilities(): AgentCapability[] {
    const caps: AgentCapability[] = ['chat', 'code', 'file_operations', 'shell', 'memory', 'tools', 'multi_turn'];
    if (!this.serenaConfig.readOnly) {
      caps.push('file_operations');
    }
    return caps;
  }
  
  get info(): AgentInfo {
    return {
      id: this.id,
      name: this.config.name,
      type: 'serena',
      description: `Serena code agent for project: ${this.serenaConfig.projectPath}`,
      capabilities: this.capabilities,
      status: this.status,
      version: '1.0.0',
      metadata: {
        projectPath: this.serenaConfig.projectPath,
        languages: this.serenaConfig.languages,
        readOnly: this.serenaConfig.readOnly,
        onboardingComplete: this.onboardingComplete
      }
    };
  }
  
  // ============================================================================
  // Connection
  // ============================================================================
  
  /**
   * Connect to Serena MCP server
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }
    
    this.setStatus('connecting');
    
    try {
      await this.withRetry(async () => {
        // Create MCP client
        this.client = new Client({
          name: 'chrysalis-terminal',
          version: '1.0.0'
        }, {
          capabilities: {
            sampling: {
              tools: {}
            }
          }
        });
        
        // Set up stdio transport to Serena server
        const serverPath = this.serenaConfig.serverPath ?? 'serena';
        const pythonPath = this.serenaConfig.pythonPath ?? 'python';
        
        this.transport = new StdioClientTransport({
          command: pythonPath,
          args: ['-m', 'serena'],
          env: {
            ...process.env,
            SERENA_PROJECT_PATH: this.serenaConfig.projectPath
          }
        });
        
        // Connect
        await this.client.connect(this.transport);
        
        // Activate project
        await this.activateProject();
        
        // Check if onboarding is needed
        await this.checkOnboarding();
      }, 'connect');
      
      this.setStatus('connected');
      this.emit({
        type: 'connected',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { projectPath: this.serenaConfig.projectPath }
      });
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }
  
  /**
   * Disconnect from Serena
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }
    
    try {
      if (this.client) {
        await this.client.close();
        this.client = undefined;
      }
      
      this.transport = undefined;
      this.projectActivated = false;
    } finally {
      this.setStatus('disconnected');
      this.emit({
        type: 'disconnected',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {}
      });
    }
  }
  
  // ============================================================================
  // Messaging
  // ============================================================================
  
  /**
   * Send a message to Serena
   */
  async send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse> {
    if (!this.client || this.status !== 'connected') {
      return this.createErrorResponse('Not connected to Serena');
    }
    
    this.emit({
      type: 'message',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { message }
    });
    
    try {
      // Parse the message for tool commands
      const toolCommand = this.parseToolCommand(message.content);
      
      if (toolCommand) {
        // Execute the requested tool
        const result = await this.executeSerenaTool(
          toolCommand.tool,
          toolCommand.args
        );
        
        const response = this.createResponse(
          JSON.stringify(result, null, 2),
          'success',
          { tool: toolCommand.tool }
        );
        
        this.emit({
          type: 'response',
          bridgeId: this.id,
          timestamp: Date.now(),
          payload: { response }
        });
        
        return response;
      }
      
      // For natural language requests, we need to interpret and execute
      const response = await this.handleNaturalLanguageRequest(message, context);
      
      this.emit({
        type: 'response',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { response }
      });
      
      return response;
    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
      
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { error }
      });
      
      return errorResponse;
    }
  }
  
  /**
   * Stream responses (Serena doesn't natively support streaming)
   */
  async *stream(
    message: AgentMessage,
    context?: AgentContext
  ): AsyncIterable<AgentResponse> {
    // Serena doesn't stream, so we yield the full response
    const response = await this.send(message, context);
    yield response;
  }
  
  // ============================================================================
  // Serena Tools
  // ============================================================================
  
  /**
   * Register Serena tools
   */
  private registerSerenaTools(): void {
    const serenaCoreTools: AgentTool[] = [
      {
        name: 'read_file',
        description: 'Read a file from the project',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to project root' },
            start_line: { type: 'number', description: 'Start line (optional)' },
            end_line: { type: 'number', description: 'End line (optional)' }
          },
          required: ['path']
        }
      },
      {
        name: 'find_symbol',
        description: 'Find symbols in the project',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Symbol name or substring' },
            type: { type: 'string', description: 'Symbol type filter', enum: ['class', 'function', 'variable', 'interface'] }
          },
          required: ['query']
        }
      },
      {
        name: 'execute_shell_command',
        description: 'Execute a shell command',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            timeout: { type: 'number', description: 'Timeout in seconds', default: 30 }
          },
          required: ['command']
        }
      },
      {
        name: 'search_for_pattern',
        description: 'Search for a regex pattern in the project',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex pattern' },
            path: { type: 'string', description: 'Optional path to limit search' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'list_dir',
        description: 'List directory contents',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path' },
            recursive: { type: 'boolean', description: 'Recurse into subdirectories', default: false }
          },
          required: ['path']
        }
      },
      {
        name: 'get_symbols_overview',
        description: 'Get an overview of symbols in a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_memory',
        description: 'Write to Serena project memory',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Memory name' },
            content: { type: 'string', description: 'Memory content' }
          },
          required: ['name', 'content']
        }
      },
      {
        name: 'read_memory',
        description: 'Read from Serena project memory',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Memory name' }
          },
          required: ['name']
        }
      },
      {
        name: 'list_memories',
        description: 'List all memories in the project',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];
    
    // Add editing tools if not read-only
    if (!this.serenaConfig.readOnly) {
      serenaCoreTools.push(
        {
          name: 'create_text_file',
          description: 'Create or overwrite a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'replace_lines',
          description: 'Replace lines in a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              start_line: { type: 'number', description: 'Start line' },
              end_line: { type: 'number', description: 'End line' },
              content: { type: 'string', description: 'New content' }
            },
            required: ['path', 'start_line', 'end_line', 'content']
          }
        },
        {
          name: 'insert_at_line',
          description: 'Insert content at a line',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              line: { type: 'number', description: 'Line number' },
              content: { type: 'string', description: 'Content to insert' }
            },
            required: ['path', 'line', 'content']
          }
        },
        {
          name: 'delete_lines',
          description: 'Delete lines from a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              start_line: { type: 'number', description: 'Start line' },
              end_line: { type: 'number', description: 'End line' }
            },
            required: ['path', 'start_line', 'end_line']
          }
        }
      );
    }
    
    // Filter excluded tools
    const excluded = new Set(this.serenaConfig.excludedTools ?? []);
    for (const tool of serenaCoreTools) {
      if (!excluded.has(tool.name)) {
        this.registerTool(tool);
      }
    }
  }
  
  /**
   * Execute a Serena tool via MCP
   */
  async executeSerenaTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected to Serena');
    }
    
    this.emit({
      type: 'tool_call',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { tool: toolName, args }
    });
    
    try {
      const result = await this.withTimeout(
        this.client.callTool({
          name: toolName,
          arguments: args
        }),
        this.config.timeout
      );
      
      this.emit({
        type: 'tool_result',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { tool: toolName, result, status: 'success' }
      });
      
      return result;
    } catch (error) {
      this.emit({
        type: 'tool_result',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { tool: toolName, error, status: 'error' }
      });
      throw error;
    }
  }
  
  // ============================================================================
  // Project Management
  // ============================================================================
  
  /**
   * Activate the project in Serena
   */
  private async activateProject(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    await this.executeSerenaTool('activate_project', {
      project_path: this.serenaConfig.projectPath
    });
    
    this.projectActivated = true;
  }
  
  /**
   * Check if onboarding is needed
   */
  private async checkOnboarding(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    
    const result = await this.executeSerenaTool('check_onboarding_performed', {}) as {
      onboarding_performed: boolean;
    };
    
    this.onboardingComplete = result.onboarding_performed;
    
    if (!this.onboardingComplete) {
      console.log('Serena onboarding not complete. Run onboarding for better results.');
    }
  }
  
  /**
   * Run onboarding for the project
   */
  async runOnboarding(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Serena');
    }
    
    await this.executeSerenaTool('onboarding', {});
    this.onboardingComplete = true;
  }
  
  // ============================================================================
  // Natural Language Processing
  // ============================================================================
  
  /**
   * Parse a message for tool commands
   * Commands format: /tool_name {json_args}
   */
  private parseToolCommand(content: string): {
    tool: string;
    args: Record<string, unknown>;
  } | null {
    const match = content.match(/^\/(\w+)\s*(\{[\s\S]*\})?$/);
    if (!match) {
      return null;
    }
    
    const tool = match[1];
    const argsStr = match[2];
    
    let args: Record<string, unknown> = {};
    if (argsStr) {
      try {
        args = JSON.parse(argsStr);
      } catch {
        // If JSON parsing fails, treat the rest as a simple string arg
        args = { input: argsStr };
      }
    }
    
    return { tool, args };
  }
  
  /**
   * Handle natural language requests
   * This interprets user intent and executes appropriate Serena tools
   */
  private async handleNaturalLanguageRequest(
    message: AgentMessage,
    context?: AgentContext
  ): Promise<AgentResponse> {
    const content = message.content.toLowerCase();
    const results: unknown[] = [];
    
    // Pattern matching for common requests
    // These could be enhanced with an LLM for better interpretation
    
    // File reading
    const readMatch = content.match(/read\s+(?:file\s+)?([^\s]+)/);
    if (readMatch) {
      const result = await this.executeSerenaTool('read_file', {
        path: readMatch[1]
      });
      results.push({ type: 'read_file', result });
    }
    
    // Symbol search
    const symbolMatch = content.match(/find\s+(?:symbol\s+)?([^\s]+)/);
    if (symbolMatch) {
      const result = await this.executeSerenaTool('find_symbol', {
        query: symbolMatch[1]
      });
      results.push({ type: 'find_symbol', result });
    }
    
    // Pattern search
    const searchMatch = content.match(/search\s+(?:for\s+)?["']([^"']+)["']/);
    if (searchMatch) {
      const result = await this.executeSerenaTool('search_for_pattern', {
        pattern: searchMatch[1]
      });
      results.push({ type: 'search', result });
    }
    
    // Directory listing
    const listMatch = content.match(/list\s+(?:dir(?:ectory)?\s+)?([^\s]+)/);
    if (listMatch) {
      const result = await this.executeSerenaTool('list_dir', {
        path: listMatch[1],
        recursive: content.includes('recursive')
      });
      results.push({ type: 'list_dir', result });
    }
    
    // Shell command
    const shellMatch = content.match(/(?:run|exec(?:ute)?)\s+["']([^"']+)["']/);
    if (shellMatch) {
      const result = await this.executeSerenaTool('execute_shell_command', {
        command: shellMatch[1]
      });
      results.push({ type: 'shell', result });
    }
    
    // If we executed tools, return their results
    if (results.length > 0) {
      return this.createResponse(
        JSON.stringify(results, null, 2),
        'success',
        { toolsExecuted: results.length }
      );
    }
    
    // If no tools matched, acknowledge the message
    // In a full implementation, this would be sent to an LLM for interpretation
    return this.createResponse(
      `I received your message: "${message.content}"\n\n` +
      `Available commands:\n` +
      `- /read_file {"path": "..."}\n` +
      `- /find_symbol {"query": "..."}\n` +
      `- /search_for_pattern {"pattern": "..."}\n` +
      `- /list_dir {"path": "...", "recursive": true}\n` +
      `- /execute_shell_command {"command": "..."}\n` +
      `- /write_memory {"name": "...", "content": "..."}\n` +
      `- /read_memory {"name": "..."}\n` +
      `\nOr describe what you'd like to do in natural language.`,
      'success'
    );
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  async destroy(): Promise<void> {
    await super.destroy();
    this.projectActivated = false;
    this.onboardingComplete = false;
  }
}

/**
 * Create a Serena bridge instance
 */
export function createSerenaBridge(config: SerenaConfig): SerenaBridge {
  return new SerenaBridge(config);
}