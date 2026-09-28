const { contextBridge, ipcRenderer } = require('electron');
const { io } = require('socket.io-client');

let socket = null;

function connect(serverUrl, password) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(serverUrl, {
    auth: { password: password || '' },
    transports: ['websocket'],
    reconnection: true,
    // O padrao do socket.io-client (20s) e curto demais: o plano gratis do
    // Render "dorme" o servidor apos um tempo sem uso e leva ate uns 50s
    // pra acordar na primeira conexao do dia - dava timeout antes de
    // conseguir conectar.
    timeout: 60000,
  });
  return socket;
}

contextBridge.exposeInMainWorld('rtc', {
  connect(serverUrl, password) {
    return new Promise((resolve, reject) => {
      const s = connect(serverUrl, password);
      const onConnect = () => {
        s.off('connect_error', onError);
        resolve();
      };
      const onError = (err) => {
        s.off('connect', onConnect);
        reject(new Error(err.message || 'Falha ao conectar'));
      };
      s.once('connect', onConnect);
      s.once('connect_error', onError);
    });
  },

  joinRoom(roomId, name) {
    return new Promise((resolve, reject) => {
      if (!socket) return reject(new Error('Não conectado'));
      socket.emit('join-room', { roomId, name }, (res) => {
        if (res && res.ok) resolve(res);
        else reject(new Error((res && res.error) || 'Falha ao entrar na sala'));
      });
    });
  },

  sendSignal(to, data) {
    if (!socket) return;
    socket.emit('signal', { to, data });
  },

  onPeerJoined(cb) {
    if (!socket) return;
    socket.on('peer-joined', (peer) => cb(peer));
  },

  onPeerLeft(cb) {
    if (!socket) return;
    socket.on('peer-left', (peer) => cb(peer));
  },

  onSignal(cb) {
    if (!socket) return;
    socket.on('signal', (msg) => cb(msg));
  },

  onDisconnected(cb) {
    if (!socket) return;
    socket.on('disconnect', () => cb());
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },
});

// Ponte com o helper nativo (TelinhaFixAudioHelper.exe), que captura o
// audio do sistema excluindo o Discord. O main process cuida de ligar/
// desligar o processo; aqui so repassamos os pedacos de audio crus (PCM
// float32) pro renderer.
contextBridge.exposeInMainWorld('audioCapture', {
  start() {
    return ipcRenderer.invoke('audio-capture-start');
  },
  stop() {
    return ipcRenderer.invoke('audio-capture-stop');
  },
  onChunk(cb) {
    ipcRenderer.on('telinhafix-audio-chunk', (event, chunk) => cb(chunk));
  },
});

// Qualidade (resolucao + fps) escolhida na ultima vez que o seletor de
// tela/janela foi usado.
contextBridge.exposeInMainWorld('screenPicker', {
  getQuality() {
    return ipcRenderer.invoke('get-last-picked-quality');
  },
  getCameraQuality() {
    return ipcRenderer.invoke('get-camera-quality');
  },
});

contextBridge.exposeInMainWorld('appLinks', {
  openCredit() {
    return ipcRenderer.invoke('open-credit-link');
  },
});
