# Uniform Semantic Agent Morphing System - Architecture Diagram

## System Architecture

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    UNIVERSAL AGENT LAYER                         ┃
┃                  (Framework-Independent)                         ┃
┃                                                                  ┃
┃  ┌────────────────────────────────────────────────────────┐    ┃
┃  │             UniformSemanticAgent                             │    ┃
┃  │  (The "True" Agent - Reference Entity)                │    ┃
┃  │                                                        │    ┃
┃  │  • identity: { name, designation, bio, fingerprint }  │    ┃
┃  │  • personality: { traits, values, quirks }            │    ┃
┃  │  • communication: { style, phrases }                  │    ┃
┃  │  • capabilities: { primary, secondary, tools }        │    ┃
┃  │  • knowledge: { facts, topics, expertise }            │    ┃
┃  │  • memory: { type, provider, settings }               │    ┃
┃  │  • beliefs: { who, what, why, how }                   │    ┃
┃  │  • training: { conversations, demos }                 │    ┃
┃  │  • metadata: { version, created, updated }            │    ┃
┃  └────────────────────────────────────────────────────────┘    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                           │
            ┌──────────────┼──────────────┬──────────────┐
            │              │              │              │
            ▼              ▼              ▼              ▼
┏━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━┓
┃ ADAPTER LAYER ┃ ┃  ADAPTER   ┃ ┃  ADAPTER   ┃ ┃  ADAPTER   ┃
┃  (Pluggable)  ┃ ┃            ┃ ┃  (Future)  ┃ ┃  (Future)  ┃
┃               ┃ ┃            ┃ ┃            ┃ ┃            ┃
┃ ElizaOS       ┃ ┃ CrewAI     ┃ ┃ AutoGen    ┃ ┃ LangChain  ┃
┃ Adapter       ┃ ┃ Adapter    ┃ ┃ Adapter    ┃ ┃ Adapter    ┃
┃               ┃ ┃            ┃ ┃            ┃ ┃            ┃
┃ toUniversal   ┃ ┃ toUniversal┃ ┃ toUniversal┃ ┃ toUniversal┃
┃ fromUniversal ┃ ┃ from...    ┃ ┃ from...    ┃ ┃ from...    ┃
┃ embedShadow   ┃ ┃ embed...   ┃ ┃ embed...   ┃ ┃ embed...   ┃
┃ extractShadow ┃ ┃ extract... ┃ ┃ extract... ┃ ┃ extract... ┃
┗━━━━━┯━━━━━━━━━┛ ┗━━━━┯━━━━━━━┛ ┗━━━━┯━━━━━━━┛ ┗━━━━┯━━━━━━━┛
      │                 │              │              │
      ▼                 ▼              ▼              ▼
┏━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━┓
┃ FRAMEWORK   ┃  ┃ FRAMEWORK  ┃ ┃ FRAMEWORK  ┃ ┃ FRAMEWORK  ┃
┃ LAYER       ┃  ┃            ┃ ┃            ┃ ┃            ┃
┃             ┃  ┃            ┃ ┃            ┃ ┃            ┃
┃ ElizaOS     ┃  ┃ CrewAI     ┃ ┃ AutoGen    ┃ ┃ LangChain  ┃
┃ Agent       ┃  ┃ Agent      ┃ ┃ Agent      ┃ ┃ Agent      ┃
┃ + Shadow    ┃  ┃ + Shadow   ┃ ┃ + Shadow   ┃ ┃ + Shadow   ┃
┗━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━┛
```

## Conversion Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONVERSION                               │
└─────────────────────────────────────────────────────────────────┘

    Source Agent (Framework A)
           │
           ▼
    ┌──────────────────┐
    │ Adapter A        │
    │ toUniversal()    │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Uniform Semantic Agent  │
    │ (Canonical)      │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Adapter B        │
    │ fromUniversal()  │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ Create Shadow Data               │
    │ • Non-mappable fields            │
    │ • Original config                │
    │ • Universal representation       │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ Encrypt Shadow                   │
    │ • Generate fingerprint           │
    │ • Derive key (PBKDF2)           │
    │ • Encrypt (AES-256-GCM)         │
    │ • Sign (RSA)                     │
    │ • Create restoration key         │
    └────────┬─────────────────────────┘
             │
             ▼
    Target Agent (Framework B)
    + Encrypted Shadow


┌─────────────────────────────────────────────────────────────────┐
│                        RESTORATION                              │
└─────────────────────────────────────────────────────────────────┘

    Target Agent (Framework B) + Shadow
           │
           ▼
    ┌──────────────────┐
    │ Adapter B        │
    │ extractShadow()  │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────────────────────┐
    │ Verify & Decrypt                 │
    │ • Verify signature               │
    │ • Parse restoration key          │
    │ • Decrypt shadow                 │
    │ • Verify checksum                │
    └────────┬─────────────────────────┘
             │
             ▼
    ┌──────────────────┐
    │ Extract Original │
    │ from Shadow      │
    └────────┬─────────┘
             │
             ▼
    Source Agent (Framework A)
    ✓ 100% Perfect Restoration
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Agent Identity
├─ Unique fingerprint (SHA-256)
├─ Derived from: name + designation + timestamp + id
└─ Immutable identifier

Layer 2: Key Derivation
├─ PBKDF2 (100,000 iterations)
├─ Input: fingerprint + random salt
└─ Output: 256-bit AES key

Layer 3: Encryption
├─ Algorithm: AES-256-GCM
├─ Random IV per encryption
├─ Authenticated encryption
└─ Output: ciphertext + auth tag

Layer 4: Digital Signature
├─ Algorithm: RSA-2048
├─ Signs: ciphertext + IV + auth tag + fingerprint
└─ Verifies agent identity

Layer 5: Integrity Check
├─ SHA-256 checksum of data
├─ Verified before restoration
└─ Detects corruption

Result: 
✓ Confidentiality (encrypted)
✓ Integrity (checksums + auth tags)
✓ Authenticity (digital signatures)
✓ Identity (fingerprints)
✓ Non-repudiation (signed by agent owner)
```

## Data Preservation

```
┌─────────────────────────────────────────────────────────────────┐
│          ElizaOS Agent → CrewAI Agent                           │
└─────────────────────────────────────────────────────────────────┘

ElizaOS Format                     CrewAI Format
┌─────────────────┐               ┌──────────────────┐
│ name            │ ──────────→   │ agent.role       │
│ bio             │ ──────────→   │ agent.backstory  │
│ adjectives      │ ──────────→   │ (in backstory)   │
│ topics          │ ──────────→   │ agent.goal       │
│ plugins         │ ──────────→   │ agent.tools      │
│                 │               │                  │
│ messageExamples │ ─────┐        │                  │
│ postExamples    │      │        │                  │
│ style           │      │        │                  │
│ beliefs         │      └──→ ┌───┴─────────────────┐
│ templates       │           │ Encrypted Shadow    │
│ settings        │           │ • All ElizaOS-only  │
│ secrets         │           │ • Original config   │
│ username        │           │ • Universal agent   │
└─────────────────┘           └─────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│          CrewAI Agent → ElizaOS Agent                           │
└─────────────────────────────────────────────────────────────────┘

CrewAI Format                      ElizaOS Format
┌──────────────────┐              ┌─────────────────┐
│ agent.role       │ ──────────→  │ name            │
│ agent.backstory  │ ──────────→  │ bio             │
│ agent.goal       │ ──────────→  │ topics          │
│ agent.tools      │ ──────────→  │ plugins         │
│                  │              │                 │
│ max_iter         │ ─────┐       │                 │
│ max_rpm          │      │       │                 │
│ allow_delegation │      │       │                 │
│ verbose          │      └──→ ┌──┴────────────────┐
│ tools_config     │           │ Encrypted Shadow  │
│ system_prompt    │           │ • All CrewAI-only │
└──────────────────┘           │ • Original config │
                               │ • Universal agent │
                               └───────────────────┘
```

## Module Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI LAYER                                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONVERTER LAYER                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Converter                                                │  │
│  │ • convert(agent, from, to, options)                     │  │
│  │ • restore(agent, to, key, options)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
                 ▼                            ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│     ADAPTER REGISTRY        │  │   ENCRYPTION UTILITIES      │
│                             │  │                             │
│ • register(adapter)         │  │ • encrypt(data)             │
│ • get(name)                 │  │ • decrypt(data)             │
│ • list()                    │  │ • sign(data)                │
│                             │  │ • verify(signature)         │
│ ┌─────────┐  ┌─────────┐   │  │ • generateFingerprint()     │
│ │ ElizaOS │  │ CrewAI  │   │  │ • deriveKey()               │
│ │ Adapter │  │ Adapter │   │  └─────────────────────────────┘
│ └─────────┘  └─────────┘   │
└─────────────────────────────┘
```

## Conversion Sequence Diagram

```
User          Converter       FromAdapter    ToAdapter       Encryption
 │                │               │             │                │
 │ convert()      │               │             │                │
 ├───────────────>│               │             │                │
 │                │ toUniversal() │             │                │
 │                ├──────────────>│             │                │
 │                │<──────────────┤             │                │
 │                │  Universal    │             │                │
 │                │               │             │                │
 │                │            fromUniversal()  │                │
 │                ├────────────────────────────>│                │
 │                │<────────────────────────────┤                │
 │                │          Target Agent       │                │
 │                │               │             │                │
 │                │  getNonMappable()           │                │
 │                ├──────────────>│             │                │
 │                │<──────────────┤             │                │
 │                │  Non-mappable │             │                │
 │                │               │             │                │
 │                │               │             │    encrypt()   │
 │                ├─────────────────────────────────────────────>│
 │                │<─────────────────────────────────────────────┤
 │                │              Encrypted Shadow                │
 │                │               │             │                │
 │                │            embedShadow()    │                │
 │                ├────────────────────────────>│                │
 │                │<────────────────────────────┤                │
 │                │    Agent + Shadow           │                │
 │                │               │             │                │
 │<───────────────┤               │             │                │
 │  Result        │               │             │                │
 │  + Key         │               │             │                │
```

## Data Structure Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MORPHABLE AGENT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Visible Data (Framework Format)                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Framework-specific configuration                          │ │
│  │ • role, goal, backstory (CrewAI)                         │ │
│  │ • name, bio, adjectives (ElizaOS)                        │ │
│  │ • etc.                                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Shadow Data (Encrypted)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ {                                                         │ │
│  │   encrypted: "base64_encrypted_data",                    │ │
│  │   algorithm: "aes-256-gcm",                              │ │
│  │   iv: "base64_iv",                                       │ │
│  │   authTag: "base64_auth_tag",                            │ │
│  │   signature: "base64_signature",                         │ │
│  │   metadata: {                                            │ │
│  │     framework: "source_framework",                       │ │
│  │     version: "1.0.0",                                    │ │
│  │     timestamp: 1704067200000,                            │ │
│  │     checksum: "sha256_hash"                              │ │
│  │   }                                                       │ │
│  │ }                                                         │ │
│  │                                                           │ │
│  │ When decrypted reveals:                                  │ │
│  │ {                                                         │ │
│  │   framework: "elizaos",                                  │ │
│  │   data: {                                                │ │
│  │     messageExamples: [...],                              │ │
│  │     postExamples: [...],                                 │ │
│  │     style: {...},                                        │ │
│  │     beliefs: {...},                                      │ │
│  │     _original: <complete original agent>,                │ │
│  │     _universal: <universal representation>               │ │
│  │   }                                                       │ │
│  │ }                                                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Identity (Verification)                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ agentId: "Ada Lovelace"                                  │ │
│  │ fingerprint: "a7f3d9c2e8b1f4a6c2d9e5f7b8a1c3d4..."       │ │
│  │ publicKey: "-----BEGIN PUBLIC KEY-----..."               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Registry Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADAPTER REGISTRY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  adapters: Map<string, FrameworkAdapter>                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ "elizaos" → ElizaOSAdapter instance                      │  │
│  │ "crewai"  → CrewAIAdapter instance                       │  │
│  │ "autogen" → AutoGenAdapter instance                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  aliases: Map<string, string>                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ "eliza" → "elizaos"                                      │  │
│  │ "crew"  → "crewai"                                       │  │
│  │ "ag"    → "autogen"                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Methods:                                                       │
│  • register(adapter, aliases?)                                 │
│  • get(nameOrAlias)                                            │
│  • has(nameOrAlias)                                            │
│  • list()                                                      │
│  • listNames()                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Usage:
  adapterRegistry.register(new CustomAdapter(), ['alias1', 'alias2']);
  const adapter = adapterRegistry.get('custom');  // or 'alias1'
```

## Component Dependencies

```
┌────────────────┐
│ CLI Tool       │
└───────┬────────┘
        │ uses
        ▼
┌────────────────┐       ┌──────────────────┐
│ Converter      │◄──────│ AdapterRegistry  │
└───────┬────────┘       └──────────────────┘
        │ uses                    │
        │                         │ manages
        ▼                         ▼
┌────────────────┐       ┌──────────────────┐
│ Encryption     │       │ FrameworkAdapter │
└────────────────┘       └──────────────────┘
                                  ▲
                                  │ implements
                         ┌────────┴─────────┐
                         │                  │
                ┌────────┴────────┐  ┌──────┴───────────┐
                │ ElizaOSAdapter  │  │ CrewAIAdapter    │
                └─────────────────┘  └──────────────────┘
```

---

**Legend**:
- ┃ Heavy box: Major architectural layer
- ┃ Light box: Module or component
- → : Data flow
- ├─ : Tree structure
- ▼ : Process flow
