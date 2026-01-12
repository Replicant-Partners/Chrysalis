/**
 * Integration Test: ChrysalisTerminal
 * 
 * Tests the terminal system to validate:
 * - Terminal creation and session management
 * - Chat pane message handling
 * - Canvas widget creation
 * - YJS document synchronization
 * - Agent terminal client operations
 */

import {
  ChrysalisTerminal,
  AgentTerminalClient,
  createAgentTerminalClient,
  WidgetRegistry,
  defaultWidgetRegistry,
  type ChatMessage,
  type WidgetNode,
  type CanvasNode
} from '../../src/terminal';
import { AgentMemoryAdapter, MockEmbeddingProvider } from '../../src/memory';
import * as Y from 'yjs';

describe('ChrysalisTerminal Integration', () => {
  let terminal: ChrysalisTerminal;

  beforeEach(() => {
    terminal = new ChrysalisTerminal({
      terminalId: 'test-terminal-001',
      sessionName: 'Test Session',
      enableSync: false // Disable WebSocket for unit tests
    });
  });

  afterEach(() => {
    terminal.destroy();
  });

  describe('Terminal Creation', () => {
    it('should create a terminal with session', () => {
      expect(terminal.id).toBe('test-terminal-001');
      
      const session = terminal.getSession();
      expect(session.name).toBe('Test Session');
      expect(session.participants).toHaveLength(0);
    });

    it('should generate unique terminal IDs when not provided', () => {
      const terminal2 = new ChrysalisTerminal({
        sessionName: 'Auto ID Session',
        enableSync: false
      });

      expect(terminal2.id).toBeDefined();
      expect(terminal2.id).not.toBe('test-terminal-001');

      terminal2.destroy();
    });

    it('should have three frames initialized', () => {
      const leftPane = terminal.getLeftPane();
      const rightPane = terminal.getRightPane();
      const canvas = terminal.getCanvas();

      expect(leftPane).toBeDefined();
      expect(rightPane).toBeDefined();
      expect(canvas).toBeDefined();
    });
  });

  describe('Chat Pane Operations', () => {
    it('should send messages to left pane (agent)', () => {
      const message = terminal.sendMessage('left', 'Hello from agent');

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello from agent');
      expect(message.sender).toBeDefined();

      const leftPane = terminal.getLeftPane();
      expect(leftPane.messages.length).toBe(1);
    });

    it('should send messages to right pane (human)', () => {
      const message = terminal.sendMessage('right', 'Hello from human');

      const rightPane = terminal.getRightPane();
      expect(rightPane.messages.length).toBe(1);
      expect(rightPane.messages[0].content).toBe('Hello from human');
    });

    it('should maintain message order', () => {
      terminal.sendMessage('left', 'Message 1');
      terminal.sendMessage('left', 'Message 2');
      terminal.sendMessage('left', 'Message 3');

      const leftPane = terminal.getLeftPane();
      expect(leftPane.messages.length).toBe(3);
      expect(leftPane.messages[0].content).toBe('Message 1');
      expect(leftPane.messages[2].content).toBe('Message 3');
    });

    it('should support message attachments', () => {
      const message = terminal.sendMessage('right', 'Check this file', {
        attachments: [
          {
            id: 'att-001',
            type: 'file',
            name: 'report.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            url: '/files/report.pdf'
          }
        ]
      });

      expect(message.attachments).toHaveLength(1);
      expect(message.attachments![0].name).toBe('report.pdf');
    });

    it('should emit message events', () => {
      const messages: ChatMessage[] = [];
      
      terminal.on('message', (event) => {
        messages.push(event.data as ChatMessage);
      });

      terminal.sendMessage('left', 'Test message');

      expect(messages.length).toBe(1);
    });
  });

  describe('Canvas Widget Operations', () => {
    it('should add a widget to canvas', () => {
      const widget = terminal.addWidget('markdown', {
        content: '# Hello World'
      }, { x: 100, y: 100, width: 300, height: 200 });

      expect(widget.id).toBeDefined();
      expect(widget.type).toBe('widget');
      expect(widget.widgetType).toBe('markdown');
      expect(widget.props.content).toBe('# Hello World');
    });

    it('should add multiple widgets', () => {
      terminal.addWidget('markdown', { content: 'Widget 1' }, { x: 0, y: 0, width: 200, height: 100 });
      terminal.addWidget('code', { code: 'console.log("hi")', language: 'javascript' }, { x: 250, y: 0, width: 200, height: 100 });
      terminal.addWidget('table', { headers: ['A', 'B'], rows: [['1', '2']] }, { x: 500, y: 0, width: 200, height: 100 });

      const canvas = terminal.getCanvas();
      expect(canvas.nodes.length).toBe(3);
    });

    it('should validate widget type exists in registry', () => {
      expect(() => {
        terminal.addWidget('nonexistent_widget', {}, { x: 0, y: 0, width: 100, height: 100 });
      }).toThrow(/unknown widget type/i);
    });

    it('should support all built-in widget types', () => {
      const widgetTypes = [
        { type: 'markdown', props: { content: '# Test' } },
        { type: 'code', props: { code: 'test', language: 'text' } },
        { type: 'chart', props: { chartType: 'bar', data: { labels: [], datasets: [] } } },
        { type: 'table', props: { headers: ['A'], rows: [['1']] } },
        { type: 'image', props: { src: '/test.png', alt: 'Test' } },
        { type: 'button', props: { label: 'Click', action: 'test' } },
        { type: 'input', props: { placeholder: 'Enter', inputType: 'text' } },
        { type: 'memory-viewer', props: { agentId: 'agent-1' } },
        { type: 'skill-executor', props: { skillName: 'test', agentId: 'agent-1' } },
        { type: 'conversation', props: { conversationId: 'conv-1' } }
      ];

      widgetTypes.forEach(({ type, props }, index) => {
        const widget = terminal.addWidget(type, props, {
          x: (index % 5) * 220,
          y: Math.floor(index / 5) * 120,
          width: 200,
          height: 100
        });
        expect(widget.widgetType).toBe(type);
      });

      const canvas = terminal.getCanvas();
      expect(canvas.nodes.length).toBe(widgetTypes.length);
    });

    it('should remove widgets', () => {
      const widget = terminal.addWidget('markdown', { content: 'To be removed' }, { x: 0, y: 0, width: 100, height: 100 });
      
      expect(terminal.getCanvas().nodes.length).toBe(1);
      
      terminal.removeNode(widget.id);
      
      expect(terminal.getCanvas().nodes.length).toBe(0);
    });

    it('should update widget props', () => {
      const widget = terminal.addWidget('markdown', { content: 'Original' }, { x: 0, y: 0, width: 100, height: 100 });
      
      terminal.updateWidget(widget.id, { content: 'Updated' });
      
      const canvas = terminal.getCanvas();
      const updated = canvas.nodes.find(n => n.id === widget.id) as WidgetNode;
      expect(updated.props.content).toBe('Updated');
    });

    it('should add edges between widgets', () => {
      const widget1 = terminal.addWidget('markdown', { content: 'A' }, { x: 0, y: 0, width: 100, height: 100 });
      const widget2 = terminal.addWidget('markdown', { content: 'B' }, { x: 200, y: 0, width: 100, height: 100 });

      terminal.addEdge(widget1.id, widget2.id, 'data_flow');

      const canvas = terminal.getCanvas();
      expect(canvas.edges.length).toBe(1);
      expect(canvas.edges[0].fromNode).toBe(widget1.id);
      expect(canvas.edges[0].toNode).toBe(widget2.id);
    });
  });

  describe('Participant Management', () => {
    it('should add participants to session', () => {
      terminal.addParticipant({
        id: 'user-001',
        type: 'human',
        name: 'Test User'
      });

      const session = terminal.getSession();
      expect(session.participants.length).toBe(1);
      expect(session.participants[0].name).toBe('Test User');
    });

    it('should track agent participants', () => {
      terminal.addParticipant({
        id: 'agent-001',
        type: 'agent',
        name: 'Learning Agent',
        agentType: 'learning'
      });

      const session = terminal.getSession();
      const agent = session.participants.find(p => p.type === 'agent');
      expect(agent).toBeDefined();
      expect(agent?.agentType).toBe('learning');
    });

    it('should remove participants', () => {
      terminal.addParticipant({ id: 'user-001', type: 'human', name: 'User' });
      terminal.addParticipant({ id: 'agent-001', type: 'agent', name: 'Agent' });

      expect(terminal.getSession().participants.length).toBe(2);

      terminal.removeParticipant('user-001');

      expect(terminal.getSession().participants.length).toBe(1);
      expect(terminal.getSession().participants[0].id).toBe('agent-001');
    });
  });

  describe('Event System', () => {
    it('should emit widget_added events', () => {
      const events: any[] = [];
      terminal.on('widget_added', (e) => events.push(e));

      terminal.addWidget('markdown', { content: 'Test' }, { x: 0, y: 0, width: 100, height: 100 });

      expect(events.length).toBe(1);
      expect(events[0].data.widgetType).toBe('markdown');
    });

    it('should emit participant events', () => {
      const joins: any[] = [];
      const leaves: any[] = [];

      terminal.on('participant_joined', (e) => joins.push(e));
      terminal.on('participant_left', (e) => leaves.push(e));

      terminal.addParticipant({ id: 'test-001', type: 'human', name: 'Test' });
      terminal.removeParticipant('test-001');

      expect(joins.length).toBe(1);
      expect(leaves.length).toBe(1);
    });

    it('should support unsubscribe', () => {
      const messages: any[] = [];
      const handler = (e: any) => messages.push(e);

      terminal.on('message', handler);
      terminal.sendMessage('left', 'Message 1');
      
      terminal.off('message', handler);
      terminal.sendMessage('left', 'Message 2');

      expect(messages.length).toBe(1);
    });
  });
});

describe('Agent Terminal Client Integration', () => {
  let terminal: ChrysalisTerminal;
  let agentClient: AgentTerminalClient;
  let memoryAdapter: AgentMemoryAdapter;

  beforeEach(() => {
    terminal = new ChrysalisTerminal({
      terminalId: 'agent-test-terminal',
      sessionName: 'Agent Test',
      enableSync: false
    });

    memoryAdapter = new AgentMemoryAdapter('test-learning-agent', undefined, new MockEmbeddingProvider());

    agentClient = createAgentTerminalClient({
      agentId: 'test-learning-agent',
      agentName: 'Test Learning Agent',
      terminal,
      memoryAdapter
    });
  });

  afterEach(() => {
    terminal.destroy();
    memoryAdapter.clear();
  });

  describe('Agent Chat Operations', () => {
    it('should send messages to left pane', () => {
      agentClient.sendMessage('Hello, I am learning!');

      const leftPane = terminal.getLeftPane();
      expect(leftPane.messages.length).toBe(1);
      expect(leftPane.messages[0].content).toBe('Hello, I am learning!');
    });

    it('should receive messages from human pane', () => {
      const received: ChatMessage[] = [];
      agentClient.onMessage((msg) => received.push(msg));

      // Simulate human sending message
      terminal.sendMessage('right', 'What have you learned?');

      expect(received.length).toBe(1);
      expect(received[0].content).toBe('What have you learned?');
    });

    it('should handle conversation flow', async () => {
      const conversation: ChatMessage[] = [];
      agentClient.onMessage((msg) => conversation.push(msg));

      // Human sends message
      terminal.sendMessage('right', 'Teach me about TypeScript');
      
      // Agent responds
      agentClient.sendMessage('TypeScript is a typed superset of JavaScript.');
      
      // Human follows up
      terminal.sendMessage('right', 'What are the benefits?');
      
      // Agent responds again
      agentClient.sendMessage('Benefits include better tooling, type safety, and clearer APIs.');

      expect(conversation.length).toBe(2); // Only human messages
      expect(terminal.getLeftPane().messages.length).toBe(2);
      expect(terminal.getRightPane().messages.length).toBe(2);
    });
  });

  describe('Agent Widget Creation', () => {
    it('should create widgets on canvas', () => {
      const widget = agentClient.createWidget('markdown', {
        content: '# Agent Knowledge\n\nThis is what I learned today.'
      }, { x: 50, y: 50, width: 400, height: 300 });

      expect(widget.id).toBeDefined();
      expect(terminal.getCanvas().nodes.length).toBe(1);
    });

    it('should create memory viewer widget', async () => {
      // First store some memories
      await memoryAdapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'JavaScript is a programming language',
        category: 'programming',
        confidence: 0.9,
        relations: []
      });

      const widget = agentClient.createWidget('memory-viewer', {
        agentId: agentClient.agentId,
        filter: { tier: 'semantic' }
      }, { x: 0, y: 0, width: 300, height: 400 });

      expect(widget.widgetType).toBe('memory-viewer');
    });

    it('should create skill executor widget', async () => {
      // First learn a skill
      await agentClient.learnSkill('greet_user', 'How to greet a user', [
        'Get user name',
        'Choose appropriate greeting',
        'Add personalization'
      ]);

      const widget = agentClient.createWidget('skill-executor', {
        skillName: 'greet_user',
        agentId: agentClient.agentId
      }, { x: 0, y: 0, width: 250, height: 200 });

      expect(widget.widgetType).toBe('skill-executor');
    });
  });

  describe('Agent Memory Integration', () => {
    it('should store working memory from conversations', async () => {
      agentClient.sendMessage('The user is interested in machine learning');
      
      await agentClient.rememberContext('User interested in machine learning');

      const context = await agentClient.getRelevantContext('machine learning');
      expect(context.length).toBeGreaterThan(0);
    });

    it('should learn skills from interactions', async () => {
      await agentClient.learnSkill('explain_concept', 'How to explain a concept clearly', [
        'Start with a simple analogy',
        'Build up complexity gradually',
        'Check for understanding',
        'Provide examples'
      ]);

      const skills = await memoryAdapter.getAllByTier('procedural');
      expect(skills.length).toBe(1);
      expect(skills[0].skillName).toBe('explain_concept');
    });

    it('should search memory for context', async () => {
      await memoryAdapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'React uses virtual DOM for efficient updates',
        category: 'frontend',
        confidence: 0.9,
        relations: []
      });

      await memoryAdapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'PostgreSQL supports JSON data types',
        category: 'database',
        confidence: 0.95,
        relations: []
      });

      const results = await agentClient.searchMemory('frontend development');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should assemble context for responses', async () => {
      // Populate memory
      await agentClient.rememberContext('Current topic is API design');
      await memoryAdapter.store({
        type: 'semantic',
        tier: 'semantic',
        source: 'learning',
        content: 'REST APIs use HTTP methods',
        category: 'api',
        confidence: 0.9,
        relations: []
      });

      const context = await agentClient.assembleResponseContext('How do REST APIs work?');
      
      expect(context.workingContext).toBeDefined();
      expect(context.relevantFacts).toBeDefined();
    });
  });

  describe('Agent State', () => {
    it('should track agent as participant', () => {
      const session = terminal.getSession();
      const agent = session.participants.find(p => p.id === 'test-learning-agent');
      
      expect(agent).toBeDefined();
      expect(agent?.type).toBe('agent');
      expect(agent?.name).toBe('Test Learning Agent');
    });

    it('should maintain agent identity', () => {
      expect(agentClient.agentId).toBe('test-learning-agent');
      expect(agentClient.agentName).toBe('Test Learning Agent');
    });
  });
});

describe('Terminal Sync (YJS)', () => {
  it('should share state between two terminals with same doc', () => {
    // Create shared YJS doc
    const sharedDoc = new Y.Doc();

    const terminal1 = new ChrysalisTerminal({
      terminalId: 'sync-test',
      sessionName: 'Sync Test',
      enableSync: false,
      sharedDoc
    });

    const terminal2 = new ChrysalisTerminal({
      terminalId: 'sync-test',
      sessionName: 'Sync Test',
      enableSync: false,
      sharedDoc
    });

    // Terminal 1 sends message
    terminal1.sendMessage('left', 'From terminal 1');

    // Terminal 2 should see it
    const terminal2LeftPane = terminal2.getLeftPane();
    expect(terminal2LeftPane.messages.length).toBe(1);
    expect(terminal2LeftPane.messages[0].content).toBe('From terminal 1');

    // Terminal 2 adds widget
    terminal2.addWidget('markdown', { content: 'From T2' }, { x: 0, y: 0, width: 100, height: 100 });

    // Terminal 1 should see it
    const terminal1Canvas = terminal1.getCanvas();
    expect(terminal1Canvas.nodes.length).toBe(1);

    terminal1.destroy();
    terminal2.destroy();
  });

  it('should handle concurrent operations', () => {
    const sharedDoc = new Y.Doc();

    const t1 = new ChrysalisTerminal({
      terminalId: 'concurrent-test',
      sessionName: 'Concurrent',
      enableSync: false,
      sharedDoc
    });

    const t2 = new ChrysalisTerminal({
      terminalId: 'concurrent-test',
      sessionName: 'Concurrent',
      enableSync: false,
      sharedDoc
    });

    // Both add messages concurrently
    t1.sendMessage('left', 'T1 Message 1');
    t2.sendMessage('right', 'T2 Message 1');
    t1.sendMessage('left', 'T1 Message 2');
    t2.sendMessage('right', 'T2 Message 2');

    // Both should see all messages
    expect(t1.getLeftPane().messages.length).toBe(2);
    expect(t1.getRightPane().messages.length).toBe(2);
    expect(t2.getLeftPane().messages.length).toBe(2);
    expect(t2.getRightPane().messages.length).toBe(2);

    t1.destroy();
    t2.destroy();
  });

  it('should sync widget updates', () => {
    const sharedDoc = new Y.Doc();

    const t1 = new ChrysalisTerminal({ terminalId: 'widget-sync', enableSync: false, sharedDoc });
    const t2 = new ChrysalisTerminal({ terminalId: 'widget-sync', enableSync: false, sharedDoc });

    // T1 creates widget
    const widget = t1.addWidget('markdown', { content: 'Original' }, { x: 0, y: 0, width: 100, height: 100 });

    // T2 updates it
    t2.updateWidget(widget.id, { content: 'Updated by T2' });

    // T1 should see update
    const t1Widget = t1.getCanvas().nodes.find(n => n.id === widget.id) as WidgetNode;
    expect(t1Widget.props.content).toBe('Updated by T2');

    t1.destroy();
    t2.destroy();
  });
});

describe('Widget Registry', () => {
  it('should have all built-in widgets registered', () => {
    const registry = defaultWidgetRegistry;
    
    expect(registry.has('markdown')).toBe(true);
    expect(registry.has('code')).toBe(true);
    expect(registry.has('chart')).toBe(true);
    expect(registry.has('table')).toBe(true);
    expect(registry.has('image')).toBe(true);
    expect(registry.has('button')).toBe(true);
    expect(registry.has('input')).toBe(true);
    expect(registry.has('memory-viewer')).toBe(true);
    expect(registry.has('skill-executor')).toBe(true);
    expect(registry.has('conversation')).toBe(true);
  });

  it('should allow registering custom widgets', () => {
    const registry = new WidgetRegistry();
    
    registry.register({
      type: 'custom-widget',
      name: 'Custom Widget',
      description: 'A custom widget for testing',
      category: 'custom',
      capabilities: ['display'],
      defaultProps: { value: 'default' },
      schema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      }
    });

    expect(registry.has('custom-widget')).toBe(true);
    expect(registry.get('custom-widget')?.name).toBe('Custom Widget');
  });

  it('should validate widget props against schema', () => {
    const registry = defaultWidgetRegistry;
    const markdownDef = registry.get('markdown');
    
    expect(markdownDef).toBeDefined();
    expect(markdownDef?.schema).toBeDefined();
  });
});
