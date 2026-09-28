const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onSources(cb) {
    ipcRenderer.on('screen-picker:sources', (event, sources) => cb(sources));
  },
  listApps() {
    return ipcRenderer.invoke('list-running-apps');
  },
  choose(sourceId, quality, audioMode, audioTarget) {
    ipcRenderer.send('screen-picker:choice', { sourceId, quality, audioMode, audioTarget });
  },
});
