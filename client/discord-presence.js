// Status do TelinhaFix no perfil do Discord ("Rich Presence" - o mesmo card
// que aparece quando alguem esta jogando um jogo). Fala direto com o Discord
// do computador pelo "cano" local que ele abre (\\.\pipe\discord-ipc-N), sem
// biblioteca de terceiros. Se o Discord nao estiver aberto, tenta de novo de
// tempos em tempos; quem nao quiser desliga em Configuracoes > Transmissao.
// Aplicativo no portal do Discord: "TelinhaFix" (conta do Bunny).
const net = require('net');
const crypto = require('crypto');

const CLIENT_ID = '1562621924104736879';
const RETRY_MS = 15000;
const MIN_UPDATE_GAP_MS = 4500; // o Discord aceita no maximo ~5 atualizacoes a cada 20s

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data), 'utf8');
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

function createDiscordPresence({ log = () => {} } = {}) {
  let sock = null;
  let connecting = false; // so UMA conexao por vez (duas ao mesmo tempo se derrubavam)
  let ready = false;
  let enabled = true;
  let retryTimer = null;
  let sendTimer = null;
  let lastSentAt = 0;
  let wanted = null; // atividade que deveria estar no Discord agora (null = nenhuma)
  let sentKey = undefined;
  let buffer = Buffer.alloc(0);
  let stopped = false;
  let firstReadyAt = null; // o tempo do card conta desde que o app conectou no Discord

  function scheduleRetry() {
    if (stopped || !enabled || retryTimer) return;
    retryTimer = setTimeout(() => { retryTimer = null; connect(0); }, RETRY_MS);
    retryTimer.unref?.();
  }

  function cleanup() {
    ready = false;
    sentKey = undefined;
    buffer = Buffer.alloc(0);
    if (sock) { sock.removeAllListeners(); sock.destroy(); sock = null; }
  }

  // tenta discord-ipc-0 ate discord-ipc-9 (Discord normal, PTB, Canary...)
  function connect(index) {
    if (stopped || !enabled || sock) return;
    if (index === 0) {
      if (connecting) return;
      connecting = true;
    }
    if (index > 9) { connecting = false; scheduleRetry(); return; }
    const s = net.createConnection(`\\\\?\\pipe\\discord-ipc-${index}`);
    let opened = false;
    s.once('connect', () => {
      opened = true;
      connecting = false;
      sock = s;
      s.write(encode(OP_HANDSHAKE, { v: 1, client_id: CLIENT_ID }));
    });
    s.on('data', (chunk) => { if (s === sock) onData(chunk); });
    s.on('error', () => {
      if (!opened) { s.destroy(); connect(index + 1); return; }
      if (s !== sock) return; // conexao velha: nao mexe na atual
      cleanup();
      scheduleRetry();
    });
    s.on('close', () => {
      if (!opened || s !== sock) return;
      log('[discord] desconectado');
      cleanup();
      scheduleRetry();
    });
  }

  function onData(chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 8) {
      const op = buffer.readInt32LE(0);
      const len = buffer.readInt32LE(4);
      if (buffer.length < 8 + len) return;
      let msg = null;
      try { msg = JSON.parse(buffer.subarray(8, 8 + len).toString('utf8')); } catch { msg = null; }
      buffer = buffer.subarray(8 + len);
      if (op === OP_PING && sock) sock.write(encode(OP_PONG, msg || {}));
      else if (op === OP_CLOSE) { log('[discord] o Discord fechou a conexao:', msg && msg.message); cleanup(); scheduleRetry(); }
      else if (op === OP_FRAME && msg && msg.evt === 'READY') {
        ready = true;
        if (!firstReadyAt) firstReadyAt = Date.now();
        log('[discord] conectado');
        flush(true);
      } else if (op === OP_FRAME && msg && msg.evt === 'ERROR') {
        log('[discord] erro:', msg.data && msg.data.message);
      }
    }
  }

  function flush(force) {
    if (!ready || !sock) return;
    const key = JSON.stringify(wanted);
    if (!force && key === sentKey) return;
    const wait = lastSentAt + MIN_UPDATE_GAP_MS - Date.now();
    if (wait > 0) {
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => flush(false), wait);
      return;
    }
    lastSentAt = Date.now();
    sentKey = key;
    sock.write(encode(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: wanted ? { ...wanted, timestamps: { start: firstReadyAt } } : undefined },
      nonce: crypto.randomUUID(),
    }));
  }

  return {
    start() { stopped = false; connect(0); },
    // activity: objeto no formato do Discord, ou null pra limpar
    setActivity(activity) {
      wanted = activity || null;
      flush(false);
    },
    setEnabled(on) {
      enabled = !!on;
      if (!enabled) {
        wanted = null;
        if (ready && sock) flush(true);
        setTimeout(() => { if (!enabled) cleanup(); }, 500);
      } else if (!sock) {
        connect(0);
      }
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(sendTimer);
      cleanup();
    },
  };
}

module.exports = { createDiscordPresence, DISCORD_CLIENT_ID: CLIENT_ID };
