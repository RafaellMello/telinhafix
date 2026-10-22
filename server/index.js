const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
// Senha opcional para o servidor todo. Defina a variavel de ambiente
// APP_PASSWORD no Render para exigir que todo mundo digite essa senha
// antes de entrar em qualquer sala. Deixe em branco para nao exigir.
const APP_PASSWORD = process.env.APP_PASSWORD || '';
// Senha separada so pro client administrador (ve todas as salas ativas e
// pode entrar em qualquer uma). Define na variavel de ambiente
// ADMIN_PASSWORD no Render - precisa ser DIFERENTE da APP_PASSWORD e so
// deve ser conhecida pelo dono do app. Se nao for definida, o recurso de
// admin fica completamente desligado (nenhuma senha vira admin).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// --- TURN (plano B quando a conexao direta P2P nao fecha) -------------------
// Quando a rede dos dois lados nao deixa os PCs se ligarem direto (CGNAT,
// NAT simetrico, firewall), o video passa por um servidor TURN. As
// credenciais NUNCA ficam no codigo (o repositorio e publico) - vem das
// variaveis de ambiente do Render e sao mandadas pro app no join-room:
//   TURN_ICE_SERVERS  JSON com servidores fixos, ex. ExpressTURN:
//                     [{"urls":["turn:SERVIDOR:3478","turn:SERVIDOR:3478?transport=tcp"],"username":"...","credential":"..."}]
//   METERED_TURN_URL  URL de credenciais da Metered (Open Relay), ex.
//                     https://NOMEDOAPP.metered.live/api/v1/turn/credentials?apiKey=CHAVE
// Sem nenhuma das duas, o app continua so com STUN (como antes).
const STUN_SERVER = { urls: 'stun:stun.l.google.com:19302' };
const METERED_TURN_URL = process.env.METERED_TURN_URL || '';
const METERED_REFRESH_MS = 30 * 60 * 1000;

function sanitizeIceServers(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && (typeof s.urls === 'string' || Array.isArray(s.urls)))
    .map((s) => {
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => typeof u === 'string' && /^turns?:/.test(u));
      const out = { urls };
      if (typeof s.username === 'string') out.username = s.username;
      if (typeof s.credential === 'string') out.credential = s.credential;
      return out;
    })
    .filter((s) => s.urls.length > 0);
}

let staticTurnServers = [];
try {
  staticTurnServers = sanitizeIceServers(JSON.parse(process.env.TURN_ICE_SERVERS || '[]'));
} catch (err) {
  console.error('[turn] TURN_ICE_SERVERS nao e um JSON valido - ignorando:', err.message);
}
let meteredTurnServers = [];

async function refreshMeteredTurn() {
  if (!METERED_TURN_URL) return;
  try {
    const res = await fetch(METERED_TURN_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = sanitizeIceServers(await res.json());
    if (list.length) meteredTurnServers = list;
  } catch (err) {
    console.error('[turn] falha ao buscar credenciais da Metered:', err.message);
  }
}
refreshMeteredTurn();
if (METERED_TURN_URL) setInterval(refreshMeteredTurn, METERED_REFRESH_MS).unref();

function getIceServers() {
  return [STUN_SERVER, ...staticTurnServers, ...meteredTurnServers];
}
console.log(`[turn] ${staticTurnServers.length} servidor(es) TURN fixo(s), Metered ${METERED_TURN_URL ? 'ligada' : 'desligada'}`);

const httpServer = http.createServer((req, res) => {
  // Endpoint do teste de qualidade (opcional, roda no app): o cliente manda
  // um payload de tamanho conhecido e cronometra quanto tempo demora pra
  // subir, pra estimar o upload real disponivel. So precisa drenar o corpo
  // e responder - o conteudo em si nao importa.
  if (req.method === 'POST' && req.url === '/bandwidth-test') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    req.on('data', () => {});
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }
  if (req.method === 'OPTIONS' && req.url === '/bandwidth-test') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // "De uma sugestao ao dev" (tela de entrar do app): POST /sugestao com
  // { name, text, version } - repassa pro Google Forms do Bunny (ver
  // SUGGESTION_FORM_PREFILL_URL). 1 por minuto por IP.
  if (req.url === '/sugestao' && req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }
  if (req.url === '/sugestao' && req.method === 'POST') {
    handleSuggestion(req, res);
    return;
  }

  // Musica do dia (ver handleMusic)
  if (req.url === '/musica' || req.url.startsWith('/musica/') || req.url.startsWith('/musica?')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }
    handleMusic(req, res, new URL(req.url, 'http://localhost'));
    return;
  }

  // Pagina de convite: https://.../convite/<sala>. Links telinhafix:// nao
  // ficam clicaveis no Discord/WhatsApp (so http/https), entao o botao
  // "Convidar" do app copia ESTE link - a pagina abre o TelinhaFix ja com a
  // sala (telinhafix://join?room=X) e mostra o codigo + o download pra quem
  // ainda nao tem o app.
  if (req.method === 'GET' && req.url.startsWith('/convite/')) {
    let raw = '';
    try { raw = decodeURIComponent(req.url.slice('/convite/'.length).split(/[?#]/)[0]); } catch { raw = ''; }
    const roomId = normalizeRoomId(raw);
    const valid = !!roomId && roomId.length <= MAX_ROOM_ID_LEN;
    res.writeHead(valid ? 200 : 404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src https://raw.githubusercontent.com; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    });
    res.end(renderInvitePage(valid ? roomId : null));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TelinhaFix signaling server ok');
});

// --- Sugestoes -> Google Forms ----------------------------------------------
// SUGGESTION_FORM_PREFILL_URL (variavel no Render) = o "link pre-preenchido"
// do Google Forms, gerado com NOME no campo Nome e SUGESTAO no campo
// Sugestao (e, se quiser, VERSAO num terceiro campo opcional). Daqui sai o
// endereco de envio e o "entry.N" de cada campo - nada disso fica no codigo
// (o repositorio e publico). Sem a variavel, /sugestao responde que nao
// esta configurado. Toda sugestao tambem aparece no log do Render.
function parseSuggestionForm(url) {
  try {
    const u = new URL(url);
    const fields = {};
    for (const [key, value] of u.searchParams) {
      if (!key.startsWith('entry.')) continue;
      const v = value.trim().toUpperCase();
      if (v === 'NOME') fields.name = key;
      else if (v === 'SUGESTAO' || v === 'SUGESTÃO') fields.text = key;
      else if (v === 'VERSAO' || v === 'VERSÃO') fields.version = key;
    }
    if (!fields.name || !fields.text) return null;
    return { action: u.origin + u.pathname.replace(/\/viewform$/, '/formResponse'), ...fields };
  } catch {
    return null;
  }
}
const suggestionForm = parseSuggestionForm(process.env.SUGGESTION_FORM_PREFILL_URL || '');
console.log(`[sugestao] Google Forms ${suggestionForm ? 'configurado' : 'NAO configurado'}`);
const SUGGESTION_COOLDOWN_MS = 60 * 1000;
const lastSuggestionByIp = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, at] of lastSuggestionByIp) if (now - at > SUGGESTION_COOLDOWN_MS) lastSuggestionByIp.delete(ip);
}, 5 * 60 * 1000).unref();

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function handleSuggestion(req, res) {
  let raw = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 8192) { tooBig = true; req.destroy(); }
  });
  req.on('end', async () => {
    if (tooBig) return;
    let body;
    try { body = JSON.parse(raw); } catch { return sendJson(res, 400, { ok: false, error: 'Pedido inválido' }); }
    const name = (typeof body.name === 'string' ? body.name : '').trim().slice(0, MAX_NAME_LEN) || 'Anônimo';
    const text = (typeof body.text === 'string' ? body.text : '').trim().slice(0, 1000);
    const version = (typeof body.version === 'string' ? body.version : '').slice(0, 20);
    if (!text) return sendJson(res, 400, { ok: false, error: 'Escreve a sugestão antes de enviar.' });

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const last = lastSuggestionByIp.get(ip) || 0;
    const waitMs = last + SUGGESTION_COOLDOWN_MS - Date.now();
    if (waitMs > 0) return sendJson(res, 429, { ok: false, error: `Calma! Dá pra mandar outra em ${Math.ceil(waitMs / 1000)}s.` });

    console.log(`[sugestao] ${name} (v${version || '?'}): ${text.replace(/\s+/g, ' ')}`);
    if (!suggestionForm) return sendJson(res, 503, { ok: false, error: 'As sugestões ainda não foram configuradas pelo dev.' });

    lastSuggestionByIp.set(ip, Date.now());
    const params = new URLSearchParams();
    params.set(suggestionForm.name, name);
    params.set(suggestionForm.text, text);
    if (suggestionForm.version) params.set(suggestionForm.version, version);
    try {
      const r = await fetch(suggestionForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`Google Forms respondeu ${r.status}`);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      lastSuggestionByIp.delete(ip); // falhou do nosso lado: deixa tentar de novo
      console.error('[sugestao] falha ao enviar pro Google Forms:', err.message);
      sendJson(res, 502, { ok: false, error: 'Não deu pra enviar agora. Tenta de novo daqui a pouco.' });
    }
  });
}

// --- Musica do dia -----------------------------------------------------------
// Card na tela inicial do app: uma musica por dia (trecho de 30s do Deezer,
// API publica sem chave), igual pra todo mundo. Cada PC vota em ate 3
// musicas por dia; cada voto poe a musica no fim da fila, e votar numa que
// ja esta na fila adianta ela uma posicao. A meia-noite (Brasilia) a
// primeira da fila vira a do dia; fila vazia = sorteio no "Pop All Stars"
// (top 50 pop mundial do Deezer). Fica no Upstash (memoria se desligado).
// Rotas HTTP (a tela inicial ainda nao tem socket): GET /musica,
// GET /musica/busca?q=, POST /musica/voto.
const MUSIC_DB_KEY = process.env.MUSIC_DB_KEY || 'telinhafix:music'; // env so pros testes
const MUSIC_VOTES_PER_DAY = 3;
const MUSIC_QUEUE_MAX = 200;
const MUSIC_FALLBACK_PLAYLIST = 1282483245; // Deezer "Pop All Stars"
// Primeiras musicas (pedido do Bunny): hoje NOBLE (Slowed Down) - F3miii,
// depois Dracula (with JENNIE) - Tame Impala, depois hate that i made you
// love me - Ariana Grande. So vale quando o banco ainda nao tem nada.
const MUSIC_SEED = (process.env.MUSIC_SEED || '4038764831,3818963601,4045817471').split(',').map(Number).filter(Boolean);
const DEEZER_API = process.env.DEEZER_API_URL || 'https://api.deezer.com'; // env so pros testes
let musicState = null; // { day, today, queue: [{ track, votes, by: [nome], firstAt }], history: [id], votesByDevice: { dev: [id] } }
let musicLoading = null;
let musicWriting = false;
let musicDirty = false;
const musicPreviewCache = new Map(); // id -> { url, until }
const musicSearchByIp = new Map(); // ip -> [t]

function brtDay(t = Date.now()) {
  return new Date(t + BRT_OFFSET_MS).toISOString().slice(0, 10);
}

async function deezer(pathAndQuery) {
  const r = await fetch(`${DEEZER_API}${pathAndQuery}`, { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || `Deezer respondeu ${r.status}`);
  return j;
}

function trackFromDeezer(t) {
  return {
    id: t.id,
    title: String(t.title || ''),
    artist: String((t.artist && t.artist.name) || ''),
    album: String((t.album && t.album.title) || ''),
    cover: (t.album && (t.album.cover_big || t.album.cover_medium)) || null,
    coverSmall: (t.album && (t.album.cover_medium || t.album.cover_small)) || null,
    link: t.link || null,
  };
}

// O link do trecho do Deezer expira (tem "exp=" assinado) - pega um novo
// quando estiver perto de vencer.
async function musicPreviewUrl(id) {
  const cached = musicPreviewCache.get(id);
  if (cached && cached.until > Date.now()) return cached.url;
  const t = await deezer(`/track/${id}`);
  const url = t.preview || null;
  const exp = Number((/exp=(\d+)/.exec(url || '') || [])[1]) * 1000;
  musicPreviewCache.set(id, { url, until: exp ? exp - 10 * 60 * 1000 : Date.now() + 30 * 60 * 1000 });
  return url;
}

async function pickFallbackTrack(history) {
  const j = await deezer(`/playlist/${MUSIC_FALLBACK_PLAYLIST}/tracks?limit=100`);
  const recent = new Set(history.slice(-30));
  const pool = (j.data || []).filter((t) => t.preview && t.readable !== false);
  const fresh = pool.filter((t) => !recent.has(t.id));
  const list = fresh.length ? fresh : pool;
  if (!list.length) throw new Error('playlist reserva vazia');
  return trackFromDeezer(list[Math.floor(Math.random() * list.length)]);
}

async function loadMusic() {
  if (musicState) return musicState;
  if (musicLoading) return musicLoading;
  musicLoading = (async () => {
    let saved = null;
    if (activityDbEnabled) {
      const raw = await upstash(['GET', MUSIC_DB_KEY]); // erro aqui = tenta de novo no proximo pedido
      saved = raw ? JSON.parse(raw) : null;
    }
    if (!saved || !saved.today) {
      const seed = [];
      for (const id of MUSIC_SEED) seed.push(trackFromDeezer(await deezer(`/track/${id}`)));
      const now = Date.now();
      saved = {
        day: brtDay(),
        today: seed[0] || await pickFallbackTrack([]),
        queue: seed.slice(1).map((track, i) => ({ track, votes: 1, by: ['Bunny'], firstAt: now + i })),
        history: seed.slice(0, 1).map((t) => t.id),
        votesByDevice: {},
      };
      musicState = saved;
      persistMusic();
    }
    musicState = saved;
    return musicState;
  })().finally(() => { musicLoading = null; });
  return musicLoading;
}

function persistMusic() {
  if (!activityDbEnabled) return;
  musicDirty = true;
  flushMusic();
}
async function flushMusic() {
  if (musicWriting || !musicDirty || !musicState) return;
  musicWriting = true;
  try {
    while (musicDirty) {
      musicDirty = false;
      try {
        await upstash(['SET', MUSIC_DB_KEY, JSON.stringify(musicState)]);
      } catch (err) {
        console.error('[musica] falha ao salvar no banco (tentando de novo em 10s):', err.message);
        musicDirty = true;
        setTimeout(flushMusic, 10000).unref();
        break;
      }
    }
  } finally {
    musicWriting = false;
  }
}

// Passa pra proxima musica: primeira da fila, ou sorteio se vazia.
async function advanceMusic(state) {
  const next = state.queue.shift();
  state.today = next ? next.track : await pickFallbackTrack(state.history);
  state.history.push(state.today.id);
  if (state.history.length > 200) state.history.splice(0, state.history.length - 200);
}

// Virou o dia desde a ultima vez? (se o servidor ficou dias dormindo, so
// avanca uma - ninguem ouviu as outras mesmo)
let musicAdvancing = null;
async function currentMusic() {
  const state = await loadMusic();
  if (state.day === brtDay()) return state;
  if (!musicAdvancing) {
    musicAdvancing = (async () => {
      await advanceMusic(state);
      state.day = brtDay();
      state.votesByDevice = {};
      persistMusic();
      console.log(`[musica] musica do dia ${state.day}: ${state.today.title} - ${state.today.artist}`);
    })().finally(() => { musicAdvancing = null; });
  }
  await musicAdvancing;
  return state;
}

function musicDeviceKey(deviceId) {
  if (typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 100) return null;
  return crypto.createHash('sha256').update(deviceId).digest('hex').slice(0, 24);
}

async function musicPublicView(state, deviceId) {
  const dev = musicDeviceKey(deviceId);
  const mine = (dev && state.votesByDevice[dev]) || [];
  let preview = null;
  try { preview = await musicPreviewUrl(state.today.id); } catch (err) { console.error('[musica] trecho:', err.message); }
  return {
    ok: true,
    day: state.day,
    today: { ...state.today, preview },
    queue: state.queue.slice(0, 10).map((q, i) => ({ pos: i + 1, id: q.track.id, title: q.track.title, artist: q.track.artist, coverSmall: q.track.coverSmall, votes: q.votes })),
    queueLength: state.queue.length,
    votesPerDay: MUSIC_VOTES_PER_DAY,
    votesLeft: Math.max(0, MUSIC_VOTES_PER_DAY - mine.length),
    myVotes: mine,
  };
}

function readJsonBody(req, max = 4096) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > max) { req.destroy(); resolve(null); } });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
  });
}

async function handleMusic(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/musica') {
      const state = await currentMusic();
      return sendJson(res, 200, await musicPublicView(state, url.searchParams.get('d')));
    }
    if (req.method === 'GET' && url.pathname === '/musica/busca') {
      const q = String(url.searchParams.get('q') || '').trim().slice(0, 100);
      if (q.length < 2) return sendJson(res, 400, { ok: false, error: 'Digite o nome da música' });
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const now = Date.now();
      const recent = (musicSearchByIp.get(ip) || []).filter((t) => now - t < 60000);
      if (recent.length >= 30) return sendJson(res, 429, { ok: false, error: 'Muitas buscas seguidas - espera um pouquinho' });
      recent.push(now);
      musicSearchByIp.set(ip, recent);
      const j = await deezer(`/search?q=${encodeURIComponent(q)}&limit=10`);
      const results = (j.data || []).filter((t) => t.preview && t.readable !== false).slice(0, 5)
        .map((t) => ({ ...trackFromDeezer(t), preview: t.preview }));
      return sendJson(res, 200, { ok: true, results });
    }
    if (req.method === 'POST' && url.pathname === '/musica/voto') {
      const body = await readJsonBody(req);
      if (!body) return sendJson(res, 400, { ok: false, error: 'Pedido inválido' });
      const dev = musicDeviceKey(body.deviceId);
      const trackId = Number(body.trackId);
      const name = (typeof body.name === 'string' ? body.name : '').trim().slice(0, MAX_NAME_LEN) || 'Anônimo';
      if (!dev || !Number.isInteger(trackId) || trackId <= 0) return sendJson(res, 400, { ok: false, error: 'Pedido inválido' });
      const state = await currentMusic();
      const mine = state.votesByDevice[dev] || [];
      if (mine.length >= MUSIC_VOTES_PER_DAY) return sendJson(res, 429, { ok: false, error: `Você já usou seus ${MUSIC_VOTES_PER_DAY} votos de hoje - volta amanhã!` });
      if (mine.includes(trackId)) return sendJson(res, 409, { ok: false, error: 'Você já votou nessa hoje' });
      if (state.today.id === trackId) return sendJson(res, 409, { ok: false, error: 'Essa já é a música de hoje!' });
      let i = state.queue.findIndex((q) => q.track.id === trackId);
      if (i >= 0) {
        // ja esta na fila: o voto adianta ela uma posicao
        const item = state.queue[i];
        item.votes += 1;
        if (!item.by.includes(name)) item.by.push(name);
        if (i > 0) { state.queue.splice(i, 1); state.queue.splice(i - 1, 0, item); i -= 1; }
      } else {
        if (state.queue.length >= MUSIC_QUEUE_MAX) return sendJson(res, 429, { ok: false, error: 'A fila está cheia - tenta amanhã' });
        const t = await deezer(`/track/${trackId}`);
        if (!t.preview || t.readable === false) return sendJson(res, 400, { ok: false, error: 'Essa música não tem trecho pra tocar - escolhe outra versão' });
        state.queue.push({ track: trackFromDeezer(t), votes: 1, by: [name], firstAt: Date.now() });
        i = state.queue.length - 1;
      }
      state.votesByDevice[dev] = mine.concat(trackId);
      persistMusic();
      const view = await musicPublicView(state, body.deviceId);
      return sendJson(res, 200, { ...view, position: i + 1 });
    }
    return sendJson(res, 404, { ok: false, error: 'não encontrado' });
  } catch (err) {
    console.error('[musica] falha:', err.message);
    return sendJson(res, 502, { ok: false, error: 'Não deu pra falar com o Deezer agora. Tenta de novo daqui a pouco.' });
  }
}

const INVITE_LOGO_URL ='https://raw.githubusercontent.com/RafaellMello/telinhafix/master/client/renderer/assets/logo.png';
const DOWNLOAD_URL = 'https://telinhafix.site'; // site do TelinhaFix (tem o download)

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderInvitePage(roomId) {
  const title = roomId ? `Convite pra sala "${roomId}" no TelinhaFix` : 'Convite inválido - TelinhaFix';
  const deepLink = roomId ? `telinhafix://join?room=${encodeURIComponent(roomId)}` : '';
  const room = roomId ? escapeHtml(roomId) : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${roomId ? 'Clique pra entrar na sala com a galera no TelinhaFix.' : 'Esse link de convite não é válido.'}">
<meta property="og:image" content="${INVITE_LOGO_URL}">
<meta property="og:site_name" content="TelinhaFix">
<meta name="theme-color" content="#e0262f">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: #060607; color: #f2f2f2; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { width: 100%; max-width: 420px; text-align: center; background: #121214; border: 1px solid #26262a;
    border-radius: 16px; padding: 32px 24px; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
  img { width: 72px; height: 72px; border-radius: 16px; }
  h1 { font-size: 20px; margin: 16px 0 6px; }
  p { color: #a7a7ad; margin: 0 0 20px; line-height: 1.45; }
  .code { display: inline-block; font-size: 22px; font-weight: 800; letter-spacing: .5px; padding: 8px 16px;
    border-radius: 10px; background: #1d1d21; border: 1px dashed #e0262f; margin-bottom: 20px; word-break: break-all; }
  a.btn, button { display: block; width: 100%; padding: 13px; border-radius: 10px; font-size: 15px; font-weight: 700;
    text-decoration: none; border: 0; cursor: pointer; margin-top: 10px; font-family: inherit; }
  .primary { background: #e0262f; color: #fff; }
  .secondary { background: #1d1d21; color: #f2f2f2; border: 1px solid #2c2c31; }
  small { display: block; margin-top: 18px; color: #77777d; }
</style>
</head>
<body>
<main class="card">
  <img src="${INVITE_LOGO_URL}" alt="">
${roomId ? `  <h1>Você foi convidado pro TelinhaFix</h1>
  <p>Sala</p>
  <div class="code" id="code">${room}</div>
  <a class="btn primary" href="${escapeHtml(deepLink)}">Abrir no TelinhaFix</a>
  <button class="secondary" id="copy" type="button">Copiar código da sala</button>
  <a class="btn secondary" href="${DOWNLOAD_URL}">Não tenho o TelinhaFix - baixar</a>
  <small>Se o app não abrir sozinho, abra o TelinhaFix e digite o código da sala.</small>
<script>
  setTimeout(function () { window.location.href = ${JSON.stringify(deepLink).replace(/</g, '\\u003c')}; }, 400);
  document.getElementById('copy').addEventListener('click', function () {
    var btn = this;
    navigator.clipboard.writeText(document.getElementById('code').textContent).then(function () {
      btn.textContent = 'Código copiado!';
      setTimeout(function () { btn.textContent = 'Copiar código da sala'; }, 2000);
    });
  });
</script>` : `  <h1>Convite inválido</h1>
  <p>Esse link de convite não é válido. Peça um novo pra quem te convidou.</p>
  <a class="btn secondary" href="${DOWNLOAD_URL}">Baixar o TelinhaFix</a>`}
</main>
</body>
</html>`;
}

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// roomId -> Map<socketId, { name }>
const rooms = new Map();

// Banco de palavras do minijogo "Codigo Secreto" (Codenames) - precisa de
// pelo menos 25 pra montar um tabuleiro; bem mais que isso pra nao repetir
// toda hora entre partidas seguidas no mesmo grupo.
const CODENAMES_WORDS = [
  'CASTELO', 'LUA', 'MÉDICO', 'BANANA', 'AVIÃO', 'ROBÔ', 'PRAIA', 'PIRATA', 'GELO',
  'REI', 'ÁGUIA', 'BANCO', 'FOGO', 'MOUSE', 'MARTE', 'ESCOLA', 'CHAVE', 'CACHORRO',
  'RIO', 'COROA', 'TELEFONE', 'DRAGÃO', 'MÚSICA', 'PONTE', 'NEVE', 'GATO', 'LEÃO',
  'CARRO', 'SOL', 'ESPAÇO', 'SATURNO', 'SERPENTE', 'FLORESTA', 'MONTANHA', 'OCEANO', 'DESERTO',
  'VULCÃO', 'CHURRASCO', 'PROFESSOR', 'ENGENHEIRO', 'ADVOGADO', 'BOMBEIRO', 'POLICIAL', 'ASTRONAUTA', 'CIENTISTA',
  'PINTOR', 'MÚSICO', 'ATOR', 'JORNALISTA', 'COZINHEIRO', 'ELEFANTE', 'GIRAFA', 'MACACO', 'TIGRE',
  'URSO', 'LOBO', 'RAPOSA', 'COBRA', 'TARTARUGA', 'GOLFINHO', 'TUBARÃO', 'BALEIA', 'POLVO',
  'CAMALEÃO', 'PINGUIM', 'CANGURU', 'ZEBRA', 'RINOCERONTE', 'HIPOPÓTAMO', 'COMPUTADOR', 'CELULAR', 'TECLADO',
  'MONITOR', 'IMPRESSORA', 'FONE', 'CÂMERA', 'RELÓGIO', 'ÓCULOS', 'BICICLETA', 'MOTO', 'TREM',
  'NAVIO', 'FOGUETE', 'HELICÓPTERO', 'METRÔ', 'ÔNIBUS', 'CAMINHÃO', 'ESTRADA', 'TÚNEL', 'FAROL',
  'BÚSSOLA', 'MAPA', 'TESOURO', 'BAÚ', 'MOEDA', 'DIAMANTE', 'OURO', 'PRATA', 'ANEL',
  'ESPADA', 'ESCUDO', 'ARCO', 'FLECHA', 'ARMADURA', 'CAVALEIRO', 'PRINCESA', 'BRUXA', 'FANTASMA',
  'VAMPIRO', 'ZUMBI', 'MONSTRO', 'LABIRINTO', 'TORRE', 'MURALHA', 'PORTÃO', 'JARDIM', 'FONTE',
  'ESTÁTUA', 'IGREJA', 'TEMPLO', 'PIRÂMIDE', 'MÚMIA', 'FARAÓ', 'OÁSIS', 'CAMELO', 'CACTO',
  'TERREMOTO', 'FURACÃO', 'TEMPESTADE', 'RAIO', 'TROVÃO', 'ARCO-ÍRIS', 'NUVEM', 'CHUVA', 'GRANIZO',
  'GELEIRA', 'ILHA', 'CACHOEIRA', 'LAGO', 'PÂNTANO', 'CAVERNA', 'ROCHA', 'AREIA', 'CONCHA',
  'CORAL', 'RECIFE', 'PEIXE', 'CAVALO-MARINHO', 'CARANGUEJO', 'LAGOSTA', 'GAIVOTA', 'PELICANO', 'CORUJA',
  'MORCEGO', 'ARANHA', 'ESCORPIÃO', 'FORMIGA', 'ABELHA', 'BORBOLETA', 'GAFANHOTO', 'JOANINHA', 'VIOLÃO',
  'PIANO', 'BATERIA', 'GUITARRA', 'TROMPETE', 'FLAUTA', 'MICROFONE', 'PALCO', 'TEATRO', 'CINEMA',
  'LIVRO', 'CADERNO', 'LÁPIS', 'CANETA', 'TINTA', 'PINCEL', 'TELA', 'QUADRO', 'ESCULTURA',
  'MUSEU', 'BIBLIOTECA', 'HOSPITAL', 'FARMÁCIA', 'MERCADO', 'PADARIA', 'RESTAURANTE', 'HOTEL', 'AEROPORTO',
  'ESTAÇÃO', 'FÁBRICA', 'USINA', 'FAZENDA', 'CELEIRO', 'TRATOR', 'MOINHO', 'PLANTAÇÃO', 'COLHEITA',
  'SEMENTE', 'CABEÇA', 'OLHO', 'NARIZ', 'BOCA', 'ORELHA', 'DENTE', 'LÍNGUA', 'PESCOÇO',
  'OMBRO', 'BRAÇO', 'COTOVELO', 'PULSO', 'MÃO', 'DEDO', 'UNHA', 'PEITO', 'COSTAS',
  'BARRIGA', 'UMBIGO', 'QUADRIL', 'PERNA', 'JOELHO', 'TORNOZELO', 'PÉ', 'CALCANHAR', 'CABELO',
  'SOBRANCELHA', 'CÍLIO', 'QUEIXO', 'TESTA', 'BOCHECHA', 'CORAÇÃO', 'PULMÃO', 'FÍGADO', 'RIM',
  'ESTÔMAGO', 'CÉREBRO', 'OSSO', 'MÚSCULO', 'SANGUE', 'PELE', 'VEIA', 'CAMISA', 'CALÇA',
  'VESTIDO', 'SAIA', 'CASACO', 'JAQUETA', 'BONÉ', 'CHAPÉU', 'LUVA', 'CINTO', 'GRAVATA',
  'MEIA', 'SAPATO', 'TÊNIS', 'SANDÁLIA', 'BOTA', 'BOLSA', 'MOCHILA', 'CARTEIRA', 'PULSEIRA',
  'COLAR', 'BRINCO', 'CACHECOL', 'PIJAMA', 'UNIFORME', 'AVENTAL', 'TOUCA', 'CUECA', 'SUNGA',
  'BIQUÍNI', 'ARROZ', 'FEIJÃO', 'MACARRÃO', 'PIZZA', 'HAMBÚRGUER', 'SANDUÍCHE', 'SALADA', 'SOPA',
  'OMELETE', 'PÃO', 'QUEIJO', 'PRESUNTO', 'MANTEIGA', 'LEITE', 'IOGURTE', 'SORVETE', 'CHOCOLATE',
  'BOLO', 'TORTA', 'BISCOITO', 'PIPOCA', 'AMENDOIM', 'CASTANHA', 'MEL', 'AÇÚCAR', 'SAL',
  'PIMENTA', 'ALHO', 'CEBOLA', 'TOMATE', 'BATATA', 'CENOURA', 'ALFACE', 'REPOLHO', 'BRÓCOLIS',
  'MILHO', 'UVA', 'MAÇÃ', 'LARANJA', 'LIMÃO', 'MORANGO', 'MELANCIA', 'ABACAXI', 'MAMÃO',
  'MANGA', 'PERA', 'PÊSSEGO', 'COCO', 'ABACATE', 'GOIABA', 'CAFÉ', 'CHÁ', 'SUCO',
  'ÁGUA', 'CERVEJA', 'VINHO', 'REFRIGERANTE', 'FUTEBOL', 'BASQUETE', 'VÔLEI', 'NATAÇÃO', 'CORRIDA',
  'CICLISMO', 'BOXE', 'JUDÔ', 'KARATÊ', 'SURF', 'SKATE', 'XADREZ', 'DOMINÓ', 'BARALHO',
  'DADO', 'PIPA', 'BOLA', 'RAQUETE', 'CAPACETE', 'PATINS', 'PRANCHA', 'REDE', 'GOL',
  'QUADRA', 'PISCINA', 'GINÁSIO', 'MEDALHA', 'TROFÉU', 'CAMPEONATO', 'ÁRBITRO', 'TIME', 'DENTISTA',
  'VETERINÁRIO', 'PSICÓLOGO', 'ENFERMEIRO', 'FARMACÊUTICO', 'MOTORISTA', 'PILOTO', 'MARINHEIRO', 'SOLDADO', 'GENERAL',
  'JUIZ', 'PROMOTOR', 'CONTADOR', 'BANCÁRIO', 'VENDEDOR', 'GARÇOM', 'CABELEIREIRO', 'ELETRICISTA', 'ENCANADOR',
  'PEDREIRO', 'CARPINTEIRO', 'MECÂNICO', 'ALFAIATE', 'PADEIRO', 'AÇOUGUEIRO', 'AGRICULTOR', 'PESCADOR', 'CAÇADOR',
  'MINERADOR', 'COSTUREIRA', 'FOTÓGRAFO', 'ESCRITOR', 'POETA', 'PALHAÇO', 'MÁGICO', 'DOMADOR', 'ACROBATA',
  'CASA', 'APARTAMENTO', 'PRÉDIO', 'ARRANHA-CÉU', 'GARAGEM', 'PORÃO', 'SÓTÃO', 'VARANDA', 'TELHADO',
  'PAREDE', 'JANELA', 'PORTA', 'ESCADA', 'ELEVADOR', 'CORREDOR', 'QUARTO', 'SALA', 'COZINHA',
  'BANHEIRO', 'QUINTAL', 'CONDOMÍNIO', 'BAIRRO', 'CIDADE', 'VILA', 'ALDEIA', 'CAPITAL', 'PRAÇA',
  'PARQUE', 'ZOOLÓGICO', 'AQUÁRIO', 'PLANETÁRIO', 'ESTÁDIO', 'SHOPPING', 'FEIRA', 'CEMITÉRIO', 'PRISÃO',
  'QUARTEL', 'EMBAIXADA', 'PALÁCIO', 'FORTALEZA', 'MOSTEIRO', 'SINAGOGA', 'MESQUITA', 'INTERNET', 'SENHA',
  'ARQUIVO', 'PASTA', 'PROGRAMA', 'APLICATIVO', 'SITE', 'VIDEOGAME', 'CONTROLE', 'CARREGADOR', 'CABO',
  'ANTENA', 'SATÉLITE', 'DRONE', 'TABLET', 'NOTEBOOK', 'PENDRIVE', 'WEBCAM', 'PROJETOR', 'TELEVISÃO',
  'MICROONDAS', 'GELADEIRA', 'FOGÃO', 'LIQUIDIFICADOR', 'TORRADEIRA', 'ASPIRADOR', 'VENTILADOR', 'LÂMPADA', 'INTERRUPTOR',
  'TOMADA', 'DISJUNTOR', 'ÁRVORE', 'FOLHA', 'GALHO', 'RAIZ', 'TRONCO', 'FLOR', 'PÉTALA',
  'GRAMA', 'MATO', 'ARBUSTO', 'SAMAMBAIA', 'MUSGO', 'COGUMELO', 'BAMBU', 'PINHEIRO', 'CARVALHO',
  'PALMEIRA', 'IPÊ', 'ORQUÍDEA', 'ROSA', 'GIRASSOL', 'MARGARIDA', 'TULIPA', 'LÍRIO', 'CRAVO',
  'VIOLETA', 'JASMIM', 'GALÁXIA', 'COMETA', 'METEORO', 'ASTEROIDE', 'ECLIPSE', 'CONSTELAÇÃO', 'PLANETA',
  'ÓRBITA', 'GRAVIDADE', 'NEBULOSA', 'SUPERNOVA', 'TELESCÓPIO', 'OBSERVATÓRIO', 'VENTO', 'BRISA', 'NEBLINA',
  'ORVALHO', 'MARÉ', 'ONDA', 'PLANALTO', 'PLANÍCIE', 'VALE', 'COLINA', 'PENHASCO', 'FALÉSIA',
  'DUNA', 'SAVANA', 'TUNDRA', 'SELVA', 'MANGUE', 'DELTA', 'FOZ', 'NASCENTE', 'AFLUENTE',
  'CONTINENTE', 'HEMISFÉRIO', 'EQUADOR', 'UNICÓRNIO', 'FÊNIX', 'GRIFO', 'CENTAURO', 'SEREIA', 'MINOTAURO',
  'CÍCLOPE', 'TITÃ', 'ORÁCULO', 'FEITICEIRO', 'DUENDE', 'FADA', 'GNOMO', 'TROLL', 'OGRO',
  'ELFO', 'ANÃO', 'GIGANTE', 'LOBISOMEM', 'HIDRA', 'QUIMERA', 'PÉGASO', 'CARROÇA', 'CHARRETE',
  'BALSA', 'IATE', 'SUBMARINO', 'TELEFÉRICO', 'BONDE', 'PATINETE', 'TRICICLO', 'VAN', 'CARAVANA',
  'LIMUSINE', 'AMBULÂNCIA', 'VIATURA', 'GUINCHO', 'EMPILHADEIRA', 'GUINDASTE', 'SAXOFONE', 'CLARINETE', 'TROMBONE',
  'HARPA', 'VIOLINO', 'VIOLONCELO', 'CONTRABAIXO', 'PANDEIRO', 'TAMBOR', 'XILOFONE', 'SINO', 'GAITA',
  'ACORDEÃO', 'BANDOLIM', 'CAVAQUINHO', 'BERIMBAU', 'MARACÁ', 'CHOCALHO', 'PARTITURA', 'ORQUESTRA', 'BALÉ',
  'DANÇA', 'ÓPERA', 'GUARDA-CHUVA', 'LANTERNA', 'VELA', 'FÓSFORO', 'ISQUEIRO', 'CORDA', 'CORRENTE',
  'CADEADO', 'FECHADURA', 'PARAFUSO', 'PREGO', 'MARTELO', 'SERROTE', 'ALICATE', 'FITA-ADESIVA', 'COLA',
  'AGULHA', 'LINHA', 'BOTÃO', 'ZÍPER', 'ESPELHO', 'PENTE', 'ESCOVA', 'SABONETE', 'SHAMPOO',
  'TOALHA', 'TRAVESSEIRO', 'COBERTOR', 'LENÇOL', 'COLCHÃO', 'CORTINA', 'TAPETE', 'VASSOURA', 'RODO',
  'BALDE', 'ESPONJA', 'PANO', 'ESTOJO', 'BORRACHA', 'APONTADOR', 'RÉGUA', 'COMPASSO', 'CALCULADORA',
  'GLOBO', 'LOUSA', 'GIZ', 'DIPLOMA', 'BOLETIM', 'PROVA', 'REDAÇÃO', 'UNIVERSIDADE', 'FACULDADE',
  'LABORATÓRIO', 'LEOPARDO', 'PANTERA', 'GUEPARDO', 'HIENA', 'CHACAL', 'BISÃO', 'BÚFALO', 'ALCE',
  'VEADO', 'COELHO', 'ESQUILO', 'OURIÇO', 'TOUPEIRA', 'MORSA', 'FOCA', 'LONTRA', 'CASTOR',
  'GAMBÁ', 'TATU', 'PREGUIÇA', 'ONÇA', 'PUMA', 'LINCE', 'AVESTRUZ', 'FLAMINGO', 'CISNE',
  'PATO', 'GANSO', 'PERU', 'GALINHA', 'GALO', 'PINTO', 'POMBO', 'PAPAGAIO', 'ARARA',
  'TUCANO', 'BEIJA-FLOR', 'FALCÃO', 'GAVIÃO', 'URUBU', 'CORVO', 'PICA-PAU', 'SABIÁ', 'CANÁRIO',
  'PERIQUITO', 'IGUANA', 'LAGARTO', 'CROCODILO', 'JACARÉ', 'SALAMANDRA', 'SAPO', 'RÃ', 'LESMA',
  'MINHOCA', 'CENTOPEIA', 'LACRAIA', 'GRILO', 'BESOURO', 'VAGA-LUME', 'MOSCA', 'MOSQUITO', 'PULGA',
  'PIOLHO', 'LAGARTA', 'AMOR', 'ÓDIO', 'MEDO', 'CORAGEM', 'PAZ', 'GUERRA', 'LIBERDADE',
  'JUSTIÇA', 'VERDADE', 'MENTIRA', 'SONHO', 'PESADELO', 'MEMÓRIA', 'ESPERANÇA', 'SORTE', 'DESTINO',
  'TEMPO', 'SILÊNCIO', 'BARULHO', 'LUZ', 'SOMBRA', 'ESCURIDÃO', 'CALOR', 'FRIO', 'VELOCIDADE',
  'FORÇA', 'PODER', 'MAGIA', 'AZAR', 'SAMBA', 'CARNAVAL', 'FOLIA', 'FEIJOADA', 'CAIPIRINHA',
  'VIOLA', 'FORRÓ', 'FREVO', 'CAPOEIRA', 'CORDEL', 'RENDA', 'ARTESANATO', 'QUADRILHA', 'FOGUEIRA',
  'BALÃO', 'BANDEIRA', 'HINO', 'SELEÇÃO', 'TORCIDA', 'ANDAIME', 'CIMENTO', 'TIJOLO', 'CONCRETO',
  'VIGA', 'COLUNA', 'ALICERCE', 'TELHA', 'CANO', 'TORNEIRA', 'VÁLVULA', 'FIO-ELÉTRICO', 'JANEIRO',
  'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO',
  'NOVEMBRO', 'DEZEMBRO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO',
  'CÍRCULO', 'QUADRADO', 'TRIÂNGULO', 'RETÂNGULO', 'CUBO', 'ESFERA', 'ÂNGULO', 'SIMETRIA', 'METAL',
  'FERRO', 'AÇO', 'COBRE', 'BRONZE', 'ALUMÍNIO', 'CHUMBO', 'ESTANHO', 'PLÁSTICO', 'VIDRO',
  'MADEIRA', 'PAPEL', 'TECIDO', 'COURO', 'SEDA', 'ALGODÃO', 'LINHO', 'VERNIZ', 'CERÂMICA',
  'PORCELANA', 'ARGILA', 'PEDRA', 'MÁRMORE', 'GRANITO', 'CARVÃO', 'PETRÓLEO', 'GASOLINA', 'DIESEL',
  'ENERGIA', 'ELETRICIDADE', 'ASTRÔNOMO', 'BIÓLOGO', 'QUÍMICO',
  'FÍSICO', 'MATEMÁTICO', 'HISTORIADOR', 'GEÓGRAFO', 'FILÓSOFO', 'ARQUITETO', 'DESIGNER', 'PROGRAMADOR', 'TRADUTOR',
  'INTÉRPRETE', 'DIPLOMATA', 'EMBAIXADOR', 'SENADOR', 'DEPUTADO', 'PREFEITO', 'GOVERNADOR', 'PRESIDENTE', 'REPÓRTER',
  'APRESENTADOR', 'LOCUTOR', 'DIRETOR', 'PRODUTOR', 'ROTEIRISTA', 'DUBLADOR', 'MODELO', 'ESTILISTA', 'JOALHEIRO',
  'RELOJOEIRO', 'MARCENEIRO', 'VIDRACEIRO', 'SERRALHEIRO', 'JARDINEIRO', 'ZELADOR', 'PORTEIRO', 'SEGURANÇA', 'DETETIVE',
  'ESPIÃO', 'BIBLIOTECÁRIO', 'APICULTOR',
  'GARRAFA', 'COPO', 'XÍCARA', 'PRATO', 'TIGELA', 'PANELA', 'FRIGIDEIRA', 'TALHER', 'GARFO',
  'FACA', 'COLHER', 'BANDEJA', 'JARRA', 'SALEIRO', 'AÇUCAREIRO', 'CORTADOR', 'RALADOR', 'PENEIRA',
  'FUNIL', 'ABRIDOR', 'SACA-ROLHAS', 'PÁ', 'ENXADA', 'REGADOR', 'TESOURA', 'CESTA',
  'SACOLA', 'MALA', 'BAGAGEM', 'CANIVETE', 'BARRACA', 'SACO-DE-DORMIR', 'CANTIL', 'TERMOS',
  'PUDIM', 'BRIGADEIRO', 'BEIJINHO', 'PAÇOCA', 'CANJICA', 'PAMONHA', 'CURAU', 'RAPADURA', 'COCADA',
  'QUINDIM', 'ROSCA', 'PANETONE', 'COLOMBA', 'OVO-DE-PÁSCOA', 'BOMBOM', 'TRUFA', 'MARSHMALLOW', 'CHICLETE',
  'PIRULITO', 'BALA', 'GOMA', 'GELATINA', 'MOUSSE', 'MILK-SHAKE', 'AÇAÍ', 'TAPIOCA', 'CUSCUZ',
  'CANJA', 'VATAPÁ', 'ACARAJÉ', 'COXINHA', 'PASTEL', 'ESFIHA', 'KIBE', 'EMPADA', 'QUIBE',
  'ALEGRIA', 'TRISTEZA', 'RAIVA', 'INVEJA', 'CIÚME', 'ORGULHO', 'VERGONHA', 'CULPA', 'SAUDADE',
  'NOSTALGIA', 'ANSIEDADE', 'CALMA', 'PACIÊNCIA', 'GRATIDÃO', 'COMPAIXÃO', 'EMPATIA', 'SOLIDÃO', 'AMIZADE',
  'CONFIANÇA', 'DÚVIDA', 'CURIOSIDADE', 'SURPRESA', 'CHOQUE', 'ALÍVIO', 'EUFORIA', 'TÉDIO', 'FRUSTRAÇÃO',
  'SATISFAÇÃO', 'ARREPENDIMENTO', 'PERDÃO', 'LUA-CHEIA', 'ESTRELA-CADENTE', 'VIA-LÁCTEA', 'BURACO-NEGRO', 'UNIVERSO', 'SISTEMA-SOLAR',
  'MERCÚRIO', 'VÊNUS', 'JÚPITER', 'URANO', 'NETUNO', 'PLUTÃO', 'ESTAÇÃO-ESPACIAL', 'TRAJE-ESPACIAL',
  'ÁTOMO', 'MOLÉCULA', 'CÉLULA', 'DNA', 'GENE', 'VÍRUS', 'BACTÉRIA', 'VACINA', 'MICROSCÓPIO',
  'ÍMÃ', 'PILHA', 'CIRCUITO', 'ALAVANCA',
  'MOLA', 'PÊNDULO', 'PRISMA', 'LENTE', 'RAIO-LASER', 'GUARDA-SOL', 'CADEIRA-DE-PRAIA', 'CANGA',
  'BOIA', 'PRANCHA-DE-SURF', 'BARCO-A-VELA', 'JANGADA', 'FOGOS-DE-ARTIFÍCIO', 'CONFETE', 'SERPENTINA', 'FANTASIA', 'MÁSCARA',
  'CONVITE', 'PRESENTE', 'ENFEITE', 'GUIRLANDA', 'ÁRVORE-DE-NATAL', 'PAPAI-NOEL', 'COELHO-DA-PÁSCOA', 'AMIGO-OCULTO', 'RELÂMPAGO',
  'MARÉ-ALTA', 'MARÉ-BAIXA', 'TSUNAMI', 'AVALANCHE', 'DESMORONAMENTO', 'INCÊNDIO', 'EXPLOSÃO', 'FUMAÇA', 'CINZAS',
  'LAVA', 'MAGMA', 'CRATERA', 'TERMÔMETRO', 'PARA-RAIOS',
  'FILTRO-SOLAR', 'PROTETOR', 'CURATIVO', 'GESSO', 'MULETA', 'CADEIRA-DE-RODAS', 'BENGALA', 'ANDADOR', 'SERINGA',
  'RAIO-X', 'POLEGAR', 'ASA', 'GRÃO', 'MARFIM', 'SECRETÁRIA',
  'FRENTE', 'CASCA', 'BERMUDA', 'NOÉ', 'DOENÇA', 'BEBIDA', 'ELÉTRICO', 'SINAL', 'JORNADA',
  'MOLHO', 'PERUCA', 'ATLÂNTIDA', 'NAVE', 'CONTRATO', 'ERVA', 'DEPÓSITO', 'ESTÁBULO', 'CELA',
  'MILIONÁRIO', 'CAPITÃO', 'PARAQUEDAS', 'LATA', 'JULGAMENTO', 'GARRA', 'BACON',
];

// Categoria "Counter-Strike" (escolhida no lobby): armas, mapas, girias,
// patentes, jogadores e callouts da Mirage. A "Normal" e a CODENAMES_WORDS.
const CODENAMES_CS_WORDS = [
  'AK-47', 'M4A4', 'M4A1-S', 'AWP', 'DEAGLE', 'GLOCK', 'USP-S', 'P250', 'FIVE-SEVEN', 'TEC-9', 'CZ75',
  'BERETAS', 'P2000', 'FAMAS', 'GALIL', 'AUG', 'SG553', 'SSG08', 'TECO-TECO', 'MP9', 'MAC-10', 'MP7',
  'MP5-SD', 'UMP45', 'P90', 'PP-BIZON', 'NOVA', 'XM1014', 'MAG-7', 'SAWED-OFF', 'M249', 'NEGEV', 'ZEUS',
  'KEVLAR', 'CAPACETE', 'GRANADA', 'FLASHBANG', 'SMOKE', 'MOLOTOV', 'C4', 'DEFUSE', 'KIT', 'HEADSHOT',
  'VARADO', 'PREFIRE', 'SPRAY', 'FLICK', 'CLUTCH', 'ACE', 'ONE-TAP', 'NOSCOPE', 'RELOAD', 'PISTOL',
  'OVERPASS', 'MIRAGE', 'INFERNO', 'DUST2', 'NUKE', 'ANCIENT', 'ANUBIS', 'VERTIGO', 'TRAIN', 'CACHE',
  'COBBLESTONE', 'OFFICE', 'SHORTDUST', 'FACEIT', 'PREMIER', 'WINGMAN', 'DEATHMATCH', 'RETAKES',
  'CORRIDA-ARMADA', 'MM', 'ELO', 'RATING', 'RANK', 'GLOBAL', 'ÁGUIA', 'XERIFE', 'PRATA', 'OURO', 'SMURF',
  'PEZINHO', 'HACKER', 'BAN', 'REPORT', 'DEMO', 'PING', 'LAG', 'FPS', 'IGL', 'ENTRYFRAGGER', 'AWPER',
  'LURKER', 'SUPPORT', 'COACH', 'BAITER', 'TOPFRAG', 'BOTTOMFRAG', 'MVP', 'KDA', 'BOT', 'NOOB', 'TRYHARD',
  'AFK', 'DISCONNECT', 'KICK', 'FALLEN', 'COLDZERA', 'FER', 'KSCERATO', 'BOLTZ', 'TAPETE', 'VAN', 'FOREST',
  'NINJA', 'B', 'SOMBRA', 'COZINHA', 'MERCADO', 'TV', 'L', 'RATO', 'MOSCOW', 'ESQUINA', 'CARROÇA', 'JANELÃO',
  'BANCO', 'CADEIRA', 'BASE TR', 'LIGA', 'CABECINHA', 'SANDUÍCHE', 'TETRIS', 'CAVERNA', 'AREIA',
  'CAIXA FOGO', 'A', 'NEWBA', 'BASE CT',
];

const CODENAMES_CATEGORIES = { normal: CODENAMES_WORDS, cs: CODENAMES_CS_WORDS };
const DEFAULT_CODENAMES_CATEGORY = 'normal';

// --- Listas de palavras do pessoal (Codenames) --------------------------
// Cada sala (codigo) tem as proprias listas, criadas por quem joga e
// guardadas pra proxima vez (no Upstash quando ligado; senao so na memoria,
// e somem quando o servidor reinicia). Categoria "custom:<id>" no jogo.
const WORDLIST_MIN_WORDS = 25;
const WORDLIST_MAX_WORDS = 500;
const WORDLIST_MAX_WORD_LEN = 20;
const WORDLIST_MAX_NAME_LEN = 30;
const WORDLIST_MAX_PER_ROOM = 30;
const WORDLISTS_DB_KEY = process.env.WORDLISTS_DB_KEY || 'telinhafix:wordlists'; // env so pros testes
const wordListsByRoom = new Map(); // roomId -> [{ id, name, author, words, createdAt, updatedAt }]
const wordListsLoading = new Map(); // roomId -> Promise

// "a, b\nc" -> ['A', 'B', 'C'] (maiusculas, sem repetidas, sem espacos sobrando)
function parseWordListText(raw) {
  const words = [];
  const seen = new Set();
  const tooLong = [];
  String(raw || '').split(/[\n,;]+/).forEach((w) => {
    const word = w.replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
    if (!word) return;
    if (word.length > WORDLIST_MAX_WORD_LEN) { tooLong.push(word); return; }
    if (seen.has(word)) return;
    seen.add(word);
    words.push(word);
  });
  return { words, tooLong };
}

function wordListMeta(list) {
  return { id: list.id, name: list.name, author: list.author, count: list.words.length };
}

function customListsOf(roomId) {
  return (wordListsByRoom.get(roomId) || []).map(wordListMeta);
}

// Carrega as listas da sala do banco (uma vez por sala enquanto o servidor
// estiver ligado). Sem banco: comeca vazio.
function loadRoomWordLists(roomId) {
  if (wordListsByRoom.has(roomId)) return Promise.resolve(wordListsByRoom.get(roomId));
  if (wordListsLoading.has(roomId)) return wordListsLoading.get(roomId);
  const p = (async () => {
    let lists = [];
    if (activityDbEnabled) {
      try {
        const raw = await upstash(['HGET', WORDLISTS_DB_KEY, roomId]);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) lists = parsed.filter((l) => l && l.id && Array.isArray(l.words));
      } catch (err) {
        console.error('[listas] falha ao ler do banco:', err.message);
      }
    }
    if (!wordListsByRoom.has(roomId)) wordListsByRoom.set(roomId, lists);
    wordListsLoading.delete(roomId);
    return wordListsByRoom.get(roomId);
  })();
  wordListsLoading.set(roomId, p);
  return p;
}

// Gravacoes uma de cada vez e sempre com o estado mais novo da sala - duas
// gravacoes ao mesmo tempo podiam chegar fora de ordem no banco e deixar
// uma versao velha salva por cima da nova.
const wordListsDirty = new Set();
let wordListsWriting = false;
let wordListsRetryTimer = null;
function persistRoomWordLists(roomId) {
  if (!activityDbEnabled) return;
  wordListsDirty.add(roomId);
  flushWordLists();
}
async function flushWordLists() {
  if (wordListsWriting) return;
  wordListsWriting = true;
  try {
    while (wordListsDirty.size) {
      const roomId = wordListsDirty.values().next().value;
      wordListsDirty.delete(roomId);
      const lists = wordListsByRoom.get(roomId) || [];
      const cmd = lists.length ? ['HSET', WORDLISTS_DB_KEY, roomId, JSON.stringify(lists)] : ['HDEL', WORDLISTS_DB_KEY, roomId];
      try {
        await upstash(cmd);
      } catch (err) {
        console.error('[listas] falha ao salvar no banco (tentando de novo em 10s):', err.message);
        wordListsDirty.add(roomId);
        if (!wordListsRetryTimer) {
          wordListsRetryTimer = setTimeout(() => { wordListsRetryTimer = null; flushWordLists(); }, 10000);
          wordListsRetryTimer.unref();
        }
        break;
      }
    }
  } finally {
    wordListsWriting = false;
  }
}

// Palavras da categoria escolhida - lista do pessoal com menos palavras que
// o tabuleiro (2x2x2 tem 37 cartas) completa com as normais.
function wordsForCategory(roomId, category, needed) {
  if (typeof category === 'string' && category.startsWith('custom:')) {
    const list = (wordListsByRoom.get(roomId) || []).find((l) => `custom:${l.id}` === category);
    if (list) {
      const own = shuffle(list.words);
      if (own.length >= needed) return own;
      const extra = shuffle(CODENAMES_WORDS.filter((w) => !list.words.includes(w)));
      return shuffle(own.concat(extra.slice(0, needed - own.length)));
    }
  }
  return shuffle(CODENAMES_CATEGORIES[category] || CODENAMES_WORDS);
}

function categoryLabel(roomId, category) {
  if (category === 'cs') return 'Counter-Strike';
  if (typeof category === 'string' && category.startsWith('custom:')) {
    const list = (wordListsByRoom.get(roomId) || []).find((l) => `custom:${l.id}` === category);
    return list ? list.name : 'Lista do pessoal';
  }
  return 'Normal';
}

// roomId -> estado do minijogo "Codigo Secreto" (ver mais abaixo). So existe
// enquanto a sala em si existir - criado sob demanda, apagado junto com ela.
const codenamesGames = new Map();

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Modos de equipe do Codenames - "livre" e o padrao de sempre (sem limite
// de agentes, so 2 equipes). 2x2/3x3 sao a mesma coisa de 2 equipes so que
// com um teto de agentes por equipe. "ffa3" e o modo "Todos contra todos":
// 3 equipes em vez de 2, cada uma com no maximo 1 agente.
const GAME_MODES = {
  livre: { teams: ['red', 'blue'], maxAgents: Infinity },
  '2x2': { teams: ['red', 'blue'], maxAgents: 1 },
  '3x3': { teams: ['red', 'blue'], maxAgents: 2 },
  ffa3: { teams: ['red', 'blue', 'green'], maxAgents: 1 },
};
const DEFAULT_GAME_MODE = 'livre';
const TEAM_LABEL = { red: 'Vermelho', blue: 'Azul', green: 'Verde' };
const TEAM_LABEL_FEM = { red: 'Vermelha', blue: 'Azul', green: 'Verde' };

// Tempo que o time da vez tem pra escolher uma palavra depois que o
// Mestre-Espiao da a pista.
const ANSWER_TIME_MS = Number(process.env.CODENAMES_TIME_MS) || 90000; // env so pra testes automatizados

function emptyTeams(mode) {
  const teams = {};
  GAME_MODES[mode].teams.forEach((t) => { teams[t] = { spymaster: null, agents: [] }; });
  return teams;
}

function createCodenamesGame(roomId) {
  return {
    roomId,
    status: 'lobby', // lobby | playing | over
    round: 0,
    mode: DEFAULT_GAME_MODE,
    category: DEFAULT_CODENAMES_CATEGORY, // de onde vem as palavras (ver CODENAMES_CATEGORIES)
    board: [], // [{ word, team: 'red'|'blue'|'green'|'neutral'|'assassin', revealed }]
    currentTeam: null,
    eliminated: [], // times que caíram num assassino no modo ffa3 - fora da rodada, mas o jogo continua pros outros
    phase: null, // 'clue' | 'guess'
    clue: null, // { word, number, guessesMade, guessesAllowed }
    teams: emptyTeams(DEFAULT_GAME_MODE),
    winner: null,
    winReason: null, // 'words' | 'assassin' | 'last-standing'
    log: [],
    clueGivenAt: null,
    answerTimer: null,
    phaseStartedAt: null, // inicio do cronometro da fase atual (pista OU palpite)
    phaseToken: 0, // muda a cada fase nova - timeout velho que dispare atrasado se reconhece e nao faz nada
    timeoutSeq: 0, // conta quantas vezes o tempo esgotou - o cliente usa pra mostrar o aviso + som
    lastTimeout: null, // { team, phase } do ultimo tempo esgotado
    hostId: null,
    joinOrder: [], // ordem em que as pessoas entraram num time - define o proximo anfitriao
    vacated: [], // [{ name, team, role }] de quem caiu com a partida rolando - o lugar aparece marcado pra ela voltar se quiser
    mapViewers: new Set(), // quem viu o mapa assistindo NESTA partida (so pode entrar como Mestre-Espiao)
    marks: {}, // socketId do agente -> indice da carta que ele esta apontando (o time todo ve)
    clueHistory: [], // [{ team, word, number, hits, targets }] - targets so aparece no fim da partida
    // "Time" Espectadores: so assiste, fica fora do "Sortear times".
    // socketId -> true (assiste COM o mapa secreto, como os mestres-espioes)
    // ou false (sem mapa, so as cartas reveladas, como um agente).
    spectators: {},
  };
}

// Um time so consegue jogar a vez se tiver mestre-espiao (pra dar a pista)
// E pelo menos um agente (pra palpitar) - e nao tiver sido eliminado.
function teamPlayable(game, team) {
  const t = game.teams[team];
  return !game.eliminated.includes(team) && !!t.spymaster && t.agents.length >= 1;
}

// Cronometro de 1min30 da fase atual - vale tanto pro mestre-espiao dar a
// pista quanto pros agentes palpitarem. Esgotou = perde a vez.
function startPhaseTimer(game) {
  clearAnswerTimer(game);
  game.phaseStartedAt = Date.now();
  const token = ++game.phaseToken;
  game.answerTimer = setTimeout(() => {
    if (codenamesGames.get(game.roomId) !== game) return; // sala acabou / jogo foi trocado
    if (game.status !== 'playing' || game.phaseToken !== token) return;
    const team = game.currentTeam;
    const who = game.phase === 'clue' ? 'o Mestre-Espião não deu a pista' : 'os agentes não escolheram';
    game.log.push(`Tempo esgotado (${who}) - Equipe ${TEAM_LABEL_FEM[team]} perdeu a vez`);
    game.timeoutSeq += 1;
    game.lastTimeout = { team, phase: game.phase };
    endGameTurn(game);
    broadcastGameState(game.roomId);
  }, ANSWER_TIME_MS);
}

// Proximo anfitriao quando o atual sai: o primeiro (na ordem em que
// entraram num time) que ainda esta na sala e num time.
function pickNextHost(game, roomId, leavingId) {
  const room = rooms.get(roomId);
  const next = game.joinOrder.find((id) => id !== leavingId && room && room.has(id) && playerGameRole(game, id));
  return next || null;
}

// Só quem abriu o lobby (o primeiro a escolher uma equipe num lobby vazio -
// ver "lobbyWasEmpty" em game-set-role) pode iniciar a partida. Se esse
// socket saiu da sala, o lobby fica "sem anfitrião" e qualquer um pode
// iniciar - senão a sala ficaria travada pra sempre se o anfitrião sumisse.
function isGameHost(game, roomId, socketId) {
  const room = rooms.get(roomId);
  const hostStillHere = game.hostId && room && room.has(game.hostId);
  return !hostStillHere || game.hostId === socketId;
}

// Limpa o cronometro de resposta pendente, se tiver - chamado sempre que o
// turno muda de qualquer jeito (passou a vez, acertou, errou, caiu num
// assassino) pra nao sobrar um setTimeout velho disparando depois da hora.
function clearAnswerTimer(game) {
  if (game.answerTimer) {
    clearTimeout(game.answerTimer);
    game.answerTimer = null;
  }
}

function getOrCreateGame(roomId) {
  if (!codenamesGames.has(roomId)) codenamesGames.set(roomId, createCodenamesGame(roomId));
  return codenamesGames.get(roomId);
}

function playerGameRole(game, socketId) {
  for (const team of GAME_MODES[game.mode].teams) {
    if (game.teams[team].spymaster === socketId) return { team, role: 'spymaster' };
    if (game.teams[team].agents.includes(socketId)) return { team, role: 'agent' };
  }
  return null;
}

function removeFromGameTeams(game, socketId) {
  for (const team of GAME_MODES[game.mode].teams) {
    if (game.teams[team].spymaster === socketId) game.teams[team].spymaster = null;
    game.teams[team].agents = game.teams[team].agents.filter((id) => id !== socketId);
  }
}

// Voltou sozinho depois da internet cair (o app reconecta e manda o token
// de volta): a conexao nova herda tudo da antiga no Codenames - time,
// espectador, anfitriao, carta apontada - como se nunca tivesse saido.
function transferGameIdentity(game, oldId, newId) {
  for (const team of GAME_MODES[game.mode].teams) {
    const t = game.teams[team];
    if (t.spymaster === oldId) t.spymaster = newId;
    t.agents = t.agents.map((id) => (id === oldId ? newId : id));
  }
  if (oldId in game.spectators) { game.spectators[newId] = game.spectators[oldId]; delete game.spectators[oldId]; }
  if (game.mapViewers.delete(oldId)) game.mapViewers.add(newId);
  if (oldId in game.marks) { game.marks[newId] = game.marks[oldId]; delete game.marks[oldId]; }
  game.joinOrder = game.joinOrder.map((id) => (id === oldId ? newId : id));
  if (game.hostId === oldId) game.hostId = newId;
}

// Tokens de "voltar pra sala": cada join-room ganha um segredo (so o app
// daquela pessoa recebe). Reconectando com ele, o servidor sabe que e a
// MESMA pessoa (o id do socket muda a cada conexao) - sem token, qualquer
// um que soubesse o id de outro poderia "roubar" o lugar dele.
const REJOIN_TOKEN_TTL_MS = 10 * 60 * 1000;
const rejoinTokens = new Map(); // token -> { sid, roomId, name, leftAt, spectator, mapViewer }

// --- Senha da sala ---------------------------------------------------------------
// O dono (1a pessoa da sala; se sair, a proxima que entrou) pode por uma
// senha pelo cadeado do lado do "Convidar". Fica so na memoria e some quando
// a sala esvazia. Guardada so como hash com sal - nem o servidor sabe a senha.
const ROOM_PASSWORD_MIN = 3;
const ROOM_PASSWORD_MAX = 32;
const ROOM_PASSWORD_MAX_FAILS = 5;
const ROOM_PASSWORD_WINDOW_MS = 60 * 1000;
const roomLocks = new Map(); // roomId -> { salt, hash }
const roomOwners = new Map(); // roomId -> socketId
const roomPasswordFails = new Map(); // `${ip}|${roomId}` -> [t]
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of roomPasswordFails) if (!list.some((t) => now - t < ROOM_PASSWORD_WINDOW_MS)) roomPasswordFails.delete(k);
}, 5 * 60 * 1000).unref();

function validRoomPassword(pw) {
  return typeof pw === 'string' && pw.length >= ROOM_PASSWORD_MIN && pw.length <= ROOM_PASSWORD_MAX;
}
function makeRoomLock(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.createHash('sha256').update(salt + pw).digest() };
}
function roomPasswordMatches(lock, pw) {
  const h = crypto.createHash('sha256').update(lock.salt + String(pw).slice(0, 200)).digest();
  return crypto.timingSafeEqual(h, lock.hash);
}
function roomLockState(roomId) {
  const ownerId = roomOwners.get(roomId) || null;
  const ownerName = (ownerId && rooms.get(roomId)?.get(ownerId)?.name) || null;
  return { locked: roomLocks.has(roomId), ownerId, ownerName };
}
function broadcastRoomLockState(roomId) {
  io.to(roomId).emit('room-lock-state', roomLockState(roomId));
}
function pruneRejoinTokens() {
  const now = Date.now();
  for (const [token, entry] of rejoinTokens) {
    if (entry.leftAt && now - entry.leftAt > REJOIN_TOKEN_TTL_MS) rejoinTokens.delete(token);
  }
}
setInterval(pruneRejoinTokens, 60 * 1000).unref();

// Historico do chat: as ultimas mensagens de cada sala, pra quem chega
// depois ver a conversa. A mensagem em si continua indo direto entre as
// pessoas (canal do WebRTC, como sempre - apps antigos continuam
// recebendo); o app so manda uma copia pra ca guardar. Fica so na memoria
// (nunca vai pro banco) e some 2h depois que a sala esvazia.
const CHAT_HISTORY_MAX = 50;
const CHAT_HISTORY_KEEP_EMPTY_MS = 2 * 60 * 60 * 1000;
const CHAT_TEXT_MAX = 500;
const chatHistories = new Map(); // roomId -> { messages: [{ author, text, t }], emptySince }
function chatHistoryFor(roomId) {
  const h = chatHistories.get(roomId);
  return h ? h.messages.slice() : [];
}
function storeChatMessage(roomId, author, text) {
  if (!chatHistories.has(roomId)) chatHistories.set(roomId, { messages: [], emptySince: null });
  const h = chatHistories.get(roomId);
  h.emptySince = null;
  h.messages.push({ author, text, t: Date.now() });
  if (h.messages.length > CHAT_HISTORY_MAX) h.messages.splice(0, h.messages.length - CHAT_HISTORY_MAX);
}
setInterval(() => {
  const now = Date.now();
  for (const [roomId, h] of chatHistories) {
    if (rooms.has(roomId)) { h.emptySince = null; continue; }
    if (!h.emptySince) h.emptySince = now;
    else if (now - h.emptySince > CHAT_HISTORY_KEEP_EMPTY_MS) chatHistories.delete(roomId);
  }
}, 5 * 60 * 1000).unref();

function generateBoard(mode, startingTeam, category, roomId) {
  let counts;
  if (mode === 'ffa3') {
    // 2x2x2 (pedido do Rafael): 9 do time que comeca, 8 de cada um dos
    // outros dois, 9 neutras e 3 assassinos = 37 cartas.
    counts = { neutral: 9, assassin: 3 };
    GAME_MODES.ffa3.teams.forEach((t) => { counts[t] = t === startingTeam ? 9 : 8; });
  } else {
    const otherTeam = GAME_MODES[mode].teams.find((t) => t !== startingTeam);
    counts = { [startingTeam]: 9, [otherTeam]: 8, neutral: 7, assassin: 1 };
  }
  const teamsArr = [];
  Object.entries(counts).forEach(([team, count]) => {
    for (let i = 0; i < count; i++) teamsArr.push(team);
  });
  const words = wordsForCategory(roomId, category, teamsArr.length).slice(0, teamsArr.length);
  const shuffledTeams = shuffle(teamsArr);
  // Foto que aparece na carta quando ela e revelada - sorteada aqui pra
  // todo mundo ver a MESMA foto na mesma carta. Numeros 0-24 embaralhados
  // (o cliente faz % quantidade de fotos), entao quase nao repete.
  const photos = shuffle(Array.from({ length: words.length }, (_, i) => i));
  return words.map((word, i) => ({ word, team: shuffledTeams[i], revealed: false, photo: photos[i] }));
}

function countRemaining(game, team) {
  return game.board.filter((c) => c.team === team && !c.revealed).length;
}

function checkGameWinConditions(game) {
  if (game.status !== 'playing') return;
  for (const team of GAME_MODES[game.mode].teams) {
    if (game.eliminated.includes(team)) continue;
    if (countRemaining(game, team) === 0) {
      game.status = 'over'; game.winner = team; game.winReason = 'words'; game.phase = null;
      return;
    }
  }
}

// Passa a vez pro PROXIMO time ainda vivo na ordem do modo, a partir da
// posicao do time atual - funciona mesmo se o time atual acabou de ser
// eliminado (ver game-reveal-word), porque usa a ordem fixa do modo em vez
// de so alternar entre dois.
function endGameTurn(game) {
  clearAnswerTimer(game);
  game.clueGivenAt = null;
  const order = GAME_MODES[game.mode].teams;
  const idx = order.indexOf(game.currentTeam);
  // Pula times desfalcados (alguem saiu no meio: sem mestre-espiao ou sem
  // agente). Se NENHUM time vivo der pra jogar, fica no proximo vivo mesmo
  // - o cronometro continua girando a vez ate alguem voltar.
  let firstAlive = null;
  let chosen = null;
  const skipped = [];
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(idx + step) % order.length];
    if (game.eliminated.includes(candidate)) continue;
    if (!firstAlive) firstAlive = candidate;
    if (teamPlayable(game, candidate)) { chosen = candidate; break; }
    skipped.push(candidate);
  }
  game.currentTeam = chosen || firstAlive || game.currentTeam;
  if (chosen) skipped.forEach((t) => game.log.push(`Equipe ${TEAM_LABEL_FEM[t]} está desfalcada - vez pulada`));
  game.phase = 'clue';
  game.clue = null;
  game.marks = {};
  if (game.status === 'playing') startPhaseTimer(game);
}

function startNewGameRound(game) {
  clearAnswerTimer(game);
  const teams = GAME_MODES[game.mode].teams;
  const startingTeam = teams[Math.floor(Math.random() * teams.length)];
  game.board = generateBoard(game.mode, startingTeam, game.category, game.roomId);
  // Identifica ESTE tabuleiro. O "round" volta pra 1 quando a sala volta
  // pro lobby (jogo novo), entao nao serve pra saber se um mapa secreto
  // guardado no app e deste tabuleiro ou de uma partida anterior.
  game.boardId = require('crypto').randomBytes(8).toString('hex');
  game.round += 1;
  game.status = 'playing';
  game.startedAt = Date.now(); // pra duracao da partida nos dashboards do admin
  game.currentTeam = startingTeam;
  game.eliminated = [];
  game.phase = 'clue';
  game.clue = null;
  game.clueGivenAt = null;
  game.winner = null;
  game.winReason = null;
  game.lastTimeout = null;
  game.marks = {};
  game.clueHistory = [];
  game.mapViewers = new Set(); // tabuleiro novo: ninguem viu esse mapa ainda
  game.vacated = [];
  game.log = [`Nova partida! Equipe ${TEAM_LABEL_FEM[startingTeam]} comeca.`];
  startPhaseTimer(game);
}

function gameTeamsBothReady(game) {
  return GAME_MODES[game.mode].teams.every((team) => game.teams[team].spymaster && game.teams[team].agents.length >= 1);
}

function gameTeamView(game, roomId, team) {
  const room = rooms.get(roomId);
  const nameOf = (id) => (room && room.get(id) && room.get(id).name) || 'Jogador';
  const t = game.teams[team];
  return {
    spymaster: t.spymaster ? { id: t.spymaster, name: nameOf(t.spymaster) } : null,
    agents: t.agents.map((id) => ({ id, name: nameOf(id) })),
  };
}

function publicGameState(roomId) {
  const game = codenamesGames.get(roomId);
  if (!game) {
    return {
      status: 'lobby', round: 0, mode: DEFAULT_GAME_MODE, category: DEFAULT_CODENAMES_CATEGORY, board: [], currentTeam: null, eliminated: [], phase: null, clue: null,
      teams: emptyTeams(DEFAULT_GAME_MODE),
      winner: null, winReason: null, remaining: { red: 0, blue: 0 }, log: [],
      clueGivenAt: null, answerTimeMs: null, phaseEndsInMs: null, timeoutSeq: 0, lastTimeout: null, hostId: null, marks: {}, clueHistory: [],
      spectators: [], vacated: [], mapViewers: [], customLists: customListsOf(roomId),
    };
  }
  const teams = GAME_MODES[game.mode].teams;
  const remaining = {};
  teams.forEach((t) => { remaining[t] = countRemaining(game, t); });
  const teamsView = {};
  teams.forEach((t) => { teamsView[t] = gameTeamView(game, roomId, t); });
  return {
    status: game.status,
    round: game.round,
    boardId: game.boardId || null,
    mode: game.mode,
    category: game.category,
    customLists: customListsOf(roomId),
    // No fim da partida todo mundo ve a cor de todas as cartas.
    board: game.board.map((c) => {
      const visible = c.revealed || game.status === 'over';
      return { word: c.word, revealed: c.revealed, team: visible ? c.team : null, photo: visible ? c.photo : null };
    }),
    currentTeam: game.currentTeam,
    eliminated: game.eliminated,
    phase: game.phase,
    clue: game.clue ? {
      word: game.clue.word,
      number: game.clue.number,
      guessesMade: game.clue.guessesMade,
      guessesAllowed: game.clue.guessesAllowed === Infinity ? null : game.clue.guessesAllowed,
    } : null,
    teams: teamsView,
    winner: game.winner,
    winReason: game.winReason,
    remaining,
    log: game.log.slice(-30),
    clueGivenAt: game.clueGivenAt,
    answerTimeMs: ANSWER_TIME_MS,
    // Quanto falta do cronometro da fase AGORA (o cliente soma no proprio
    // relogio ao receber - nao depende do relogio do PC bater com o servidor).
    phaseEndsInMs: game.status === 'playing' && game.phaseStartedAt
      ? Math.max(0, ANSWER_TIME_MS - (Date.now() - game.phaseStartedAt)) : null,
    timeoutSeq: game.timeoutSeq,
    marks: (() => {
      const room = rooms.get(roomId);
      const out = {};
      for (const [id, idx] of Object.entries(game.marks)) {
        (out[idx] = out[idx] || []).push({ id, name: (room && room.get(id) && room.get(id).name) || 'Jogador' });
      }
      return out;
    })(),
    clueHistory: game.clueHistory.map((c) => ({
      team: c.team, word: c.word, number: c.number, hits: c.hits,
      targets: game.status === 'over' ? c.targets : null,
    })),
    lastTimeout: game.lastTimeout,
    hostId: game.hostId,
    spectators: (() => {
      const room = rooms.get(roomId);
      return Object.entries(game.spectators)
        .filter(([id]) => room && room.has(id))
        .map(([id, withMap]) => ({ id, name: room.get(id).name || 'Jogador', withMap }));
    })(),
    // lugares de quem caiu no meio da partida (aparecem como "lugar de Fulano")
    vacated: game.status === 'playing' ? game.vacated.map((v) => ({ name: v.name, team: v.team, role: v.role })) : [],
    // quem viu o mapa assistindo nesta partida (so pode entrar como Mestre-Espiao)
    mapViewers: [...game.mapViewers],
  };
}

function broadcastGameState(roomId) {
  const game = codenamesGames.get(roomId);
  if (game && game.status === 'over') logCodenamesGame(game, false); // so registra 1x por tabuleiro
  io.to(roomId).emit('game-state', publicGameState(roomId));
  broadcastRoomsToAdmins(); // painel de admin mostra os jogos ao vivo
}

// Resumo de um Codenames pro painel de admin - INCLUI o mapa secreto
// (cor de todas as cartas), so vai pra socket de admin.
function codenamesAdminView(roomId) {
  const game = codenamesGames.get(roomId);
  if (!game) return null;
  const pub = publicGameState(roomId);
  const room = rooms.get(roomId);
  return {
    status: pub.status,
    mode: pub.mode,
    round: pub.round,
    currentTeam: pub.currentTeam,
    phase: pub.phase,
    clue: pub.clue,
    remaining: pub.remaining,
    eliminated: pub.eliminated,
    winner: pub.winner,
    teams: pub.teams,
    spectators: pub.spectators,
    phaseEndsInMs: pub.phaseEndsInMs,
    hostName: (game.hostId && room && room.get(game.hostId) && room.get(game.hostId).name) || null,
    board: game.board.map((c) => ({ word: c.word, team: c.team, revealed: c.revealed })),
    log: game.log.slice(-8),
    // pro "Assistir partida" do painel (tabuleiro grande, ao vivo): quem
    // esta apontando cada carta, pistas com as cartas que o mestre quis
    // dizer (admin ve sempre) e o historico inteiro. Ninguem na sala sabe
    // que o admin esta olhando - isso so vai pros sockets de admin.
    boardId: game.boardId || null,
    categoryName: categoryLabel(roomId, game.category),
    marks: pub.marks,
    clueHistory: game.clueHistory.map((c) => ({ team: c.team, word: c.word, number: c.number, hits: c.hits, targets: c.targets || null })),
    fullLog: pub.log,
  };
}

// ============================================================================
// Minijogo "Stop / Adedonha" - sorteia uma letra, todo mundo (quem estiver na
// sala quando a rodada comecar) digita uma palavra por categoria comecando
// com ela, correndo contra um cronometro no servidor. Quem termina primeiro
// aperta "PARAR", o que encerra a rodada pra todo mundo na hora (regra
// classica do jogo). Sem equipes/papeis - todo mundo joga contra todo mundo.
// ============================================================================

const STOP_DEFAULT_CATEGORIES = ['Nome', 'Animal', 'Fruta', 'Cor', 'País', 'Objeto'];
// Letras raras como inicial em portugues (K, W, X, Y, Z) ficam de fora pra
// nao sortear uma rodada praticamente impossivel de preencher.
const STOP_LETTERS = 'ABCDEFGHIJLMNOPQRSTUV'.split('');
const STOP_ROUND_MS = 60000;
const STOP_CATEGORY_MAX_LEN = 24;
const STOP_MIN_CATEGORIES = 2;
const STOP_MAX_CATEGORIES = 10;

// roomId -> estado do Stop. So existe enquanto a sala existir.
const stopGames = new Map();

function createStopGame() {
  return {
    status: 'idle', // idle | lobby | playing | reveal
    round: 0,
    letter: null,
    // Categorias da ULTIMA rodada (ou o padrao, numa sala nova) - quem
    // aperta "comecar" pode mandar uma lista nova pra substituir essa (ver
    // sanitizeCategoryList/stop-start-round), e o que for usado fica salvo
    // aqui pra ser o ponto de partida mostrado pra todo mundo na proxima.
    categories: [...STOP_DEFAULT_CATEGORIES],
    startedAt: null,
    durationMs: STOP_ROUND_MS,
    // Quanto tempo (ms) precisa passar antes de alguem poder dar Stop
    // nessa rodada - calculado a partir do numero de categorias quando a
    // rodada comeca de verdade (ver computeStopMinStopMs/beginStopRound).
    minStopMs: 0,
    // Lobby: quem ja apertou "Pronto" pra essa rodada comecar (ver
    // tryStartStopRoundFromLobby) - zerado a cada nova entrada no lobby.
    readyPlayers: new Set(),
    players: new Map(), // socketId -> { name, values: { categoria: texto } }
    results: null,
    timer: null,
  };
}

// 3 categorias = 10s, 4 = 15s, +5s por categoria a mais (e o mesmo padrao
// pra menos: 2 categorias = 5s) - quanto mais categoria, mais tempo justo
// pra todo mundo pelo menos LER a letra e as categorias antes de alguem
// conseguir fechar a rodada na cara dos outros.
function computeStopMinStopMs(categoryCount) {
  return Math.max(0, (categoryCount - 1) * 5000);
}

function getOrCreateStopGame(roomId) {
  if (!stopGames.has(roomId)) stopGames.set(roomId, createStopGame());
  return stopGames.get(roomId);
}

// Valida/limpa a lista de categorias que quem vai comandar a rodada montou:
// remove vazias/duplicadas (sem diferenciar maiusculas) e limita tamanho de
// cada uma e quantidade total. Retorna null se sobrar categoria de menos
// pra valer a pena jogar.
function sanitizeCategoryList(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim().slice(0, STOP_CATEGORY_MAX_LEN);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= STOP_MAX_CATEGORIES) break;
  }
  return out.length >= STOP_MIN_CATEGORIES ? out : null;
}

function sanitizeStopValues(values, categories) {
  const out = {};
  for (const cat of categories) {
    const v = values && typeof values === 'object' ? values[cat] : '';
    out[cat] = typeof v === 'string' ? v.trim().slice(0, 40) : '';
  }
  return out;
}

function computeStopResults(game) {
  const letterLower = (game.letter || '').toLowerCase();
  const categories = game.categories;
  // Primeiro agrupa, por categoria, as respostas validas (nao vazias e que
  // comecam com a letra sorteada) por texto normalizado - pra saber quais
  // sao unicas (10 pontos) e quais se repetiram entre jogadores (5 pontos).
  const groupsByCategory = {};
  for (const cat of categories) {
    const groups = new Map();
    for (const [id, p] of game.players) {
      const raw = (p.values[cat] || '').trim();
      if (!raw || raw[0].toLowerCase() !== letterLower) continue;
      const norm = raw.toLowerCase();
      if (!groups.has(norm)) groups.set(norm, []);
      groups.get(norm).push(id);
    }
    groupsByCategory[cat] = groups;
  }

  const perPlayer = [];
  for (const [id, p] of game.players) {
    let total = 0;
    const catResults = {};
    for (const cat of categories) {
      const raw = (p.values[cat] || '').trim();
      const valid = raw.length > 0 && raw[0].toLowerCase() === letterLower;
      let points = 0;
      let status = 'vazio';
      if (valid) {
        const group = groupsByCategory[cat].get(raw.toLowerCase());
        if (group.length === 1) { points = 10; status = 'unica'; }
        else { points = 5; status = 'repetida'; }
      } else if (raw) {
        status = 'invalida';
      }
      total += points;
      catResults[cat] = { value: raw, points, status };
    }
    perPlayer.push({ id, name: p.name, total, categories: catResults });
  }
  perPlayer.sort((a, b) => b.total - a.total);
  return { letter: game.letter, categories, perPlayer };
}

function finalizeStopRound(roomId) {
  const game = stopGames.get(roomId);
  if (!game || game.status !== 'playing') return;
  if (game.timer) { clearTimeout(game.timer); game.timer = null; }
  game.status = 'reveal';
  game.results = computeStopResults(game);
  const now = Date.now();
  logActivity({
    type: 'stop', roomId, letter: game.letter, categories: game.categories.length,
    players: game.results.perPlayer.map((p) => ({ name: p.name, total: p.total })),
    start: game.startedAt || now, end: now, dur: now - (game.startedAt || now),
  });
  broadcastStopState(roomId);
}

// Comeca a rodada de verdade (sorteia letra, zera o cronometro) - chamada
// quando o lobby fecha, seja porque todo mundo apertou "Pronto" ou porque
// alguem forcou o inicio (stop-force-start).
function beginStopRound(roomId, game) {
  if (game.timer) { clearTimeout(game.timer); game.timer = null; }
  const room = rooms.get(roomId);
  game.players = new Map();
  if (room) room.forEach((info, id) => game.players.set(id, { name: info.name || 'Jogador', values: {} }));
  game.letter = STOP_LETTERS[Math.floor(Math.random() * STOP_LETTERS.length)];
  game.startedAt = Date.now();
  game.durationMs = STOP_ROUND_MS;
  game.minStopMs = computeStopMinStopMs(game.categories.length);
  game.status = 'playing';
  game.round += 1;
  game.results = null;
  game.readyPlayers = new Set();
  game.timer = setTimeout(() => finalizeStopRound(roomId), game.durationMs);
}

// Se todo mundo que esta na sala agora ja apertou "Pronto", fecha o lobby
// e comeca a rodada sozinho - e assim que o "todo mundo comeca junto"
// funciona na pratica, sem precisar de um botao extra na maioria das vezes.
function tryStartStopRoundFromLobby(roomId, game) {
  if (game.status !== 'lobby') return;
  const room = rooms.get(roomId);
  const roomSize = room ? room.size : 0;
  if (roomSize === 0 || game.readyPlayers.size < roomSize) return;
  beginStopRound(roomId, game);
}

function stopPublicState(roomId) {
  const game = stopGames.get(roomId);
  if (!game || game.status === 'idle') {
    return {
      status: 'idle', round: game ? game.round : 0, letter: null, categories: game ? game.categories : STOP_DEFAULT_CATEGORIES,
      startedAt: null, durationMs: STOP_ROUND_MS, minStopMs: 0, players: [], lobbyPlayers: [], results: null,
    };
  }
  if (game.status === 'lobby') {
    const room = rooms.get(roomId);
    const lobbyPlayers = room
      ? Array.from(room.entries()).map(([id, info]) => ({ id, name: info.name || 'Jogador', ready: game.readyPlayers.has(id) }))
      : [];
    return {
      status: 'lobby',
      round: game.round,
      letter: null,
      categories: game.categories,
      startedAt: null,
      durationMs: game.durationMs,
      minStopMs: computeStopMinStopMs(game.categories.length),
      players: [],
      lobbyPlayers,
      results: null,
    };
  }
  return {
    status: game.status,
    round: game.round,
    letter: game.letter,
    categories: game.categories,
    startedAt: game.startedAt,
    durationMs: game.durationMs,
    minStopMs: game.minStopMs || 0,
    players: Array.from(game.players.entries()).map(([id, p]) => ({ id, name: p.name })),
    lobbyPlayers: [],
    results: game.status === 'reveal' ? game.results : null,
  };
}

function broadcastStopState(roomId) {
  io.to(roomId).emit('stop-state', stopPublicState(roomId));
}

// ============================================================================
// Minijogo "Sketch do PC" - alguem cria uma pergunta "Voce prefere A ou B?",
// e quem estiver na sala vota ao vivo (contagem atualiza em tempo real pra
// todo mundo a cada voto, sem esperar ninguem "revelar" nada - diferente do
// Stop/Codigo Secreto, aqui nao tem nada escondido). A votacao se encerra
// sozinha quando todo mundo que esta na sala ja votou, ou qualquer um pode
// encerrar na mao a qualquer momento (ex: alguem ficou ausente).
// ============================================================================

const SKETCH_OPTION_MAX_LEN = 60;

// roomId -> estado do Sketch. So existe enquanto a sala existir.
const sketchGames = new Map();

function createSketchGame() {
  return {
    status: 'idle', // idle | voting | ended
    round: 0,
    optionA: null,
    optionB: null,
    authorName: null,
    votes: new Map(), // socketId -> 'a' | 'b'
  };
}

function getOrCreateSketchGame(roomId) {
  if (!sketchGames.has(roomId)) sketchGames.set(roomId, createSketchGame());
  return sketchGames.get(roomId);
}

function sketchPublicState(roomId) {
  const game = sketchGames.get(roomId);
  if (!game || game.status === 'idle') {
    return { status: 'idle', round: game ? game.round : 0, optionA: null, optionB: null, authorName: null, counts: { a: 0, b: 0 }, total: 0 };
  }
  const counts = { a: 0, b: 0 };
  for (const v of game.votes.values()) counts[v] += 1;
  return {
    status: game.status,
    round: game.round,
    optionA: game.optionA,
    optionB: game.optionB,
    authorName: game.authorName,
    counts,
    total: game.votes.size,
  };
}

function broadcastSketchState(roomId) {
  const game = sketchGames.get(roomId);
  // Votacao encerrada: registra 1x por rodada pros dashboards do admin.
  if (game && game.status === 'ended' && game.loggedRound !== game.round) {
    game.loggedRound = game.round;
    const room = rooms.get(roomId);
    let votesA = 0; let votesB = 0;
    const voters = [];
    for (const [id, v] of game.votes) {
      if (v === 'a') votesA += 1; else votesB += 1;
      const n = room && room.get(id) && room.get(id).name;
      if (n) voters.push(n);
    }
    logActivity({ type: 'sketch', roomId, author: game.authorName, optionA: game.optionA, optionB: game.optionB, votesA, votesB, voters });
  }
  io.to(roomId).emit('sketch-state', sketchPublicState(roomId));
}

function maybeAutoEndSketchVote(roomId, game) {
  if (game.status !== 'voting') return;
  const room = rooms.get(roomId);
  const roomSize = room ? room.size : 0;
  if (roomSize > 0 && game.votes.size >= roomSize) game.status = 'ended';
}

// Convite de minijogo: quando alguem abre o lobby / comeca um minijogo,
// avisa todo mundo da sala (menos quem iniciou) pra aparecer o pop-up
// "Fulano iniciou um jogo de X - Entrar / Agora nao" no app de cada um.
const MINIGAME_NAMES = { codenames: 'Codenames', stop: 'Stop / Adedonha', sketch: 'Sketch do PC' };

function notifyMinigameStarted(socket, roomId, gameId) {
  const byName = (rooms.get(roomId)?.get(socket.id)?.name) || 'Alguém';
  socket.to(roomId).emit('minigame-invite', { gameId, gameName: MINIGAME_NAMES[gameId], byName });
}

// roomId -> Set<socketId> de admins espectando essa sala de forma invisivel
// (nao entram no Map "rooms" acima - nao contam como participante, nao
// aparecem pra ninguem, so recebem video/audio dos outros).
const spectatorsByRoom = new Map();

// Sockets autenticados com a ADMIN_PASSWORD - recebem o snapshot de todas as
// salas em tempo real e podem entrar em qualquer uma.
const adminSockets = new Set();

const serverStartedAt = Date.now();
// Entradas/saidas de sala pro painel de admin. Fica so na memoria: some
// quando o Render reinicia (deploy ou "dormir") - o cliente de admin guarda
// uma copia no PC dele a cada vez que busca (ver admin-history).
const presenceLog = [];
let presenceSeq = 0;
function logPresence(type, name, roomId, version) {
  presenceLog.push({ id: `${serverStartedAt}-${++presenceSeq}`, t: Date.now(), type, name, roomId, version: version || null });
  if (presenceLog.length > 5000) presenceLog.splice(0, presenceLog.length - 5000);
}

// --- Atividade pros dashboards do painel admin --------------------------------
// Eventos com duracao (sessao em call, transmissao) e resultados dos
// minijogos. Ficam na memoria (o Render gratis apaga ao dormir/reiniciar),
// entao cada evento tambem vai NA HORA pros paineis admin abertos, que
// guardam no PC do admin (ver admin-client). Tipos:
//   session   { name, roomId, version, start, end, dur, cut? }
//   share     { name, roomId, mode: 'screen'|'screen-native'|'camera', start, end, dur, cut? }
//   codenames { roomId, mode, category, winner, winReason, aborted, start, end, dur, players: [{ name, team, role }] }
//   stop      { roomId, letter, categories, players: [{ name, total }], start, end, dur }
//   sketch    { roomId, author, optionA, optionB, votesA, votesB, voters: [name] }
// "cut" = o servidor desligou com a sessao/transmissao em andamento.
const activityLog = [];
let activitySeq = 0;
const ACTIVITY_MAX = 20000;
const SHARE_MODES = new Set(['screen', 'screen-native', 'camera']);

function logActivity(event) {
  const e = { id: `${serverStartedAt}-a${++activitySeq}`, t: Date.now(), ...event };
  activityLog.push(e);
  if (activityLog.length > ACTIVITY_MAX) activityLog.splice(0, activityLog.length - ACTIVITY_MAX);
  adminSockets.forEach((s) => s.emit('admin-activity-event', e));
  persistActivity(e);
  return e;
}

// --- Banco de dados dos dashboards (Upstash Redis, via HTTPS) ----------------
// Cada evento vai pro banco na hora, entao nada se perde quando o servidor
// dorme/reinicia - e o painel admin le de la, mesmo que tenha ficado fechado.
// Credenciais SO nas variaveis do Render (UPSTASH_REDIS_REST_URL e
// UPSTASH_REDIS_REST_TOKEN); sem elas, tudo continua so na memoria como antes.
// Guardado num "sorted set" com a hora do evento como nota, pra dar pra pedir
// "tudo depois de tal hora". Se o Upstash falhar, os eventos ficam na fila e
// o servidor tenta de novo a cada 10s.
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const ACTIVITY_DB_KEY = process.env.ACTIVITY_DB_KEY || 'telinhafix:activity'; // env so pros testes
const activityDbEnabled = !!(UPSTASH_URL && UPSTASH_TOKEN);
const activityDbQueue = [];
let activityDbFlushing = false;
let activityDbRetryTimer = null;
let activityDbLastError = null;
console.log(`[stats] banco de dados ${activityDbEnabled ? 'ligado (Upstash)' : 'desligado - so memoria'}`);

async function upstash(command) {
  const r = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
  return data.result;
}

function persistActivity(e) {
  if (!activityDbEnabled) return;
  activityDbQueue.push(e);
  flushActivityDb();
}

async function flushActivityDb() {
  if (activityDbFlushing || !activityDbQueue.length) return;
  activityDbFlushing = true;
  try {
    while (activityDbQueue.length) {
      const batch = activityDbQueue.slice(0, 50);
      const cmd = ['ZADD', ACTIVITY_DB_KEY];
      batch.forEach((e) => cmd.push(String(e.t), JSON.stringify(e)));
      await upstash(cmd);
      activityDbQueue.splice(0, batch.length);
    }
    activityDbLastError = null;
  } catch (err) {
    activityDbLastError = err.message;
    console.error(`[stats] falha ao salvar no banco (${activityDbQueue.length} na fila, tentando de novo em 10s):`, err.message);
    if (!activityDbRetryTimer) {
      activityDbRetryTimer = setTimeout(() => { activityDbRetryTimer = null; flushActivityDb(); }, 10000);
      activityDbRetryTimer.unref();
    }
  } finally {
    activityDbFlushing = false;
  }
}

// Tudo depois de "since" (ms), em paginas de 2000 pra nao estourar o limite
// de tamanho de resposta do Upstash.
async function readActivityFromDb(since) {
  const out = [];
  for (let page = 0, offset = 0; page < 100; page++, offset += 2000) {
    const res = await upstash(['ZRANGEBYSCORE', ACTIVITY_DB_KEY, `(${Number(since) || 0}`, '+inf', 'LIMIT', String(offset), '2000']);
    for (const s of res || []) { try { out.push(JSON.parse(s)); } catch { /* linha estragada - ignora */ } }
    if (!res || res.length < 2000) break;
  }
  return out;
}

// Espera a fila do banco esvaziar (usado antes de desligar), no maximo maxMs.
function waitActivityDbIdle(maxMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function tick() {
      const idle = !activityDbQueue.length && !activityDbFlushing && !wordListsDirty.size && !wordListsWriting;
      if (idle || Date.now() - t0 > maxMs) return resolve();
      if (!activityDbFlushing) flushActivityDb();
      if (!wordListsWriting && wordListsDirty.size) flushWordLists();
      setTimeout(tick, 100);
    }());
  });
}

// Fecha a transmissao em andamento de alguem (se tiver) e registra a duracao.
function endShareActivity(roomId, info, now, cut = false) {
  if (!info || !info.shareMode || !info.shareStartedAt) return;
  logActivity({ type: 'share', name: info.name, roomId, mode: info.shareMode, start: info.shareStartedAt, end: now, dur: now - info.shareStartedAt, ...(cut ? { cut: true } : {}) });
  info.shareStartedAt = null;
}

function endSessionActivity(roomId, info, now, cut = false) {
  if (!info || !info.joinedAt) return;
  endShareActivity(roomId, info, now, cut);
  logActivity({ type: 'session', name: info.name, roomId, version: info.version || null, start: info.joinedAt, end: now, dur: now - info.joinedAt, ...(cut ? { cut: true } : {}) });
}

function logCodenamesGame(game, aborted) {
  if (!game || !game.boardId || game.loggedBoardId === game.boardId) return;
  game.loggedBoardId = game.boardId;
  const room = rooms.get(game.roomId);
  const nameOf = (id) => (room && room.get(id) && room.get(id).name) || null;
  const players = [];
  for (const team of GAME_MODES[game.mode].teams) {
    const t = game.teams[team];
    if (t.spymaster && nameOf(t.spymaster)) players.push({ name: nameOf(t.spymaster), team, role: 'spymaster' });
    t.agents.forEach((id) => { if (nameOf(id)) players.push({ name: nameOf(id), team, role: 'agent' }); });
  }
  const now = Date.now();
  logActivity({
    type: 'codenames', roomId: game.roomId, mode: game.mode, category: (game.category || 'normal').startsWith('custom:') ? 'custom' : (game.category || 'normal'), categoryName: categoryLabel(game.roomId, game.category),
    winner: aborted ? null : game.winner, winReason: aborted ? null : game.winReason, aborted: !!aborted,
    start: game.startedAt || now, end: now, dur: now - (game.startedAt || now), players,
  });
}
// --- Retrospectiva ("TelinhaFix Wrapped") ----------------------------------
// Resumo da semana/mes de UMA pessoa (pelo nome) NA SALA em que ela esta -
// de proposito nao junta outras salas: o nome nao tem senha, e assim
// ninguem descobre o codigo das outras salas de alguem so digitando o nome
// dela. Vem do mesmo registro de atividade dos dashboards (banco + memoria),
// mais o que esta rolando agora (sessoes/transmissoes ainda abertas).
const WRAPPED_PERIODS = { week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };
const WRAPPED_CACHE_MS = 2 * 60 * 1000;
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000; // horario de Brasilia (sem horario de verao desde 2019)
const wrappedEventsCache = new Map(); // period -> { at, since, promise }
// desde quando o servidor guarda a atividade no banco (19/10/2026, 0h Brasilia)
const ACTIVITY_DATA_SINCE = Date.UTC(2026, 9, 19, 3);
let profileEventsCache = null; // { at, promise } - tudo desde o comeco

function getProfileEvents() {
  const now = Date.now();
  if (profileEventsCache && now - profileEventsCache.at < WRAPPED_CACHE_MS) return profileEventsCache.promise;
  const promise = getActivitySince(0);
  profileEventsCache = { at: now, promise };
  promise.catch(() => { profileEventsCache = null; });
  return promise;
}

function getActivitySince(since) {
  const fromMemory = () => activityLog.filter((e) => e.t > since);
  if (!activityDbEnabled) return Promise.resolve(fromMemory());
  return readActivityFromDb(since).then((fromDb) => {
    const seen = new Set(fromDb.map((e) => e.id));
    return fromDb.concat(fromMemory().filter((e) => !seen.has(e.id)));
  }).catch((err) => {
    console.error('[wrapped] falha ao ler o banco:', err.message);
    return fromMemory();
  });
}

// Eventos do periodo (lidos 1x a cada 2 min no maximo, pra todo mundo -
// nao gasta o limite de comandos do Upstash com cada clique).
function getWrappedEvents(period) {
  const now = Date.now();
  const cached = wrappedEventsCache.get(period);
  if (cached && now - cached.at < WRAPPED_CACHE_MS) return cached.promise;
  const since = now - WRAPPED_PERIODS[period];
  // (cada evento e gravado quando TERMINA - "t" - entao o que terminou antes
  // do periodo nao tem nada dentro dele)
  const promise = getActivitySince(since);
  wrappedEventsCache.set(period, { at: now, promise });
  promise.catch(() => wrappedEventsCache.delete(period));
  return promise;
}

function computeWrapped(allEvents, roomId, name, since, now) {
  const norm = (n) => String(n || '').trim().toLowerCase();
  const me = norm(name);
  const inRoom = allEvents.filter((e) => e.roomId === roomId);
  // sessoes/transmissoes ainda abertas contam ate agora
  const room = rooms.get(roomId);
  const live = [];
  if (room) {
    for (const info of room.values()) {
      if (info.joinedAt) live.push({ type: 'session', name: info.name, roomId, start: info.joinedAt, end: now });
      if (info.shareMode && info.shareStartedAt) live.push({ type: 'share', name: info.name, roomId, mode: info.shareMode, start: info.shareStartedAt, end: now });
    }
  }
  const events = inRoom.concat(live);
  const clip = (e) => ({ ...e, start: Math.max(e.start || e.t, since), end: Math.min(e.end || e.t, now) });
  const sessions = events.filter((e) => e.type === 'session').map(clip).filter((e) => e.end > e.start);
  const mine = sessions.filter((e) => norm(e.name) === me);

  const totalMs = mine.reduce((s, e) => s + (e.end - e.start), 0);
  const longestMs = mine.reduce((m, e) => Math.max(m, e.end - e.start), 0);
  const days = new Set();
  const hourMs = new Array(24).fill(0);
  for (const e of mine) {
    for (let t = e.start; t < e.end;) {
      const local = new Date(t + BRT_OFFSET_MS);
      days.add(local.toISOString().slice(0, 10));
      const nextHour = t - (local.getUTCMinutes() * 60000 + local.getUTCSeconds() * 1000 + local.getUTCMilliseconds()) + 3600000;
      const until = Math.min(nextHour, e.end);
      hourMs[local.getUTCHours()] += until - t;
      t = until;
    }
  }
  const peakHourMs = Math.max(...hourMs);
  const peakHour = peakHourMs > 0 ? hourMs.indexOf(peakHourMs) : null;

  // Com quem mais ficou em call ao mesmo tempo
  const together = new Map(); // nome normalizado -> { name, ms }
  for (const m of mine) {
    for (const o of sessions) {
      if (norm(o.name) === me) continue;
      const overlap = Math.min(m.end, o.end) - Math.max(m.start, o.start);
      if (overlap <= 0) continue;
      const k = norm(o.name);
      const cur = together.get(k) || { name: o.name, ms: 0 };
      cur.ms += overlap;
      cur.name = o.name;
      together.set(k, cur);
    }
  }
  const companions = Array.from(together.values()).sort((a, b) => b.ms - a.ms).slice(0, 3);

  // Ranking de tempo em call na sala
  const perPerson = new Map();
  for (const e of sessions) perPerson.set(norm(e.name), (perPerson.get(norm(e.name)) || 0) + (e.end - e.start));
  const ranking = Array.from(perPerson.entries()).sort((a, b) => b[1] - a[1]);
  const rankIdx = ranking.findIndex(([k]) => k === me);

  const shares = events.filter((e) => e.type === 'share' && norm(e.name) === me).map(clip).filter((e) => e.end > e.start);
  const shareMs = shares.reduce((s, e) => s + (e.end - e.start), 0);
  const cameraCount = shares.filter((e) => e.mode === 'camera').length;

  const inPeriod = (e) => (e.end || e.t) >= since && (e.end || e.t) <= now;
  const cn = events.filter((e) => e.type === 'codenames' && !e.aborted && inPeriod(e));
  let cnPlayed = 0, cnWins = 0, cnSpy = 0;
  for (const g of cn) {
    const p = (g.players || []).find((x) => norm(x.name) === me);
    if (!p) continue;
    cnPlayed += 1;
    if (g.winner && g.winner === p.team) cnWins += 1;
    if (p.role === 'spymaster') cnSpy += 1;
  }
  const stops = events.filter((e) => e.type === 'stop' && inPeriod(e));
  let stopPlayed = 0, stopWins = 0;
  for (const r of stops) {
    const p = (r.players || []).find((x) => norm(x.name) === me);
    if (!p) continue;
    stopPlayed += 1;
    const best = Math.max(...r.players.map((x) => x.total || 0));
    if (best > 0 && (p.total || 0) === best) stopWins += 1;
  }
  const sketches = events.filter((e) => e.type === 'sketch' && inPeriod(e) && norm(e.author) === me).length;

  return {
    name, roomId, since, until: now,
    totalMs, sessions: mine.length, longestMs, daysActive: days.size, peakHour,
    companions,
    rank: rankIdx >= 0 ? rankIdx + 1 : null, rankOf: ranking.length,
    shares: { count: shares.length, ms: shareMs, camera: cameraCount, screen: shares.length - cameraCount },
    codenames: { played: cnPlayed, wins: cnWins, spymaster: cnSpy },
    stop: { played: stopPlayed, wins: stopWins },
    sketch: { authored: sketches },
  };
}

// --- Perfil + conquistas ---------------------------------------------------
// Os numeros de uma pessoa (pelo nome) no TelinhaFix inteiro - todas as
// salas, sem mostrar o codigo de nenhuma - e as 12 conquistas em bronze,
// prata e ouro. Mesma fonte da Retrospectiva (banco + memoria + o que esta
// rolando agora). So da pra pedir o seu perfil ou o de quem esta na mesma
// sala que voce (clicando no nome na lista).
const ACHIEVEMENTS = [
  { id: 'maratonista', name: 'Maratonista', desc: 'Horas em call', metric: 'callHours', unit: 'h', tiers: [10, 50, 200] },
  { id: 'folego', name: 'Fôlego', desc: 'Maior call seguida', metric: 'longestHours', unit: 'h', tiers: [2, 4, 8] },
  { id: 'fiel', name: 'Fiel', desc: 'Dias diferentes com call', metric: 'daysActive', unit: 'dias', tiers: [7, 30, 100] },
  { id: 'coruja', name: 'Coruja', desc: 'Noites em call entre 0h e 5h', metric: 'nights', unit: 'noites', tiers: [3, 15, 50] },
  { id: 'streamer', name: 'Streamer', desc: 'Horas transmitindo a tela', metric: 'screenHours', unit: 'h', tiers: [5, 25, 100] },
  { id: 'rosto', name: 'Rosto conhecido', desc: 'Transmissões de câmera', metric: 'cameraShares', unit: '', tiers: [5, 25, 100] },
  { id: 'turma', name: 'Turma', desc: 'Pessoas diferentes em call com você', metric: 'people', unit: 'pessoas', tiers: [3, 10, 25] },
  { id: 'agente', name: 'Agente secreto', desc: 'Vitórias no Codenames', metric: 'cnWins', unit: '', tiers: [5, 25, 100] },
  { id: 'mestre', name: 'Mestre-espião', desc: 'Vitórias como Mestre-Espião', metric: 'cnSpyWins', unit: '', tiers: [3, 15, 50] },
  { id: 'stop', name: 'Rei do Stop', desc: 'Vitórias no Stop', metric: 'stopWins', unit: '', tiers: [3, 15, 50] },
  { id: 'artista', name: 'Artista', desc: 'Rodadas criadas no "A ou B"', metric: 'sketches', unit: '', tiers: [3, 15, 50] },
  { id: 'pefrio', name: 'Pé-frio', desc: 'Derrotas no Codenames pelo assassino', metric: 'assassinLosses', unit: '', tiers: [1, 5, 20] },
];
const PROFILE_MIN_TOGETHER_MS = 60 * 1000; // ficar junto menos de 1 min nao conta como "turma"

function computeProfile(allEvents, name, now) {
  const norm = (n) => String(n || '').trim().toLowerCase();
  const me = norm(name);
  const live = [];
  for (const [roomId, room] of rooms) {
    for (const info of room.values()) {
      if (info.joinedAt) live.push({ type: 'session', name: info.name, roomId, start: info.joinedAt, end: now });
      if (info.shareMode && info.shareStartedAt) live.push({ type: 'share', name: info.name, roomId, mode: info.shareMode, start: info.shareStartedAt, end: now });
    }
  }
  const events = allEvents.concat(live);
  const sessions = events.filter((e) => e.type === 'session' && e.end > e.start);
  const mine = sessions.filter((e) => norm(e.name) === me);

  let totalMs = 0;
  let longestMs = 0;
  let firstSeen = null;
  const days = new Set();
  const nights = new Set();
  for (const e of mine) {
    totalMs += e.end - e.start;
    longestMs = Math.max(longestMs, e.end - e.start);
    if (firstSeen === null || e.start < firstSeen) firstSeen = e.start;
    for (let t = e.start; t < e.end;) {
      const local = new Date(t + BRT_OFFSET_MS);
      const day = local.toISOString().slice(0, 10);
      days.add(day);
      if (local.getUTCHours() < 5) nights.add(day);
      const nextHour = t - (local.getUTCMinutes() * 60000 + local.getUTCSeconds() * 1000 + local.getUTCMilliseconds()) + 3600000;
      t = Math.min(nextHour, e.end);
    }
  }

  // com quem ficou em call (mesma sala, ao mesmo tempo)
  const byRoom = new Map();
  for (const e of sessions) {
    if (!byRoom.has(e.roomId)) byRoom.set(e.roomId, []);
    byRoom.get(e.roomId).push(e);
  }
  const together = new Map();
  for (const m of mine) {
    for (const o of byRoom.get(m.roomId) || []) {
      if (norm(o.name) === me) continue;
      const overlap = Math.min(m.end, o.end) - Math.max(m.start, o.start);
      if (overlap <= 0) continue;
      const k = norm(o.name);
      const cur = together.get(k) || { name: o.name, ms: 0 };
      cur.ms += overlap;
      cur.name = o.name;
      together.set(k, cur);
    }
  }
  const companions = Array.from(together.values()).sort((a, b) => b.ms - a.ms);

  const shares = events.filter((e) => e.type === 'share' && norm(e.name) === me && e.end > e.start);
  const screenMs = shares.filter((e) => e.mode === 'screen' || e.mode === 'screen-native').reduce((s, e) => s + (e.end - e.start), 0);
  const cameraShares = shares.filter((e) => e.mode === 'camera').length;

  let cnPlayed = 0, cnWins = 0, cnSpyWins = 0, assassinLosses = 0;
  for (const g of events) {
    if (g.type !== 'codenames' || g.aborted) continue;
    const p = (g.players || []).find((x) => norm(x.name) === me);
    if (!p) continue;
    cnPlayed += 1;
    const won = !!g.winner && g.winner === p.team;
    if (won) cnWins += 1;
    if (won && p.role === 'spymaster') cnSpyWins += 1;
    if (!won && g.winReason === 'assassin') assassinLosses += 1;
  }
  let stopPlayed = 0, stopWins = 0;
  for (const r of events) {
    if (r.type !== 'stop') continue;
    const p = (r.players || []).find((x) => norm(x.name) === me);
    if (!p) continue;
    stopPlayed += 1;
    const best = Math.max(...r.players.map((x) => x.total || 0));
    if (best > 0 && (p.total || 0) === best) stopWins += 1;
  }
  const sketches = events.filter((e) => e.type === 'sketch' && norm(e.author) === me).length;

  const metrics = {
    callHours: totalMs / 3600000,
    longestHours: longestMs / 3600000,
    daysActive: days.size,
    nights: nights.size,
    screenHours: screenMs / 3600000,
    cameraShares,
    people: companions.filter((c) => c.ms >= PROFILE_MIN_TOGETHER_MS).length,
    cnWins,
    cnSpyWins,
    stopWins,
    sketches,
    assassinLosses,
  };
  const achievements = ACHIEVEMENTS.map((a) => {
    const value = metrics[a.metric] || 0;
    const level = a.tiers.filter((t) => value >= t).length; // 0 = nenhum, 1 bronze, 2 prata, 3 ouro
    return { id: a.id, name: a.name, desc: a.desc, unit: a.unit, tiers: a.tiers, value: Math.round(value * 10) / 10, level, next: level < 3 ? a.tiers[level] : null };
  });

  return {
    name,
    firstSeen,
    dataSince: ACTIVITY_DATA_SINCE,
    stats: {
      totalMs, longestMs, daysActive: days.size, sessions: mine.length,
      screenMs, shares: shares.length, cameraShares,
      people: metrics.people,
      codenames: { played: cnPlayed, wins: cnWins, spyWins: cnSpyWins },
      stop: { played: stopPlayed, wins: stopWins },
      sketches,
    },
    companions: companions.slice(0, 3),
    achievements,
  };
}

let peakRooms = 0;
let peakParticipants = 0;

function getPeersInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.entries()).map(([id, info]) => ({ id, name: info.name, shareMode: info.shareMode || null, shareStartedAt: info.shareStartedAt || null, version: info.version || null, joinedAt: info.joinedAt || null, allowPings: info.allowPings !== false }));
}

function getRoomsSnapshot() {
  return Array.from(rooms.keys()).map((roomId) => ({
    roomId,
    locked: roomLocks.has(roomId),
    participants: getPeersInRoom(roomId),
    codenames: codenamesAdminView(roomId),
  }));
}

function getFullAdminSnapshot() {
  const roomsList = getRoomsSnapshot();
  const totalParticipants = roomsList.reduce((sum, r) => sum + r.participants.length, 0);
  peakRooms = Math.max(peakRooms, roomsList.length);
  peakParticipants = Math.max(peakParticipants, totalParticipants);
  return {
    rooms: roomsList,
    stats: {
      totalRooms: roomsList.length,
      totalParticipants,
      peakRooms,
      peakParticipants,
      serverStartedAt,
    },
  };
}

function broadcastRoomsToAdmins() {
  if (adminSockets.size === 0) return;
  const snapshot = getFullAdminSnapshot();
  adminSockets.forEach((s) => s.emit('admin-rooms-updated', snapshot));
}

io.use((socket, next) => {
  const provided = socket.handshake.auth?.password || '';
  if (ADMIN_PASSWORD && provided === ADMIN_PASSWORD) {
    socket.data.isAdmin = true;
    return next();
  }
  if (!APP_PASSWORD) return next();
  if (provided === APP_PASSWORD) return next();
  next(new Error('senha invalida'));
});

// Tamanho maximo do codigo da sala e do nome de exibicao.
const MAX_ROOM_ID_LEN = 20;

// "Paygorn", "paygorn " e "paygorn/" sao a MESMA sala: sem diferenca de
// maiuscula/minuscula, sem espaco nas pontas e sem barra no fim (alguns
// navegadores/apps colocam uma "/" no fim do link telinhafix://join?room=X
// e a pessoa caia sozinha numa sala "X/"). Feito aqui no servidor pra
// valer ate pra quem esta com versao antiga do app.
function normalizeRoomId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\/+$/, '').trim().toLowerCase();
}
const MAX_NAME_LEN = 20;

// Limite de acoes por conexao ("balde de fichas"): cada evento gasta 1
// ficha; o balde enche RATE_REFILL_PER_SEC por segundo ate RATE_BUCKET.
// A folga cobre o pico normal de quando alguem entra numa call (muitos
// sinais WebRTC de uma vez). Passou disso: o evento e ignorado (e quem
// esperava resposta recebe um erro); quem continuar inundando e desconectado.
const RATE_BUCKET = 150;
const RATE_REFILL_PER_SEC = 50;
const RATE_DROPS_BEFORE_KICK = 300;

io.on('connection', (socket) => {
  let rateTokens = RATE_BUCKET;
  let rateLastRefill = Date.now();
  let rateDrops = 0;
  socket.use((packet, next) => {
    const now = Date.now();
    rateTokens = Math.min(RATE_BUCKET, rateTokens + ((now - rateLastRefill) / 1000) * RATE_REFILL_PER_SEC);
    rateLastRefill = now;
    if (rateTokens >= 1) {
      rateTokens -= 1;
      rateDrops = Math.max(0, rateDrops - 1);
      return next();
    }
    rateDrops += 1;
    const ack = packet[packet.length - 1];
    if (typeof ack === 'function') ack({ ok: false, error: 'Muitas ações seguidas - espera um pouquinho' });
    if (rateDrops >= RATE_DROPS_BEFORE_KICK) {
      console.warn(`[rate-limit] desconectando ${socket.id} (inundando o servidor)`);
      socket.disconnect(true);
    }
  });

  let currentRoom = null;
  let spectatingRoom = null;

  if (socket.data.isAdmin) {
    adminSockets.add(socket);
    socket.emit('admin-rooms-updated', getFullAdminSnapshot());
  }

  // Em TODOS os handlers de admin abaixo: sempre chama o ack, mesmo quando
  // nao autorizado. Um "return" sem ack deixa a Promise do lado do cliente
  // esperando pra sempre (ex: alguem digita a senha normal por engano em
  // vez da ADMIN_PASSWORD - o socket conecta normal, mas sem isso aqui a
  // tela fica travada em "Conectando..." sem nenhum erro).
  // Recebe (dado, ack) mesmo sem usar "dado" - o client manda um payload
  // (mesmo que undefined) + callback de ack, e isso chega aqui como dois
  // argumentos separados. Com so "(ack)" no parametro, "ack" vira o dado
  // (undefined) por engano e o calback de ack de verdade nunca e chamado -
  // a Promise do lado do cliente fica esperando pra sempre.
  socket.on('admin-list-rooms', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ error: 'nao autorizado' }); return; }
    if (ack) ack(getFullAdminSnapshot());
  });

  // Remove uma pessoa de uma sala direto (sem o admin precisar entrar nela)
  // - so desconecta o socket dela, o resto (avisar os outros, limpar a sala)
  // reaproveita exatamente a mesma logica do disconnect normal abaixo.
  socket.on('admin-history', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    if (ack) ack({ ok: true, serverStartedAt, events: presenceLog });
  });

  // Dashboards: tudo que o servidor registrou desde que ligou (since = so o
  // que veio depois desse horario), pro painel guardar no PC do admin.
  // Com o banco ligado, le de la (inclui o que aconteceu antes desse servidor
  // ligar) e junta com o que ainda esta na memoria/fila; sem banco ou se ele
  // falhar, devolve so a memoria (storage diz de onde veio).
  socket.on('admin-activity', async (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const since = Number(data && data.since) || 0;
    const fromMemory = activityLog.filter((e) => e.t > since);
    if (!activityDbEnabled) { if (ack) ack({ ok: true, serverStartedAt, storage: 'memory', events: fromMemory }); return; }
    try {
      const fromDb = await readActivityFromDb(since);
      const seen = new Set(fromDb.map((e) => e.id));
      const events = fromDb.concat(fromMemory.filter((e) => !seen.has(e.id))).sort((a, b) => a.t - b.t);
      if (ack) ack({ ok: true, serverStartedAt, storage: 'db', events });
    } catch (err) {
      console.error('[stats] falha ao ler o banco:', err.message);
      if (ack) ack({ ok: true, serverStartedAt, storage: 'memory', dbError: err.message, events: fromMemory });
    }
  });

  socket.on('admin-server-health', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const mem = process.memoryUsage();
    let playing = 0;
    codenamesGames.forEach((g) => { if (g.status === 'playing') playing += 1; });
    if (ack) ack({
      ok: true,
      now: Date.now(),
      serverStartedAt,
      uptimeMs: Date.now() - serverStartedAt,
      connections: io.engine.clientsCount,
      admins: adminSockets.size,
      rooms: rooms.size,
      people: Array.from(rooms.values()).reduce((n, r) => n + r.size, 0),
      codenamesPlaying: playing,
      // banco dos dashboards: 'off' (sem variaveis), 'ok' ou 'erro' (+ fila esperando pra salvar)
      statsDb: !activityDbEnabled ? 'off' : activityDbLastError ? 'erro' : 'ok',
      statsDbQueue: activityDbQueue.length,
      rssMb: Math.round(mem.rss / 1048576),
      heapMb: Math.round(mem.heapUsed / 1048576),
      node: process.version,
    });
  });

  // Aviso que aparece como faixa na tela das pessoas (todas, ou de uma sala).
  socket.on('admin-notice', (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const text = String((data && data.text) || '').trim().slice(0, 300);
    const roomId = data && data.roomId ? String(data.roomId) : null;
    if (!text) { if (ack) ack({ ok: false, error: 'Escreva o aviso' }); return; }
    let count = 0;
    io.sockets.sockets.forEach((s) => {
      if (s.data.isAdmin) return;
      if (roomId && !(rooms.get(roomId) && rooms.get(roomId).has(s.id))) return;
      s.emit('admin-notice', { text });
      count += 1;
    });
    if (ack) ack({ ok: true, count });
  });

  // "Pedir pra atualizar": cada app aberto (3.5.6+) confere se tem versao
  // nova e, se tiver, baixa e PERGUNTA se quer reiniciar - nunca reinicia sozinho.
  socket.on('admin-request-update', (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    let count = 0;
    io.sockets.sockets.forEach((s) => { if (!s.data.isAdmin) { s.emit('update-prompt'); count += 1; } });
    if (ack) ack({ ok: true, count });
  });

  socket.on('admin-game-reset', (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const roomId = data && data.roomId;
    const old = codenamesGames.get(roomId);
    if (!old) { if (ack) ack({ ok: false, error: 'Sem partida nessa sala' }); return; }
    clearAnswerTimer(old);
    if (old.status === 'playing') logCodenamesGame(old, true);
    const fresh = createCodenamesGame(roomId);
    fresh.spectators = old.spectators;
    fresh.category = old.category;
    codenamesGames.set(roomId, fresh);
    broadcastGameState(roomId);
    if (ack) ack({ ok: true });
  });

  socket.on('admin-game-skip-turn', (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const roomId = data && data.roomId;
    const game = codenamesGames.get(roomId);
    if (!game || game.status !== 'playing') { if (ack) ack({ ok: false, error: 'Nenhuma partida rolando' }); return; }
    game.log.push(`Admin passou a vez da Equipe ${TEAM_LABEL_FEM[game.currentTeam]}`);
    endGameTurn(game);
    broadcastGameState(roomId);
    if (ack) ack({ ok: true });
  });

  // Musica do dia (ver handleMusic): fila completa com quem votou.
  const adminMusicView = (state) => ({
    ok: true,
    day: state.day,
    today: state.today,
    queue: state.queue.map((q, i) => ({ pos: i + 1, ...q.track, votes: q.votes, by: q.by, firstAt: q.firstAt })),
    votersToday: Object.keys(state.votesByDevice).length,
  });
  socket.on('admin-music-get', async (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    try { if (ack) ack(adminMusicView(await currentMusic())); } catch (err) { if (ack) ack({ ok: false, error: err.message }); }
  });
  socket.on('admin-music-remove', async (data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    try {
      const state = await currentMusic();
      const i = state.queue.findIndex((q) => q.track.id === Number(data && data.trackId));
      if (i < 0) { if (ack) ack({ ok: false, error: 'Essa música não está na fila' }); return; }
      state.queue.splice(i, 1);
      persistMusic();
      if (ack) ack(adminMusicView(state));
    } catch (err) { if (ack) ack({ ok: false, error: err.message }); }
  });
  socket.on('admin-music-skip', async (_data, ack) => {
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    try {
      const state = await currentMusic();
      await advanceMusic(state);
      persistMusic();
      console.log(`[musica] admin trocou a de hoje: ${state.today.title} - ${state.today.artist}`);
      if (ack) ack(adminMusicView(state));
    } catch (err) { if (ack) ack({ ok: false, error: err.message }); }
  });

  socket.on('admin-kick', (data, ack) => {
    const { socketId } = data || {};
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const target = io.sockets.sockets.get(socketId);
    if (target) target.disconnect(true);
    if (ack) ack({ ok: !!target });
  });

  // Desconecta todo mundo de uma sala de uma vez (participantes E
  // espectadores admin que estiverem la).
  socket.on('admin-close-room', (data, ack) => {
    const { roomId } = data || {};
    if (!socket.data.isAdmin) { if (ack) ack({ ok: false, error: 'nao autorizado' }); return; }
    const room = rooms.get(roomId);
    if (room) Array.from(room.keys()).forEach((id) => io.sockets.sockets.get(id)?.disconnect(true));
    const specs = spectatorsByRoom.get(roomId);
    if (specs) Array.from(specs).forEach((id) => io.sockets.sockets.get(id)?.disconnect(true));
    if (ack) ack({ ok: true });
  });

  // Modo espectador invisivel: o admin passa a receber video/audio de todo
  // mundo na sala, mas NAO entra no Map "rooms" (nao conta como
  // participante, nao aparece na lista de ninguem) - os participantes de
  // verdade so sabem que precisam mandar midia pra esse id via o evento
  // 'spectator-joined' (ver abaixo), nunca via o 'peer-joined' normal.
  socket.on('admin-spectate-room', (data, ack) => {
    const { roomId } = data || {};
    if (!socket.data.isAdmin) {
      if (ack) ack({ ok: false, error: 'nao autorizado' });
      return;
    }
    if (!roomId || typeof roomId !== 'string' || !rooms.has(roomId)) {
      if (ack) ack({ ok: false, error: 'sala nao encontrada' });
      return;
    }
    spectatingRoom = roomId;
    if (!spectatorsByRoom.has(roomId)) spectatorsByRoom.set(roomId, new Set());
    spectatorsByRoom.get(roomId).add(socket.id);

    const existingPeers = getPeersInRoom(roomId);
    if (ack) ack({ ok: true, selfId: socket.id, peers: existingPeers, iceServers: getIceServers() });
    socket.to(roomId).emit('spectator-joined', { id: socket.id });
  });

  socket.on('join-room', (data, ack) => {
    const { version } = data || {};
    const appVersion = typeof version === 'string' ? version.slice(0, 20) : null; // apps antigos (<= 3.5.5) nao mandam
    const roomId = normalizeRoomId(data && data.roomId);
    if (!roomId) {
      if (ack) ack({ ok: false, error: 'roomId invalido' });
      return;
    }
    if (roomId.length > MAX_ROOM_ID_LEN) {
      if (ack) ack({ ok: false, error: `O código da sala pode ter no máximo ${MAX_ROOM_ID_LEN} caracteres` });
      return;
    }
    // nome: so texto, ate MAX_NAME_LEN caracteres (o resto e cortado)
    const name = (typeof data.name === 'string' ? data.name : '').trim().slice(0, MAX_NAME_LEN) || 'Anonimo';
    if (currentRoom) { if (ack) ack({ ok: false, error: 'Você já está em uma sala' }); return; }

    // Reconexao automatica (a internet caiu ou o servidor reiniciou): so vale
    // com o token que essa pessoa recebeu ao entrar, e pra MESMA sala.
    const rejoinToken = data && typeof data.rejoinToken === 'string' ? data.rejoinToken : null;
    const rejoin = rejoinToken && rejoinTokens.get(rejoinToken);
    const validRejoin = !!rejoin && rejoin.roomId === roomId;

    // Sala com senha (ver roomLocks): quem ja estava dentro e so reconectou
    // (token valido) volta direto; o resto precisa da senha.
    const lock = rooms.has(roomId) ? roomLocks.get(roomId) : null;
    if (lock && !validRejoin) {
      const ip = String(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').split(',')[0].trim();
      const attemptKey = `${ip}|${roomId}`;
      const now = Date.now();
      const recent = (roomPasswordFails.get(attemptKey) || []).filter((t) => now - t < ROOM_PASSWORD_WINDOW_MS);
      if (recent.length >= ROOM_PASSWORD_MAX_FAILS) {
        const waitS = Math.ceil((recent[0] + ROOM_PASSWORD_WINDOW_MS - now) / 1000);
        if (ack) ack({ ok: false, needsPassword: true, error: `Muitas tentativas erradas - tenta de novo em ${waitS}s` });
        return;
      }
      const given = data && typeof data.roomPassword === 'string' ? data.roomPassword : '';
      if (!given) { if (ack) ack({ ok: false, needsPassword: true, error: 'Essa sala tem senha' }); return; }
      if (!roomPasswordMatches(lock, given)) {
        recent.push(now);
        roomPasswordFails.set(attemptKey, recent);
        if (ack) ack({ ok: false, needsPassword: true, wrongPassword: true, error: 'Senha incorreta' });
        return;
      }
    }
    if (rejoin) rejoinTokens.delete(rejoinToken); // token vale uma vez so

    currentRoom = roomId;
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);
    const isNewRoom = room.size === 0;
    // A conexao antiga ainda nao caiu do lado do servidor (ele demora uns
    // segundos pra perceber): a nova assume o lugar dela e a antiga sai em
    // silencio, sem "fulano saiu"/"fulano entrou" pros outros.
    const oldSocket = validRejoin && room.has(rejoin.sid) ? io.sockets.sockets.get(rejoin.sid) : null;

    const existingPeers = getPeersInRoom(roomId).filter((p) => !oldSocket || p.id !== rejoin.sid);

    // roomSince: desde quando a pessoa esta na sala (uma reconexao mantem o
    // horario original) - decide quem herda o cadeado quando o dono sai.
    // joinedAt continua sendo o inicio DESTA conexao (conta as horas em call).
    const roomSince = validRejoin && rejoin.roomSince ? rejoin.roomSince : Date.now();
    room.set(socket.id, { name: name || 'Anonimo', shareMode: null, version: appVersion, joinedAt: Date.now(), roomSince, allowPings: data.allowPings !== false });
    logPresence('join', name || 'Anonimo', roomId, appVersion);
    socket.join(roomId);

    const myToken = crypto.randomBytes(18).toString('hex');
    rejoinTokens.set(myToken, { sid: socket.id, roomId, name: name || 'Anonimo', leftAt: null, roomSince });
    socket.data.rejoinToken = myToken;

    // Dono da sala (quem pode por/tirar senha): a 1a pessoa. Quem so
    // reconectou continua dono; se o dono ja tinha saido, nao volta a ser.
    const owner = roomOwners.get(roomId);
    if (oldSocket && owner === rejoin.sid) roomOwners.set(roomId, socket.id);
    else if (!owner || !room.has(owner)) roomOwners.set(roomId, socket.id);
    // Servidor reiniciou e o dono voltou primeiro: o app dele reenvia a
    // senha que tinha posto (so vale em sala recem-criada por ele).
    const restore = data && typeof data.restoreRoomPassword === 'string' ? data.restoreRoomPassword : '';
    if (isNewRoom && restore && !roomLocks.has(roomId) && validRoomPassword(restore)) {
      roomLocks.set(roomId, makeRoomLock(restore));
    }

    const game = codenamesGames.get(roomId);
    let gameChanged = false;
    if (validRejoin && game) {
      if (oldSocket) {
        transferGameIdentity(game, rejoin.sid, socket.id);
        gameChanged = true;
      } else if (game.status === 'playing') {
        // A antiga ja tinha caido: volta pro lugar que ficou guardado, se
        // ainda estiver livre (ninguem pegou nesse meio tempo).
        const vi = game.vacated.findIndex((v) => v.sid === rejoin.sid);
        const seat = vi >= 0 ? game.vacated[vi] : null;
        const t = seat && game.teams[seat.team];
        const free = t && !game.eliminated.includes(seat.team)
          && (seat.role === 'spymaster' ? !t.spymaster : t.agents.length < GAME_MODES[game.mode].maxAgents);
        if (free) {
          game.vacated.splice(vi, 1);
          if (seat.role === 'spymaster') t.spymaster = socket.id; else t.agents.push(socket.id);
          if (!game.joinOrder.includes(socket.id)) game.joinOrder.push(socket.id);
          game.log.push(`${name} voltou pra Equipe ${TEAM_LABEL_FEM[seat.team]}`);
          gameChanged = true;
        } else if (!seat && rejoin.spectator !== undefined) {
          game.spectators[socket.id] = rejoin.spectator;
          if (rejoin.mapViewer) game.mapViewers.add(socket.id);
          gameChanged = true;
        }
      } else if (rejoin.spectator !== undefined) {
        game.spectators[socket.id] = rejoin.spectator;
        gameChanged = true;
      }
    }

    if (ack) ack({ ok: true, selfId: socket.id, peers: existingPeers, iceServers: getIceServers(), rejoinToken: myToken, rejoined: validRejoin, chatHistory: chatHistoryFor(roomId), lock: roomLockState(roomId) });
    // dono mudou (sala nova ou reconexao do dono): todo mundo atualiza o cadeado
    if (!isNewRoom) broadcastRoomLockState(roomId);

    socket.to(roomId).emit('peer-joined', { id: socket.id, name: name || 'Anonimo', rejoin: validRejoin, replaces: oldSocket ? rejoin.sid : null, allowPings: data.allowPings !== false });
    // Espectadores invisiveis tambem precisam saber de gente nova pra
    // conseguir receber a midia dela - 'peer-joined' direto pra cada um
    // (nao via socket.to, porque eles nunca dao socket.join na sala).
    const specs = spectatorsByRoom.get(roomId);
    if (specs) specs.forEach((id) => io.to(id).emit('peer-joined', { id: socket.id, name: name || 'Anonimo' }));

    if (oldSocket) {
      oldSocket.data.replacedBy = socket.id;
      oldSocket.disconnect(true);
    }
    if (gameChanged) broadcastGameState(roomId);
    // Listas de palavras do pessoal dessa sala: carrega do banco na primeira
    // vez e avisa todo mundo quando chegar.
    if (!wordListsByRoom.has(roomId)) {
      loadRoomWordLists(roomId).then((lists) => { if (lists.length && rooms.has(roomId)) broadcastGameState(roomId); });
    }

    // Codenames: quem SAIU e entrou de novo pelo botao (sem token) NAO e
    // colocado de volta no time sozinho (pedido do Rafael) - ao abrir o
    // Codenames ele ve "Partida em andamento" e escolhe: assistir com/sem
    // mapa ou pegar uma vaga livre; o lugar antigo aparece marcado (ver
    // "vacated" no estado).
    broadcastRoomsToAdmins();
  });

  // Apontar na tela: Alt + clique na transmissao de tela de alguem mostra
  // uma seta pra sala toda (e por cima do monitor de quem transmite). Quem
  // transmite pode desligar (Configuracoes > Transmissao).
  let lastPingAt = 0;
  socket.on('set-ping-permission', (data) => {
    const info = currentRoom && rooms.get(currentRoom)?.get(socket.id);
    if (!info) return;
    info.allowPings = !(data && data.allow === false);
    socket.to(currentRoom).emit('peer-ping-permission', { id: socket.id, allow: info.allowPings });
  });
  socket.on('screen-ping', (data, ack) => {
    const room = currentRoom && rooms.get(currentRoom);
    const me = room && room.get(socket.id);
    const targetId = data && data.target;
    const target = room && typeof targetId === 'string' ? room.get(targetId) : null;
    const x = Number(data && data.x);
    const y = Number(data && data.y);
    if (!me || !target || targetId === socket.id) { if (ack) ack({ ok: false, error: 'Pessoa não encontrada' }); return; }
    if (target.shareMode !== 'screen' && target.shareMode !== 'screen-native') { if (ack) ack({ ok: false, error: 'Só dá pra apontar em transmissão de tela' }); return; }
    if (target.allowPings === false) { if (ack) ack({ ok: false, error: `${target.name} não deixa apontar na tela`, denied: true }); return; }
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) { if (ack) ack({ ok: false, error: 'Ponto inválido' }); return; }
    const now = Date.now();
    if (now - lastPingAt < 300) { if (ack) ack({ ok: false, error: 'Calma' }); return; }
    lastPingAt = now;
    io.to(currentRoom).emit('screen-ping', { target: targetId, from: socket.id, name: me.name, x, y });
    if (ack) ack({ ok: true });
  });

  // Senha da sala (ver roomLocks): so o dono poe, troca ou tira.
  socket.on('room-lock-set', (data, ack) => {
    if (!currentRoom || !rooms.get(currentRoom)?.has(socket.id)) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (roomOwners.get(currentRoom) !== socket.id) { if (ack) ack({ ok: false, error: 'Só o dono da sala pode mudar a senha' }); return; }
    const pw = data && typeof data.password === 'string' ? data.password : '';
    if (!validRoomPassword(pw)) { if (ack) ack({ ok: false, error: `A senha precisa ter de ${ROOM_PASSWORD_MIN} a ${ROOM_PASSWORD_MAX} caracteres` }); return; }
    roomLocks.set(currentRoom, makeRoomLock(pw));
    broadcastRoomLockState(currentRoom);
    broadcastRoomsToAdmins();
    if (ack) ack({ ok: true, lock: roomLockState(currentRoom) });
  });
  socket.on('room-lock-clear', (_data, ack) => {
    if (!currentRoom || !rooms.get(currentRoom)?.has(socket.id)) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (roomOwners.get(currentRoom) !== socket.id) { if (ack) ack({ ok: false, error: 'Só o dono da sala pode mudar a senha' }); return; }
    roomLocks.delete(currentRoom);
    broadcastRoomLockState(currentRoom);
    broadcastRoomsToAdmins();
    if (ack) ack({ ok: true, lock: roomLockState(currentRoom) });
  });

  // Perfil (ver computeProfile): o seu, ou o de alguem da mesma sala.
  socket.on('profile-get', async (data, ack) => {
    const room = currentRoom && rooms.get(currentRoom);
    const me = room && room.get(socket.id);
    if (!me) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const asked = data && typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, MAX_NAME_LEN) : me.name;
    const norm = (n) => String(n || '').trim().toLowerCase();
    const inRoom = Array.from(room.values()).some((info) => norm(info.name) === norm(asked));
    if (!inRoom) { if (ack) ack({ ok: false, error: 'Essa pessoa não está na sala' }); return; }
    try {
      const events = await getProfileEvents();
      if (ack) ack({ ok: true, self: norm(asked) === norm(me.name), profile: computeProfile(events, asked, Date.now()) });
    } catch (err) {
      console.error('[perfil] falha:', err);
      if (ack) ack({ ok: false, error: 'Não deu pra montar o perfil agora' });
    }
  });

  // Retrospectiva da pessoa nessa sala (ver computeWrapped).
  socket.on('wrapped-get', async (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const period = data && data.period === 'month' ? 'month' : 'week';
    const roomId = currentRoom;
    const name = rooms.get(roomId)?.get(socket.id)?.name;
    if (!name) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    try {
      const events = await getWrappedEvents(period);
      const now = Date.now();
      if (ack) ack({ ok: true, period, storage: activityDbEnabled ? 'db' : 'memory', serverStartedAt, wrapped: computeWrapped(events, roomId, name, now - WRAPPED_PERIODS[period], now) });
    } catch (err) {
      console.error('[wrapped] falha:', err);
      if (ack) ack({ ok: false, error: 'Não deu pra montar a retrospectiva agora' });
    }
  });

  // Copia de uma mensagem do chat pro historico da sala (ver chatHistories).
  // O autor e sempre o nome de quem mandou, nunca o que vier no payload.
  socket.on('chat-store', (data) => {
    if (!currentRoom) return;
    const info = rooms.get(currentRoom)?.get(socket.id);
    if (!info) return;
    const text = (data && typeof data.text === 'string' ? data.text : '').trim().slice(0, CHAT_TEXT_MAX);
    if (!text) return;
    storeChatMessage(currentRoom, info.name, text);
  });

  // So repassa pra quem esta na MESMA sala (ou, pro modo espectador do
  // admin, entre o espectador e os participantes daquela sala) - antes
  // dava pra mandar sinal pra qualquer conexao do servidor sabendo o id.
  socket.on('signal', (payload) => {
    const { to, data } = payload || {};
    if (!to || typeof to !== 'string') return;
    const myRoom = currentRoom ? rooms.get(currentRoom) : null;
    const mySpecs = currentRoom ? spectatorsByRoom.get(currentRoom) : null;
    const memberToMemberOrSpectator = !!myRoom && (myRoom.has(to) || (!!mySpecs && mySpecs.has(to)));
    const spectatorToMember = !!spectatingRoom && !!rooms.get(spectatingRoom) && rooms.get(spectatingRoom).has(to);
    if (!memberToMemberOrSpectator && !spectatorToMember) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  // Avisa a sala o que a pessoa esta transmitindo agora ('camera' | 'screen'
  // | 'screen-native' | null) - guarda no participante pra quem entrar
  // depois ja saber (ver getPeersInRoom), e repassa pra quem ja esta na
  // sala (inclusive espectadores invisiveis, mesmo padrao do join-room).
  socket.on('share-mode-changed', (data) => {
    if (!currentRoom) return;
    const mode = (data && typeof data.mode === 'string' && SHARE_MODES.has(data.mode)) ? data.mode : null;
    const room = rooms.get(currentRoom);
    if (room && room.has(socket.id)) {
      const info = room.get(socket.id);
      // Trocou de modo (ou parou): fecha a transmissao anterior com a duracao.
      if (info.shareMode !== mode) {
        endShareActivity(currentRoom, info, Date.now());
        info.shareStartedAt = mode ? Date.now() : null;
      }
      info.shareMode = mode;
    }
    socket.to(currentRoom).emit('peer-share-mode', { id: socket.id, mode });
    const specs = spectatorsByRoom.get(currentRoom);
    if (specs) specs.forEach((id) => io.to(id).emit('peer-share-mode', { id: socket.id, mode }));
  });

  // Minijogo "Codigo Secreto" (Codenames) - os jogadores sao sempre quem
  // estiver na MESMA sala (mesmo codigo), currentRoom (fechado aqui em cima
  // pelo join-room). Estado fica so no servidor (por sala) pra garantir que
  // todo mundo ve exatamente o mesmo tabuleiro/vez/placar; o mapa secreto
  // (qual palavra e de qual time) so e mandado pro socket do Mestre-Espiao
  // de cada equipe, nunca pro grupo todo.
  socket.on('game-get-state', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (ack) ack({ ok: true, state: publicGameState(currentRoom) });
  });

  socket.on('game-get-secret-map', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || (game.status !== 'playing' && game.status !== 'over')) {
      if (ack) ack({ ok: false, error: 'Nenhuma partida em andamento' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    // Espectador que escolheu "assistir com mapa" tambem recebe o mapa.
    if (!role && game.spectators[socket.id] === true) {
      const firstLook = game.status === 'playing' && !game.mapViewers.has(socket.id);
      if (firstLook) game.mapViewers.add(socket.id);
      if (ack) ack({ ok: true, round: game.round, boardId: game.boardId, map: game.board.map((c) => c.team) });
      // avisa todo mundo (o app dessa pessoa ja desativa "Entrar como agente")
      if (firstLook) broadcastGameState(currentRoom);
      return;
    }
    if (!role || role.role !== 'spymaster') {
      if (ack) ack({ ok: false, error: 'Só o Mestre-Espião vê o mapa secreto' });
      return;
    }
    if (game.status === 'playing' && game.eliminated.includes(role.team)) {
      if (ack) ack({ ok: false, error: 'Sua equipe foi eliminada' });
      return;
    }
    if (ack) ack({ ok: true, round: game.round, boardId: game.boardId, map: game.board.map((c) => c.team) });
  });

  // So pode trocar o modo (livre/2x2/3x3/ffa3) com a partida parada - troca
  // zera as equipes escolhidas ate agora, porque os times disponiveis (e o
  // teto de agentes) podem mudar inteiramente (ex: ffa3 tem uma 3a equipe).
  socket.on('game-set-mode', (data, ack) => {
    const { mode } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar o modo com a partida em andamento' }); return; }
    if (!GAME_MODES[mode]) { if (ack) ack({ ok: false, error: 'Modo inválido' }); return; }
    game.mode = mode;
    game.teams = emptyTeams(mode);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Categoria das palavras (Normal / Counter-Strike) - mesma regra do modo:
  // qualquer um troca, so fora da partida. Vale pro proximo tabuleiro.
  socket.on('game-set-category', (data, ack) => {
    const { category } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra trocar as palavras com a partida em andamento' }); return; }
    const isCustom = typeof category === 'string' && (wordListsByRoom.get(currentRoom) || []).some((l) => `custom:${l.id}` === category);
    if (!CODENAMES_CATEGORIES[category] && !isCustom) { if (ack) ack({ ok: false, error: 'Categoria inválida' }); return; }
    game.category = category;
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Listas de palavras do pessoal (ver wordListsByRoom): qualquer um da sala
  // cria, edita e apaga - sao da sala, nao de uma pessoa.
  socket.on('game-wordlist-save', async (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const roomId = currentRoom;
    const name = (data && typeof data.name === 'string' ? data.name : '').replace(/\s+/g, ' ').trim().slice(0, WORDLIST_MAX_NAME_LEN);
    if (!name) { if (ack) ack({ ok: false, error: 'Dê um nome pra lista' }); return; }
    const { words, tooLong } = parseWordListText(data && data.words);
    if (tooLong.length) { if (ack) ack({ ok: false, error: `Palavra grande demais (máx. ${WORDLIST_MAX_WORD_LEN} letras): ${tooLong.slice(0, 3).join(', ')}` }); return; }
    if (words.length < WORDLIST_MIN_WORDS) { if (ack) ack({ ok: false, error: `A lista precisa de pelo menos ${WORDLIST_MIN_WORDS} palavras diferentes (tem ${words.length})` }); return; }
    if (words.length > WORDLIST_MAX_WORDS) { if (ack) ack({ ok: false, error: `No máximo ${WORDLIST_MAX_WORDS} palavras por lista (tem ${words.length})` }); return; }
    const lists = await loadRoomWordLists(roomId);
    const author = rooms.get(roomId)?.get(socket.id)?.name || 'Alguém';
    const id = data && typeof data.id === 'string' ? data.id : null;
    const now = Date.now();
    let list;
    if (id) {
      list = lists.find((l) => l.id === id);
      if (!list) { if (ack) ack({ ok: false, error: 'Essa lista não existe mais' }); return; }
      if (lists.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { if (ack) ack({ ok: false, error: 'Já tem uma lista com esse nome' }); return; }
      Object.assign(list, { name, words, updatedAt: now });
    } else {
      if (lists.length >= WORDLIST_MAX_PER_ROOM) { if (ack) ack({ ok: false, error: `No máximo ${WORDLIST_MAX_PER_ROOM} listas por sala - apague alguma antes` }); return; }
      if (lists.some((l) => l.name.toLowerCase() === name.toLowerCase())) { if (ack) ack({ ok: false, error: 'Já tem uma lista com esse nome' }); return; }
      list = { id: crypto.randomBytes(6).toString('hex'), name, author, words, createdAt: now, updatedAt: now };
      lists.push(list);
    }
    persistRoomWordLists(roomId);
    // Lista nova ja fica escolhida (se nao tiver partida rolando).
    const game = getOrCreateGame(roomId);
    if (!id && game.status !== 'playing') game.category = `custom:${list.id}`;
    broadcastGameState(roomId);
    if (ack) ack({ ok: true, list: wordListMeta(list) });
  });

  socket.on('game-wordlist-get', async (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const lists = await loadRoomWordLists(currentRoom);
    const list = lists.find((l) => l.id === (data && data.id));
    if (!list) { if (ack) ack({ ok: false, error: 'Essa lista não existe mais' }); return; }
    if (ack) ack({ ok: true, list: { ...wordListMeta(list), words: list.words.slice() } });
  });

  socket.on('game-wordlist-delete', async (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const roomId = currentRoom;
    const lists = await loadRoomWordLists(roomId);
    const i = lists.findIndex((l) => l.id === (data && data.id));
    if (i < 0) { if (ack) ack({ ok: false, error: 'Essa lista não existe mais' }); return; }
    const game = getOrCreateGame(roomId);
    if (game.status === 'playing' && game.category === `custom:${lists[i].id}`) {
      if (ack) ack({ ok: false, error: 'Essa lista está sendo usada na partida agora' });
      return;
    }
    if (game.category === `custom:${lists[i].id}`) game.category = DEFAULT_CODENAMES_CATEGORY;
    lists.splice(i, 1);
    persistRoomWordLists(roomId);
    broadcastGameState(roomId);
    if (ack) ack({ ok: true });
  });

  socket.on('game-set-role', (data, ack) => {
    const { team, role } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    const validTeams = GAME_MODES[game.mode].teams;
    if (!validTeams.includes(team)) { if (ack) ack({ ok: false, error: 'Equipe inválida' }); return; }
    if (role !== 'spymaster' && role !== 'agent') { if (ack) ack({ ok: false, error: 'Papel inválido' }); return; }
    // Partida rolando: quem esta de fora (ou assistindo) pode pegar uma vaga
    // livre; quem ja joga nao troca de time no meio.
    const midGame = game.status === 'playing';
    if (midGame) {
      if (playerGameRole(game, socket.id)) { if (ack) ack({ ok: false, error: 'Não dá pra trocar de equipe com a partida em andamento' }); return; }
      if (game.eliminated.includes(team)) { if (ack) ack({ ok: false, error: 'Essa equipe já foi eliminada nessa partida' }); return; }
      // Quem assistiu com o mapa nessa partida ja sabe a cor das cartas -
      // como agente seria trapaca; como Mestre-Espiao (que ve o mapa) pode.
      if (role === 'agent' && game.mapViewers.has(socket.id)) {
        if (ack) ack({ ok: false, error: 'Você viu o mapa assistindo - nessa partida só dá pra entrar como Mestre-Espião' });
        return;
      }
    }
    if (role === 'spymaster' && game.teams[team].spymaster && game.teams[team].spymaster !== socket.id) {
      if (ack) ack({ ok: false, error: 'Essa equipe já tem um Mestre-Espião' });
      return;
    }
    const maxAgents = GAME_MODES[game.mode].maxAgents;
    if (role === 'agent' && game.teams[team].agents.length >= maxAgents && !game.teams[team].agents.includes(socket.id)) {
      if (ack) ack({ ok: false, error: 'Essa equipe já está cheia nesse modo' });
      return;
    }
    const lobbyWasEmpty = validTeams.every((t) => !game.teams[t].spymaster && game.teams[t].agents.length === 0);
    removeFromGameTeams(game, socket.id);
    delete game.spectators[socket.id]; // escolheu um time: deixa de ser espectador
    if (role === 'spymaster') game.teams[team].spymaster = socket.id;
    else game.teams[team].agents.push(socket.id);
    if (!game.joinOrder.includes(socket.id)) game.joinOrder.push(socket.id);
    if (midGame) {
      const myName = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
      // o lugar de quem caiu deixa de ser "lugar vago de Fulano"
      const vi = game.vacated.findIndex((v) => v.team === team && v.role === role);
      if (vi >= 0) game.vacated.splice(vi, 1);
      game.vacated = game.vacated.filter((v) => String(v.name).trim().toLowerCase() !== myName.trim().toLowerCase());
      game.log.push(`${myName} entrou na Equipe ${TEAM_LABEL_FEM[team]} como ${role === 'spymaster' ? 'Mestre-Espião' : 'agente'}`);
    }
    broadcastGameState(currentRoom);
    // Codenames nao tem um "abrir lobby" explicito - o primeiro a escolher
    // equipe num lobby vazio e quem "iniciou" o jogo, e tambem quem fica
    // marcado como anfitriao (so ele pode apertar "Iniciar partida").
    if (lobbyWasEmpty) {
      game.hostId = socket.id;
      notifyMinigameStarted(socket, currentRoom, 'codenames');
    }
    if (ack) ack({ ok: true });
  });

  // "Sortear times" (so o anfitriao, so no lobby): embaralha TODO MUNDO da
  // sala nos times do modo - primeiro 1 mestre-espiao por time, depois os
  // agentes em rodizio ate o limite do modo; quem sobrar fica assistindo.
  socket.on('game-shuffle-teams', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status !== 'lobby') { if (ack) ack({ ok: false, error: 'Só dá pra sortear no lobby' }); return; }
    if (game.hostId && !isGameHost(game, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode sortear os times' });
      return;
    }
    const room = rooms.get(currentRoom);
    // Quem esta em Espectadores fica de fora do sorteio.
    const people = shuffle(Array.from(room ? room.keys() : []).filter((id) => !(id in game.spectators)));
    const teams = GAME_MODES[game.mode].teams;
    const maxAgents = GAME_MODES[game.mode].maxAgents;
    game.teams = emptyTeams(game.mode);
    const queue = [...people];
    teams.forEach((t) => { if (queue.length) game.teams[t].spymaster = queue.shift(); });
    let ti = 0;
    let fullRounds = 0;
    while (queue.length && fullRounds < teams.length) {
      const t = teams[ti % teams.length];
      if (game.teams[t].agents.length < maxAgents) { game.teams[t].agents.push(queue.shift()); fullRounds = 0; } else { fullRounds += 1; }
      ti += 1;
    }
    if (!game.hostId) game.hostId = socket.id;
    game.joinOrder = [socket.id, ...people.filter((id) => id !== socket.id && playerGameRole(game, id))];
    broadcastGameState(currentRoom);
    notifyMinigameStarted(socket, currentRoom, 'codenames');
    if (ack) ack({ ok: true });
  });

  // Entrar em Espectadores (com ou sem o mapa secreto). Da pra virar
  // espectador ou trocar com/sem mapa a qualquer hora - mas quem esta num
  // time so sai dele no lobby (com a partida rolando o time ficaria
  // desfalcado), e espectador so entra num time no lobby (ver game-set-role).
  socket.on('game-set-spectator', (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (playerGameRole(game, socket.id)) {
      if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra sair da equipe com a partida em andamento' }); return; }
      removeFromGameTeams(game, socket.id);
      delete game.marks[socket.id];
    }
    game.spectators[socket.id] = !!(data && data.withMap);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-leave-role', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game) { if (ack) ack({ ok: true }); return; }
    // Sair de Espectadores pode a qualquer hora (nao desfalca ninguem).
    if (socket.id in game.spectators) {
      delete game.spectators[socket.id];
      broadcastGameState(currentRoom);
      if (ack) ack({ ok: true });
      return;
    }
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Não dá pra sair da equipe com a partida em andamento' }); return; }
    removeFromGameTeams(game, socket.id);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-start', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateGame(currentRoom);
    if (game.status === 'playing') { if (ack) ack({ ok: false, error: 'Já tem uma partida em andamento' }); return; }
    if (!isGameHost(game, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode iniciar a partida' });
      return;
    }
    if (!gameTeamsBothReady(game)) {
      if (ack) ack({ ok: false, error: 'Cada equipe precisa de 1 Mestre-Espião e pelo menos 1 Agente' });
      return;
    }
    game.hostId = socket.id;
    startNewGameRound(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-play-again', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'over') { if (ack) ack({ ok: false, error: 'A partida ainda não acabou' }); return; }
    if (!isGameHost(game, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode iniciar a partida' });
      return;
    }
    if (!gameTeamsBothReady(game)) {
      if (ack) ack({ ok: false, error: 'Cada equipe precisa de 1 Mestre-Espião e pelo menos 1 Agente' });
      return;
    }
    game.hostId = socket.id;
    startNewGameRound(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-reset-lobby', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const oldGame = codenamesGames.get(currentRoom);
    // So restringe pro anfitriao quando esta ENCERRANDO uma partida em
    // andamento (botao "Encerrar partida") - voltar ao lobby depois que a
    // partida ja acabou sozinha ("Trocar equipes"/"Jogar de novo") continua
    // livre pra qualquer um, isso nunca foi a parte sensivel.
    if (oldGame && oldGame.status === 'playing' && !isGameHost(oldGame, currentRoom, socket.id)) {
      if (ack) ack({ ok: false, error: 'Só quem abriu o lobby pode encerrar a partida' });
      return;
    }
    if (oldGame) clearAnswerTimer(oldGame);
    if (oldGame && oldGame.status === 'playing') logCodenamesGame(oldGame, true); // encerrada antes do fim
    const fresh = createCodenamesGame(currentRoom);
    if (oldGame) {
      fresh.spectators = oldGame.spectators; // quem escolheu so assistir continua assistindo
      fresh.category = oldGame.category; // e as palavras escolhidas continuam as mesmas
    }
    codenamesGames.set(currentRoom, fresh);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-give-clue', (data, ack) => {
    const { word, number, targets } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'clue') {
      if (ack) ack({ ok: false, error: 'Não é hora de dar uma pista' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam || role.role !== 'spymaster') {
      if (ack) ack({ ok: false, error: 'Só o Mestre-Espião da vez pode dar a pista' });
      return;
    }
    const cleanWord = String(word || '').trim().slice(0, 40);
    if (!cleanWord) { if (ack) ack({ ok: false, error: 'Escreva uma palavra-pista' }); return; }
    let n = Number(number);
    if (!Number.isInteger(n) || n < 0) n = 0;
    if (n > 9) n = 9;
    const remaining = countRemaining(game, game.currentTeam);
    game.clue = { word: cleanWord, number: n, guessesMade: 0, guessesAllowed: n === 0 ? Infinity : Math.min(n + 1, remaining) };
    const cleanTargets = Array.isArray(targets)
      ? [...new Set(targets.map(Number))].filter((i) => Number.isInteger(i) && game.board[i] && !game.board[i].revealed).slice(0, 9)
      : [];
    game.clueHistory.push({ team: game.currentTeam, word: cleanWord, number: n, hits: 0, targets: cleanTargets });
    const teamLabel = TEAM_LABEL[game.currentTeam];
    const name = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    game.log.push(`${name} (Mestre-Espião ${teamLabel}) deu a pista "${cleanWord.toUpperCase()}" ${n}`);
    game.phase = 'guess';

    game.clueGivenAt = Date.now();
    startPhaseTimer(game);

    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-reveal-word', (data, ack) => {
    const { index } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') {
      if (ack) ack({ ok: false, error: 'Não é hora de escolher uma palavra' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam || role.role !== 'agent') {
      if (ack) ack({ ok: false, error: 'Só os agentes da equipe da vez podem escolher uma palavra' });
      return;
    }
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= game.board.length || !game.board[i] || game.board[i].revealed) {
      if (ack) ack({ ok: false, error: 'Palavra inválida' });
      return;
    }

    const cell = game.board[i];
    cell.revealed = true;
    for (const [id, idx] of Object.entries(game.marks)) if (idx === i) delete game.marks[id];
    const name = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    const teamLabel = TEAM_LABEL[game.currentTeam];

    if (cell.team === 'assassin') {
      game.log.push(`${name} (${teamLabel}) revelou o ASSASSINO: "${cell.word}"!`);
      if (game.mode === 'ffa3') {
        // No modo "Todos contra todos" quem cai num assassino e eliminado
        // (nao perde a partida inteira) - o jogo continua pros outros times
        // ainda vivos, a nao ser que so sobre 1, que ja vence na hora.
        game.eliminated.push(game.currentTeam);
        const survivors = GAME_MODES[game.mode].teams.filter((t) => !game.eliminated.includes(t));
        if (survivors.length <= 1) {
          game.status = 'over';
          game.winner = survivors[0] || null;
          game.winReason = 'last-standing';
          game.phase = null;
        } else {
          endGameTurn(game);
        }
      } else {
        const otherTeam = GAME_MODES[game.mode].teams.find((t) => t !== game.currentTeam);
        game.status = 'over';
        game.winner = otherTeam;
        game.winReason = 'assassin';
        game.phase = null;
      }
    } else if (cell.team === game.currentTeam) {
      game.log.push(`${name} (${teamLabel}) acertou "${cell.word}"`);
      game.clue.guessesMade += 1;
      const lastClue = game.clueHistory[game.clueHistory.length - 1];
      if (lastClue && lastClue.team === game.currentTeam) lastClue.hits += 1;
      checkGameWinConditions(game);
      if (game.status === 'playing' && game.clue.guessesAllowed !== Infinity && game.clue.guessesMade >= game.clue.guessesAllowed) {
        endGameTurn(game);
      }
    } else {
      const otherLabel = cell.team === 'neutral' ? 'uma palavra neutra' : `uma palavra do time ${TEAM_LABEL[cell.team]}`;
      game.log.push(`${name} (${teamLabel}) revelou ${otherLabel}: "${cell.word}"`);
      checkGameWinConditions(game);
      if (game.status === 'playing') endGameTurn(game);
    }

    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-mark-cell', (data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') { if (ack) ack({ ok: false, error: 'Não é hora de palpitar' }); return; }
    const role = playerGameRole(game, socket.id);
    if (!role || role.role !== 'agent' || role.team !== game.currentTeam) { if (ack) ack({ ok: false, error: 'Só os agentes da vez podem marcar' }); return; }
    const index = data && data.index;
    if (index === null || index === undefined) {
      delete game.marks[socket.id];
    } else {
      const i = Number(index);
      if (!Number.isInteger(i) || !game.board[i] || game.board[i].revealed) { if (ack) ack({ ok: false, error: 'Carta inválida' }); return; }
      game.marks[socket.id] = i;
    }
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('game-end-turn', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = codenamesGames.get(currentRoom);
    if (!game || game.status !== 'playing' || game.phase !== 'guess') {
      if (ack) ack({ ok: false, error: 'Não dá pra passar a vez agora' });
      return;
    }
    const role = playerGameRole(game, socket.id);
    if (!role || role.team !== game.currentTeam) { if (ack) ack({ ok: false, error: 'Você não está na equipe da vez' }); return; }
    if (role.role !== 'agent') { if (ack) ack({ ok: false, error: 'Só os agentes podem passar a vez' }); return; }
    const teamLabel = TEAM_LABEL[game.currentTeam];
    game.log.push(`Equipe ${teamLabel} passou a vez`);
    endGameTurn(game);
    broadcastGameState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Minijogo "Stop / Adedonha" - sem equipes/papeis, todo mundo que estiver
  // na sala quando a rodada comecar vira jogador dessa rodada.
  socket.on('stop-get-state', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (ack) ack({ ok: true, state: stopPublicState(currentRoom) });
  });

  // Abre o LOBBY (nao comeca a rodada direto) - todo mundo precisa apertar
  // "Pronto" (ver stop-toggle-ready) pra rodada comecar igual pra todo
  // mundo ao mesmo tempo, em vez de quem clicou primeiro sair na frente.
  socket.on('stop-start-round', (data, ack) => {
    const { categories } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateStopGame(currentRoom);
    if (game.status === 'lobby' || game.status === 'playing') { if (ack) ack({ ok: false, error: 'Já tem uma rodada em andamento' }); return; }
    // Quem abre o lobby pode mandar a lista de categorias que montou (ver
    // stop-view no renderer); se nao mandar nada valido, repete as da
    // ultima rodada (ou o padrao, numa sala que nunca jogou).
    if (categories !== undefined) {
      const clean = sanitizeCategoryList(categories);
      if (!clean) { if (ack) ack({ ok: false, error: `Escolha entre ${STOP_MIN_CATEGORIES} e ${STOP_MAX_CATEGORIES} categorias (sem repetir)` }); return; }
      game.categories = clean;
    }
    if (game.timer) { clearTimeout(game.timer); game.timer = null; }
    game.status = 'lobby';
    game.readyPlayers = new Set();
    game.results = null;
    broadcastStopState(currentRoom);
    notifyMinigameStarted(socket, currentRoom, 'stop');
    if (ack) ack({ ok: true });
  });

  // Liga/desliga o "Pronto" de quem chamou. Quando todo mundo que esta na
  // sala agora estiver pronto, a rodada comeca sozinha (tryStartStopRoundFromLobby).
  socket.on('stop-toggle-ready', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'lobby') { if (ack) ack({ ok: false, error: 'Não tem lobby aberto' }); return; }
    if (game.readyPlayers.has(socket.id)) game.readyPlayers.delete(socket.id);
    else game.readyPlayers.add(socket.id);
    tryStartStopRoundFromLobby(currentRoom, game);
    broadcastStopState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Escape hatch: comeca a rodada mesmo sem todo mundo pronto (ex: alguem
  // ficou ausente/AFK e o resto nao quer esperar pra sempre).
  socket.on('stop-force-start', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'lobby') { if (ack) ack({ ok: false, error: 'Não tem lobby aberto' }); return; }
    beginStopRound(currentRoom, game);
    broadcastStopState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Fecha o lobby sem comecar (volta pro editor de categorias).
  socket.on('stop-cancel-lobby', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'lobby') { if (ack) ack({ ok: true }); return; }
    game.status = 'idle';
    game.readyPlayers = new Set();
    broadcastStopState(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Sincroniza em tempo real o que a pessoa ja digitou (sem isso, quando
  // alguem aperta "Parar" o servidor nao teria como saber o que os OUTROS
  // jogadores ja tinham escrito na hora de fechar a rodada pra todo mundo).
  // Sem ack de proposito - e so uma atualizacao de rascunho, disparada a
  // cada pausa de digitacao; nao precisa de confirmacao de ida e volta.
  socket.on('stop-sync-answers', (data) => {
    const { values } = data || {};
    if (!currentRoom) return;
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'playing') return;
    const p = game.players.get(socket.id);
    if (!p) return;
    p.values = sanitizeStopValues(values, game.categories);
  });

  socket.on('stop-call-stop', (data, ack) => {
    const { values } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = stopGames.get(currentRoom);
    if (!game || game.status !== 'playing') { if (ack) ack({ ok: false, error: 'Não tem rodada em andamento' }); return; }
    const p = game.players.get(socket.id);
    if (!p) { if (ack) ack({ ok: false, error: 'Você não está jogando essa rodada' }); return; }
    const elapsed = Date.now() - game.startedAt;
    if (elapsed < game.minStopMs) {
      const remaining = Math.ceil((game.minStopMs - elapsed) / 1000);
      if (ack) ack({ ok: false, error: `Espera mais ${remaining}s antes de dar Stop (${game.categories.length} categorias)` });
      return;
    }
    const clean = sanitizeStopValues(values, game.categories);
    const missing = game.categories.some((cat) => !clean[cat]);
    if (missing) { if (ack) ack({ ok: false, error: 'Preencha todas as categorias antes de dar Stop' }); return; }
    p.values = clean;
    finalizeStopRound(currentRoom);
    if (ack) ack({ ok: true });
  });

  // Minijogo "Sketch do PC" - "Voce prefere A ou B?" com votacao ao vivo.
  // Sem roster fixo (diferente do Stop): qualquer um que estiver na sala
  // pode votar a qualquer momento enquanto a votacao estiver aberta, mesmo
  // quem entrou depois da pergunta ter sido criada.
  socket.on('sketch-get-state', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    if (ack) ack({ ok: true, state: sketchPublicState(currentRoom) });
  });

  socket.on('sketch-create', (data, ack) => {
    const { optionA, optionB } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateSketchGame(currentRoom);
    if (game.status === 'voting') { if (ack) ack({ ok: false, error: 'Já tem uma votação em andamento' }); return; }
    const cleanA = String(optionA || '').trim().slice(0, SKETCH_OPTION_MAX_LEN);
    const cleanB = String(optionB || '').trim().slice(0, SKETCH_OPTION_MAX_LEN);
    if (!cleanA || !cleanB) { if (ack) ack({ ok: false, error: 'Preencha as duas opções' }); return; }
    game.optionA = cleanA;
    game.optionB = cleanB;
    game.authorName = (rooms.get(currentRoom)?.get(socket.id)?.name) || 'Alguém';
    game.votes = new Map();
    game.status = 'voting';
    game.round += 1;
    broadcastSketchState(currentRoom);
    notifyMinigameStarted(socket, currentRoom, 'sketch');
    if (ack) ack({ ok: true });
  });

  socket.on('sketch-vote', (data, ack) => {
    const { choice } = data || {};
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = sketchGames.get(currentRoom);
    if (!game || game.status !== 'voting') { if (ack) ack({ ok: false, error: 'Não tem votação em andamento' }); return; }
    if (choice !== 'a' && choice !== 'b') { if (ack) ack({ ok: false, error: 'Escolha inválida' }); return; }
    game.votes.set(socket.id, choice);
    maybeAutoEndSketchVote(currentRoom, game);
    broadcastSketchState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('sketch-end-vote', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = sketchGames.get(currentRoom);
    if (!game || game.status !== 'voting') { if (ack) ack({ ok: false, error: 'Não tem votação em andamento' }); return; }
    game.status = 'ended';
    broadcastSketchState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('sketch-reset', (_data, ack) => {
    if (!currentRoom) { if (ack) ack({ ok: false, error: 'Você não está em uma sala' }); return; }
    const game = getOrCreateSketchGame(currentRoom);
    game.status = 'idle';
    game.optionA = null;
    game.optionB = null;
    game.authorName = null;
    game.votes = new Map();
    broadcastSketchState(currentRoom);
    if (ack) ack({ ok: true });
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket);

    if (spectatingRoom && spectatorsByRoom.has(spectatingRoom)) {
      spectatorsByRoom.get(spectatingRoom).delete(socket.id);
      if (spectatorsByRoom.get(spectatingRoom).size === 0) spectatorsByRoom.delete(spectatingRoom);
      socket.to(spectatingRoom).emit('spectator-left', { id: socket.id });
    }

    // O token de voltar continua valendo por um tempo depois de cair, e
    // lembra se a pessoa assistia o Codenames (com/sem mapa).
    const myRejoin = socket.data.rejoinToken && rejoinTokens.get(socket.data.rejoinToken);
    if (myRejoin) {
      myRejoin.leftAt = Date.now();
      const g = currentRoom && codenamesGames.get(currentRoom);
      if (g && socket.id in g.spectators) {
        myRejoin.spectator = g.spectators[socket.id];
        myRejoin.mapViewer = g.mapViewers.has(socket.id);
      }
      if (socket.data.replacedBy) rejoinTokens.delete(socket.data.rejoinToken);
    }

    if (currentRoom && rooms.has(currentRoom)) {
      const leavingName = rooms.get(currentRoom).get(socket.id)?.name || 'Alguém';
      const replaced = !!socket.data.replacedBy;
      logPresence('leave', leavingName, currentRoom, rooms.get(currentRoom).get(socket.id)?.version);
      endSessionActivity(currentRoom, rooms.get(currentRoom).get(socket.id), Date.now());
      rooms.get(currentRoom).delete(socket.id);
      const specs = spectatorsByRoom.get(currentRoom);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
        roomLocks.delete(currentRoom); // a senha some junto com a sala
        roomOwners.delete(currentRoom);
        const deadGame = codenamesGames.get(currentRoom);
        if (deadGame) clearAnswerTimer(deadGame);
        if (deadGame && deadGame.status === 'playing') logCodenamesGame(deadGame, true); // sala esvaziou no meio
        codenamesGames.delete(currentRoom);
        const stopGame = stopGames.get(currentRoom);
        if (stopGame && stopGame.timer) clearTimeout(stopGame.timer);
        stopGames.delete(currentRoom);
        sketchGames.delete(currentRoom);
      } else {
        socket.to(currentRoom).emit('peer-left', { id: socket.id, replaced });
        // o dono saiu (e nao foi so reconexao): o cadeado passa pra quem
        // entrou primeiro entre os que ficaram
        if (roomOwners.get(currentRoom) === socket.id) {
          let next = null;
          for (const [id, info] of rooms.get(currentRoom)) if (!next || info.roomSince < next.since) next = { id, since: info.roomSince };
          roomOwners.set(currentRoom, next.id);
          broadcastRoomLockState(currentRoom);
        }
        const game = codenamesGames.get(currentRoom);
        if (game) {
          const role = playerGameRole(game, socket.id);
          // Partida rolando: guarda o lugar pra pessoa voltar se reconectar
          // com o mesmo nome (ver join-room).
          if (role && game.status !== 'lobby') {
            game.vacated.push({ name: leavingName, team: role.team, role: role.role, sid: socket.id });
            game.log.push(`${leavingName} saiu da sala (Equipe ${TEAM_LABEL_FEM[role.team]})`);
          }
          removeFromGameTeams(game, socket.id);
          delete game.marks[socket.id];
          delete game.spectators[socket.id];
          if (game.hostId === socket.id) game.hostId = pickNextHost(game, currentRoom, socket.id);
          // O time da vez ficou sem quem precisa agir AGORA (mestre-espiao na
          // fase de pista, ou nenhum agente): pula a vez na hora. Se so o
          // mestre saiu durante os palpites, os agentes terminam essa pista.
          const t = role && game.teams[role.team];
          const stuckNow = t && (t.agents.length === 0 || (game.phase === 'clue' && !t.spymaster));
          if (role && game.status === 'playing' && role.team === game.currentTeam && stuckNow) {
            game.log.push(`Equipe ${TEAM_LABEL_FEM[role.team]} está desfalcada - vez pulada`);
            endGameTurn(game);
          }
          broadcastGameState(currentRoom);
        }
        // Quem sai pode ter sido justamente quem faltava votar - reavalia
        // se a votacao deve se encerrar sozinha agora.
        const sketchGame = sketchGames.get(currentRoom);
        if (sketchGame) {
          maybeAutoEndSketchVote(currentRoom, sketchGame);
          broadcastSketchState(currentRoom);
        }
        // Mesma logica pro lobby do Stop: quem saiu pode ter sido
        // justamente quem faltava ficar pronto.
        const stopGameState = stopGames.get(currentRoom);
        if (stopGameState && stopGameState.status === 'lobby') {
          stopGameState.readyPlayers.delete(socket.id);
          tryStartStopRoundFromLobby(currentRoom, stopGameState);
          broadcastStopState(currentRoom);
        }
      }
      // Mesma logica do join: espectadores recebem o peer-left direto.
      if (specs) specs.forEach((id) => io.to(id).emit('peer-left', { id: socket.id, replaced }));
      broadcastRoomsToAdmins();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de sinalizacao rodando na porta ${PORT}`);
});

// O Render manda SIGTERM antes de desligar (deploy novo ou o plano gratis
// "dormindo"). Fecha as sessoes/transmissoes em andamento como "cut" e manda
// pros paineis admin abertos guardarem - senao esse tempo se perderia.
let shuttingDown = false;
function flushActivityAndExit() {
  if (shuttingDown) return;
  shuttingDown = true;
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    for (const info of room.values()) endSessionActivity(roomId, info, now, true);
  }
  for (const game of codenamesGames.values()) if (game.status === 'playing') logCodenamesGame(game, true);
  // termina de salvar no banco antes de sair (no maximo ~4s)
  waitActivityDbIdle(4000).then(() => setTimeout(() => process.exit(0), 300));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', flushActivityAndExit);
process.on('SIGINT', flushActivityAndExit);
