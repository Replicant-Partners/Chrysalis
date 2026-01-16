# Widget Publishing Guide

**For:** Developers ready to distribute their widgets and canvas types
**Prerequisites:** Completed widget or canvas type development

---

## Overview

Distribution options:
1. **Local file** - Install from `.cpkg` file
2. **URL** - Install from any HTTP endpoint
3. **Registry** - Publish to the Chrysalis package registry
4. **Bundled** - Include directly in your application

---

## Package Structure

### Directory Layout

```
my-widget-pack/
├── chrysalis-widget.json    # Package manifest (required)
├── README.md                # Documentation (recommended)
├── LICENSE                  # License file (recommended)
├── dist/                    # Built JavaScript
│   ├── widgets/
│   │   ├── counter.js
│   │   └── timer.js
│   └── index.js
├── src/                     # Source (not included in package)
│   └── ...
└── assets/                  # Icons, images
    └── icon.png
```

### Package Manifest

`chrysalis-widget.json`:

```json
{
  "$schema": "https://chrysalis.dev/schemas/widget-package-v1.json",

  "id": "@my-org/utilities",
  "version": "1.2.0",
  "name": "Utility Widgets",
  "description": "A collection of useful utility widgets for everyday tasks",

  "author": {
    "name": "Your Name",
    "email": "you@example.com",
    "url": "https://your-website.com"
  },

  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/my-org/chrysalis-utilities"
  },
  "homepage": "https://github.com/my-org/chrysalis-utilities#readme",
  "bugs": "https://github.com/my-org/chrysalis-utilities/issues",

  "keywords": ["utilities", "counter", "timer", "productivity"],

  "canvasSystemVersion": "^1.0.0",

  "widgets": [
    {
      "typeId": "@my-org/counter",
      "module": "./dist/widgets/counter.js",
      "export": "CounterWidget",
      "component": "CounterView",
      "canvases": ["board", "scrapbook"],
      "category": "utilities"
    },
    {
      "typeId": "@my-org/timer",
      "module": "./dist/widgets/timer.js",
      "export": "TimerWidget",
      "component": "TimerView",
      "canvases": "*",
      "category": "utilities"
    }
  ],

  "canvasTypes": [],

  "dependencies": {},
  "peerDependencies": {
    "react": "^18.0.0"
  },

  "requiredServices": [],
  "optionalServices": ["storage"],

  "icon": "./assets/icon.png",
  "screenshots": [
    {
      "url": "./assets/screenshot-counter.png",
      "caption": "Counter widget in action"
    }
  ],

  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/my-org"
  },

  "publishConfig": {
    "access": "public"
  }
}
```

---

## Building Your Package

### Project Setup

```bash
# Initialize project
mkdir my-widget-pack && cd my-widget-pack
npm init -y

# Install dependencies
npm install typescript @chrysalis/canvas-types react
npm install -D @chrysalis/cli vite

# Create tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### Build Script

`package.json`:

```json
{
  "scripts": {
    "build": "vite build",
    "pack": "chrysalis-cli pack",
    "validate": "chrysalis-cli validate",
    "publish": "chrysalis-cli publish"
  }
}
```

`vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        'widgets/counter': './src/counter/index.ts',
        'widgets/timer': './src/timer/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@chrysalis/canvas'],
    },
  },
});
```

### Build and Package

```bash
# Build JavaScript
npm run build

# Validate package
npm run validate
# ✓ Manifest valid
# ✓ All widget modules found
# ✓ React components exported
# ✓ Version satisfies canvasSystemVersion

# Create package file
npm run pack
# Created: my-org-utilities-1.2.0.cpkg
```

---

## Distribution Methods

### Method 1: Local File

Share the `.cpkg` file directly:

```bash
# Install from file
chrysalis-cli install ./my-org-utilities-1.2.0.cpkg

# Or in code
import { getPackageManager } from '@chrysalis/canvas';

const pm = getPackageManager();
await pm.installFromFile('/path/to/package.cpkg');
```

### Method 2: URL

Host on any HTTP server:

```bash
# Install from URL
chrysalis-cli install https://my-server.com/packages/utilities-1.2.0.cpkg

# Or in code
await pm.installFromUrl('https://my-server.com/packages/utilities-1.2.0.cpkg');
```

### Method 3: Registry

Publish to the Chrysalis package registry:

```bash
# Login (first time)
chrysalis-cli login

# Publish
chrysalis-cli publish
# Publishing @my-org/utilities@1.2.0...
# ✓ Package validated
# ✓ Uploaded to registry
# ✓ Published successfully

# Users install by name
chrysalis-cli install @my-org/utilities
```

### Method 4: Bundled

Include widgets directly in your application:

```typescript
// In your app's initialization
import { getWidgetRegistry, getPackageManager } from '@chrysalis/canvas';

// Import widget definitions directly
import { CounterWidget, CounterView } from './local-widgets/counter';
import { TimerWidget, TimerView } from './local-widgets/timer';

const registry = getWidgetRegistry();

// Register directly (no package manager needed)
registry.register(CounterWidget);
registry.registerComponent('@my-org/counter', CounterView);

registry.register(TimerWidget);
registry.registerComponent('@my-org/timer', TimerView);
```

---

## Version Management

### Semantic Versioning

Follow semver strictly:

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
  - Renamed/removed widget types
  - Breaking data schema changes
  - Removed capabilities

- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
  - New widgets added
  - New optional data fields
  - New capabilities

- **PATCH** (1.0.0 → 1.0.1): Bug fixes
  - Visual fixes
  - Performance improvements
  - Documentation updates

### Pre-release Versions

```json
{
  "version": "2.0.0-beta.1"
}
```

Users must explicitly opt-in:

```bash
chrysalis-cli install @my-org/utilities@2.0.0-beta.1
```

### Deprecation

When replacing a package:

```json
{
  "deprecated": "This package is deprecated. Use @my-org/utilities-v2 instead."
}
```

---

## Dependencies

### Package Dependencies

Other widget packages this one needs:

```json
{
  "dependencies": {
    "@chrysalis/common-widgets": "^1.0.0"
  }
}
```

These are installed automatically.

### Peer Dependencies

Packages that must be provided by the host:

```json
{
  "peerDependencies": {
    "react": "^18.0.0",
    "@chrysalis/canvas": "^1.0.0"
  }
}
```

Validation fails if peers aren't available.

### Service Dependencies

Services required from the canvas system:

```json
{
  "requiredServices": ["storage"],
  "optionalServices": ["ai", "encryption"]
}
```

Widgets gracefully degrade when optional services are unavailable.

---

## Security

### Code Review

Before publishing:

1. No secrets in code
2. No network calls without user consent
3. No filesystem access outside sandbox
4. No eval() or dynamic code execution

### Permissions Model

Widgets must declare what they need:

```typescript
export const MyWidget: WidgetDefinition = {
  // ...

  permissions: {
    network: ['api.example.com'],  // Only these domains
    storage: 'local',              // No cloud storage
    clipboard: 'read',             // Can read, not write
  },
};
```

Users see permission requests on install.

### Verification

Registry packages can be verified:

```bash
chrysalis-cli verify @my-org/utilities

# Checks:
# ✓ Package signature valid
# ✓ Source matches published hash
# ✓ No known vulnerabilities
# ✓ Meets security guidelines
```

Verified packages show a badge in the registry.

---

## Registry Features

### Search

```bash
chrysalis-cli search timer

# Results:
# @chrysalis/timer       ★★★★★  125k downloads  Timer widget
# @my-org/pomodoro      ★★★★☆   45k downloads  Pomodoro timer
# @dev/countdown        ★★★☆☆    8k downloads  Countdown timer
```

### Package Info

```bash
chrysalis-cli info @my-org/utilities

# @my-org/utilities@1.2.0
#
# A collection of useful utility widgets
#
# Widgets:
#   @my-org/counter  - Simple click counter
#   @my-org/timer    - Countdown timer
#
# Homepage: https://github.com/my-org/chrysalis-utilities
# Downloads: 12,450 total (890 this week)
# License: MIT
```

### Versions

```bash
chrysalis-cli versions @my-org/utilities

# 1.2.0  2024-01-15  latest, stable
# 1.1.0  2024-01-01
# 1.0.0  2023-12-15
# 0.9.0  2023-12-01  deprecated
```

---

## Updating Packages

### For Package Authors

```bash
# Bump version
npm version patch  # or minor, major

# Rebuild and publish
npm run build
chrysalis-cli publish
```

### For Users

```bash
# Check for updates
chrysalis-cli outdated

# @my-org/utilities  1.1.0  →  1.2.0

# Update specific package
chrysalis-cli update @my-org/utilities

# Update all
chrysalis-cli update
```

### Migration on Update

If your update includes data migrations, they run automatically:

```typescript
dataContract: {
  version: '2.0.0',
  migrations: [
    {
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      migrate: (old) => ({ ...old, newField: 'default' }),
    },
  ],
}
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Module not found" | Wrong path in manifest | Check `module` paths are relative to package root |
| "Component not exported" | Missing export | Ensure `export` name matches actual export |
| "Version conflict" | Dependency mismatch | Check `canvasSystemVersion` compatibility |
| "Validation failed" | Schema error | Run `chrysalis-cli validate` for details |

### Debug Mode

```bash
# Verbose logging during install
chrysalis-cli install @my-org/utilities --debug

# Test without installing
chrysalis-cli install @my-org/utilities --dry-run
```

---

## Best Practices

1. **Write good documentation** - README.md is displayed in the registry
2. **Include screenshots** - Visual preview increases adoption
3. **Test on all supported canvases** - Don't assume behavior
4. **Keep packages focused** - Multiple small packages > one mega package
5. **Respond to issues** - Active maintenance builds trust
6. **Use semantic versioning strictly** - Breaking changes = major version
7. **Provide migration paths** - Never strand users on old versions

---

## Next Steps

- Join the [Chrysalis Discord](https://discord.gg/chrysalis) to get help and share widgets
- Submit your package to the [Community Showcase](https://chrysalis.dev/showcase)
- Apply for [Verified Publisher](https://chrysalis.dev/verify) status
