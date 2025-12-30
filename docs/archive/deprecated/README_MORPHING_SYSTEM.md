# Universal Agent Morphing System

**A modular, generalizable system for lossless conversion between agentic AI frameworks**

---

## Overview

This system enables AI agents to morph between different frameworks (CrewAI, ElizaOS, AutoGen, etc.) without losing ANY information. The agent specification exists as a **canonical reference entity** independent of any framework.

### Key Innovation

**Encrypted Shadow Fields** - Framework-specific data that doesn't map is encrypted and embedded in the target framework's configuration, allowing perfect restoration later.

```
Agent in Framework A
    ↓
Universal Agent (canonical representation)
    ↓
Agent in Framework B + Encrypted Shadow (Framework A data)
    ↓
Restore → Agent in Framework A (100% perfect)
```

---

## Project Structure

```
src/
├── core/
│   ├── UniversalAgent.ts        # Universal agent types (canonical)
│   ├── FrameworkAdapter.ts      # Abstract adapter interface
│   ├── AdapterRegistry.ts       # Adapter management
│   └── Encryption.ts            # Crypto utilities
│
├── adapters/
│   ├── ElizaOSAdapter.ts        # ElizaOS ↔ Universal
│   ├── CrewAIAdapter.ts         # CrewAI ↔ Universal
│   └── [Future: AutoGen, LangChain, etc.]
│
├── converter/
│   └── Converter.ts             # Main conversion logic
│
├── cli/
│   └── agent-morph.ts           # CLI tool
│
└── index.ts                     # Public API exports

examples/
├── complete_morphing_example.ts # Full working demo
└── ...

Replicants/                      # Existing agent definitions
├── legends/
│   ├── ada_lovelace.json       # Can be converted to CrewAI
│   ├── ted_lasso.json
│   └── ...
└── ...
```

---

## Installation

```bash
cd ~/Documents/GitClones/CharactersAgents

# Install dependencies
npm install

# Build TypeScript
npm run build

# Install CLI globally (optional)
npm link
```

---

## Quick Start

### Option 1: CLI Usage

```bash
# Convert ElizaOS to CrewAI
agent-morph convert \
  --from elizaos \
  --to crewai \
  --input ./Replicants/legends/ada_lovelace.json \
  --output ./output/ada_crewai.json \
  --key ./keys/private_key.pem

# Output: ada_crewai.json + restoration key

# Restore back to ElizaOS
agent-morph restore \
  --framework elizaos \
  --input ./output/ada_crewai.json \
  --output ./output/ada_restored.json \
  --restoration-key "salt:authTag" \
  --public-key ./keys/public_key.pem
```

### Option 2: Programmatic Usage

```typescript
import { Converter, adapterRegistry, ElizaOSAdapter, CrewAIAdapter } from './src';
import { generateKeyPair } from './src/core/Encryption';

// Setup
const converter = new Converter();
adapterRegistry.register(new ElizaOSAdapter());
adapterRegistry.register(new CrewAIAdapter());

// Generate keys
const { privateKey, publicKey } = generateKeyPair();

// Convert
const result = await converter.convert(
  elizaOSAgent,
  adapterRegistry.get('elizaos'),
  adapterRegistry.get('crewai'),
  { privateKey }
);

// Restore
const restored = await converter.restore(
  result.agent,
  adapterRegistry.get('elizaos'),
  result.restorationKey,
  { publicKey }
);
```

---

## Architecture

### The Universal Agent (Reference Entity)

The **Universal Agent** is the canonical representation:

```typescript
interface UniversalAgent {
  schema_version: string;
  identity: { name, designation, bio, fingerprint, ... };
  personality: { core_traits, values, quirks, ... };
  communication: { style, signature_phrases, ... };
  capabilities: { primary, secondary, domains, tools, ... };
  knowledge: { facts, topics, expertise, ... };
  memory: { type, provider, settings };
  beliefs: { who, what, why, how, ... };
  training: { conversations, demonstrations, ... };
  metadata: { version, created, updated, ... };
}
```

### Framework Adapters (Pluggable)

Each adapter implements:

```typescript
abstract class FrameworkAdapter {
  readonly name: string;
  readonly version: string;
  readonly supports_shadow: boolean;
  
  abstract toUniversal(agent: any): Promise<UniversalAgent>;
  abstract fromUniversal(universal: UniversalAgent): Promise<any>;
  abstract embedShadow(agent: any, shadow: EncryptedShadow): Promise<any>;
  abstract extractShadow(agent: any): Promise<EncryptedShadow | null>;
  abstract validate(agent: any): Promise<ValidationResult>;
}
```

### Converter (Framework Agnostic)

The converter works with **any two adapters**:

```typescript
converter.convert(
  agent,
  fromAdapter,  // variable: any adapter
  toAdapter,    // variable: any adapter
  options
)
```

---

## Adding New Framework Support

To add support for a new framework (e.g., AutoGen):

### Step 1: Create Adapter

```typescript
// src/adapters/AutoGenAdapter.ts
import { FrameworkAdapter } from '../core/FrameworkAdapter';

export class AutoGenAdapter extends FrameworkAdapter {
  readonly name = 'autogen';
  readonly version = '1.0.0';
  readonly supports_shadow = true;
  
  async toUniversal(autoGenAgent: any): Promise<UniversalAgent> {
    // Convert AutoGen → Universal
  }
  
  async fromUniversal(universal: UniversalAgent): Promise<any> {
    // Convert Universal → AutoGen
  }
  
  async embedShadow(agent: any, shadow: EncryptedShadow): Promise<any> {
    // Embed shadow in AutoGen config
  }
  
  async extractShadow(agent: any): Promise<EncryptedShadow | null> {
    // Extract shadow from AutoGen config
  }
  
  async validate(agent: any): Promise<ValidationResult> {
    // Validate AutoGen agent
  }
}
```

### Step 2: Register Adapter

```typescript
import { adapterRegistry } from './src/core/AdapterRegistry';
import { AutoGenAdapter } from './src/adapters/AutoGenAdapter';

adapterRegistry.register(new AutoGenAdapter(), ['ag', 'autogen']);
```

### Step 3: Use It

```bash
agent-morph convert --from elizaos --to autogen --input agent.json --output agent_autogen.json
```

---

## CLI Commands

### Convert

```bash
agent-morph convert \
  --from <framework> \
  --to <framework> \
  --input <file> \
  --output <file> \
  [--key <private-key-file>]
```

### Restore

```bash
agent-morph restore \
  --framework <framework> \
  --input <file> \
  --output <file> \
  --restoration-key <key> \
  [--public-key <public-key-file>]
```

### Validate

```bash
agent-morph validate \
  --framework <framework> \
  --input <file>
```

### Generate Keys

```bash
agent-morph keygen \
  [--output-dir <directory>]
```

### List Adapters

```bash
agent-morph adapters
```

### Inspect

```bash
agent-morph inspect \
  --framework <framework> \
  --input <file>
```

---

## Examples

### Convert Existing ElizaOS Agent

```bash
# Convert Ada Lovelace to CrewAI
agent-morph convert \
  --from elizaos \
  --to crewai \
  --input ./Replicants/legends/ada_lovelace.json \
  --output ./output/ada_lovelace_crewai.json

# Output includes restoration key
# Save this key!: "Ym9/7X3dK8qP2w1A4j9L6M=:Xc8Y4pL2mK9jN6fT3qW1hR="
```

### Restore to Original

```bash
# Restore Ada back to ElizaOS
agent-morph restore \
  --framework elizaos \
  --input ./output/ada_lovelace_crewai.json \
  --output ./output/ada_lovelace_restored.json \
  --restoration-key "Ym9/7X3dK8qP2w1A4j9L6M=:Xc8Y4pL2mK9jN6fT3qW1hR="

# Verify restoration
diff ./Replicants/legends/ada_lovelace.json ./output/ada_lovelace_restored.json
# Should be identical!
```

---

## Running the Demo

```bash
# Run the complete demonstration
ts-node examples/complete_morphing_example.ts
```

**Output shows**:
- ✓ ElizaOS → CrewAI → ElizaOS (perfect restoration)
- ✓ CrewAI → ElizaOS → CrewAI (perfect restoration)
- ✓ Identity verification across morphs
- ✓ All tests pass

---

## Key Features

### ✅ Zero Information Loss
- Framework-specific data encrypted in shadow
- Perfect restoration with restoration key
- Original config always recoverable

### ✅ Cryptographic Security
- AES-256-GCM encryption
- RSA/ECDSA digital signatures
- PBKDF2 key derivation (100k iterations)
- SHA-256 integrity checks

### ✅ Agent Identity
- Unique fingerprints
- Verifiable across morphs
- Tamper detection

### ✅ Modular Design
- Pluggable adapters
- Framework-agnostic core
- Easy to extend

---

## Documentation

- **[AGENT_MORPHING_SPECIFICATION.md](./AGENT_MORPHING_SPECIFICATION.md)** - Complete technical spec
- **[LOSSLESS_AGENT_MORPHING.md](./LOSSLESS_AGENT_MORPHING.md)** - Detailed documentation
- **[LOSSLESS_MORPHING_README.md](./LOSSLESS_MORPHING_README.md)** - Quick reference
- **[CREWAI_VS_ELIZAOS_ANALYSIS.md](./CREWAI_VS_ELIZAOS_ANALYSIS.md)** - Framework comparison

---

## Next Steps

1. ✅ **Try the demo**: `ts-node examples/complete_morphing_example.ts`
2. ✅ **Convert your agents**: Use the CLI tool
3. ✅ **Add new frameworks**: Create custom adapters
4. ✅ **Integrate**: Use programmatically in your projects

---

## License

MIT
