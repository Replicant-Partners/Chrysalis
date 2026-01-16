// @ts-nocheck - Ink v6 types require moduleResolution: bundler/node16
/**
 * Input Bar Component
 *
 * User input with command parsing.
 *
 * @module tui/components/input/InputBar
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
// Note: ink-text-input needs to be installed
// import TextInput from 'ink-text-input';
import { useMessageStore } from '../../stores/messageStore';

interface SimpleTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

/**
 * Simple text input (placeholder until ink-text-input is installed)
 */
const SimpleTextInput: React.FC<SimpleTextInputProps> = (props) => {
  const { value, onChange, onSubmit, placeholder } = props;
  useInput((input: string, key: { return?: boolean; backspace?: boolean; delete?: boolean; ctrl?: boolean; meta?: boolean }) => {
    if (key.return) {
      onSubmit(value);
      return;
    }

    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  return (
    <Text>
      {value || <Text color="gray">{placeholder}</Text>}
      <Text color="cyan">▎</Text>
    </Text>
  );
};

/**
 * Input bar component
 */
export const InputBar: React.FC = () => {
  const [input, setInput] = useState('');
  const addUserMessage = useMessageStore((state) => state.addUserMessage);
  const addSystemMessage = useMessageStore((state) => state.addSystemMessage);

  const handleSubmit = useCallback((value: string) => {
    if (!value.trim()) return;

    const trimmed = value.trim();

    // Check if it's a command
    if (trimmed.startsWith('/')) {
      const isCommand = true;
      addUserMessage(trimmed, isCommand);

      // Parse command
      const parts = trimmed.slice(1).split(/\s+/);
      const command = parts[0]?.toLowerCase();
      const args = parts.slice(1).join(' ');

      // Handle commands
      switch (command) {
        case 'help':
          addSystemMessage('info', `Available commands:
  /help - Show this help
  /skill <text> - Learn a skill
  /remember <text> - Add to memory
  /undo - Remove last exchange
  /reset - Clear conversation
  /agents - List agents
  /tokens - Show token usage
  /quit - Exit TUI`);
          break;

        case 'undo':
          // TODO: Implement undo
          addSystemMessage('info', 'Undo not yet implemented');
          break;

        case 'reset':
          useMessageStore.getState().clearMessages();
          addSystemMessage('success', 'Conversation cleared');
          break;

        case 'agents':
          // TODO: List agents
          addSystemMessage('info', 'Agents command not yet implemented');
          break;

        case 'quit':
        case 'exit':
          process.exit(0);
          break;

        default:
          addSystemMessage('warning', `Unknown command: /${command}`);
      }
    } else {
      // Regular message
      addUserMessage(trimmed, false);
      // TODO: Send to ACP bridge
      addSystemMessage('info', 'ACP integration pending - message not sent to agents');
    }

    setInput('');
  }, [addUserMessage, addSystemMessage]);

  return (
    <Box
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
    >
      <Text color="cyan">{'>'} </Text>
      <SimpleTextInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        placeholder="Type a message or /help for commands..."
      />
    </Box>
  );
};

export default InputBar;
