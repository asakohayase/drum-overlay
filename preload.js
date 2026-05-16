const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setInteractive:     (v)         => ipcRenderer.send('set-interactive', v),
  pickMusic:          ()          => ipcRenderer.invoke('pick-music'),
  getLibrary:         ()          => ipcRenderer.invoke('get-library'),
  addToLibrary:       (entry)     => ipcRenderer.invoke('add-to-library', entry),
  removeFromLibrary:  (id)        => ipcRenderer.invoke('remove-from-library', id),
  loadLibraryTrack:   (filePath)  => ipcRenderer.invoke('load-library-track', filePath),
});
