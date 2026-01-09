/**
 * Widget Registry and Built-in Widget Definitions
 * 
 * Defines the protocol for widgets that agents can build to.
 * Each widget has a schema that defines its props, state, events, and actions.
 * 
 * @module terminal/protocols/widgets
 */

import {
  WidgetDefinition,
  WidgetCategory,
  WidgetCapability,
  JSONSchema
} from './types';

import {
  AgentState,
  AgentSourceFormat,
  AgentConnectionStatus,
  AGENT_STATE_COLORS,
  DEFAULT_AGENT_NODE_SIZE
} from './agent-canvas';

// ============================================================================
// Built-in Widget Definitions
// ============================================================================

/**
 * Markdown Widget - Renders markdown content
 */
export const MarkdownWidget: WidgetDefinition = {
  type: 'markdown',
  version: '1.0.0',
  name: 'Markdown',
  description: 'Renders markdown content with syntax highlighting',
  icon: '📝',
  category: 'output',
  
  propsSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Markdown content to render' },
      theme: { type: 'string', enum: ['light', 'dark'], default: 'light' }
    },
    required: ['content']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      scrollPosition: { type: 'number', default: 0 }
    }
  },
  
  defaultWidth: 400,
  defaultHeight: 300,
  minWidth: 200,
  minHeight: 100,
  
  capabilities: ['resizable'],
  events: [],
  actions: [
    {
      name: 'setContent',
      description: 'Update the markdown content',
      paramsSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' }
        },
        required: ['content']
      }
    }
  ]
};

/**
 * Code Widget - Displays code with syntax highlighting
 */
export const CodeWidget: WidgetDefinition = {
  type: 'code',
  version: '1.0.0',
  name: 'Code',
  description: 'Displays code with syntax highlighting and optional editing',
  icon: '💻',
  category: 'output',
  
  propsSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code content' },
      language: { type: 'string', description: 'Programming language' },
      filename: { type: 'string', description: 'Optional filename' },
      showLineNumbers: { type: 'boolean', default: true },
      editable: { type: 'boolean', default: false }
    },
    required: ['code', 'language']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      currentCode: { type: 'string' },
      cursorPosition: { type: 'object' }
    }
  },
  
  defaultWidth: 500,
  defaultHeight: 400,
  minWidth: 300,
  minHeight: 150,
  
  capabilities: ['resizable', 'interactive', 'exportable'],
  events: [
    {
      name: 'codeChanged',
      description: 'Emitted when code is edited',
      payloadSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'setCode',
      description: 'Update the code content',
      paramsSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' }
        },
        required: ['code']
      }
    }
  ]
};

/**
 * Chart Widget - Displays data visualizations
 */
export const ChartWidget: WidgetDefinition = {
  type: 'chart',
  version: '1.0.0',
  name: 'Chart',
  description: 'Displays data as line, bar, pie, or scatter charts',
  icon: '📊',
  category: 'visualization',
  
  propsSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['line', 'bar', 'pie', 'scatter'] },
      data: {
        type: 'object',
        properties: {
          labels: { type: 'array', items: { type: 'string' } },
          datasets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                data: { type: 'array', items: { type: 'number' } },
                color: { type: 'string' }
              }
            }
          }
        }
      },
      options: { type: 'object' }
    },
    required: ['type', 'data']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      hoveredPoint: { type: 'object' },
      selectedPoints: { type: 'array' }
    }
  },
  
  defaultWidth: 500,
  defaultHeight: 350,
  minWidth: 300,
  minHeight: 200,
  
  capabilities: ['resizable', 'interactive', 'exportable'],
  events: [
    {
      name: 'pointClicked',
      description: 'Emitted when a data point is clicked',
      payloadSchema: {
        type: 'object',
        properties: {
          datasetIndex: { type: 'number' },
          index: { type: 'number' },
          value: { type: 'number' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'updateData',
      description: 'Update chart data',
      paramsSchema: {
        type: 'object',
        properties: {
          data: { type: 'object' }
        },
        required: ['data']
      }
    }
  ]
};

/**
 * Table Widget - Displays tabular data
 */
export const TableWidget: WidgetDefinition = {
  type: 'table',
  version: '1.0.0',
  name: 'Table',
  description: 'Displays data in a sortable, filterable table',
  icon: '📋',
  category: 'data',
  
  propsSchema: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            type: { type: 'string' },
            sortable: { type: 'boolean' }
          }
        }
      },
      data: { type: 'array', items: { type: 'object' } },
      sortBy: { type: 'string' },
      sortDirection: { type: 'string', enum: ['asc', 'desc'] }
    },
    required: ['columns', 'data']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      selectedRows: { type: 'array', items: { type: 'number' } },
      filter: { type: 'string' },
      page: { type: 'number' },
      pageSize: { type: 'number' }
    }
  },
  
  defaultWidth: 600,
  defaultHeight: 400,
  minWidth: 400,
  minHeight: 200,
  
  capabilities: ['resizable', 'interactive', 'exportable'],
  events: [
    {
      name: 'rowClicked',
      description: 'Emitted when a row is clicked',
      payloadSchema: {
        type: 'object',
        properties: {
          rowIndex: { type: 'number' },
          rowData: { type: 'object' }
        }
      }
    },
    {
      name: 'sortChanged',
      description: 'Emitted when sort changes',
      payloadSchema: {
        type: 'object',
        properties: {
          column: { type: 'string' },
          direction: { type: 'string' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'setData',
      description: 'Update table data',
      paramsSchema: {
        type: 'object',
        properties: {
          data: { type: 'array' }
        },
        required: ['data']
      }
    },
    {
      name: 'exportCSV',
      description: 'Export data as CSV',
      paramsSchema: { type: 'object' },
      returnsSchema: { type: 'string' }
    }
  ]
};

/**
 * Image Widget - Displays images
 */
export const ImageWidget: WidgetDefinition = {
  type: 'image',
  version: '1.0.0',
  name: 'Image',
  description: 'Displays an image with optional zoom',
  icon: '🖼️',
  category: 'output',
  
  propsSchema: {
    type: 'object',
    properties: {
      src: { type: 'string', description: 'Image URL or base64' },
      alt: { type: 'string', description: 'Alt text' },
      fit: { type: 'string', enum: ['contain', 'cover', 'fill'] }
    },
    required: ['src']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      zoom: { type: 'number', default: 1 },
      panX: { type: 'number', default: 0 },
      panY: { type: 'number', default: 0 }
    }
  },
  
  defaultWidth: 400,
  defaultHeight: 300,
  minWidth: 100,
  minHeight: 100,
  
  capabilities: ['resizable', 'interactive'],
  events: [
    {
      name: 'clicked',
      description: 'Emitted when image is clicked',
      payloadSchema: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'setSource',
      description: 'Change image source',
      paramsSchema: {
        type: 'object',
        properties: {
          src: { type: 'string' }
        },
        required: ['src']
      }
    }
  ]
};

/**
 * Button Widget - Interactive button
 */
export const ButtonWidget: WidgetDefinition = {
  type: 'button',
  version: '1.0.0',
  name: 'Button',
  description: 'Interactive button that triggers actions',
  icon: '🔘',
  category: 'control',
  
  propsSchema: {
    type: 'object',
    properties: {
      label: { type: 'string' },
      action: { type: 'string', description: 'Action identifier to trigger' },
      variant: { type: 'string', enum: ['primary', 'secondary', 'danger'] },
      disabled: { type: 'boolean' }
    },
    required: ['label', 'action']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      loading: { type: 'boolean', default: false }
    }
  },
  
  defaultWidth: 120,
  defaultHeight: 40,
  minWidth: 80,
  minHeight: 32,
  maxHeight: 60,
  
  capabilities: ['interactive'],
  events: [
    {
      name: 'clicked',
      description: 'Emitted when button is clicked',
      payloadSchema: {
        type: 'object',
        properties: {
          action: { type: 'string' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'setLoading',
      description: 'Set loading state',
      paramsSchema: {
        type: 'object',
        properties: {
          loading: { type: 'boolean' }
        },
        required: ['loading']
      }
    }
  ]
};

/**
 * Input Widget - Form input
 */
export const InputWidget: WidgetDefinition = {
  type: 'input',
  version: '1.0.0',
  name: 'Input',
  description: 'Form input for collecting data',
  icon: '📝',
  category: 'input',
  
  propsSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['text', 'number', 'textarea', 'select', 'checkbox'] },
      label: { type: 'string' },
      placeholder: { type: 'string' },
      value: { type: 'string' },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' }
          }
        }
      }
    },
    required: ['type', 'label']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      value: { type: 'string' },
      error: { type: 'string' },
      touched: { type: 'boolean' }
    }
  },
  
  defaultWidth: 250,
  defaultHeight: 60,
  minWidth: 150,
  minHeight: 40,
  
  capabilities: ['interactive'],
  events: [
    {
      name: 'valueChanged',
      description: 'Emitted when value changes',
      payloadSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      }
    },
    {
      name: 'submitted',
      description: 'Emitted when enter is pressed',
      payloadSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'setValue',
      description: 'Set input value',
      paramsSchema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        },
        required: ['value']
      }
    },
    {
      name: 'clear',
      description: 'Clear input',
      paramsSchema: { type: 'object' }
    }
  ]
};

/**
 * Memory Viewer Widget - Shows agent memory
 */
export const MemoryViewerWidget: WidgetDefinition = {
  type: 'memory-viewer',
  version: '1.0.0',
  name: 'Memory Viewer',
  description: 'Displays agent memory across tiers',
  icon: '🧠',
  category: 'data',
  
  propsSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      memoryTier: { type: 'string', enum: ['working', 'episodic', 'semantic', 'procedural', 'all'] },
      limit: { type: 'number', default: 10 },
      searchQuery: { type: 'string' }
    },
    required: ['agentId']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      memories: { type: 'array' },
      loading: { type: 'boolean' },
      selectedMemory: { type: 'string' }
    }
  },
  
  defaultWidth: 500,
  defaultHeight: 400,
  minWidth: 350,
  minHeight: 250,
  
  capabilities: ['interactive', 'memory-aware', 'realtime'],
  events: [
    {
      name: 'memorySelected',
      description: 'Emitted when a memory is selected',
      payloadSchema: {
        type: 'object',
        properties: {
          memoryId: { type: 'string' },
          memory: { type: 'object' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'refresh',
      description: 'Refresh memories from agent',
      paramsSchema: { type: 'object' }
    },
    {
      name: 'search',
      description: 'Search memories',
      paramsSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    }
  ]
};

/**
 * Skill Executor Widget - Execute agent skills
 */
export const SkillExecutorWidget: WidgetDefinition = {
  type: 'skill-executor',
  version: '1.0.0',
  name: 'Skill Executor',
  description: 'Execute and monitor agent skills/procedures',
  icon: '⚡',
  category: 'control',
  
  propsSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      skillName: { type: 'string' },
      parameters: { type: 'object' },
      autoExecute: { type: 'boolean', default: false }
    },
    required: ['agentId', 'skillName']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['idle', 'running', 'success', 'error'] },
      result: { type: 'string' },
      error: { type: 'string' },
      executionTime: { type: 'number' }
    }
  },
  
  defaultWidth: 400,
  defaultHeight: 300,
  minWidth: 300,
  minHeight: 200,
  
  capabilities: ['interactive', 'memory-aware', 'llm-powered'],
  events: [
    {
      name: 'executionStarted',
      description: 'Emitted when execution starts',
      payloadSchema: { type: 'object' }
    },
    {
      name: 'executionCompleted',
      description: 'Emitted when execution completes',
      payloadSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
          success: { type: 'boolean' },
          executionTime: { type: 'number' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'execute',
      description: 'Execute the skill',
      paramsSchema: {
        type: 'object',
        properties: {
          parameters: { type: 'object' }
        }
      },
      returnsSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
          success: { type: 'boolean' }
        }
      }
    },
    {
      name: 'cancel',
      description: 'Cancel execution',
      paramsSchema: { type: 'object' }
    }
  ]
};

/**
 * Conversation Widget - Embedded chat
 */
export const ConversationWidget: WidgetDefinition = {
  type: 'conversation',
  version: '1.0.0',
  name: 'Conversation',
  description: 'Embedded mini-chat for focused discussions',
  icon: '💬',
  category: 'communication',
  
  propsSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      participants: { type: 'array', items: { type: 'string' } },
      maxMessages: { type: 'number', default: 50 }
    },
    required: ['title']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      messages: { type: 'array' },
      inputValue: { type: 'string' }
    }
  },
  
  defaultWidth: 350,
  defaultHeight: 450,
  minWidth: 280,
  minHeight: 300,
  
  capabilities: ['interactive', 'realtime', 'persistent'],
  events: [
    {
      name: 'messageSent',
      description: 'Emitted when a message is sent',
      payloadSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          senderId: { type: 'string' }
        }
      }
    }
  ],
  actions: [
    {
      name: 'sendMessage',
      description: 'Send a message',
      paramsSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          senderId: { type: 'string' }
        },
        required: ['content', 'senderId']
      }
    },
    {
      name: 'clearMessages',
      description: 'Clear all messages',
      paramsSchema: { type: 'object' }
    }
  ]
};

/**
 * Agent Node Widget - Visual representation of a Chrysalis Agent on canvas
 *
 * Displays agent identity, state, capabilities, and provides wake/sleep controls.
 * This is the primary widget for the Agent Canvas.
 */
export const AgentNodeWidget: WidgetDefinition = {
  type: 'agent-node',
  version: '1.0.0',
  name: 'Agent Node',
  description: 'Visual representation of a Chrysalis Agent with wake/sleep lifecycle controls',
  icon: '🤖',
  category: 'control',
  
  propsSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'Unique agent identifier' },
      name: { type: 'string', description: 'Agent display name' },
      role: { type: 'string', description: 'Agent role from uSA spec' },
      goal: { type: 'string', description: 'Agent goal from uSA spec' },
      state: {
        type: 'string',
        enum: ['dormant', 'waking', 'awake', 'sleeping', 'error'],
        description: 'Current agent lifecycle state'
      },
      avatar: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['url', 'emoji', 'initials', 'generated'] },
          value: { type: 'string' },
          backgroundColor: { type: 'string' }
        },
        description: 'Agent avatar configuration'
      },
      stateIndicatorColor: { type: 'string', description: 'Color for state indicator' },
      capabilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of agent capabilities'
      },
      sourceFormat: {
        type: 'string',
        enum: ['usa', 'eliza', 'crewai', 'replicant', 'unknown'],
        description: 'Original import format'
      },
      dataResourceCount: {
        type: 'number',
        description: 'Number of linked data resources'
      },
      lastAwakeAt: {
        type: 'number',
        description: 'Timestamp of last awake session'
      },
      sessionCount: {
        type: 'number',
        description: 'Total number of wake sessions'
      }
    },
    required: ['agentId', 'name', 'role', 'state']
  },
  
  stateSchema: {
    type: 'object',
    properties: {
      isExpanded: { type: 'boolean', default: false },
      showDetails: { type: 'boolean', default: false },
      showDataResources: { type: 'boolean', default: false },
      connectionStatus: {
        type: 'string',
        enum: ['disconnected', 'connecting', 'connected', 'error'],
        default: 'disconnected'
      },
      wakeProgress: {
        type: 'number',
        description: '0-100 progress during waking'
      },
      sleepProgress: {
        type: 'number',
        description: '0-100 progress during sleeping'
      }
    }
  },
  
  defaultWidth: DEFAULT_AGENT_NODE_SIZE.width,
  defaultHeight: DEFAULT_AGENT_NODE_SIZE.height,
  minWidth: DEFAULT_AGENT_NODE_SIZE.minWidth,
  minHeight: DEFAULT_AGENT_NODE_SIZE.minHeight,
  maxWidth: DEFAULT_AGENT_NODE_SIZE.maxWidth,
  maxHeight: DEFAULT_AGENT_NODE_SIZE.maxHeight,
  
  capabilities: ['interactive', 'memory-aware', 'connectable', 'persistent'],
  
  events: [
    {
      name: 'wakeRequested',
      description: 'Emitted when user requests to wake the agent',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' }
        }
      }
    },
    {
      name: 'sleepRequested',
      description: 'Emitted when user requests to sleep the agent',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' }
        }
      }
    },
    {
      name: 'stateChanged',
      description: 'Emitted when agent state changes',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          previousState: { type: 'string' },
          newState: { type: 'string' }
        }
      }
    },
    {
      name: 'detailsToggled',
      description: 'Emitted when details panel is toggled',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          showDetails: { type: 'boolean' }
        }
      }
    },
    {
      name: 'dataResourcesToggled',
      description: 'Emitted when data resources panel is toggled',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          showDataResources: { type: 'boolean' }
        }
      }
    },
    {
      name: 'chatRequested',
      description: 'Emitted when user wants to chat with this agent',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' }
        }
      }
    },
    {
      name: 'removeRequested',
      description: 'Emitted when user requests to remove agent from canvas',
      payloadSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' }
        }
      }
    }
  ],
  
  actions: [
    {
      name: 'wake',
      description: 'Wake the agent and connect to chat',
      paramsSchema: {
        type: 'object',
        properties: {
          loadMemory: { type: 'boolean', default: true },
          connectDataResources: { type: 'boolean', default: true }
        }
      },
      returnsSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          bridgeId: { type: 'string' },
          error: { type: 'string' }
        }
      }
    },
    {
      name: 'sleep',
      description: 'Sleep the agent and disconnect from chat',
      paramsSchema: {
        type: 'object',
        properties: {
          persistMemory: { type: 'boolean', default: true }
        }
      },
      returnsSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' }
        }
      }
    },
    {
      name: 'toggleDetails',
      description: 'Toggle the details panel',
      paramsSchema: { type: 'object' }
    },
    {
      name: 'toggleDataResources',
      description: 'Toggle the data resources panel',
      paramsSchema: { type: 'object' }
    },
    {
      name: 'updateState',
      description: 'Update agent state (internal use)',
      paramsSchema: {
        type: 'object',
        properties: {
          state: { type: 'string' },
          progress: { type: 'number' }
        },
        required: ['state']
      }
    },
    {
      name: 'openChat',
      description: 'Open chat with this agent',
      paramsSchema: { type: 'object' }
    }
  ]
};

// ============================================================================
// Widget Registry
// ============================================================================

/**
 * Built-in widget registry
 */
export const BUILTIN_WIDGETS: Map<string, WidgetDefinition> = new Map([
  ['markdown', MarkdownWidget],
  ['code', CodeWidget],
  ['chart', ChartWidget],
  ['table', TableWidget],
  ['image', ImageWidget],
  ['button', ButtonWidget],
  ['input', InputWidget],
  ['memory-viewer', MemoryViewerWidget],
  ['skill-executor', SkillExecutorWidget],
  ['conversation', ConversationWidget],
  ['agent-node', AgentNodeWidget]
]);

/**
 * Widget registry class
 */
export class WidgetRegistry {
  private widgets: Map<string, WidgetDefinition>;
  
  constructor(includeBuiltins: boolean = true) {
    this.widgets = includeBuiltins 
      ? new Map(BUILTIN_WIDGETS)
      : new Map();
  }
  
  /**
   * Register a custom widget
   */
  register(definition: WidgetDefinition): void {
    const key = `${definition.type}@${definition.version}`;
    this.widgets.set(definition.type, definition);
    this.widgets.set(key, definition);
  }
  
  /**
   * Get a widget definition
   */
  get(type: string, version?: string): WidgetDefinition | undefined {
    if (version) {
      return this.widgets.get(`${type}@${version}`);
    }
    return this.widgets.get(type);
  }
  
  /**
   * Check if a widget type exists
   */
  has(type: string): boolean {
    return this.widgets.has(type);
  }
  
  /**
   * List all widget types
   */
  list(): WidgetDefinition[] {
    // Filter out versioned duplicates
    const seen = new Set<string>();
    const result: WidgetDefinition[] = [];
    
    for (const [key, def] of this.widgets) {
      if (!key.includes('@') && !seen.has(def.type)) {
        seen.add(def.type);
        result.push(def);
      }
    }
    
    return result;
  }
  
  /**
   * List widgets by category
   */
  listByCategory(category: WidgetCategory): WidgetDefinition[] {
    return this.list().filter(w => w.category === category);
  }
  
  /**
   * List widgets with capability
   */
  listByCapability(capability: WidgetCapability): WidgetDefinition[] {
    return this.list().filter(w => w.capabilities.includes(capability));
  }
  
  /**
   * Validate widget props against schema
   */
  validateProps(type: string, props: unknown): { valid: boolean; errors: string[] } {
    const definition = this.get(type);
    if (!definition) {
      return { valid: false, errors: [`Unknown widget type: ${type}`] };
    }
    
    // Basic schema validation
    return this.validateAgainstSchema(props, definition.propsSchema);
  }
  
  /**
   * Simple JSON schema validation
   */
  private validateAgainstSchema(
    value: unknown,
    schema: JSONSchema
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (schema.type === 'object' && typeof value !== 'object') {
      errors.push('Expected object');
      return { valid: false, errors };
    }
    
    if (schema.type === 'object' && schema.required && typeof value === 'object' && value !== null) {
      for (const required of schema.required) {
        if (!(required in value)) {
          errors.push(`Missing required property: ${required}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Default widget registry instance
 */
export const defaultWidgetRegistry = new WidgetRegistry(true);