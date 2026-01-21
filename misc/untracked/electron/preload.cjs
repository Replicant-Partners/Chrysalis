const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('chrysalis', {
  platform: process.platform,
});
