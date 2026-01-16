/**
 * Demo Entry Point
 *
 * Renders the canvas demo application.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { DemoApp } from './App';

// Reset styles
const resetStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body, #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`;

// Inject reset styles
const styleElement = document.createElement('style');
styleElement.textContent = resetStyles;
document.head.appendChild(styleElement);

// Render app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <DemoApp />
    </React.StrictMode>
  );
}
