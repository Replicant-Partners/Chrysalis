# Open Interpreter Analysis for Chrysalis

**Date:** January 16, 2026
**Purpose:** Identify extractable components from Open Interpreter for Chrysalis agents

---

## Executive Summary

**Open Interpreter** is a mature, production-tested LLM coding agent with **comprehensive computer control capabilities**. Unlike OpenHands (which focuses on code editing) or AgentPipe (which focuses on orchestration), Open Interpreter provides a **complete computer automation API** that could significantly enhance Chrysalis agents' ability to interact with the user's system.

---

## Key Architecture Components

### 1. Computer Control API (`interpreter/core/computer/`)

**The crown jewel** - a full computer interaction layer:

```
interpreter/core/computer/
├── ai/           # AI capabilities
├── browser/      # Browser automation
├── calendar/     # Calendar access (macOS)
├── clipboard/    # Clipboard operations
├── contacts/     # Contacts access (macOS)
├── display/      # Screenshots, screen control
├── files/        # File operations
├── keyboard/     # Keyboard control
├── mail/         # Email access (macOS)
├── mouse/        # Mouse control
├── os/           # OS interaction
├── skills/       # Skills system
├── sms/          # SMS (macOS)
├── terminal/     # Terminal execution
├── vision/       # Computer vision
└── utils/        # Utilities
```

**Usage Example:**
```python
computer.display.view()              # Screenshot
computer.keyboard.write("hello")     # Type text
computer.mouse.click("Submit")       # Click UI by text
computer.mouse.click(icon="gear")    # Click icon by description
computer.browser.search("query")     # Google search
computer.files.edit(path, old, new)  # Edit file
computer.calendar.get_events()       # Calendar events
computer.mail.send(to, subject, body)# Send email
```

### 2. Skills System (`interpreter/core/computer/skills/`)

File-based skills that are auto-imported:

```python
class Skills:
    """
    - Skills stored as .py files in ~/.oi/skills/
    - Auto-imported at startup
    - Callable as functions
    """
    def list(self):     # List available skills
    def search(query):  # Search skills

class NewSkill:
    def create(self):   # Create new skill
```

**Alignment with Chrysalis:** This is simpler than Chrysalis's `SkillAccumulator` but could complement it for user-defined automation skills.

### 3. Magic Commands (`interpreter/terminal_interface/magic_commands.py`)

Terminal meta-commands:

| Command | Function |
|---------|----------|
| `%undo` | Remove last user message + response |
| `%reset` | Reset session |
| `%save_message [path]` | Save conversation to JSON |
| `%load_message [path]` | Load conversation from JSON |
| `%tokens [prompt]` | Calculate token usage + cost |
| `%markdown [path]` | Export to Markdown |
| `%jupyter` | Export to Jupyter notebook |
| `%verbose` | Toggle verbose mode |
| `%info` | System info |
| `%% [cmd]` | Run shell command |

**Alignment with Chrysalis:** These could enhance the terminal interface or be exposed via CLI.

### 4. Profile System (`interpreter/terminal_interface/profiles/`)

Model-specific and mode-specific configurations:

| Category | Profiles |
|----------|----------|
| **General** | default.yaml, fast.yaml, local.py |
| **Vision** | vision.yaml, llama3-vision.py, codestral-vision.py |
| **OS Mode** | os.py, local-os.py (computer control) |
| **Models** | llama3.py, codestral.py, gemma2.py, groq.py, qwen.py, cerebras.py |
| **Cloud** | bedrock-anthropic.py, aws-docs.py, e2b.py |
| **Special** | obsidian.py, screenpipe.py, snowpark.yml |

**Alignment with Chrysalis:** Could inform profile system for different agent deployment modes.

### 5. LLM Abstraction (`interpreter/core/llm/`)

Clean separation of LLM interaction modes:

```
interpreter/core/llm/
├── llm.py                    # Base LLM abstraction
├── run_function_calling_llm.py  # Function calling mode
├── run_tool_calling_llm.py      # Tool calling mode
├── run_text_llm.py              # Text-only mode
└── utils/                       # Token counting, etc.
```

**Key insight:** Separates `function_calling` (OpenAI style) from `tool_calling` (Anthropic style).

### 6. Computer Use Tools (`interpreter/computer_use/tools/`)

Anthropic computer-use compatible tool set:

```
interpreter/computer_use/tools/
├── base.py       # Base tool definition
├── bash.py       # Bash execution
├── computer.py   # Computer interaction
├── edit.py       # File editing
├── run.py        # Code execution
└── collection.py # Tool collection
```

---

## Extractable Components for Chrysalis

### Priority 1: Computer API (HIGH VALUE)

**What to extract:** The entire `computer/` module provides capabilities that would be valuable for Chrysalis agents operating in "OS mode".

**Integration approach:**
```typescript
// New: src/computer/ComputerAPI.ts
interface ComputerAPI {
  display: {
    view(): Promise<Screenshot>;
    center(): Promise<{x: number, y: number}>;
  };
  keyboard: {
    write(text: string): Promise<void>;
    hotkey(...keys: string[]): Promise<void>;
  };
  mouse: {
    click(target: string | {icon?: string; x?: number; y?: number}): Promise<void>;
    move(target: string): Promise<void>;
    scroll(amount: number): Promise<void>;
  };
  browser: {
    search(query: string): Promise<string>;
  };
  files: {
    edit(path: string, original: string, replacement: string): Promise<void>;
  };
  clipboard: {
    view(): Promise<string>;
    copy(text: string): Promise<void>;
  };
}
```

**Benefit:** Enables Chrysalis agents to perform GUI automation, not just code execution.

### Priority 2: Magic Commands (MEDIUM VALUE)

**What to extract:** Conversation management commands.

**Integration approach:**
```typescript
// New: src/terminal/MagicCommands.ts
class MagicCommands {
  handleUndo(messages: Message[]): Message[];
  handleReset(): void;
  saveMessage(path: string): void;
  loadMessage(path: string): Message[];
  calculateTokens(prompt?: string): TokenUsage;
  exportMarkdown(path: string): void;
  exportJupyter(path: string): void;
}
```

**Benefit:** Better conversation management for debugging and export.

### Priority 3: Skills File System (LOW-MEDIUM VALUE)

**What to extract:** File-based skill storage pattern.

**Chrysalis already has:** `SkillAccumulator` for programmatic skill accumulation.

**Complement:** Add file-based user skills that can be edited outside the system.

```typescript
// New: src/computer/UserSkills.ts
interface UserSkillsManager {
  skillsPath: string;  // ~/.chrysalis/skills/
  list(): string[];
  load(name: string): SkillDefinition;
  create(name: string, code: string): void;
}
```

### Priority 4: LLM Mode Separation (LOW VALUE)

**What to extract:** Separate function_calling vs tool_calling modes.

**Chrysalis already has:** Rich adapter system handling protocol differences.

**Minor enhancement:** Could add explicit mode flags for debugging.

---

## Comparison Matrix

| Capability | Chrysalis | Open Interpreter | OpenHands | AgentPipe |
|------------|-----------|------------------|-----------|-----------|
| **Code Execution** | ✅ Terminal | ✅ Terminal | ✅ Sandbox | ✅ CLI |
| **Computer Vision** | ❌ | ✅ display.view() | ✅ Browser | ❌ |
| **GUI Automation** | ❌ | ✅ mouse/keyboard | ❌ | ❌ |
| **Browser Control** | ❌ | ✅ browser.search | ✅ Browser | ❌ |
| **Calendar/Mail** | ❌ | ✅ macOS only | ❌ | ❌ |
| **Skills System** | ✅ SkillAccumulator | ✅ File-based | ✅ Skills | ❌ |
| **Distributed Memory** | ✅ | ❌ | ❌ | ❌ |
| **Experience Sync** | ✅ | ❌ | ❌ | ❌ |
| **Byzantine Resistance** | ✅ | ❌ | ❌ | ❌ |
| **Protocol Morphing** | ✅ | ❌ | ❌ | ❌ |
| **Multi-Agent** | ✅ | ❌ | ✅ Delegation | ✅ Orchestrator |
| **Context Condenser** | ❌ | ❌ | ✅ | ❌ |
| **Stuck Detection** | ❌ | ❌ | ✅ | ❌ |
| **ACP Support** | ❌ | ❌ | ❌ | ❌ |

---

## Recommended Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CHRYSALIS ENHANCED AGENT                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────── EXISTING CHRYSALIS CORE ──────────────────────────┐   │
│  │  SemanticAgent | MemoryMerger | ExperienceSyncManager│   │
│  │  SkillAccumulator | OODARecorder | Byzantine Resistance     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 +                                   │
│  ┌────────── NEW: OPENHANDS PATTERNS ──────────────────────────┐   │
│  │  [ContextCondenser]  [StuckDetector]  [Delegation]          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 +                                   │
│  ┌────────── NEW: OPEN INTERPRETER PATTERNS ───────────────────┐   │
│  │  [ComputerAPI]  [MagicCommands]  [UserSkills]               │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  computer.display.view()    computer.keyboard.write() │   │   │
│  │  │  computer.mouse.click()     computer.browser.search() │   │   │
│  │  │  computer.files.edit()      computer.clipboard.view() │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 +                                   │
│  ┌────────── NEW: ACP PROTOCOL LAYER ──────────────────────────┐   │
│  │  [ACPServer] ← ndjson/stdio → [VS Code, Zed, Emacs]        │   │
│  │  [ACPClient] ← ndjson/stdio → [Claude Code, OpenCode]      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Assess Existing Terminal Capabilities (1 day)

Check what Chrysalis `src/terminal/` already has and identify gaps.

### Phase 2: Computer API Foundation (1 week)

1. Create `src/computer/` module
2. Implement `display.ts` - screenshots using screenshot libraries
3. Implement `keyboard.ts` - keyboard control via nut.js or robotjs
4. Implement `mouse.ts` - mouse control via nut.js or robotjs
5. Implement basic `browser.ts` - Playwright-based browser control

### Phase 3: Skills Integration (3 days)

1. Create `src/computer/skills/UserSkills.ts`
2. File-based skill storage at `~/.chrysalis/skills/`
3. Auto-discovery and import of user skills
4. Integration with `SkillAccumulator` for persistence

### Phase 4: Magic Commands (2 days)

1. Implement `%undo`, `%reset` for conversation management
2. Implement `%tokens` for cost tracking
3. Implement `%markdown`, `%jupyter` for export

### Phase 5: Cross-Platform Considerations (ongoing)

Open Interpreter's calendar/mail/sms are macOS-only. Consider:
- Windows: Outlook COM automation
- Linux: Evolution/Thunderbird via D-Bus
- Cross-platform: Google Calendar/Gmail APIs

---

## Quick Win: Expose Computer API via MCP

Open Interpreter's computer API could be exposed as an **MCP server**:

```typescript
// New MCP Server: src/mcp-server/computer-tools/
const mcpServer = new MCPServer({
  name: "chrysalis-computer",
  tools: [
    {
      name: "computer_screenshot",
      description: "Take a screenshot of the screen",
      handler: async () => computerAPI.display.view()
    },
    {
      name: "computer_click",
      description: "Click on text or icon on screen",
      inputSchema: { target: "string" },
      handler: async (input) => computerAPI.mouse.click(input.target)
    },
    {
      name: "computer_type",
      description: "Type text",
      inputSchema: { text: "string" },
      handler: async (input) => computerAPI.keyboard.write(input.text)
    }
  ]
});
```

This would allow ANY MCP-compatible agent to use Chrysalis computer control!

---

## Conclusion

Open Interpreter provides a **mature, battle-tested computer control API** that would significantly enhance Chrysalis agents' capabilities. The key extractable components are:

1. **Computer API** - GUI automation (HIGH VALUE)
2. **Magic Commands** - Conversation management (MEDIUM VALUE)
3. **Skills File System** - User-editable skills (MEDIUM VALUE)

Combined with the earlier recommendations:
- **ACP integration** from protocol research
- **Condenser/StuckDetector** from OpenHands

Chrysalis would have the most comprehensive agent capabilities in the ecosystem.

---

## Links

- [Open Interpreter GitHub](https://github.com/openinterpreter/open-interpreter)
- [Open Interpreter Docs](https://docs.openinterpreter.com/)
- [Desktop App](https://openinterpreter.com/) - Upcoming

---

**Document Status:** Analysis Complete
**Next Action:** Evaluate priority and begin Computer API implementation
