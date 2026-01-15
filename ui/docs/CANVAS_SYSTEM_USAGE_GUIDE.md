# Canvas System - User Guide

**Version:** 2.0  
**Date:** January 14, 2026

---

## Overview

The Chrysalis canvas system now supports **10 different canvas types** with advanced tab management, allowing you to create unlimited canvases and organize them however you like.

---

## Canvas Types

### System Canvases
- **⚙️ Settings** - System configuration (pinned, cannot close)

### Work Canvases
- **📋 Board** - Node-based workspace with React Flow
- **📔 Scrapbook** - Quick media collection
- **📚 Research** - Structured documentation
- **📖 Wiki** - MediaWiki knowledge base (in progress)
- **🖥️ Terminal** - Embedded xterm.js terminals ✨ NEW
- **🌐 Browser** - Embedded browser windows ✨ NEW

### Future Canvases (Coming Soon)
- **🎯 Scenarios** - Future planning & analysis
- **📦 Curation** - Domain research library
- **🎬 Media** - Audio/video editing

---

## Tab Management

### Adding Canvases
1. Click the **[+]** button in the tab bar
2. A new canvas is created and activated
3. Default type is "Board" - change using context menu

### Renaming Canvases
1. **Right-click** on any canvas tab
2. Select **"Rename Tab"**
3. Type the new name and press **Enter**
4. Or press **Escape** to cancel

### Hiding Canvases
1. **Right-click** on any canvas tab
2. Select **"Hide Tab"**
3. Canvas continues running in background
4. Access via **Hidden Canvases** drawer (👁️ icon)

### Closing Canvases
1. **Right-click** on any canvas tab
2. Select **"Close Tab"**
3. Canvas is permanently closed
4. **Note:** Settings canvas cannot be closed

### Duplicating Canvases
1. **Right-click** on any canvas tab
2. Select **"Duplicate Tab"**
3. Creates an exact copy with " (Copy)" suffix

### Changing Canvas Type
1. **Right-click** on any canvas tab
2. Select **"Change Type"**
3. Currently cycles through available types
4. **Note:** Settings canvas type cannot be changed

---

## Scrollable Tabs

When you have more than 5-6 canvas tabs:

- **Left Arrow [◀]** - Scroll to see earlier tabs
- **Right Arrow [▶]** - Scroll to see later tabs
- **Mouse Wheel** - Scroll horizontally over tab bar

---

## Hidden Canvas Drawer

Located in the left sidebar (bottom area):

- **Badge Count** - Shows number of hidden canvases
- **Click to Open** - View list of all hidden canvases
- **Eye Icon** - Make a canvas visible again
- **X Icon** - Close a hidden canvas permanently
- **Show All** - Make all hidden canvases visible at once

---

## Terminal Canvas 🖥️

### Creating Terminals
1. Select a Terminal canvas type
2. Click **"New Terminal"** to spawn a terminal
3. Multiple terminals can exist in one canvas

### Terminal Features
- Full xterm.js terminal emulation
- Custom Chrysalis dark theme
- Clickable URLs
- WebGL rendering for performance
- Tabs for multiple terminals

### Terminal Shortcuts
- **Ctrl+C** - Copy selected text
- **Ctrl+V** - Paste (if enabled)
- Standard terminal keyboard shortcuts work

### Closing Terminals
- Click the **[X]** on terminal tab
- Or right-click and close canvas

---

## Browser Canvas 🌐

### Creating Browser Instances
1. Select a Browser canvas type
2. Click **"New Tab"** to spawn a browser
3. Multiple browsers can exist in one canvas

### Navigation
- **URL Bar** - Enter any URL (auto-adds https://)
- **Back [◀]** - Go back (when available)
- **Forward [▶]** - Go forward (when available)
- **Refresh [↻]** - Reload current page
- **Home [⌂]** - Return to blank page

### Browser Features
- Sandboxed iframes for security
- Multiple browser tabs per canvas
- URL validation and auto-correction
- Tab management like Chrome/Firefox

### Closing Browsers
- Click the **[X]** on browser tab
- Or right-click and close canvas

---

## Keyboard Shortcuts

### Navigation
- **Click Tab** - Switch to that canvas
- **Ctrl+Tab** - Cycle through canvases (planned)
- **Ctrl+Shift+Tab** - Reverse cycle (planned)

### Management
- **Right-Click Tab** - Open context menu
- **Ctrl+T** - New canvas (planned)
- **Ctrl+W** - Close current canvas (planned)

---

## Best Practices

### Organizing Canvases
- Keep frequently used canvases visible
- Hide canvases you need but don't actively use
- Use descriptive names for easy identification
- Pin important canvases to the left

### Terminal Canvas
- Create separate terminals for different tasks
- Use descriptive tab names
- Close unused terminals to save resources

### Browser Canvas
- One browser per research topic
- Use tab names to identify sites
- Close tabs when done browsing

---

## Troubleshooting

### Tab Bar Not Scrolling
- **Solution:** Make sure there are 6+ tabs visible
- Arrows appear automatically when needed

### Cannot Rename Canvas
- **Check:** Is it the Settings canvas? (Cannot rename)
- **Try:** Right-click and ensure "Rename" is not disabled

### Hidden Canvas Drawer Empty
- **Reason:** No canvases are currently hidden
- **Action:** Hide a canvas to see the drawer appear

### Terminal Not Responding
- **Try:** Click in the terminal area to focus
- **Check:** Backend connection status
- **Restart:** Close and create new terminal

### Browser Not Loading
- **Check:** URL is valid (must be https://)
- **Try:** Click refresh button
- **Note:** Some sites block iframe embedding

---

## Tips & Tricks

### Quick Canvas Creation
1. Click **[+]** multiple times to create several canvases
2. Rename them all at once using right-click menu
3. Change types as needed

### Hidden Canvas Workflow
1. Create canvases for different projects
2. Hide all but current project canvases
3. Switch projects by showing/hiding groups

### Multi-Terminal Workflow
1. One terminal canvas per project
2. Multiple terminal tabs per canvas
3. Label tabs: "build", "test", "logs", etc.

### Multi-Browser Research
1. One browser canvas for research
2. Tabs for different aspects/sources
3. Keep canvas hidden while not researching

---

## Limits & Performance

- **Maximum Canvases:** Unlimited (tested up to 50+)
- **Tab Scrolling:** Efficient for any number
- **Hidden Canvases:** All continue running in background
- **Terminal Instances:** Recommend < 10 per canvas
- **Browser Instances:** Recommend < 5 per canvas (memory)

---

## Coming Soon

- [ ] Drag-to-reorder tabs
- [ ] Grid layout with no overlap
- [ ] Auto-arrange algorithms
- [ ] Canvas templates
- [ ] Infinite scroll modes
- [ ] Keyboard shortcuts
- [ ] Collaborative canvas sharing

---

**Last Updated:** January 14, 2026  
**Questions?** Check the main documentation or raise an issue.