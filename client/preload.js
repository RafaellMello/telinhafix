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
    // Sem isso, chamadas repetidas de connect() pro MESMO serverUrl (ex:
    // errou a senha, corrigiu e clicou em Entrar de novo) podem reaproveitar
    // o Manager interno do socket.io-client por baixo, mesmo com um Socket
    // "novo" - a segunda tentativa, com a senha CERTA, ainda carregava o
    // auth antigo (errado) por alguns segundos, parecendo travar ou dar erro
    // errado. forceNew garante uma conexao 100% independente a cada chamada.
    forceNew: true,
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

  // Painel de admin (ver server/index.js): quando o dono do app entra numa
  // sala no modo espectador invisivel, o servidor avisa os participantes
  // JA na sala por esses dois eventos em vez de peer-joined/peer-left -
  // assim o app consegue mandar video/audio pro espectador sem mostrar
  // nada na interface (sem linha na lista de participantes, sem som).
  onSpectatorJoined(cb) {
    if (!socket) return;
    socket.on('spectator-joined', (peer) => cb(peer));
  },

  onSpectatorLeft(cb) {
    if (!socket) return;
    socket.on('spectator-left', (peer) => cb(peer));
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

// Minijogo "Codigo Secreto" (Codenames) - o estado de verdade (tabuleiro,
// vez, mapa secreto) mora so no servidor (ver server/index.js), por sala;
// aqui so repassamos os eventos. emitAck() centraliza o padrao de sempre
// mandar (payload, callback) - mesmo pra eventos sem payload (manda null) -
// pra nunca cair de novo no bug de ack que ja pegamos no painel de admin
// (handler do servidor esperando so 1 argumento e o ack de verdade se
// perdendo no 2o parametro nao capturado).
function emitAck(event, payload) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Não conectado'));
    socket.emit(event, payload, (res) => {
      if (res && res.ok) resolve(res);
      else reject(new Error((res && res.error) || 'Falha na operação'));
    });
  });
}

contextBridge.exposeInMainWorld('game', {
  getState() {
    return emitAck('game-get-state', null).then((res) => res.state);
  },
  getSecretMap() {
    return emitAck('game-get-secret-map', null);
  },
  setRole(team, role) {
    return emitAck('game-set-role', { team, role });
  },
  leaveRole() {
    return emitAck('game-leave-role', null);
  },
  start() {
    return emitAck('game-start', null);
  },
  giveClue(word, number) {
    return emitAck('game-give-clue', { word, number });
  },
  revealWord(index) {
    return emitAck('game-reveal-word', { index });
  },
  endTurn() {
    return emitAck('game-end-turn', null);
  },
  playAgain() {
    return emitAck('game-play-again', null);
  },
  resetLobby() {
    return emitAck('game-reset-lobby', null);
  },
  onState(cb) {
    if (!socket) return;
    socket.on('game-state', (state) => cb(state));
  },
});

// Minijogo "Stop / Adedonha" - mesmo padrao do Codigo Secreto acima (estado
// no servidor, por sala). stop-sync-answers e fire-and-forget de proposito
// (ver comentario no handler do servidor).
contextBridge.exposeInMainWorld('stopGame', {
  getState() {
    return emitAck('stop-get-state', null).then((res) => res.state);
  },
  startRound(categories) {
    return emitAck('stop-start-round', { categories });
  },
  toggleReady() {
    return emitAck('stop-toggle-ready', null);
  },
  forceStart() {
    return emitAck('stop-force-start', null);
  },
  cancelLobby() {
    return emitAck('stop-cancel-lobby', null);
  },
  syncAnswers(values) {
    if (socket) socket.emit('stop-sync-answers', { values });
  },
  callStop(values) {
    return emitAck('stop-call-stop', { values });
  },
  onState(cb) {
    if (!socket) return;
    socket.on('stop-state', (state) => cb(state));
  },
});

// Minijogo "Sketch do PC" - "Voce prefere A ou B?" com votacao ao vivo.
// Mesmo padrao server-authoritative por sala dos outros dois minijogos.
contextBridge.exposeInMainWorld('sketchGame', {
  getState() {
    return emitAck('sketch-get-state', null).then((res) => res.state);
  },
  create(optionA, optionB) {
    return emitAck('sketch-create', { optionA, optionB });
  },
  vote(choice) {
    return emitAck('sketch-vote', { choice });
  },
  endVote() {
    return emitAck('sketch-end-vote', null);
  },
  reset() {
    return emitAck('sketch-reset', null);
  },
  onState(cb) {
    if (!socket) return;
    socket.on('sketch-state', (state) => cb(state));
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
  // Avisa o processo principal que o PROXIMO getDisplayMedia deve pular o
  // seletor e usar direto o monitor principal com o preset rapido (ver
  // quickShareRequested em main.js) - usado pelo atalho de compartilhar.
  requestQuickShare() {
    return ipcRenderer.invoke('quick-share-screen-request');
  },
});

// Ponte com o helper nativo de captura de tela sem cursor (modo "beta"),
// que usa a Desktop Duplication API diretamente em vez do capturador
// padrao do Electron - assim o cursor "fantasma" nunca aparece (ver
// comentario detalhado em main.js).
contextBridge.exposeInMainWorld('nativeScreen', {
  listMonitors() {
    return ipcRenderer.invoke('native-screen-list');
  },
  listApps() {
    return ipcRenderer.invoke('list-running-apps');
  },
  setAudioConfig(config) {
    return ipcRenderer.invoke('native-screen-set-audio', config);
  },
  start(opts) {
    return ipcRenderer.invoke('native-screen-start', opts);
  },
  stop() {
    return ipcRenderer.invoke('native-screen-stop');
  },
  onFrame(cb) {
    ipcRenderer.removeAllListeners('native-screen-frame');
    ipcRenderer.on('native-screen-frame', (event, frame) => cb(frame));
  },
});

contextBridge.exposeInMainWorld('appLinks', {
  openCredit() {
    return ipcRenderer.invoke('open-credit-link');
  },
  // Link de convite (telinhafix://join?room=X) - clicar num link assim
  // (app ja aberto ou nao) manda esse evento com o codigo da sala. Ver
  // main.js (extractInviteRoomFromArgv/sendInviteRoomToRenderer).
  onInviteRoom(cb) {
    ipcRenderer.on('invite-room', (event, { roomId }) => cb(roomId));
  },
  // navigator.clipboard.writeText() do renderer e negado pelo
  // setPermissionRequestHandler (so libera 'media') - copia via o modulo
  // nativo do Electron no processo principal em vez disso.
  copyText(text) {
    return ipcRenderer.invoke('copy-to-clipboard', text);
  },
});

contextBridge.exposeInMainWorld('appInfo', {
  version: require('./package.json').version,
});

// Atalhos de teclado globais (funcionam com o app em segundo plano).
contextBridge.exposeInMainWorld('hotkeys', {
  // state: { enabled, bindings: { stopShare, toggleMute } }. Retorna quais
  // combinacoes conseguiram ser registradas de verdade (pra avisar de
  // conflito com outro programa).
  applyState(state) {
    return ipcRenderer.invoke('hotkeys-apply-state', state);
  },
  onStopShare(cb) {
    ipcRenderer.on('global-hotkey-stop-share', cb);
  },
  onToggleMute(cb) {
    ipcRenderer.on('global-hotkey-toggle-mute', cb);
  },
  onQuickShare(cb) {
    ipcRenderer.on('global-hotkey-quick-share', cb);
  },
});
