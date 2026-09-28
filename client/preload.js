const { contextBridge } = require('electron');
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
      if (!socket) return reject(new Error('Nao conectado'));
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
