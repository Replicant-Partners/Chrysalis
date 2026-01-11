# Rio Terminal Technical Evaluation Report

**Document Version:** 1.0  
**Date:** 2026-01-11  
**Author:** Architecture Analysis Team  
**Classification:** Internal Technical Research  

---

## Executive Summary

This report presents a comprehensive technical evaluation of Rio Terminal as a candidate component for the Chrysalis Terminal application. The assessment focuses on two distinct integration points: the **Voyeur session popup window** and the **chat interface panes**. After systematic analysis of Rio's architecture, rendering pipeline, configuration system, and extension capabilities, this evaluation concludes with a **negative recommendation** for Rio Terminal integration and proposes **xterm.js as the preferred alternative** for both use cases.

### Key Findings

| Criterion | Rio Terminal | Assessment |
|-----------|--------------|------------|
| **Embedding Support** | ❌ None | Critical blocker |
| **Library Usage** | ❌ Standalone only | Critical blocker |
| **GPU Acceleration** | ✅ Excellent (wgpu) | Positive |
| **Visual Customization** | ✅ Strong | Positive |
| **IPC Mechanisms** | ❌ Not documented | Significant gap |
| **Programmatic Control** | ❌ Not available | Critical blocker |
| **Chat Interface Fit** | ❌ Paradigm mismatch | Fundamental limitation |

---

## 1. Methodology

### 1.1 Investigation Approach

Following the Complex Learning Agent methodology, this investigation proceeded through four phases:

1. **Discovery**: Clarified objectives and integration requirements
2. **Investigation**: Examined Rio repository structure, source code, and documentation
3. **Synthesis**: Distilled architectural insights and integration feasibility
4. **Reporting**: Structured findings with actionable recommendations

### 1.2 Sources Examined

| Source | Type | Key Insights |
|--------|------|--------------|
| `raphamorim/rio` GitHub repository[^1] | Primary | Architecture, crate structure |
| `Cargo.toml` workspace configuration | Primary | Dependencies, version info |
| `sugarloaf/` rendering engine | Primary | GPU pipeline, shader system |
| `rio-backend/src/config/` | Primary | Configuration system |
| `teletypewriter/` crate | Primary | PTY abstraction |
| `docs/docs/config.md` | Primary | Feature documentation |
| `xtermjs/xterm.js` repository[^2] | Comparison | Alternative evaluation |

---

## 2. Rio Terminal Architecture Analysis

### 2.1 High-Level Architecture

```mermaid
graph TB
    subgraph "Rio Terminal Application"
        subgraph "Frontend Layer"
            RIOTERM[rioterm<br/>Main Application]
            RIOWINDOW[rio-window<br/>Window Management]
        end
        
        subgraph "Rendering Engine - Sugarloaf"
            SUGAR[Sugarloaf Core]
            CONTEXT[wgpu Context]
            
            subgraph "Brush System"
                QUAD[QuadBrush<br/>Background/UI]
                RICH[RichTextBrush<br/>Text Rendering]
                LAYER[LayerBrush<br/>Compositing]
                FILTER[FiltersBrush<br/>Post-processing]
            end
        end
        
        subgraph "Backend Services"
            BACKEND[rio-backend<br/>Configuration & State]
            TTY[teletypewriter<br/>PTY Management]
            CORCO[corcovado<br/>Event Loop]
        end
    end
    
    subgraph "Platform Layer"
        WGPU[wgpu 28.0.0]
        VULKAN[Vulkan]
        METAL[Metal]
        DX12[DirectX 12]
        GL[OpenGL]
        WEBGPU[WebGPU]
    end
    
    RIOTERM --> RIOWINDOW
    RIOTERM --> BACKEND
    RIOTERM --> SUGAR
    
    SUGAR --> CONTEXT
    SUGAR --> QUAD
    SUGAR --> RICH
    SUGAR --> LAYER
    SUGAR --> FILTER
    
    BACKEND --> TTY
    BACKEND --> CORCO
    
    CONTEXT --> WGPU
    WGPU --> VULKAN
    WGPU --> METAL
    WGPU --> DX12
    WGPU --> GL
    WGPU --> WEBGPU
```

### 2.2 Crate Dependency Structure

```mermaid
graph LR
    subgraph "Workspace Crates"
        RIOTERM["frontends/rioterm<br/>(main binary)"]
        BACKEND[rio-backend]
        WINDOW[rio-window]
        SUGAR[sugarloaf]
        TTY[teletypewriter]
        CORCO[corcovado]
        COPA[copa]
        MACROS[rio-proc-macros]
    end
    
    RIOTERM --> BACKEND
    RIOTERM --> WINDOW
    RIOTERM --> SUGAR
    RIOTERM --> TTY
    
    BACKEND --> SUGAR
    BACKEND --> CORCO
    BACKEND --> COPA
    
    SUGAR --> MACROS
    
    TTY --> CORCO
```

### 2.3 Key Technical Specifications

| Component | Version/Technology | Purpose |
|-----------|-------------------|---------|
| **Rust Version** | MSRV 1.92.0 | Build toolchain |
| **wgpu** | 28.0.0 | GPU abstraction layer |
| **librashader** | Integrated | RetroArch shader support |
| **raw_window_handle** | Platform-specific | Window handle abstraction |
| **WGSL Shaders** | F16/F32 variants | GPU programs |

---

## 3. GPU Acceleration Evaluation

### 3.1 Rendering Pipeline

```mermaid
sequenceDiagram
    participant App as Application
    participant Sugar as Sugarloaf
    participant Ctx as GPU Context
    participant Queue as Command Queue
    participant Surface as Display Surface
    
    App->>Sugar: render()
    Sugar->>Sugar: prepare_grid()
    
    rect rgb(240, 248, 255)
        Note over Sugar: Brush Execution Phase
        Sugar->>Ctx: QuadBrush.render()<br/>(backgrounds, borders)
        Sugar->>Ctx: RichTextBrush.render()<br/>(glyphs, text)
        Sugar->>Ctx: LayerBrush.render()<br/>(images, overlays)
        Sugar->>Ctx: FiltersBrush.render()<br/>(CRT, blur effects)
    end
    
    Ctx->>Queue: submit(commands)
    Queue->>Surface: present()
```

### 3.2 Shader Analysis

Rio employs WGSL shaders with two precision variants:

**Rich Text Shader** ([`rich_text.wgsl`](https://github.com/raphamorim/rio/blob/main/sugarloaf/src/components/rich_text/rich_text.wgsl)):
```wgsl
enable f16;

struct VertexInput {
    @builtin(vertex_index) vertex_index: u32,
    @location(0) v_pos: vec4<f32>,
    @location(1) v_color: vec4<f32>,
    @location(2) v_uv: vec2<f32>,
    @location(3) layers: vec2<i32>,
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    var out: vec4<f16> = input.f_color;
    
    if input.color_layer > 0 {
        let tex_sample = textureSampleLevel(color_texture, font_sampler, 
            vec2<f32>(input.f_uv), 0.0);
        out = vec4<f16>(tex_sample);
    }
    
    if input.mask_layer > 0 {
        let tex_alpha = textureSampleLevel(mask_texture, font_sampler, 
            vec2<f32>(input.f_uv), 0.0).x;
        out = vec4<f16>(out.xyz, input.f_color.a * f16(tex_alpha));
    }
    
    return vec4<f32>(out);
}
```

**Quad Shader** ([`quad_f16.wgsl`](https://github.com/raphamorim/rio/blob/main/sugarloaf/src/components/quad/quad_f16.wgsl)) features:
- Rounded box SDF for anti-aliased corners
- Per-corner radius selection (CSS-style)
- Border rendering with smooth gradients
- Shadow effects with blur radius
- F16 precision for performance

### 3.3 Visual Effects Capabilities

| Effect | Implementation | Quality |
|--------|---------------|---------|
| **CRT Filter** | librashader `newpixiecrt` | Authentic retro aesthetic |
| **VR Effects** | librashader `fubax_vr` | Lens distortion simulation |
| **Custom Shaders** | RetroArch `.slangp` preset loading | Extensible |
| **Window Blur** | Platform-specific compositor | macOS/Windows native |
| **Transparency** | Alpha compositing in shaders | Full control |
| **Wide Gamut** | sRGB, DisplayP3, Rec2020 | Professional color |

### 3.4 Performance Characteristics

**Observed Strengths:**
- F16 shader precision reduces memory bandwidth by 50%
- Instanced rendering for character grids
- Texture atlasing for glyph caching
- Command buffer batching

**Potential Concerns:**
- Filter chain creates intermediate textures per pass
- CRT effects require additional render targets
- No documented frame timing metrics

---

## 4. UI Customization Framework

### 4.1 Configuration System

Rio uses TOML configuration with hot-reloading support:

```mermaid
graph TB
    subgraph "Configuration Loading"
        TOML[config.toml]
        PARSER[TOML Parser]
        CONFIG[Config Struct]
    end
    
    subgraph "Configuration Domains"
        WINDOW[Window Settings]
        COLORS[Color Scheme]
        FONTS[Font Configuration]
        RENDER[Renderer Settings]
        NAV[Navigation/Tabs]
        BINDS[Key Bindings]
    end
    
    subgraph "Runtime Application"
        HOTRELOAD[Hot Reload Watcher]
        SUGAR[Sugarloaf Update]
        UI[UI Refresh]
    end
    
    TOML --> PARSER
    PARSER --> CONFIG
    
    CONFIG --> WINDOW
    CONFIG --> COLORS
    CONFIG --> FONTS
    CONFIG --> RENDER
    CONFIG --> NAV
    CONFIG --> BINDS
    
    HOTRELOAD --> CONFIG
    CONFIG --> SUGAR
    SUGAR --> UI
```

### 4.2 Window Configuration Options

From [`window.rs`](https://github.com/raphamorim/rio/blob/main/rio-backend/src/config/window.rs)[^3]:

```rust
pub struct Window {
    pub width: i32,
    pub height: i32,
    pub mode: WindowMode,           // Windowed/Maximized/Fullscreen
    pub opacity: f32,               // 0.0 - 1.0
    pub blur: bool,                 // Platform blur effect
    pub background_image: Option<ImageProperties>,
    pub decorations: Decorations,   // Enabled/Disabled/Transparent/Buttonless
    pub colorspace: Colorspace,     // Srgb/DisplayP3/Rec2020
    // Platform-specific options...
}
```

### 4.3 Color System

From [`colors/mod.rs`](https://github.com/raphamorim/rio/blob/main/rio-backend/src/config/colors/mod.rs)[^4]:

- **Full ANSI palette**: 16 named colors + light/dim variants
- **256-color indexed palette**: Standard xterm colors
- **True color**: Full RGB via hex notation with alpha channel
- **Semantic colors**: cursor, selection, tabs, search highlights
- **Adaptive theming**: Light/dark mode switching

### 4.4 Font System

From [`font/mod.rs`](https://github.com/raphamorim/rio/blob/main/sugarloaf/src/font/mod.rs)[^5]:

```rust
pub struct FontLibraryData {
    pub inner: FxHashMap<usize, FontData>,
    pub symbol_maps: Option<Vec<SymbolMap>>,
    pub hinting: bool,
    primary_metrics_cache: FxHashMap<u32, Metrics>,
}
```

**Font Features:**
- Multiple font family support (regular, bold, italic, bold-italic)
- Symbol mapping for Nerd Fonts
- CJK fallback with proper metrics alignment
- Emoji support via Twemoji
- Custom font directories
- Weight/width/style specification

---

## 5. Embedding and Integration Assessment

### 5.1 Critical Finding: No Embedding API

**Evidence from Sugarloaf documentation:**
> "Sugarloaf is Rio rendering engine, designed to be multiplatform. It is based on WebGPU, Rust library for Desktops and WebAssembly for Web (JavaScript). **This project is created and maintained for Rio terminal purposes** but feel free to use it."[^6]

This statement, combined with architectural analysis, indicates:

1. **No public embedding API**: Sugarloaf exposes rendering primitives but not terminal session management
2. **Tightly coupled components**: `rioterm` binary integrates all subsystems with no plugin boundary
3. **No IPC protocol**: No documented mechanism for external process control
4. **No library target**: Only binary crates in workspace

### 5.2 Theoretical Embedding Approaches

```mermaid
graph TB
    subgraph "Option A: Process Spawning"
        SPAWN[Spawn Rio Process]
        PTY_BRIDGE[PTY Bridge]
        IPC[Custom IPC Layer]
        HOST[Host Application]
        
        HOST --> SPAWN
        SPAWN --> PTY_BRIDGE
        PTY_BRIDGE --> IPC
        IPC --> HOST
    end
    
    subgraph "Option B: Sugarloaf Extraction"
        FORK[Fork Sugarloaf]
        TERM_CORE[Build Terminal Core]
        API[Define Embedding API]
        MAINTAIN[Maintain Fork]
        
        FORK --> TERM_CORE
        TERM_CORE --> API
        API --> MAINTAIN
    end
    
    subgraph "Option C: WASM Compilation"
        COMPILE[Compile to WASM]
        CANVAS[Canvas Integration]
        JS_BRIDGE[JavaScript Bridge]
        ELECTRON[Electron Host]
        
        COMPILE --> CANVAS
        CANVAS --> JS_BRIDGE
        JS_BRIDGE --> ELECTRON
    end
```

**Assessment of Each Approach:**

| Approach | Effort | Maintainability | Risk |
|----------|--------|-----------------|------|
| Process Spawning | High | Poor | High (IPC complexity) |
| Sugarloaf Fork | Very High | Very Poor | Critical (maintenance burden) |
| WASM Compilation | Medium-High | Moderate | Medium (feature gaps) |

### 5.3 Integration Barrier Analysis

```mermaid
graph LR
    subgraph "Required Capabilities"
        EMB[Embeddable Component]
        API[Programmatic API]
        IPC[IPC Mechanisms]
        LIFE[Lifecycle Control]
        STATE[State Observation]
    end
    
    subgraph "Rio Provides"
        GPU[GPU Rendering ✓]
        THEME[Theming ✓]
        FONT[Font System ✓]
        EFFECT[Visual Effects ✓]
    end
    
    subgraph "Rio Lacks"
        NO_EMB[No Embedding ✗]
        NO_API[No Library API ✗]
        NO_IPC[No IPC ✗]
        NO_PROG[No Programmatic Control ✗]
    end
    
    EMB -.->|Missing| NO_EMB
    API -.->|Missing| NO_API
    IPC -.->|Missing| NO_IPC
    LIFE -.->|Missing| NO_PROG
    STATE -.->|Missing| NO_PROG
```

---

## 6. Voyeur Session Integration Analysis

### 6.1 Chrysalis Voyeur Architecture

From [`VoyeurEvents.ts`](../../src/observability/VoyeurEvents.ts)[^7]:

```typescript
export interface VoyeurEvent {
    kind: VoyeurEventKind | string;
    timestamp: string;
    // ...
}

export class VoyeurBus {
    private sinks: Set<VoyeurSink>;
    
    async emit(event: VoyeurEvent): Promise<void> {
        if (!this.sinks.size) return;
        // ...
    }
}
```

### 6.2 Required Data Flow for Voyeur Integration

```mermaid
sequenceDiagram
    participant Session as Agent Session
    participant Voyeur as VoyeurBus
    participant Bridge as Terminal Bridge
    participant Terminal as Terminal Component
    participant User as User Viewport
    
    Session->>Voyeur: emit('session.start')
    Voyeur->>Bridge: Subscribe to session
    Bridge->>Terminal: Initialize terminal instance
    
    loop Session Monitoring
        Session->>Voyeur: emit('shell.output', data)
        Voyeur->>Bridge: Forward output
        Bridge->>Terminal: Write to terminal buffer
        Terminal->>User: Render updated content
        
        alt User Input (Optional)
            User->>Terminal: Key input
            Terminal->>Bridge: Forward keystroke
            Bridge->>Session: Inject input
        end
    end
    
    Session->>Voyeur: emit('session.end')
    Voyeur->>Bridge: Cleanup
    Bridge->>Terminal: Dispose
```

### 6.3 Rio Integration Challenges for Voyeur

| Requirement | Rio Capability | Gap |
|-------------|---------------|-----|
| Programmatic session creation | ❌ Not available | Terminal launched via system spawn |
| Buffer state observation | ❌ Not exposed | Internal to Sugarloaf |
| Real-time content streaming | ❌ No API | Requires PTY access |
| Multiple embedded instances | ❌ Each is a window | No component model |
| Lifecycle control | ❌ OS process only | No programmatic control |

---

## 7. Chat Interface Pane Applicability

### 7.1 ChatPane Component Analysis

From [`ChatPane.tsx`](../../src/components/ChrysalisWorkspace/ChatPane.tsx)[^8]:

```typescript
export const ChatPane: React.FC<ChatPaneProps> = ({
    paneId,
    agent,
    messages,
    isAgentTyping,
    showMemoryIndicators,
    onSendMessage,
}) => {
    // Message-based rendering with:
    // - User/agent/system message differentiation
    // - Memory indicators
    // - Typing animations
    // - Auto-scroll with scroll-lock
    // ...
};
```

### 7.2 Paradigm Comparison

```mermaid
graph TB
    subgraph "Terminal Rendering Model"
        GRID[Character Grid]
        ROWS[Fixed Row Count]
        COLS[Fixed Column Count]
        CURSOR[Cursor Position]
        SCROLL[Scrollback Buffer]
        ANSI[ANSI Escape Sequences]
        
        GRID --> ROWS
        GRID --> COLS
        GRID --> CURSOR
        ROWS --> SCROLL
        COLS --> ANSI
    end
    
    subgraph "Chat Interface Model"
        MESSAGES[Message Stream]
        FLEX[Flexible Layout]
        RICH[Rich Content]
        META[Metadata Display]
        INTERACT[Interactive Elements]
        
        MESSAGES --> FLEX
        MESSAGES --> RICH
        FLEX --> META
        RICH --> INTERACT
    end
    
    GRID -.->|Mismatch| FLEX
    ANSI -.->|Mismatch| RICH
    CURSOR -.->|Mismatch| META
```

### 7.3 Fundamental Incompatibilities

| Chat Requirement | Terminal Implementation | Mismatch |
|-----------------|------------------------|----------|
| Variable-height messages | Fixed character rows | Layout model |
| Rich media embedding | ANSI escape sequences | Content format |
| Memory badges/indicators | No semantic markup | Metadata display |
| Message timestamps | No native support | Auxiliary data |
| Typing animations | Cursor blink only | Visual feedback |
| Auto-scroll with lock | Scrollback buffer | User experience |

**Conclusion**: Terminal rendering is fundamentally incompatible with conversational chat interfaces. Forcing terminal semantics onto chat display would create:
- Accessibility issues (screen reader incompatibility)
- Layout rigidity (fixed-width constraints)
- Styling limitations (ANSI color subset)
- Interaction gaps (no rich interactivity)

---

## 8. Alternative Terminal Emulator Comparison

### 8.1 Candidate Overview

| Solution | Stars | Language | GPU | Embedding | License |
|----------|-------|----------|-----|-----------|---------|
| **xterm.js** | 19,705 | TypeScript | WebGL addon | ✅ Designed for | MIT |
| **Rio Terminal** | ~3,000 | Rust | wgpu native | ❌ None | MIT |
| **Alacritty** | ~53,000 | Rust | OpenGL | ❌ None | Apache-2.0 |
| **Kitty** | ~23,000 | C/Python | OpenGL | ❌ None | GPL-3.0 |

### 8.2 Feature Comparison Matrix

```mermaid
graph TB
    subgraph "xterm.js"
        XE[Embedding ✅]
        XW[WebGL Renderer ✅]
        XN[npm Package ✅]
        XD[Well Documented ✅]
        XV[VS Code Uses ✅]
        XT[TypeScript ✅]
    end
    
    subgraph "Rio Terminal"
        RG[Native GPU ✅]
        RV[Visual Effects ✅]
        RC[Cross-platform ✅]
        RE[Embedding ❌]
        RL[Library API ❌]
        RI[IPC ❌]
    end
    
    subgraph "Alacritty"
        AG[OpenGL ✅]
        AP[Performance ✅]
        AM[Minimal ✅]
        AE[Embedding ❌]
        AL[Library ❌]
        AC[Config Only]
    end
```

### 8.3 xterm.js Detailed Analysis

From [`xtermjs/xterm.js` README](https://github.com/xtermjs/xterm.js)[^2]:

**Key Advantages:**
1. **Designed for embedding**: `npm install @xterm/xterm`
2. **GPU acceleration**: `@xterm/addon-webgl` for WebGL2 rendering
3. **Rich addon ecosystem**: attach, fit, search, serialize, web-links
4. **Production proven**: Used by VS Code, Azure Cloud Shell, JupyterLab
5. **TypeScript-native**: Full type definitions
6. **Zero dependencies**: Self-contained core

**Integration Example:**
```typescript
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';

const terminal = new Terminal({
    cursorBlink: true,
    theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        // ... Catppuccin theme
    }
});

terminal.loadAddon(new WebglAddon());
terminal.loadAddon(new FitAddon());
terminal.open(document.getElementById('terminal')!);
```

---

## 9. Integration Architecture Recommendations

### 9.1 Voyeur Session Popup - Recommended Architecture

```mermaid
graph TB
    subgraph "Chrysalis Application"
        subgraph "Voyeur System"
            BUS[VoyeurBus]
            SINK[TerminalSink]
        end
        
        subgraph "Terminal Layer"
            XTERM[xterm.js Instance]
            WEBGL[WebGL Addon]
            FIT[Fit Addon]
            ATTACH[Attach Addon]
        end
        
        subgraph "Session Management"
            POPUP[Popup Window]
            STATE[Session State]
            BUFFER[Buffer Cache]
        end
    end
    
    subgraph "Agent Process"
        AGENT[Agent Session]
        PTY[Pseudo-Terminal]
        WS[WebSocket Server]
    end
    
    BUS --> SINK
    SINK --> XTERM
    XTERM --> WEBGL
    XTERM --> FIT
    XTERM --> ATTACH
    
    ATTACH --> WS
    WS --> PTY
    PTY --> AGENT
    
    POPUP --> XTERM
    STATE --> BUFFER
    BUFFER --> XTERM
```

### 9.2 Chat Interface Panes - Recommended Architecture

**Recommendation**: Do **not** use a terminal emulator for chat interfaces.

```mermaid
graph TB
    subgraph "Recommended Chat Architecture"
        CHAT[ChatPane.tsx<br/>Current Implementation]
        MEMORY[Memory Indicators]
        TYPING[Typing Animations]
        SCROLL[Smart Scrolling]
        THEME[Theme Integration]
    end
    
    subgraph "Enhancement Options"
        MD[Markdown Rendering]
        CODE[Code Highlighting]
        COPY[Copy/Paste Rich]
        A11Y[Accessibility]
    end
    
    CHAT --> MEMORY
    CHAT --> TYPING
    CHAT --> SCROLL
    CHAT --> THEME
    
    CHAT -.->|Add| MD
    CHAT -.->|Add| CODE
    CHAT -.->|Add| COPY
    CHAT -.->|Add| A11Y
```

The existing [`ChatPane.tsx`](../../src/components/ChrysalisWorkspace/ChatPane.tsx) component with its React-based message rendering is architecturally superior for conversational interfaces.

---

## 10. Technical Recommendation Matrix

### 10.1 Decision Matrix

| Criterion | Weight | Rio Terminal | xterm.js | ChatPane (current) |
|-----------|--------|--------------|----------|-------------------|
| **Voyeur Popup Suitability** | | | | |
| Embedding capability | 10 | 0 | 10 | N/A |
| GPU acceleration | 8 | 10 | 7 | N/A |
| Programmatic control | 9 | 0 | 9 | N/A |
| Theme customization | 6 | 9 | 8 | N/A |
| Integration complexity | 8 | 1 | 9 | N/A |
| **Weighted Score** | | **29** | **170** | N/A |
| **Chat Pane Suitability** | | | | |
| Message layout flexibility | 10 | 1 | 2 | 10 |
| Rich content support | 9 | 2 | 3 | 8 |
| Memory indicator display | 8 | 0 | 1 | 10 |
| Typing animations | 6 | 2 | 3 | 9 |
| Accessibility | 9 | 3 | 5 | 8 |
| **Weighted Score** | | **68** | **116** | **378** |

### 10.2 Final Recommendations

```mermaid
graph TB
    subgraph "Recommendations"
        V[Voyeur Session Popup]
        C[Chat Interface Panes]
        
        V -->|Use| XTERM[xterm.js + WebGL]
        C -->|Keep| CHATPANE[ChatPane.tsx]
        
        XTERM --> REASON1[Designed for embedding]
        XTERM --> REASON2[VS Code proven]
        XTERM --> REASON3[WebSocket integration]
        
        CHATPANE --> REASON4[Correct paradigm]
        CHATPANE --> REASON5[Already implemented]
        CHATPANE --> REASON6[Flexible layout]
    end
    
    subgraph "Not Recommended"
        RIO[Rio Terminal]
        RIO --> BLOCK1[No embedding API]
        RIO --> BLOCK2[No programmatic control]
        RIO --> BLOCK3[Maintenance burden]
    end
```

### 10.3 Implementation Roadmap

**Phase 1: Voyeur Terminal Integration (xterm.js)**
1. Install `@xterm/xterm`, `@xterm/addon-webgl`, `@xterm/addon-fit`, `@xterm/addon-attach`
2. Create `VoyeurTerminal` wrapper component
3. Integrate with `VoyeurBus` as a sink
4. Implement WebSocket bridge to agent PTY

**Phase 2: Theme Consistency**
1. Map Chrysalis theme tokens to xterm.js theme
2. Implement blur/opacity via CSS backdrop-filter
3. Create theme synchronization hook

**Phase 3: Production Hardening**
1. Add error boundaries
2. Implement reconnection logic
3. Add accessibility enhancements

---

## 11. Conclusion

Rio Terminal, while technically impressive with its Rust/wgpu architecture and visual effects capabilities, is **not suitable** for integration into Chrysalis Terminal due to fundamental architectural barriers:

1. **No embedding API**: Rio is designed as a standalone application
2. **No programmatic control**: Cannot create/manage sessions from code
3. **No IPC mechanisms**: No documented external communication
4. **Paradigm mismatch**: Terminal grids incompatible with chat interfaces

**For Voyeur session popups**: Adopt **xterm.js** with the WebGL addon. It provides GPU-accelerated rendering, is designed for embedding, and is proven in production by VS Code and numerous other applications.

**For chat interface panes**: Continue using the existing **ChatPane.tsx** React component. Terminal emulation is architecturally inappropriate for conversational message display.

---

## Footnotes

[^1]: raphamorim/rio GitHub Repository: https://github.com/raphamorim/rio
[^2]: xtermjs/xterm.js GitHub Repository: https://github.com/xtermjs/xterm.js
[^3]: Rio Window Configuration: [`rio-backend/src/config/window.rs`](https://github.com/raphamorim/rio/blob/main/rio-backend/src/config/window.rs)
[^4]: Rio Color System: [`rio-backend/src/config/colors/mod.rs`](https://github.com/raphamorim/rio/blob/main/rio-backend/src/config/colors/mod.rs)
[^5]: Sugarloaf Font System: [`sugarloaf/src/font/mod.rs`](https://github.com/raphamorim/rio/blob/main/sugarloaf/src/font/mod.rs)
[^6]: Sugarloaf README Statement: https://github.com/raphamorim/rio/tree/main/sugarloaf
[^7]: Chrysalis VoyeurEvents: [`src/observability/VoyeurEvents.ts`](../../src/observability/VoyeurEvents.ts)
[^8]: Chrysalis ChatPane: [`src/components/ChrysalisWorkspace/ChatPane.tsx`](../../src/components/ChrysalisWorkspace/ChatPane.tsx)

---

## Appendix A: Rio Shader Code Samples

### A.1 Rich Text Fragment Shader (F16)

```wgsl
enable f16;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    var out: vec4<f16> = input.f_color;

    if input.color_layer > 0 {
        let tex_sample = textureSampleLevel(color_texture, font_sampler, 
            vec2<f32>(input.f_uv), 0.0);
        out = vec4<f16>(tex_sample);
    }

    if input.mask_layer > 0 {
        let tex_alpha = textureSampleLevel(mask_texture, font_sampler, 
            vec2<f32>(input.f_uv), 0.0).x;
        out = vec4<f16>(out.xyz, input.f_color.a * f16(tex_alpha));
    }

    return vec4<f32>(out);
}
```

### A.2 Quad Shadow Rendering

```wgsl
if input.shadow_color.a > f16(0.0) {
    let shadow_radius = select_border_radius(
        vec4<f32>(input.border_radius),
        input.position.xy - vec2<f32>(input.shadow_offset),
        (vec2<f32>(input.pos) + vec2<f32>(input.scale) * 0.5).xy
    );
    let shadow_distance = max(rounded_box_sdf(
        input.position.xy - vec2<f32>(input.pos) - 
        vec2<f32>(input.shadow_offset) - (vec2<f32>(input.scale) / 2.0), 
        vec2<f32>(input.scale) / 2.0, 
        shadow_radius
    ), 0.);
    
    let shadow_alpha = f16(1.0 - smoothstep(
        -f32(input.shadow_blur_radius), 
        f32(input.shadow_blur_radius), 
        shadow_distance
    ));
    // ... compositing
}
```

---

## Appendix B: xterm.js Integration Reference

### B.1 Minimal Voyeur Terminal Component

```typescript
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import type { VoyeurSink, VoyeurEvent } from '../observability/VoyeurEvents';

interface VoyeurTerminalProps {
    sessionWebSocket: WebSocket;
    theme?: Record<string, string>;
}

export const VoyeurTerminal: React.FC<VoyeurTerminalProps> = ({ 
    sessionWebSocket, 
    theme 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    
    useEffect(() => {
        if (!containerRef.current) return;
        
        const terminal = new Terminal({
            cursorBlink: true,
            fontFamily: 'Cascadia Code, monospace',
            theme: theme ?? {
                background: '#1e1e2e',
                foreground: '#cdd6f4',
                cursor: '#f5e0dc',
            }
        });
        
        const webglAddon = new WebglAddon();
        const fitAddon = new FitAddon();
        const attachAddon = new AttachAddon(sessionWebSocket);
        
        terminal.loadAddon(webglAddon);
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(attachAddon);
        
        terminal.open(containerRef.current);
        fitAddon.fit();
        
        terminalRef.current = terminal;
        
        return () => {
            terminal.dispose();
        };
    }, [sessionWebSocket, theme]);
    
    return <div ref={containerRef} style={{ height: '100%' }} />;
};
```

---

*Document prepared for the Chrysalis Terminal Frontend Engineering Team*
