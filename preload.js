const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setInteractive: (v) => ipcRenderer.send('set-interactive', v),
  pickMusic: () => ipcRenderer.invoke('pick-music'),
});
