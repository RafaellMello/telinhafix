const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onSources(cb) {
    ipcRenderer.on('screen-picker:sources', (event, sources) => cb(sources));
  },
  choose(sourceId, quality) {
    ipcRenderer.send('screen-picker:choice', { sourceId, quality });
  },
});
