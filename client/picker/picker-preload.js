const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onSources(cb) {
    ipcRenderer.on('screen-picker:sources', (event, sources) => cb(sources));
  },
  choose(id) {
    ipcRenderer.send('screen-picker:choice', id);
  },
});
