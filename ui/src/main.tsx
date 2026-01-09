/**
 * ChrysalisTerminal UI Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Get terminal ID from URL params or use default
const params = new URLSearchParams(window.location.search);
const terminalId = params.get('terminal') || 'default';
const serverUrl = params.get('server') || undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App terminalId={terminalId} serverUrl={serverUrl} />
  </React.StrictMode>
);