const path = require('path');
const { app, BrowserWindow } = require('electron');

const isDev = !app.isPackaged;

// Linux sandbox note:
// Electron on some Linux setups requires chrome-sandbox to be setuid-root.
// For local dev only, allow opting out via ELECTRON_NO_SANDBOX=1.
if (process.env.ELECTRON_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}

function createMainWindow() {
  const rendererSandbox = process.env.ELECTRON_NO_SANDBOX !== '1';

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Chrysalis',
    backgroundColor: '#0b0f14',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: rendererSandbox,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.once('ready-to-show', () => win.show());

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devUrl) {
    win.loadURL(devUrl);
    return;
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'canvas-ui', 'index.html');
  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
