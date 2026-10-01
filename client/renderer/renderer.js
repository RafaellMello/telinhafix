// --- Tema (fonte, tamanho de texto, cor principal) --------------------
// Aplicado antes de mais nada pra evitar um "flash" com o tema padrao.

const FONT_STACKS = {
  inter: "'Inter', 'Segoe UI', Arial, sans-serif",
  poppins: "'Poppins', 'Segoe UI', Arial, sans-serif",
  jetbrains: "'JetBrains Mono', Consolas, monospace",
  anton: "'Anton', 'Segoe UI', Arial, sans-serif",
  nunito: "'Nunito', 'Segoe UI', Arial, sans-serif",
};

const THEME_STORAGE_KEY = 'telinhafix-theme';
const DEFAULT_THEME = { font: 'inter', scale: 1, color: '#e2231a', mode: 'latadelixo', border: 'arredondada' };

function hexToRgbString(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r; let g; let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function deriveThemeColors(baseHex) {
  const [h, s, l] = hexToHsl(baseHex);
  const bright = hslToHex(h, Math.min(100, s + 10), Math.min(72, l + 15));
  const dark = hslToHex(h, Math.max(25, s - 20), Math.max(8, l - 30));
  return { base: baseHex, bright, dark };
}

function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--font-ui', FONT_STACKS[theme.font] || FONT_STACKS.inter);
  root.setProperty('--font-scale', theme.scale || 1);
  const { base, bright, dark } = deriveThemeColors(theme.color || DEFAULT_THEME.color);
  root.setProperty('--red', base);
  root.setProperty('--red-rgb', hexToRgbString(base));
  root.setProperty('--red-bright', bright);
  root.setProperty('--red-bright-rgb', hexToRgbString(bright));
  root.setProperty('--red-dark', dark);
  // Modo "serio": tira as fotos dos membros/participantes e troca os paineis
  // por um visual liquid glass limpo, em vez do visual "lata de lixo" normal
  // (default - identico ao app de sempre, zero mudanca pra quem nao mexe
  // nessa opcao).
  document.documentElement.classList.toggle('mode-serio', theme.mode === 'serio');
  // Bordas: independente do modo acima - "chama2k19" zera o arredondamento
  // de tudo no app (ver .border-chama2k19 * no CSS), "arredondada" (default)
  // nao mexe em nada.
  document.documentElement.classList.toggle('border-chama2k19', theme.border === 'chama2k19');
}

function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
    return { ...DEFAULT_THEME, ...(saved || {}) };
  } catch (err) {
    return { ...DEFAULT_THEME };
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (err) {
    // sem localStorage, o tema so nao persiste - sem problema.
  }
}

let currentTheme = loadTheme();
applyTheme(currentTheme);

function setupSettingsPanel() {
  const overlay = document.getElementById('settings-overlay');
  const btnOpen = document.getElementById('btn-settings');
  const btnOpenRoom = document.getElementById('btn-settings-room');
  const btnClose = document.getElementById('btn-settings-close');
  const modeOptions = document.querySelectorAll('.mode-option');
  const borderOptions = document.querySelectorAll('.border-option');
  const fontOptions = document.querySelectorAll('.font-option');
  const sizeOptions = document.querySelectorAll('.size-option');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const colorCustom = document.getElementById('color-custom');
  if (!overlay) return;

  function refreshUI() {
    modeOptions.forEach((el) => el.classList.toggle('selected', el.dataset.mode === currentTheme.mode));
    borderOptions.forEach((el) => el.classList.toggle('selected', el.dataset.border === currentTheme.border));
    fontOptions.forEach((el) => el.classList.toggle('selected', el.dataset.font === currentTheme.font));
    sizeOptions.forEach((el) => el.classList.toggle('selected', Number(el.dataset.scale) === currentTheme.scale));
    colorSwatches.forEach((el) => {
      el.classList.toggle('selected', el.dataset.color.toLowerCase() === currentTheme.color.toLowerCase());
    });
    colorCustom.value = currentTheme.color;
  }

  function updateTheme(patch) {
    currentTheme = { ...currentTheme, ...patch };
    applyTheme(currentTheme);
    saveTheme(currentTheme);
    refreshUI();
  }

  function openSettings() {
    refreshUI();
    overlay.classList.remove('hidden');
  }

  function closeSettings() {
    overlay.classList.add('hidden');
  }

  if (btnOpen) btnOpen.addEventListener('click', openSettings);
  if (btnOpenRoom) btnOpenRoom.addEventListener('click', openSettings);
  btnClose.addEventListener('click', closeSettings);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  modeOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ mode: el.dataset.mode }));
  });
  borderOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ border: el.dataset.border }));
  });
  fontOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ font: el.dataset.font }));
  });
  sizeOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ scale: Number(el.dataset.scale) }));
  });
  colorSwatches.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ color: el.dataset.color }));
  });
  colorCustom.addEventListener('input', () => updateTheme({ color: colorCustom.value }));
}

setupSettingsPanel();

// --- Animacoes da tela de login (entrada em cascata + brilho nos inputs) ---

// Toca (ou retoca) a animacao de entrada em cascata do formulario de login.
// Chamado no carregamento inicial e de novo toda vez que a pessoa volta pra
// essa tela (ver leaveRoom) - remove a classe, forca um reflow pra garantir
// que o navegador registre o estado "escondido" de novo, e re-adiciona num
// requestAnimationFrame pra disparar a transicao do zero.
function triggerLoginReveal() {
  const box = document.querySelector('.login-box');
  if (!box) return;
  box.classList.remove('revealed');
  void box.offsetWidth; // forca reflow
  requestAnimationFrame(() => {
    requestAnimationFrame(() => box.classList.add('revealed'));
  });
}

function setupInputSpotlights() {
  document.querySelectorAll('.input-spotlight').forEach((wrapper) => {
    wrapper.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      wrapper.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
      wrapper.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
    });
    wrapper.addEventListener('mouseenter', () => wrapper.classList.add('spotlight-active'));
    wrapper.addEventListener('mouseleave', () => wrapper.classList.remove('spotlight-active'));
  });
}

function setupPasswordToggle() {
  const btn = document.getElementById('btn-toggle-password');
  const input = document.getElementById('server-password');
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.querySelector('.eye-icon-show').classList.toggle('hidden', !showing);
    btn.querySelector('.eye-icon-hide').classList.toggle('hidden', showing);
    btn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Esconder senha');
  });
}

setupInputSpotlights();
setupPasswordToggle();
triggerLoginReveal();

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const loginScreen = document.getElementById('login-screen');
const roomScreen = document.getElementById('room-screen');
const loginError = document.getElementById('login-error');
const roomLabel = document.getElementById('room-label');
const participantsList = document.getElementById('participants-list');
const videoGrid = document.getElementById('video-grid');
const btnShare = document.getElementById('btn-share');
const btnShareNative = document.getElementById('btn-share-native');
const btnShareCamera = document.getElementById('btn-share-camera');
const btnToggleCamera = document.getElementById('btn-toggle-camera');
const btnStopShare = document.getElementById('btn-stop-share');
const btnLeave = document.getElementById('btn-leave');
const btnJoin = document.getElementById('btn-join');

const NAME_PLACEHOLDERS = [
  'Ex: bunny',
  'Ex: zicaneto',
  'Ex: chama2k19',
  'Ex: pc',
  'Ex: babini',
  'Ex: cokaizi',
];

function startNamePlaceholderCycle() {
  const input = document.getElementById('display-name');
  let i = 0;
  input.placeholder = NAME_PLACEHOLDERS[i];
  setInterval(() => {
    i = (i + 1) % NAME_PLACEHOLDERS.length;
    input.placeholder = NAME_PLACEHOLDERS[i];
  }, 2000);
}

startNamePlaceholderCycle();

// Endereco do servidor fixo - a pessoa nao escolhe mais, pra evitar erro
// de digitacao/configuracao e simplificar a tela de login.
const DEFAULT_SERVER_URL = 'https://screenbunny.onrender.com';

// Lembra a senha global, mas so depois que ela realmente funcionou (conectou
// de verdade) - assim um typo nao fica salvo e preenchido de novo na proxima
// vez, fazendo a pessoa achar que a senha mudou sozinha.
const SERVER_PASSWORD_STORAGE_KEY = 'telinhafix-server-password';

function restoreSavedServerPassword() {
  try {
    const saved = localStorage.getItem(SERVER_PASSWORD_STORAGE_KEY);
    if (saved) document.getElementById('server-password').value = saved;
  } catch (err) {
    // localStorage indisponivel - segue sem lembrar a senha.
  }
}

function saveWorkingServerPassword(password) {
  try {
    localStorage.setItem(SERVER_PASSWORD_STORAGE_KEY, password);
  } catch (err) {
    // localStorage indisponivel - segue sem lembrar a senha.
  }
}

restoreSavedServerPassword();

const AVATAR_FILES = [
  'babini.jpg', 'babini2.jpg', 'coka.jpg', 'dani.jpg', 'rudeus.jpg',
  'fab.jpg', 'hent.jpg', 'img-20240330-wa0127_original.jpg', 'nathan.jpg',
  'nathanthegoat.jpg', 'pc.jpg', 'screenshot_20251112_185935_discord.jpg',
  'thiaginfn.jpg', 'thiaguinis.jpg', 'tutuzada.jpg', 'yuri.jpg',
];

// peerId -> nome do arquivo de avatar sorteado pra essa pessoa NESSA
// entrada na sala. Sorteia de novo toda vez que alguem entra (ver
// addParticipantRow) e esquece quando a pessoa sai (removeParticipantRow),
// entao uma nova entrada pode vir com outra foto.
const assignedAvatars = new Map();

function assignRandomAvatar(id) {
  const file = AVATAR_FILES[Math.floor(Math.random() * AVATAR_FILES.length)];
  assignedAvatars.set(id, file);
  return file;
}

function avatarFor(id) {
  if (!assignedAvatars.has(id)) assignRandomAvatar(id);
  return `assets/avatars/${assignedAvatars.get(id)}`;
}

function populateMembersColumns() {
  const left = document.getElementById('members-left');
  const right = document.getElementById('members-right');
  if (!left || !right) return;

  AVATAR_FILES.forEach((file, i) => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.style.setProperty('--tilt', `${(i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 3)}deg`);
    const img = document.createElement('img');
    img.src = `assets/avatars/${file}`;
    img.alt = '';
    card.appendChild(img);
    (i % 2 === 0 ? left : right).appendChild(card);
  });
}

populateMembersColumns();

let selfId = null;
let localStream = null;
// Qualidade (resolucao/fps/bitrate) escolhida no seletor de tela.
let currentQuality = null;
// peerId -> { pc, polite, makingOffer, ignoreOffer, name }
const peers = new Map();
// peerId -> nome, usado para a lista de participantes
const peerNames = new Map();

async function applyBitrateToSender(sender, quality) {
  if (!sender || !quality) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = quality.maxBitrate;
    await sender.setParameters(params);
  } catch (err) {
    console.error('Falha ao ajustar bitrate do video:', err);
  }
}

// Se a pessoa ja rodou o teste automatico de qualidade (opcional, no
// seletor de aparencia - ver quality-test.js), ele mede qual codec essa
// maquina especifica consegue codificar em tempo real de verdade (testa
// AV1/VP9/VP8 numa conexao local e mede o fps real via getStats, em vez
// de supor) e usa esse resultado aqui. Sem teste, cai no palpite padrao:
// VP9 primeiro (bom equilibrio, acelerado por hardware na maioria das
// placas recentes), AV1 depois (comprime melhor mas a codificacao pra
// WebRTC ainda e via software na maioria das maquinas - arriscado como
// primeira opcao sem saber se a maquina aguenta).
function getRecommendedCodec() {
  try {
    const raw = localStorage.getItem('telinhafix-quality-profile');
    const saved = raw ? JSON.parse(raw) : null;
    return saved && saved.recommendedCodec ? saved.recommendedCodec : null;
  } catch (err) {
    return null;
  }
}

function preferVideoCodecs(pc) {
  if (typeof RTCRtpSender === 'undefined' || !RTCRtpSender.getCapabilities) return;
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps || !caps.codecs) return;

  // O Chromium (testado no Electron 33) rejeita setCodecPreferences com
  // "InvalidModificationError: invalid codec with name H264" quando a
  // lista reordenada inclui as variantes de H264 que getCapabilities
  // devolve (parece validar mal os varios perfis/packetization-mode). Como
  // os dois lados sempre rodam o mesmo Electron embutido, H264 nunca faz
  // falta como fallback de compatibilidade - so tira ele da lista em vez
  // de tentar descobrir qual variante exata passaria na validacao.
  const recommended = getRecommendedCodec();
  const defaultOrder = ['video/VP9', 'video/AV1', 'video/VP8'];
  const order = recommended ? [recommended, ...defaultOrder.filter((c) => c !== recommended)] : defaultOrder;

  const filtered = caps.codecs.filter((c) => c.mimeType !== 'video/H264');
  const preferred = filtered
    .filter((c) => order.includes(c.mimeType))
    .sort((a, b) => order.indexOf(a.mimeType) - order.indexOf(b.mimeType));
  const rest = filtered.filter((c) => !order.includes(c.mimeType));
  const sorted = [...preferred, ...rest];

  pc.getTransceivers().forEach((t) => {
    if (t.sender && t.sender.track && t.sender.track.kind === 'video' && t.setCodecPreferences) {
      try { t.setCodecPreferences(sorted); } catch (err) { console.error('Falha ao definir codec de video preferido:', err); }
    }
  });
}

function setLoginError(msg, isInfo = false) {
  loginError.textContent = msg || '';
  loginError.style.color = isInfo ? 'var(--text-muted)' : '';
}

function addParticipantRow(id, name, isSelf) {
  const li = document.createElement('li');
  li.id = `participant-${id}`;

  const avatar = document.createElement('img');
  avatar.className = 'avatar-dot';
  avatar.src = avatarFor(id);
  avatar.alt = '';

  const label = document.createElement('span');
  label.textContent = isSelf ? `${name} (voce)` : name;

  li.appendChild(avatar);
  li.appendChild(label);
  participantsList.appendChild(li);
}

function removeParticipantRow(id) {
  const li = document.getElementById(`participant-${id}`);
  if (li) li.remove();
  assignedAvatars.delete(id);
}

// --- Tela cheia, destacar (PiP) e modo foco -------------------------------

function toggleTileFullscreen(tile) {
  if (document.fullscreenElement === tile) {
    document.exitFullscreen();
  } else {
    tile.requestFullscreen().catch((err) => console.error('Falha ao entrar em tela cheia:', err));
  }
}

let focusedPeerId = null;

function applyFocusClassesTo(tile, peerId) {
  if (!focusedPeerId) {
    tile.classList.remove('tile-focused', 'tile-minor');
    return;
  }
  tile.classList.toggle('tile-focused', peerId === focusedPeerId);
  tile.classList.toggle('tile-minor', peerId !== focusedPeerId);
}

function setFocus(peerId) {
  focusedPeerId = focusedPeerId === peerId ? null : peerId;
  videoGrid.classList.toggle('layout-focus', !!focusedPeerId);
  document.querySelectorAll('.video-tile').forEach((t) => {
    applyFocusClassesTo(t, t.id.replace('tile-', ''));
  });
}

// --- Indicador de qualidade da conexao ------------------------------------

const QUALITY_COLORS = { green: '#3ddc73', yellow: '#f2c94c', red: '#ff4d4d' };
const QUALITY_LABELS = { green: 'Conexao boa', yellow: 'Conexao instavel', red: 'Conexao ruim' };

function setQualityDot(peerId, level) {
  const dot = document.getElementById(`quality-${peerId}`);
  if (!dot) return;
  dot.style.background = QUALITY_COLORS[level] || QUALITY_COLORS.green;
  dot.title = QUALITY_LABELS[level] || '';
}

async function pollRemoteQuality(peerId, pc) {
  try {
    const stats = await pc.getStats();
    let inboundVideo = null;
    let rttMs = null;
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') inboundVideo = report;
      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) {
        rttMs = report.currentRoundTripTime * 1000;
      }
    });
    if (!inboundVideo) return;
    const lost = inboundVideo.packetsLost || 0;
    const received = inboundVideo.packetsReceived || 0;
    const total = lost + received;
    const lossPct = total > 0 ? (lost / total) * 100 : 0;
    let level = 'green';
    if (lossPct > 8 || (rttMs && rttMs > 500)) level = 'red';
    else if (lossPct > 2 || (rttMs && rttMs > 250)) level = 'yellow';
    setQualityDot(peerId, level);
  } catch (err) {
    // tenta de novo no proximo ciclo
  }
}

async function pollSelfQuality() {
  if (!localStream || !selfId) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  let level = 'green';
  for (const [, state] of peers) {
    const sender = state.pc.getSenders().find((s) => s.track === videoTrack);
    if (!sender) continue;
    try {
      const stats = await sender.getStats();
      stats.forEach((report) => {
        if (report.type !== 'outbound-rtp' || report.kind !== 'video') return;
        if (report.qualityLimitationReason === 'bandwidth') level = 'red';
        else if (report.qualityLimitationReason === 'cpu' && level !== 'red') level = 'yellow';
      });
    } catch (err) {
      // tenta de novo no proximo ciclo
    }
  }
  setQualityDot(selfId, level);
}

setInterval(() => {
  for (const [peerId, state] of peers) {
    if (state.pc.connectionState === 'connected') pollRemoteQuality(peerId, state.pc);
  }
  pollSelfQuality();
}, 3000);

// --- Contador de audiencia (so pra quem esta compartilhando) -------------

function updateSelfAudienceLabel() {
  if (!selfId) return;
  const tile = document.getElementById(`tile-${selfId}`);
  if (!tile) return;
  const labelText = tile.querySelector('.label-text');
  if (!labelText) return;
  const base = shareMode === 'camera' ? 'Você (câmera)' : 'Você (compartilhando)';
  labelText.textContent = `${base} — ${peers.size} na sala`;
}

// --- Mixer de volume de verdade (Web Audio) -------------------------------
// video.volume trava em 1.0 (100%) - nao da pra "aumentar" alem disso.
// Passamos o audio de cada remoto por um GainNode pra poder ir ate 200%, e
// de quebra usamos o mesmo mecanismo pra suprimir o audio dos outros
// enquanto VOCE esta compartilhando (senao o que toca nas suas caixas de
// som entra na sua propria captura de sistema e vira eco pros outros).
let sharedAudioCtx = null;
const remoteGainNodes = new Map(); // peerId -> { gainNode, sliderValue, video }

// --- Ocultar transmissao de alguem (so pra voce, botao direito na tile) --
const hiddenPeers = new Set();
let activeTileContextMenu = null;

function closeTileContextMenu() {
  if (activeTileContextMenu) {
    activeTileContextMenu.remove();
    activeTileContextMenu = null;
  }
}

function setTileContentHidden(peerId, tile, hidden) {
  if (hidden) hiddenPeers.add(peerId);
  else hiddenPeers.delete(peerId);
  tile.classList.toggle('content-hidden', hidden);
  applyGain(peerId);
}

function showTileContextMenu(x, y, peerId, tile) {
  closeTileContextMenu();

  const menu = document.createElement('div');
  menu.className = 'tile-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const isHidden = hiddenPeers.has(peerId);
  const item = document.createElement('div');
  item.className = 'tile-context-menu-item';
  item.textContent = isHidden ? 'Mostrar essa transmissão' : 'Ocultar essa transmissão';
  item.addEventListener('click', () => {
    setTileContentHidden(peerId, tile, !isHidden);
    closeTileContextMenu();
  });

  menu.appendChild(item);
  document.body.appendChild(menu);
  activeTileContextMenu = menu;
}

document.addEventListener('click', closeTileContextMenu);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.video-tile')) closeTileContextMenu();
});

function getSharedAudioContext() {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume().catch(() => {});
  return sharedAudioCtx;
}

// createMediaElementSource(video) se mostrou nao confiavel com um <video>
// cujo srcObject e um MediaStream ao vivo (WebRTC) - o audio saia sempre
// mudo (testei e confirmei: bytes chegando de verdade pela rede, mas o
// grafo do Web Audio lia silencio puro). createMediaStreamSource direto na
// track de audio, ignorando o elemento de video, e o jeito recomendado
// pra esse caso e funciona de forma confiavel.
//
// Como a track passa a ser consumida por DOIS lugares ao mesmo tempo (o
// <video>, que mostra a imagem, e esse source node, que cuida do audio),
// o <video> fica mudo (video.muted = true) pra nao tocar o audio dele
// tambem por fora do nosso GainNode - senao ficaria dobrado.
function wireRemoteAudioGain(peerId, video, audioTrack) {
  if (remoteGainNodes.has(peerId)) return;
  video.muted = true;
  const audioCtx = getSharedAudioContext();
  const sourceNode = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
  const gainNode = audioCtx.createGain();
  sourceNode.connect(gainNode).connect(audioCtx.destination);
  remoteGainNodes.set(peerId, { gainNode, sliderValue: 100 });
  applyGain(peerId);
}

function applyGain(peerId) {
  const entry = remoteGainNodes.get(peerId);
  if (!entry) return;
  // Enquanto voce compartilha capturando audio do sistema, suprime o audio
  // dos outros pra nao vazar eco na sua propria transmissao. No modo camera
  // isso nao se aplica: nao capturamos audio do sistema nesse modo, entao
  // nao ha risco de eco e a pessoa continua ouvindo os outros normalmente.
  // E corta de vez quando a transmissao esta oculta (botao direito na tile).
  const hiddenFactor = hiddenPeers.has(peerId) ? 0 : 1;
  const suppressForEcho = !!localStream && shareMode !== 'camera';
  entry.gainNode.gain.value = (suppressForEcho ? 0 : entry.sliderValue / 100) * hiddenFactor;
}

function refreshAllGainsForSharingState() {
  for (const peerId of remoteGainNodes.keys()) applyGain(peerId);
}

function updateSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = ((Number(slider.value) - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--red-bright) 0%, var(--red-bright) ${pct}%, rgba(255, 255, 255, 0.25) ${pct}%, rgba(255, 255, 255, 0.25) 100%)`;
}

function getOrCreateVideoTile(peerId, label, isSelf = false) {
  let tile = document.getElementById(`tile-${peerId}`);
  if (tile) return tile.querySelector('video');

  tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `tile-${peerId}`;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  // Sem isso, quem compartilha ouviria o proprio audio capturado tocando
  // de volta pelas caixas de som dele mesmo (eco).
  if (isSelf) video.muted = true;

  const labelEl = document.createElement('div');
  labelEl.className = 'label';

  const qualityDot = document.createElement('span');
  qualityDot.className = 'quality-dot';
  qualityDot.id = `quality-${peerId}`;
  qualityDot.title = 'Conexao';

  const labelText = document.createElement('span');
  labelText.className = 'label-text';
  labelText.textContent = label;

  labelEl.appendChild(qualityDot);
  labelEl.appendChild(labelText);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'tile-actions';

  const btnFullscreen = document.createElement('button');
  btnFullscreen.className = 'tile-action-btn';
  btnFullscreen.textContent = '⛶';
  btnFullscreen.title = 'Tela cheia (ou 2 cliques no video)';
  btnFullscreen.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTileFullscreen(tile);
  });

  const btnPip = document.createElement('button');
  btnPip.className = 'tile-action-btn';
  btnPip.textContent = '\u{1F5D7}';
  btnPip.title = 'Destacar em janela flutuante';
  btnPip.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('Falha ao destacar video:', err);
    }
  });

  const btnFocus = document.createElement('button');
  btnFocus.className = 'tile-action-btn';
  btnFocus.textContent = '\u{1F50D}';
  btnFocus.title = 'Focar (encolher os outros)';
  btnFocus.addEventListener('click', (e) => {
    e.stopPropagation();
    setFocus(peerId);
  });

  actionsRow.appendChild(btnFullscreen);
  actionsRow.appendChild(btnPip);
  actionsRow.appendChild(btnFocus);

  tile.appendChild(video);
  tile.appendChild(labelEl);
  tile.appendChild(actionsRow);
  tile.addEventListener('dblclick', () => toggleTileFullscreen(tile));

  // Ocultar so afeta o que VOCE ve dessa pessoa - local, ninguem mais na
  // sala e afetado. Botao direito na tile pra ligar/desligar.
  if (!isSelf) {
    const hiddenOverlay = document.createElement('div');
    hiddenOverlay.className = 'tile-hidden-overlay';
    hiddenOverlay.textContent = 'Transmissão oculta — clique com o botão direito para mostrar de novo';
    tile.appendChild(hiddenOverlay);

    tile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTileContextMenu(e.clientX, e.clientY, peerId, tile);
    });

    const reconnectingBadge = document.createElement('div');
    reconnectingBadge.className = 'tile-reconnecting-badge';
    reconnectingBadge.innerHTML = '<span class="dot"></span><span>Reconectando...</span>';
    tile.appendChild(reconnectingBadge);
  }

  // Volume so afeta o que VOCE ouve dessa pessoa - e local, ninguem mais
  // na sala e afetado. Por isso nao existe controle na sua propria tile.
  // A conexao com o Web Audio (createMediaElementSource) NAO e feita aqui -
  // precisa ser depois que video.srcObject for atribuido (ver
  // wireRemoteAudioGain, chamada em pc.ontrack). Criar o node antes disso
  // fazia o audio sair sempre mudo (RMS 0), porque o Chromium prende o
  // source node no estado "sem stream" que existia no momento da criacao.
  if (!isSelf) {
    const volumeRow = document.createElement('div');
    volumeRow.className = 'volume-control';

    const icon = document.createElement('span');
    icon.className = 'volume-icon';
    icon.textContent = '\u{1F50A}';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '200';
    slider.value = '100';
    slider.title = 'Ate 200% - passar de 100% amplifica alem do volume original';
    slider.className = 'volume-slider';
    updateSliderFill(slider);
    slider.addEventListener('input', () => {
      const pct = Number(slider.value);
      const entry = remoteGainNodes.get(peerId);
      if (entry) {
        entry.sliderValue = pct;
        applyGain(peerId);
      }
      icon.textContent = pct === 0 ? '\u{1F507}' : '\u{1F50A}';
      updateSliderFill(slider);
    });
    slider.addEventListener('click', (e) => e.stopPropagation());

    volumeRow.appendChild(icon);
    volumeRow.appendChild(slider);
    tile.appendChild(volumeRow);
  }

  videoGrid.appendChild(tile);
  applyFocusClassesTo(tile, peerId);

  // Caso raro: a track chega e cria a tile enquanto essa conexao ja estava
  // marcada como "reconectando" por outro motivo - sincroniza o badge com
  // o estado real em vez de deixar a tile nova sem ele.
  if (!isSelf && peers.get(peerId)?.reconnecting) {
    tile.classList.add('tile-reconnecting');
  }

  return video;
}

function removeVideoTile(peerId) {
  const tile = document.getElementById(`tile-${peerId}`);
  if (tile) tile.remove();
  if (focusedPeerId === peerId) setFocus(peerId);
  const gainEntry = remoteGainNodes.get(peerId);
  if (gainEntry) {
    gainEntry.gainNode.disconnect();
    remoteGainNodes.delete(peerId);
  }
  hiddenPeers.delete(peerId);
}

// Mostra/esconde o aviso de "reconectando" numa tile - a pessoa continua
// vendo o ultimo frame congelado por baixo (nao removemos nada durante a
// tentativa de reconexao), so fica claro que o app esta tentando voltar
// sozinho em vez de parecer travado sem explicacao.
function setTileReconnecting(peerId, reconnecting) {
  const tile = document.getElementById(`tile-${peerId}`);
  if (tile) tile.classList.toggle('tile-reconnecting', reconnecting);
}

// Com varias pessoas compartilhando tela ao mesmo tempo (rede em malha: cada
// upload multiplica por participante), e comum uma conexao especifica sofrer
// um engasgo sob a carga - o WebRTC entra em 'disconnected'/'failed'. Em vez
// de desistir depois de um tempo, o app tenta reconectar (restartIce)
// indefinidamente, de tempos em tempos, ate a conexao voltar - a tile so e
// removida por um motivo explicito (a pessoa realmente saiu da sala ou
// parou de compartilhar), nunca so por causa de uma queda de rede.
const RECONNECT_RETRY_INTERVAL_MS = 5000;

function clearReconnectTimers(state) {
  if (state.reconnectInterval) { clearInterval(state.reconnectInterval); state.reconnectInterval = null; }
  state.reconnecting = false;
}

// --- Chat de texto (via RTCDataChannel, ponto a ponto - sem servidor) -----

let chatPanelOpen = false;
let chatUnreadCount = 0;

function setupChatChannel(peerId, channel) {
  channel.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      console.error('Mensagem de chat invalida recebida:', err);
      return;
    }
    const author = peerNames.get(peerId) || 'Participante';
    addChatMessage({ author, text: String(data.text || ''), timestamp: data.timestamp || Date.now(), self: false });
  };
  const state = peers.get(peerId);
  if (state) state.chatChannel = channel;
}

// Constroi a mensagem via createElement/textContent (nunca innerHTML com o
// texto direto) de proposito - o texto e o nome vem de outro participante,
// entao nao da pra confiar que nao tem HTML/script dentro.
function addChatMessage({ author, text, timestamp, self }) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  const row = document.createElement('div');
  row.className = 'chat-message' + (self ? ' self' : '');

  const authorEl = document.createElement('span');
  authorEl.className = 'chat-author';
  authorEl.textContent = author;

  const timeEl = document.createElement('span');
  timeEl.className = 'chat-time';
  timeEl.textContent = new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  row.appendChild(authorEl);
  row.appendChild(document.createTextNode(text));
  row.appendChild(timeEl);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (!self && !chatPanelOpen) {
    chatUnreadCount++;
    updateChatUnreadBadge();
  }
}

function addChatSystemMessage(text) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;
  const row = document.createElement('div');
  row.className = 'chat-system-message';
  row.textContent = text;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateChatUnreadBadge() {
  const badge = document.getElementById('chat-unread-badge');
  if (!badge) return;
  if (chatUnreadCount > 0) {
    badge.textContent = chatUnreadCount > 99 ? '99+' : String(chatUnreadCount);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleChatPanel() {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  chatPanelOpen = !chatPanelOpen;
  panel.classList.toggle('hidden', !chatPanelOpen);
  if (chatPanelOpen) {
    chatUnreadCount = 0;
    updateChatUnreadBadge();
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  }
}

// Manda pra TODOS os peers com canal aberto - e uma malha, entao cada
// conexao tem seu proprio canal independente pra essa mesma mensagem.
function sendChatMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const timestamp = Date.now();
  addChatMessage({ author: 'Você', text: trimmed, timestamp, self: true });

  const payload = JSON.stringify({ text: trimmed, timestamp });
  for (const [, state] of peers) {
    if (state.chatChannel && state.chatChannel.readyState === 'open') {
      try { state.chatChannel.send(payload); } catch (err) { console.error('Falha ao enviar mensagem de chat:', err); }
    }
  }
}

function createPeerConnection(peerId) {
  const polite = selfId < peerId; // regra combinada dos dois lados

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const state = {
    pc, polite, makingOffer: false, ignoreOffer: false,
    reconnecting: false, reconnectInterval: null,
    chatChannel: null,
  };
  peers.set(peerId, state);

  // Chat de texto: so o lado "impolite" cria o canal (senao os dois lados
  // criariam um cada, duplicando) - o outro lado recebe via ondatachannel.
  // Um canal de dados so, usado nos dois sentidos depois de aberto.
  if (!polite) {
    setupChatChannel(peerId, pc.createDataChannel('chat'));
  }
  pc.ondatachannel = (event) => {
    if (event.channel.label === 'chat') setupChatChannel(peerId, event.channel);
  };

  pc.onicecandidate = ({ candidate }) => {
    // .toJSON() vira um objeto simples - RTCIceCandidate de verdade nao
    // sobrevive ao structured clone da contextBridge (preload <-> renderer),
    // o que corrompia a negociacao silenciosamente.
    if (candidate) window.rtc.sendSignal(peerId, { candidate: candidate.toJSON() });
  };

  pc.onnegotiationneeded = async () => {
    try {
      state.makingOffer = true;
      await pc.setLocalDescription();
      window.rtc.sendSignal(peerId, { description: pc.localDescription.toJSON() });
    } catch (err) {
      console.error('Erro ao negociar:', err);
    } finally {
      state.makingOffer = false;
    }
  };

  pc.ontrack = (event) => {
    const name = peerNames.get(peerId) || 'Participante';
    const video = getOrCreateVideoTile(peerId, name);
    video.srcObject = event.streams[0];
    // So conecta ao Web Audio quando a track de AUDIO especificamente
    // chega - assim garante que o stream ja tem audio de verdade no
    // momento da conexao (ver comentario em wireRemoteAudioGain).
    if (event.track.kind === 'audio') {
      wireRemoteAudioGain(peerId, video, event.track);
    }

    // Nao remove a tile aqui - esse evento e pouco confiavel (ja disparou
    // com a conexao ainda saudavel) e agora quem decide se a pessoa
    // realmente sumiu e o onconnectionstatechange, com a logica de espera/
    // reconexao abaixo.
    event.track.onended = () => {};
  };

  pc.onconnectionstatechange = () => {
    const cs = pc.connectionState;

    if (cs === 'connected') {
      clearReconnectTimers(state);
      setTileReconnecting(peerId, false);
      return;
    }

    if (cs === 'closed') {
      // So fica 'closed' quando ALGUEM chama pc.close() de proposito (saiu
      // da sala, parou de compartilhar) - nunca por instabilidade de rede,
      // entao aqui pode remover na hora, sem esperar.
      clearReconnectTimers(state);
      removeVideoTile(peerId);
      return;
    }

    if ((cs === 'disconnected' || cs === 'failed') && !state.reconnecting) {
      state.reconnecting = true;
      setTileReconnecting(peerId, true);
      console.error(`Conexao com ${peerId} caiu (${cs}) - tentando reconectar ate voltar, a tile fica na tela.`);

      state.reconnectInterval = setInterval(() => {
        if (['disconnected', 'failed'].includes(pc.connectionState)) {
          try { pc.restartIce(); } catch (err) { console.error(`Falha ao reiniciar ICE com ${peerId}:`, err); }
        } else {
          // ja recuperou entre um tick e outro - o handler de 'connected'
          // ja deveria ter limpado isso, mas por garantia.
          clearReconnectTimers(state);
        }
      }, RECONNECT_RETRY_INTERVAL_MS);
    }
  };

  // Se ja estamos compartilhando quando essa conexao e criada (ex: alguem
  // entrou na sala depois que voce comecou a compartilhar), manda o video
  // atual pra essa pessoa tambem.
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStream);
      if (track.kind === 'video') applyBitrateToSender(sender, currentQuality);
    });
    preferVideoCodecs(pc);
  }

  return state;
}

async function handleSignal({ from, data }) {
  let state = peers.get(from);
  if (!state) state = createPeerConnection(from);
  const { pc, polite } = state;

  try {
    if (data.description) {
      const offerCollision =
        data.description.type === 'offer' &&
        (state.makingOffer || pc.signalingState !== 'stable');

      state.ignoreOffer = !polite && offerCollision;
      if (state.ignoreOffer) return;

      await pc.setRemoteDescription(data.description);
      if (data.description.type === 'offer') {
        await pc.setLocalDescription();
        window.rtc.sendSignal(from, { description: pc.localDescription.toJSON() });
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (err) {
        if (!state.ignoreOffer) throw err;
      }
    } else if (data.shareEnded) {
      // Sinal explicito de "parei de compartilhar" - mais confiavel que
      // esperar o evento 'ended' da track remota, que nem sempre dispara
      // quando o outro lado so remove a track (fica um frame congelado).
      removeVideoTile(from);
    }
  } catch (err) {
    console.error('Erro ao tratar sinal de', from, err);
  }
}

function attachLocalStreamToAllPeers(stream) {
  for (const [, state] of peers) {
    stream.getTracks().forEach((track) => {
      const sender = state.pc.addTrack(track, stream);
      if (track.kind === 'video') applyBitrateToSender(sender, currentQuality);
    });
    preferVideoCodecs(state.pc);
  }
}

function detachLocalStreamFromAllPeers(stream) {
  for (const [, state] of peers) {
    state.pc.getSenders().forEach((sender) => {
      if (sender.track && stream.getTracks().includes(sender.track)) {
        state.pc.removeTrack(sender);
      }
    });
  }
}

// Recebe o audio cru (PCM float32, 48kHz, estereo) do helper nativo
// (que captura o sistema todo excluindo o Discord) e alimenta um
// AudioWorklet com um ring buffer, gerando uma MediaStreamTrack de audio
// continua pra juntar com o video da tela compartilhada.
const AUDIO_WORKLET_CODE = `
class PcmRingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 96000; // 2s de buffer a 48kHz (capacidade maxima, so de seguranca)
    // A captura nativa (WASAPI) e o AudioContext do Chromium sao dois
    // relogios de audio independentes - nunca batem 48000Hz exatamente
    // igual. Sem correcao, essa diferenca (por menor que seja) se acumula
    // pro resto da chamada e o atraso so cresce, nunca se corrige sozinho
    // (medido: ~300ms depois de so 15s com 2% de diferenca de ritmo).
    // maxBuffered poe um teto de ~150ms - sempre que o buffer passa disso,
    // descarta o excesso mais antigo e volta perto do tempo real.
    this.maxBuffered = 7200;
    this.bufferL = new Float32Array(this.capacity);
    this.bufferR = new Float32Array(this.capacity);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.available = 0;
    this.port.onmessage = (e) => {
      const interleaved = e.data;
      const frames = interleaved.length / 2;
      for (let i = 0; i < frames; i++) {
        this.bufferL[this.writeIndex] = interleaved[i * 2];
        this.bufferR[this.writeIndex] = interleaved[i * 2 + 1];
        this.writeIndex = (this.writeIndex + 1) % this.capacity;
        if (this.available < this.capacity) {
          this.available++;
        } else {
          this.readIndex = (this.readIndex + 1) % this.capacity;
        }
      }
      if (this.available > this.maxBuffered) {
        const drop = this.available - this.maxBuffered;
        this.readIndex = (this.readIndex + drop) % this.capacity;
        this.available = this.maxBuffered;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    for (let i = 0; i < left.length; i++) {
      if (this.available > 0) {
        left[i] = this.bufferL[this.readIndex];
        right[i] = this.bufferR[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.available--;
      } else {
        left[i] = 0;
        right[i] = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-ring-processor', PcmRingProcessor);
`;

let audioCtx = null;
let workletNode = null;

function bytesToFloat32Array(uint8) {
  const floatCount = Math.floor(uint8.byteLength / 4);
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const out = new Float32Array(floatCount);
  for (let i = 0; i < floatCount; i++) {
    out[i] = view.getFloat32(i * 4, true);
  }
  return out;
}

window.audioCapture.onChunk((chunk) => {
  if (!workletNode) return;
  const samples = bytesToFloat32Array(chunk);
  workletNode.port.postMessage(samples, [samples.buffer]);
});

async function setupCapturedAudioTrack() {
  audioCtx = new AudioContext({ sampleRate: 48000 });
  const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  await audioCtx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  workletNode = new AudioWorkletNode(audioCtx, 'pcm-ring-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const destination = audioCtx.createMediaStreamDestination();
  workletNode.connect(destination);

  await window.audioCapture.start();

  return destination.stream.getAudioTracks()[0];
}

function teardownCapturedAudioTrack() {
  window.audioCapture.stop();
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

let localVideoStream = null;
// 'screen' | 'camera' | null - o que esta sendo transmitido agora.
let shareMode = null;

// --- Camera (bolinha no canto, composta por cima da tela em um canvas) ---

let cameraStream = null;
let cameraSourceVideo = null;
let screenSourceVideo = null;
let compositeCanvas = null;
let compositeCtx = null;
let compositeRunning = false;
let cameraActive = false;

// Desenha `video` dentro do retangulo (x,y,w,h) cobrindo tudo (tipo
// object-fit: cover), cortando o excesso pra nao distorcer a imagem.
function drawCover(ctx, video, x, y, w, h) {
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function drawCompositeFrame() {
  if (!compositeRunning) return;

  if (screenSourceVideo && screenSourceVideo.videoWidth) {
    compositeCtx.drawImage(screenSourceVideo, 0, 0, compositeCanvas.width, compositeCanvas.height);
  }

  if (cameraSourceVideo && cameraSourceVideo.videoWidth) {
    const bubbleSize = Math.round(compositeCanvas.height * 0.22);
    const margin = Math.round(compositeCanvas.height * 0.03);
    const bx = compositeCanvas.width - bubbleSize - margin;
    const by = compositeCanvas.height - bubbleSize - margin;
    const cx = bx + bubbleSize / 2;
    const cy = by + bubbleSize / 2;

    compositeCtx.save();
    compositeCtx.beginPath();
    compositeCtx.arc(cx, cy, bubbleSize / 2, 0, Math.PI * 2);
    compositeCtx.closePath();
    compositeCtx.clip();
    drawCover(compositeCtx, cameraSourceVideo, bx, by, bubbleSize, bubbleSize);
    compositeCtx.restore();

    compositeCtx.lineWidth = Math.max(2, Math.round(bubbleSize * 0.02));
    compositeCtx.strokeStyle = '#e2231a';
    compositeCtx.beginPath();
    compositeCtx.arc(cx, cy, bubbleSize / 2, 0, Math.PI * 2);
    compositeCtx.stroke();
  }

  requestAnimationFrame(drawCompositeFrame);
}

async function replaceOutgoingVideoTrack(newTrack) {
  for (const [, state] of peers) {
    const sender = state.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      try {
        await sender.replaceTrack(newTrack);
      } catch (err) {
        console.error('Falha ao trocar a track de video:', err);
      }
    }
  }
  const selfVideo = document.querySelector(`#tile-${selfId} video`);
  if (selfVideo) selfVideo.srcObject = new MediaStream([newTrack, ...localStream.getAudioTracks()]);
  localStream = new MediaStream([newTrack, ...localStream.getAudioTracks()]);
}

async function enableCamera() {
  if (!localVideoStream || cameraActive) return;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (err) {
    console.error('Falha ao acessar a webcam:', err);
    return;
  }

  const screenTrack = localVideoStream.getVideoTracks()[0];
  const settings = screenTrack.getSettings();
  const width = settings.width || (currentQuality && currentQuality.width) || 1280;
  const height = settings.height || (currentQuality && currentQuality.height) || 720;

  compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  compositeCtx = compositeCanvas.getContext('2d');

  screenSourceVideo = document.createElement('video');
  screenSourceVideo.muted = true;
  screenSourceVideo.playsInline = true;
  screenSourceVideo.srcObject = new MediaStream([screenTrack]);
  await screenSourceVideo.play();

  cameraSourceVideo = document.createElement('video');
  cameraSourceVideo.muted = true;
  cameraSourceVideo.playsInline = true;
  cameraSourceVideo.srcObject = cameraStream;
  await cameraSourceVideo.play();

  compositeRunning = true;
  drawCompositeFrame();

  const fps = (currentQuality && currentQuality.frameRate) || 30;
  const compositedTrack = compositeCanvas.captureStream(fps).getVideoTracks()[0];
  await replaceOutgoingVideoTrack(compositedTrack);

  cameraActive = true;
  btnToggleCamera.textContent = 'Desativar câmera';
}

async function disableCamera() {
  if (!cameraActive) return;

  compositeRunning = false;
  if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
  cameraStream = null;
  cameraSourceVideo = null;
  screenSourceVideo = null;
  compositeCanvas = null;
  compositeCtx = null;

  if (localVideoStream) {
    await replaceOutgoingVideoTrack(localVideoStream.getVideoTracks()[0]);
  }

  cameraActive = false;
  btnToggleCamera.textContent = 'Ativar câmera';
}

async function startShare() {
  try {
    localVideoStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (err) {
    console.error('Falha ao iniciar compartilhamento:', err);
    return;
  }

  shareMode = 'screen';
  currentQuality = await window.screenPicker.getQuality();
  await finishStartingShare('Você (compartilhando)');

  btnToggleCamera.classList.remove('hidden');
}

// --- Compartilhamento "sem cursor" (beta, via helper nativo) --------------
//
// Usa a Desktop Duplication API (DXGI) diretamente em vez da captura de
// tela padrao do Electron, porque o Chromium sempre desenha um cursor
// "fantasma" por cima do frame capturado - mesmo quando o jogo escondeu o
// cursor de verdade na tela - e nao existe nenhuma opcao pra desligar isso
// no Electron. A DXGI nunca inclui o cursor no frame por padrao, entao o
// problema nao existe aqui. Os frames chegam como JPEG via IPC, sao
// desenhados num canvas escondido, e o canvas.captureStream() vira a track
// de video que a gente manda pros outros - a mesma tecnica ja usada pra
// compor a bolinha da webcam por cima da tela.
const NATIVE_SHARE_QUALITY = 80;

// Bitrate alvo por largura escolhida - mesmo espirito da tabela QUALITY_PRESETS
// do main.js (usada pelo compartilhamento normal), so que mais simples,
// ja que aqui a resolucao/fps sao dois seletores independentes em vez de
// combinacoes fixas.
const NATIVE_BITRATE_BY_WIDTH = {
  1280: 3_500_000,
  1920: 6_000_000,
  2560: 9_000_000,
  3840: 16_000_000,
};

let nativeShareCanvas = null;
let nativeShareCtx = null;

function pickNativeShareOptions(monitors) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('native-monitor-picker-overlay');
    const optionsEl = document.getElementById('native-monitor-options');
    const cancelBtn = document.getElementById('btn-native-monitor-picker-cancel');
    const confirmBtn = document.getElementById('btn-native-monitor-picker-confirm');
    const resBtns = document.querySelectorAll('#native-resolution-row .quality-btn');
    const fpsBtns = document.querySelectorAll('#native-fps-row .quality-btn');
    const audioBtns = document.querySelectorAll('#native-audio-row .audio-btn');
    const appSelect = document.getElementById('native-app-select');

    let selectedMonitor = monitors.length === 1 ? monitors[0] : null;
    let selectedWidth = 1920;
    let selectedFps = 60;
    let selectedAudioMode = 'exclude';
    let appsLoaded = false;

    async function loadAppsIfNeeded() {
      if (appsLoaded) return;
      appsLoaded = true;
      const apps = await window.nativeScreen.listApps();
      appSelect.innerHTML = '';
      apps.forEach((a) => {
        const opt = document.createElement('option');
        opt.value = a.name;
        opt.textContent = a.title;
        appSelect.appendChild(opt);
      });
      if (apps.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Nenhum programa com janela aberta';
        appSelect.appendChild(opt);
      }
    }

    optionsEl.innerHTML = '';
    monitors.forEach((mon, i) => {
      const opt = document.createElement('div');
      opt.className = 'camera-option' + (mon === selectedMonitor ? ' selected' : '');
      opt.textContent = `Monitor ${i + 1} (${mon.width}x${mon.height})`;
      opt.addEventListener('click', () => {
        selectedMonitor = mon;
        optionsEl.querySelectorAll('.camera-option').forEach((el) => el.classList.remove('selected'));
        opt.classList.add('selected');
        confirmBtn.disabled = false;
      });
      optionsEl.appendChild(opt);
    });

    // .onclick (nao addEventListener) de proposito - esses botoes sao
    // elementos fixos do HTML (nao recriados a cada vez, diferente da lista
    // de monitores), entao addEventListener acumularia um listener novo
    // toda vez que essa tela fosse aberta de novo.
    resBtns.forEach((btn) => {
      btn.onclick = () => {
        resBtns.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedWidth = Number(btn.dataset.width);
      };
    });

    fpsBtns.forEach((btn) => {
      btn.onclick = () => {
        fpsBtns.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedFps = Number(btn.dataset.fps);
      };
    });

    audioBtns.forEach((btn) => {
      btn.onclick = async () => {
        audioBtns.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAudioMode = btn.dataset.audio;
        if (selectedAudioMode === 'include') {
          appSelect.classList.remove('hidden');
          await loadAppsIfNeeded();
        } else {
          appSelect.classList.add('hidden');
        }
      };
    });

    confirmBtn.disabled = !selectedMonitor;
    confirmBtn.onclick = () => {
      if (!selectedMonitor) return;
      overlay.classList.add('hidden');
      const audioTarget = selectedAudioMode === 'include' ? appSelect.value : 'Discord';
      resolve({
        monitor: selectedMonitor,
        maxWidth: selectedWidth,
        fps: selectedFps,
        audioMode: selectedAudioMode,
        audioTarget,
      });
    };

    cancelBtn.onclick = () => {
      overlay.classList.add('hidden');
      resolve(null);
    };

    overlay.classList.remove('hidden');
  });
}

async function startNativeScreenShare() {
  const monitors = await window.nativeScreen.listMonitors();
  if (!monitors || monitors.length === 0) {
    console.error('Nenhum monitor encontrado pelo helper nativo.');
    return;
  }
  const choice = await pickNativeShareOptions(monitors);
  if (!choice) return;

  await window.nativeScreen.setAudioConfig({ mode: choice.audioMode, target: choice.audioTarget });

  const { monitor } = choice;
  const scale = choice.maxWidth < monitor.width ? choice.maxWidth / monitor.width : 1;
  const canvasWidth = choice.maxWidth < monitor.width ? choice.maxWidth : monitor.width;
  const canvasHeight = Math.round(monitor.height * scale);

  nativeShareCanvas = document.createElement('canvas');
  nativeShareCanvas.width = canvasWidth;
  nativeShareCanvas.height = canvasHeight;
  nativeShareCtx = nativeShareCanvas.getContext('2d');

  window.nativeScreen.onFrame((frameBuf) => {
    const blob = new Blob([frameBuf], { type: 'image/jpeg' });
    createImageBitmap(blob)
      .then((bmp) => {
        if (!nativeShareCtx) { bmp.close(); return; }
        nativeShareCtx.drawImage(bmp, 0, 0, nativeShareCanvas.width, nativeShareCanvas.height);
        bmp.close();
      })
      .catch(() => {});
  });

  await window.nativeScreen.start({
    adapterIndex: monitor.adapterIndex,
    outputIndex: monitor.outputIndex,
    fps: choice.fps,
    quality: NATIVE_SHARE_QUALITY,
    maxWidth: choice.maxWidth,
  });

  localVideoStream = nativeShareCanvas.captureStream(choice.fps);
  shareMode = 'screen-native';
  // largura/altura NAO sao lidas daqui - o bloco que le esses campos em
  // finishStartingShare so roda quando shareMode === 'screen', e aqui e
  // 'screen-native'. maxBitrate da um empurrao inicial (sem isso o WebRTC
  // comeca conservador e demora pra subir a resolucao), e frameRate so
  // serve pra applyBitrateToSender escolher a degradationPreference certa.
  const baseBitrate = NATIVE_BITRATE_BY_WIDTH[choice.maxWidth] || 6_000_000;
  currentQuality = {
    maxBitrate: choice.fps >= 120 ? baseBitrate * 1.6 : choice.fps >= 60 ? baseBitrate * 1.3 : baseBitrate,
    frameRate: choice.fps,
  };
  await finishStartingShare('Você (compartilhando - sem cursor)');

  btnToggleCamera.classList.remove('hidden');
}

// --- Escolha de camera (quando tem mais de uma) ---------------------------

const CAMERA_DEVICE_STORAGE_KEY = 'telinhafix-camera-device';

async function listCameraDevices() {
  let devices = await navigator.mediaDevices.enumerateDevices();
  let cams = devices.filter((d) => d.kind === 'videoinput');
  // Sem permissao ainda, o navegador esconde os nomes das cameras. Pede
  // acesso uma vez (com a camera padrao) so pra desbloquear os labels, e
  // fecha essa track na hora - a de verdade e aberta depois com o
  // deviceId escolhido.
  if (cams.length > 0 && cams.every((d) => !d.label)) {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
      cams = devices.filter((d) => d.kind === 'videoinput');
    } catch (err) {
      console.error('Falha ao pedir permissao de camera:', err);
    }
  }
  return cams;
}

function pickCameraDevice(cams) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('camera-picker-overlay');
    const optionsEl = document.getElementById('camera-options');
    const cancelBtn = document.getElementById('btn-camera-picker-cancel');
    const savedId = (() => {
      try { return localStorage.getItem(CAMERA_DEVICE_STORAGE_KEY); } catch (err) { return null; }
    })();

    optionsEl.innerHTML = '';
    cams.forEach((cam, i) => {
      const opt = document.createElement('div');
      opt.className = 'camera-option' + (cam.deviceId === savedId ? ' selected' : '');
      opt.textContent = cam.label || `Câmera ${i + 1}`;
      opt.addEventListener('click', () => {
        try { localStorage.setItem(CAMERA_DEVICE_STORAGE_KEY, cam.deviceId); } catch (err) {}
        overlay.classList.add('hidden');
        resolve(cam.deviceId);
      });
      optionsEl.appendChild(opt);
    });

    cancelBtn.onclick = () => {
      overlay.classList.add('hidden');
      resolve(null);
    };

    overlay.classList.remove('hidden');
  });
}

// Retorna { ok, deviceId }. ok=false so quando o usuario cancela o seletor
// (com 2+ cameras disponiveis) - com 0 ou 1 camera, segue direto.
async function chooseCameraDeviceId() {
  const cams = await listCameraDevices();
  if (cams.length <= 1) return { ok: true, deviceId: cams[0]?.deviceId || null };
  const chosen = await pickCameraDevice(cams);
  if (chosen === null) return { ok: false, deviceId: null };
  return { ok: true, deviceId: chosen };
}

async function startCameraShare() {
  const choice = await chooseCameraDeviceId();
  if (!choice.ok) return;

  const videoConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
  if (choice.deviceId) videoConstraints.deviceId = { exact: choice.deviceId };

  try {
    localVideoStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
  } catch (err) {
    console.error('Falha ao acessar a webcam:', err);
    return;
  }

  shareMode = 'camera';
  currentQuality = await window.screenPicker.getCameraQuality();
  await finishStartingShare('Você (câmera)');
}

async function finishStartingShare(selfLabel) {
  const videoTrack = localVideoStream.getVideoTracks()[0];
  if (currentQuality && videoTrack && shareMode === 'screen') {
    try {
      await videoTrack.applyConstraints({
        width: { ideal: currentQuality.width, max: currentQuality.width },
        height: { ideal: currentQuality.height, max: currentQuality.height },
        frameRate: { ideal: currentQuality.frameRate, max: currentQuality.frameRate },
      });
    } catch (err) {
      console.error('Falha ao aplicar qualidade escolhida:', err);
    }
  }
  if (currentQuality && videoTrack && currentQuality.frameRate) {
    // contentHint e o que o Chromium realmente usa pra decidir se, quando
    // uma conexao especifica nao aguenta o bitrate pedido, abre mao de
    // resolucao ou de fps primeiro (testei setParameters com
    // degradationPreference direto - o Chromium aceita a chamada sem erro
    // mas ignora o valor silenciosamente, entao isso aqui e o que
    // realmente funciona). 'detail' prioriza nitidez/resolucao (bom pra
    // texto/UI em 30fps); 'motion' prioriza fluidez (bom quando a pessoa
    // pediu 60fps+ de proposito, normalmente pra jogo). Cada RTCRtpSender
    // e independente por peer mesmo compartilhando a mesma track local, entao
    // a conexao mais fraca de uma pessoa degrada so o que ela recebe.
    videoTrack.contentHint = currentQuality.frameRate >= 60 ? 'motion' : 'detail';
  }

  // No modo camera (so a webcam, sem tela), nao captura o audio do sistema -
  // quem quer so mostrar o rosto normalmente nao quer que o audio dos jogos/
  // musica/notificacoes do PC va junto.
  let audioTrack = null;
  if (shareMode !== 'camera') {
    try {
      audioTrack = await setupCapturedAudioTrack();
    } catch (err) {
      console.error('Falha ao capturar audio do sistema:', err);
    }
  }

  const tracks = [...localVideoStream.getVideoTracks()];
  if (audioTrack) tracks.push(audioTrack);
  localStream = new MediaStream(tracks);

  attachLocalStreamToAllPeers(localStream);
  // Suprime o audio dos outros participantes enquanto voce compartilha -
  // senao o que toca nas suas caixas de som entraria na sua propria
  // captura de sistema e viraria eco pra quem esta assistindo.
  refreshAllGainsForSharingState();

  const video = getOrCreateVideoTile(selfId, selfLabel, true);
  video.srcObject = localStream;
  updateSelfAudienceLabel();

  btnShare.classList.add('hidden');
  btnShareNative.classList.add('hidden');
  btnShareCamera.classList.add('hidden');
  btnStopShare.classList.remove('hidden');

  localVideoStream.getVideoTracks()[0].addEventListener('ended', stopShare);
}

async function stopShare() {
  if (!localStream) return;

  if (cameraActive) await disableCamera();

  if (shareMode === 'screen-native') {
    await window.nativeScreen.stop();
    nativeShareCanvas = null;
    nativeShareCtx = null;
  }

  // Avisa todo mundo explicitamente que a transmissao acabou - nao da pra
  // confiar so no evento 'ended' da track remota (as vezes fica um frame
  // congelado do outro lado em vez de fechar a tile).
  for (const peerId of peers.keys()) {
    window.rtc.sendSignal(peerId, { shareEnded: true });
  }

  detachLocalStreamFromAllPeers(localStream);
  localStream.getTracks().forEach((t) => t.stop());
  if (localVideoStream) localVideoStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  localVideoStream = null;
  currentQuality = null;
  shareMode = null;
  refreshAllGainsForSharingState();

  teardownCapturedAudioTrack();

  removeVideoTile(selfId);

  btnShare.classList.remove('hidden');
  btnShareNative.classList.remove('hidden');
  btnShareCamera.classList.remove('hidden');
  btnToggleCamera.classList.add('hidden');
  btnStopShare.classList.add('hidden');
}

async function leaveRoom() {
  if (localStream) await stopShare();
  for (const [, state] of peers) state.pc.close();
  peers.clear();
  peerNames.clear();
  assignedAvatars.clear();
  videoGrid.innerHTML = '';
  participantsList.innerHTML = '';
  window.rtc.disconnect();

  document.getElementById('chat-messages').innerHTML = '';
  chatUnreadCount = 0;
  updateChatUnreadBadge();

  roomScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  triggerLoginReveal();
}

btnShare.addEventListener('click', startShare);
btnShareNative.addEventListener('click', startNativeScreenShare);
btnShareCamera.addEventListener('click', startCameraShare);
btnToggleCamera.addEventListener('click', () => {
  if (cameraActive) disableCamera();
  else enableCamera();
});
btnStopShare.addEventListener('click', stopShare);
btnLeave.addEventListener('click', leaveRoom);

document.getElementById('btn-toggle-chat').addEventListener('click', toggleChatPanel);
document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  sendChatMessage(input.value);
  input.value = '';
});

document.getElementById('credit-link').addEventListener('click', (e) => {
  e.preventDefault();
  window.appLinks.openCredit();
});

document.getElementById('build-version').textContent = `build (${window.appInfo.version})`;

btnJoin.addEventListener('click', async () => {
  setLoginError('');
  const serverUrl = DEFAULT_SERVER_URL;
  const password = document.getElementById('server-password').value;
  const name = document.getElementById('display-name').value.trim() || 'Anonimo';
  const roomId = document.getElementById('room-id').value.trim();

  if (!roomId) {
    setLoginError('Preencha o código da sala.');
    return;
  }

  btnJoin.disabled = true;
  setLoginError('Conectando... pode levar até 1 minuto se o servidor estava "dormindo".', true);
  try {
    await window.rtc.connect(serverUrl, password);
    setLoginError('');
    saveWorkingServerPassword(password);
    const { selfId: id, peers: existingPeers } = await window.rtc.joinRoom(roomId, name);
    selfId = id;

    window.rtc.onSignal(handleSignal);

    window.rtc.onPeerJoined(({ id: peerId, name: peerName }) => {
      peerNames.set(peerId, peerName);
      addParticipantRow(peerId, peerName, false);
      createPeerConnection(peerId);
      updateSelfAudienceLabel();
      addChatSystemMessage(`${peerName} entrou na sala`);
    });

    window.rtc.onPeerLeft(({ id: peerId }) => {
      const leftName = peerNames.get(peerId) || 'Alguém';
      const state = peers.get(peerId);
      if (state) state.pc.close();
      peers.delete(peerId);
      peerNames.delete(peerId);
      updateSelfAudienceLabel();
      removeParticipantRow(peerId);
      removeVideoTile(peerId);
      addChatSystemMessage(`${leftName} saiu da sala`);
    });

    window.rtc.onDisconnected(() => {
      setLoginError('Conexão com o servidor perdida.');
    });

    roomLabel.textContent = roomId;
    addParticipantRow(selfId, name, true);
    existingPeers.forEach((p) => {
      peerNames.set(p.id, p.name);
      addParticipantRow(p.id, p.name, false);
      createPeerConnection(p.id);
    });

    loginScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
  } catch (err) {
    setLoginError(err.message || 'Falha ao entrar.');
  } finally {
    btnJoin.disabled = false;
  }
});
