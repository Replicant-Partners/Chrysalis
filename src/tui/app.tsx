import React, { useCallback, useMemo, useState } from 'react';
import { render, Box, Text, useApp, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';

type PaneId = 'left' | 'right';
type MessageRole = 'user' | 'agent' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  name: string;
  content: string;
  timestamp: number;
}

interface AppOptions {
  agent?: string;
  session?: string;
  baseUrl: string;
  debug?: boolean;
}

interface ChatResponseData {
  threadId?: string;
  responses?: Array<{
    agentId: string;
    content: string;
    confidence?: number;
  }>;
}

interface AgentListResponse {
  agents?: Array<{ id: string; name: string }>;
}

const DEFAULT_BASE_URL =
  process.env.SYSTEM_AGENT_API_BASE_URL ||
  process.env.SYSTEM_AGENT_API_URL ||
  'http://localhost:3200/api/v1/system-agents';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseArgs(argv: string[]): Partial<AppOptions> {
  const options: Partial<AppOptions> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--agent' && argv[i + 1]) {
      options.agent = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--session' && argv[i + 1]) {
      options.session = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--base-url' && argv[i + 1]) {
      options.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--debug') {
      options.debug = true;
      continue;
    }
  }
  return options;
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function nextPane(current: PaneId): PaneId {
  return current === 'left' ? 'right' : 'left';
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postChat(
  baseUrl: string,
  message: string,
  threadId?: string,
  targetAgent?: string
): Promise<ChatResponseData> {
  const payload: Record<string, unknown> = { message };
  if (threadId) payload.threadId = threadId;
  if (targetAgent) payload.targetAgent = targetAgent;

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (!data?.success) {
    const message = data?.error?.message || 'Unexpected response';
    throw new Error(message);
  }
  return data.data as ChatResponseData;
}

async function fetchAgents(baseUrl: string): Promise<AgentListResponse> {
  const response = await fetch(`${baseUrl}/agents`, { method: 'GET' });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (!data?.success) {
    const message = data?.error?.message || 'Unexpected response';
    throw new Error(message);
  }
  return data.data as AgentListResponse;
}

function App(): JSX.Element {
  const cliOptions = useMemo(() => parseArgs(process.argv), []);
  const baseUrl = normalizeBaseUrl(cliOptions.baseUrl || DEFAULT_BASE_URL);
  const { exit } = useApp();
  const { columns, rows } = useStdout();

  const [activePane, setActivePane] = useState<PaneId>('left');
  const [input, setInput] = useState('');
  const [targetAgent, setTargetAgent] = useState<string | undefined>(cliOptions.agent);
  const [isSending, setIsSending] = useState(false);

  const initialSession = cliOptions.session || `session-${Date.now()}`;
  const [threadIds, setThreadIds] = useState<Record<PaneId, string>>({
    left: `${initialSession}-left`,
    right: `${initialSession}-right`,
  });

  const [messages, setMessages] = useState<Record<PaneId, Message[]>>({
    left: [],
    right: [],
  });

  const addMessage = useCallback((pane: PaneId, message: Message) => {
    setMessages((prev) => ({
      ...prev,
      [pane]: [...prev[pane], message],
    }));
  }, []);

  const addSystemMessage = useCallback((pane: PaneId, content: string) => {
    addMessage(pane, {
      id: makeId('system'),
      role: 'system',
      name: 'system',
      content,
      timestamp: Date.now(),
    });
  }, [addMessage]);

  const handleCommand = useCallback(async (pane: PaneId, raw: string) => {
    const trimmed = raw.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0]?.slice(1);

    if (!command) return;

    if (command === 'help') {
      addSystemMessage(pane, 'commands: /help /quit /pane left|right /agent <id|auto> /agents /clear');
      return;
    }
    if (command === 'quit') {
      exit();
      return;
    }
    if (command === 'pane') {
      const target = parts[1] === 'right' ? 'right' : 'left';
      setActivePane(target);
      addSystemMessage(pane, `active pane: ${target}`);
      return;
    }
    if (command === 'agent') {
      const next = parts[1];
      if (!next || next === 'auto') {
        setTargetAgent(undefined);
        addSystemMessage(pane, 'target agent: auto');
        return;
      }
      setTargetAgent(next);
      addSystemMessage(pane, `target agent: ${next}`);
      return;
    }
    if (command === 'agents') {
      try {
        const list = await fetchAgents(baseUrl);
        const names = (list.agents || []).map((agent) => `${agent.id} (${agent.name})`);
        addSystemMessage(pane, names.length ? `available agents: ${names.join(', ')}` : 'no agents found');
      } catch (error) {
        addSystemMessage(pane, `agents error: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (command === 'clear') {
      setMessages((prev) => ({ ...prev, [pane]: [] }));
      return;
    }

    addSystemMessage(pane, `unknown command: ${command}`);
  }, [addSystemMessage, baseUrl, exit]);

  const sendMessage = useCallback(async (pane: PaneId, content: string) => {
    addMessage(pane, {
      id: makeId('user'),
      role: 'user',
      name: 'you',
      content,
      timestamp: Date.now(),
    });

    setIsSending(true);
    try {
      const response = await postChat(baseUrl, content, threadIds[pane], targetAgent);
      if (response.threadId) {
        setThreadIds((prev) => ({ ...prev, [pane]: response.threadId || prev[pane] }));
      }
      const agentResponses = response.responses || [];
      if (!agentResponses.length) {
        addSystemMessage(pane, 'no agent response');
      }
      for (const reply of agentResponses) {
        addMessage(pane, {
          id: makeId('agent'),
          role: 'agent',
          name: reply.agentId,
          content: reply.content,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      addSystemMessage(pane, `send error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSending(false);
    }
  }, [addMessage, addSystemMessage, baseUrl, targetAgent, threadIds]);

  useInput((inputValue, key) => {
    if (key.tab) {
      setActivePane((current) => nextPane(current));
      return;
    }
    if (key.ctrl && inputValue === 'c') {
      exit();
    }
  });

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setInput('');
      return;
    }
    setInput('');
    if (trimmed.startsWith('/')) {
      await handleCommand(activePane, trimmed);
      return;
    }
    await sendMessage(activePane, trimmed);
  }, [activePane, handleCommand, sendMessage]);

  const paneHeight = Math.max(6, (rows || 24) - 6);
  const paneWidth = Math.floor((columns || 80) / 2) - 1;

  const renderPaneMessages = (pane: PaneId) => {
    const maxMessages = Math.max(3, paneHeight - 2);
    const recent = messages[pane].slice(-maxMessages);
    return recent.map((msg) => {
      const color = msg.role === 'agent' ? 'green' : msg.role === 'system' ? 'yellow' : 'cyan';
      return (
        <Text key={msg.id} color={color} wrap="wrap">
          {`${msg.name}: ${msg.content}`}
        </Text>
      );
    });
  };

  return (
    <Box flexDirection="column" width={columns || 80}>
      <Box flexDirection="column" marginBottom={1}>
        <Text>Chrysalis TUI chat</Text>
        <Text>
          base: {shortUrl(baseUrl)} | agent: {targetAgent || 'auto'} | active: {activePane}
          {isSending ? ' | sending...' : ''}
        </Text>
        {cliOptions.debug ? <Text>session: {initialSession}</Text> : null}
      </Box>

      <Box flexDirection="row" width={columns || 80}>
        <Box
          flexDirection="column"
          width={paneWidth}
          height={paneHeight}
          borderStyle="round"
          borderColor={activePane === 'left' ? 'green' : 'gray'}
          paddingX={1}
        >
          <Text>{activePane === 'left' ? '> left' : 'left'}</Text>
          {renderPaneMessages('left')}
        </Box>
        <Box width={2} />
        <Box
          flexDirection="column"
          width={paneWidth}
          height={paneHeight}
          borderStyle="round"
          borderColor={activePane === 'right' ? 'green' : 'gray'}
          paddingX={1}
        >
          <Text>{activePane === 'right' ? '> right' : 'right'}</Text>
          {renderPaneMessages('right')}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={isSending ? 'yellow' : 'white'}>{'> '}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
      <Text dimColor>tab switch panes | /help for commands</Text>
    </Box>
  );
}

render(<App />);
