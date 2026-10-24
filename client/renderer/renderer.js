// --- Tema (fonte, tamanho de texto, cor principal) --------------------
// Aplicado antes de mais nada pra evitar um "flash" com o tema padrao.

const FONT_STACKS = {
  inter: "'Inter', 'Segoe UI', Arial, sans-serif",
  poppins: "'Poppins', 'Segoe UI', Arial, sans-serif",
  jetbrains: "'JetBrains Mono', Consolas, monospace",
  anton: "'Anton', 'Segoe UI', Arial, sans-serif",
  nunito: "'Nunito', 'Segoe UI', Arial, sans-serif",
  montserrat: "'Montserrat', 'Segoe UI', Arial, sans-serif",
};

const THEME_STORAGE_KEY = 'telinhafix-theme';
// Tema claro/escuro SO do fundo do tabuleiro de Codenames - independente do
// resto do app (ver DEFAULT_THEME acima), preferencia de cada pessoa na
// propria maquina, nao sincroniza com a sala.
const CODENAMES_BOARD_THEME_STORAGE_KEY = 'telinhafix-codenames-board-theme';
// "Tema dos agentes": como a carta aparece depois de revelada - "latadelixo"
// (foto da galera com a cor por cima, padrao) ou "normal" (so a cor + a
// palavra). Tambem e preferencia local de cada pessoa.
const CODENAMES_AGENTS_THEME_STORAGE_KEY = 'telinhafix-codenames-agents-theme';
const DEFAULT_KEYBINDS = { stopShare: 'Control+Alt+S', toggleMute: 'Control+Alt+M', quickShare: 'Control+Alt+Q' };
const DEFAULT_VOLUMES = { join: 1, leave: 1, chat: 1, connection: 1, buttons: 1 };
const DEFAULT_THEME = {
  font: 'inter', scale: 1, color: '#e2231a', mode: 'serio', border: 'arredondada',
  sound: 'ligado', hotkeys: 'ligado', keybinds: { ...DEFAULT_KEYBINDS }, priority: 'nitidez',
  volumeStyle: 'abre', // visual do controle de volume das transmissoes: 'abre' | 'degraus'
  shareNotify: 'ligado', // notificacao do Windows quando alguem comeca a transmitir
  allowPings: 'ligado', // deixar quem assiste apontar na sua tela (Alt + clique)
  discordStatus: 'ligado', // mostrar o TelinhaFix no perfil do Discord (Rich Presence)
  discordRoom: 'ligado', // ...com o nome da sala (senao "Sala Privada")
  discordPeople: 'ligado', // ...e quantas pessoas estao nela
  background: 'particulas', loginOpacity: 0.25, volumes: { ...DEFAULT_VOLUMES },
  // false ate a pessoa mexer de proposito (clicar num modo, arrastar o
  // slider de transparencia) - diferencia "nunca escolheu" (recebe o
  // padrao mais novo sempre, mesmo em quem ja tinha outro tema salvo por
  // ter mexido em outra coisa) de "escolheu de proposito" (fica travado
  // nisso pra sempre, mesmo se o padrao mudar em updates futuros). Ver
  // loadTheme e os cliques de .mode-option/#login-opacity-slider abaixo.
  modeExplicit: false,
  loginOpacityExplicit: false,
};

// --- Icones SVG (substituem os emojis antigos, mesmo estilo outline fino
// em todo o app - herdam a cor do texto do botao via currentColor) --------
const ICON_SVG_ATTRS = 'class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  link: `<svg ${ICON_SVG_ATTRS}><path d="M10 13a5 5 0 0 0 7.07 0l2.5-2.5a5 5 0 0 0-7.07-7.07L11 4.91"></path><path d="M14 11a5 5 0 0 0-7.07 0l-2.5 2.5a5 5 0 0 0 7.07 7.07L13 19.09"></path></svg>`,
  speakerOn: `<svg ${ICON_SVG_ATTRS}><path d="M4 9h4l5-5v16l-5-5H4V9Z"></path><path d="M16.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 6a8 8 0 0 1 0 12"></path></svg>`,
  speakerOff: `<svg ${ICON_SVG_ATTRS}><path d="M4 9h4l5-5v16l-5-5H4V9Z"></path><path d="M16 9l5 6M21 9l-5 6"></path></svg>`,
  // Icone do mudo por participante (tile de video): fica em cima do icone
  // "ligado" (currentColor) com uma linha diagonal VERMELHA fixa por cima -
  // nao usa currentColor nessa linha de proposito, pra continuar vermelha
  // mesmo se a pessoa trocar a cor de destaque do app em Aparencia.
  speakerMuted: `<svg ${ICON_SVG_ATTRS}><path d="M4 9h4l5-5v16l-5-5H4V9Z"></path><path d="M16.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 6a8 8 0 0 1 0 12"></path><line x1="2.5" y1="2.5" x2="21.5" y2="21.5" stroke="var(--red-bright)"></line></svg>`,
  gamepad: `<svg ${ICON_SVG_ATTRS}><rect x="2" y="7" width="20" height="10" rx="5"></rect><path d="M6 10v4M4 12h4"></path><circle cx="15" cy="10.5" r="1"></circle><circle cx="18" cy="13.5" r="1"></circle></svg>`,
  fullscreen: `<svg ${ICON_SVG_ATTRS}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>`,
  close: `<svg ${ICON_SVG_ATTRS}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  check: `<svg ${ICON_SVG_ATTRS}><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  pip: `<svg ${ICON_SVG_ATTRS}><rect x="2" y="4" width="20" height="14" rx="2"></rect><rect x="12" y="11" width="8" height="6" rx="1"></rect></svg>`,
  focus: `<svg ${ICON_SVG_ATTRS}><circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="21" y1="21" x2="15.5" y2="15.5"></line></svg>`,
  snapshot: `<svg ${ICON_SVG_ATTRS}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>`,
};

// Silhuetas grandes (preenchidas, nao outline) usadas como marca d'agua no
// verso das cartas do Codenames depois de reveladas - espiao pros times,
// civil pra neutra, caveira pro assassino (ver .game-cell-watermark).
const CARD_WATERMARKS = {
  red: `<svg viewBox="0 0 64 64" fill="currentColor"><ellipse cx="32" cy="17" rx="15" ry="3.5"/><path d="M19 17c1-7 7-12 13-12s12 5 13 12c-3-2-8-3-13-3s-10 1-13 3Z"/><circle cx="32" cy="25" r="8.5"/><path d="M13 58c0-13 8-21 19-21s19 8 19 21Z"/></svg>`,
  blue: `<svg viewBox="0 0 64 64" fill="currentColor"><ellipse cx="32" cy="17" rx="15" ry="3.5"/><path d="M19 17c1-7 7-12 13-12s12 5 13 12c-3-2-8-3-13-3s-10 1-13 3Z"/><circle cx="32" cy="25" r="8.5"/><path d="M13 58c0-13 8-21 19-21s19 8 19 21Z"/></svg>`,
  green: `<svg viewBox="0 0 64 64" fill="currentColor"><ellipse cx="32" cy="17" rx="15" ry="3.5"/><path d="M19 17c1-7 7-12 13-12s12 5 13 12c-3-2-8-3-13-3s-10 1-13 3Z"/><circle cx="32" cy="25" r="8.5"/><path d="M13 58c0-13 8-21 19-21s19 8 19 21Z"/></svg>`,
  neutral: `<svg viewBox="0 0 64 64" fill="currentColor"><circle cx="32" cy="21" r="10.5"/><path d="M12 58c0-14 9-22 20-22s20 8 20 22Z"/></svg>`,
  assassin: `<svg viewBox="0 0 64 64"><path fill="currentColor" fill-rule="evenodd" d="M32 5C18 5 8 15 8 27c0 8 4 14 9 18v8a4 4 0 0 0 4 4h4v6h4v-6h6v6h4v-6h4a4 4 0 0 0 4-4v-8c5-4 9-10 9-18C56 15 46 5 32 5Z M22 21a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z M42 21a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z M32 31l-6 9h12Z"/></svg>`,
};

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
  root.setProperty('--login-opacity', theme.loginOpacity === undefined ? 1 : theme.loginOpacity);
  // Modo "serio": tira as fotos dos membros/participantes e troca os paineis
  // por um visual liquid glass limpo, em vez do visual "lata de lixo" normal
  // (default - identico ao app de sempre, zero mudanca pra quem nao mexe
  // nessa opcao).
  document.documentElement.classList.toggle('mode-serio', theme.mode === 'serio');
  // Bordas: independente do modo acima - "chama2k19" zera o arredondamento
  // de tudo no app (ver .border-chama2k19 * no CSS), "arredondada" (default)
  // nao mexe em nada.
  document.documentElement.classList.toggle('border-chama2k19', theme.border === 'chama2k19');
  // Visual do controle de volume das transmissoes (ver createVolumeControl).
  document.documentElement.classList.toggle('volume-style-degraus', theme.volumeStyle === 'degraus');
}

function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
    const merged = { ...DEFAULT_THEME, ...(saved || {}) };
    // merge raso no objeto todo perderia um keybind default se o salvo so
    // tiver outro customizado (ex: pessoa so trocou stopShare) - funde os
    // dois por dentro tambem.
    merged.keybinds = { ...DEFAULT_KEYBINDS, ...((saved && saved.keybinds) || {}) };
    merged.volumes = { ...DEFAULT_VOLUMES, ...((saved && saved.volumes) || {}) };
    // Quem nunca escolheu um modo de proposito (nunca clicou em Lata de
    // lixo/Serio) recebe sempre o padrao mais novo, mesmo que ja tivesse
    // algum tema salvo de antes por ter mexido em outra coisa (ex: so
    // trocou a fonte) - sem isso, o "latadelixo" de um default antigo
    // ficaria congelado pra sempre no cache dessa pessoa.
    if (!merged.modeExplicit) merged.mode = DEFAULT_THEME.mode;
    if (!merged.loginOpacityExplicit) merged.loginOpacity = DEFAULT_THEME.loginOpacity;
    // "Feixe de luz" saiu do app (4.2.0): quem usava passa pro Brasas
    if (merged.background === 'lightbeam') {
      merged.background = 'brasas';
      saveTheme(merged);
    }
    return merged;
  } catch (err) {
    return { ...DEFAULT_THEME, keybinds: { ...DEFAULT_KEYBINDS }, volumes: { ...DEFAULT_VOLUMES } };
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

// Manda o estado atual (ligado/desligado + qual tecla pra cada acao) pro
// processo principal registrar de verdade no sistema operacional. Retorna
// quais combinacoes conseguiram ser registradas - usado pela UI de
// configuracoes pra saber se uma troca deu conflito com outro programa.
function syncHotkeysToMain() {
  return window.hotkeys.applyState({
    enabled: currentTheme.hotkeys !== 'desligado',
    bindings: currentTheme.keybinds,
  });
}

syncHotkeysToMain();
window.hotkeys.onStopShare(() => stopShare());
window.hotkeys.onToggleMute(() => toggleMasterMute());
window.hotkeys.onQuickShare(() => startQuickShare());

function setupSettingsPanel() {
  const overlay = document.getElementById('settings-overlay');
  const btnOpen = document.getElementById('btn-settings');
  const btnOpenRoom = document.getElementById('btn-settings-room');
  const btnClose = document.getElementById('btn-settings-close');
  const modeOptions = document.querySelectorAll('.mode-option');
  const borderOptions = document.querySelectorAll('.border-option');
  const soundOptions = document.querySelectorAll('.sound-option');
  const shareNotifyOptions = document.querySelectorAll('.share-notify-option');
  const pingPermissionOptions = document.querySelectorAll('.ping-permission-option');
  const discordStatusOptions = document.querySelectorAll('.discord-status-option');
  const discordRoomOptions = document.querySelectorAll('.discord-room-option');
  const discordPeopleOptions = document.querySelectorAll('.discord-people-option');
  const hotkeyOptions = document.querySelectorAll('.hotkeys-option');
  const priorityOptions = document.querySelectorAll('.priority-option');
  const fontOptions = document.querySelectorAll('.font-option');
  const sizeOptions = document.querySelectorAll('.size-option');
  const colorCustom = document.getElementById('color-custom');
  const colorCustomHex = document.getElementById('color-custom-hex');
  const backgroundOptions = document.querySelectorAll('.background-option');
  const volumeStyleOptions = document.querySelectorAll('.volume-style-option');
  const opacitySlider = document.getElementById('login-opacity-slider');
  const opacityValue = document.getElementById('login-opacity-value');
  const tabButtons = document.querySelectorAll('.settings-tab-btn');
  const panes = document.querySelectorAll('.settings-pane');
  const volumeKeys = ['join', 'leave', 'chat', 'connection', 'buttons'];
  const volumeSliders = {};
  volumeKeys.forEach((key) => {
    volumeSliders[key] = {
      slider: document.getElementById(`sound-volume-${key}`),
      value: document.getElementById(`sound-volume-${key}-value`),
    };
  });
  if (!overlay) return;

  function refreshUI() {
    modeOptions.forEach((el) => el.classList.toggle('selected', el.dataset.mode === currentTheme.mode));
    borderOptions.forEach((el) => el.classList.toggle('selected', el.dataset.border === currentTheme.border));
    soundOptions.forEach((el) => el.classList.toggle('selected', el.dataset.sound === currentTheme.sound));
    shareNotifyOptions.forEach((el) => el.classList.toggle('selected', el.dataset.shareNotify === (currentTheme.shareNotify || 'ligado')));
    pingPermissionOptions.forEach((el) => el.classList.toggle('selected', el.dataset.pingPermission === (currentTheme.allowPings || 'ligado')));
    discordStatusOptions.forEach((el) => el.classList.toggle('selected', el.dataset.discordStatus === (currentTheme.discordStatus || 'ligado')));
    discordRoomOptions.forEach((el) => el.classList.toggle('selected', el.dataset.discordRoom === (currentTheme.discordRoom || 'ligado')));
    discordPeopleOptions.forEach((el) => el.classList.toggle('selected', el.dataset.discordPeople === (currentTheme.discordPeople || 'ligado')));
    hotkeyOptions.forEach((el) => el.classList.toggle('selected', el.dataset.hotkeys === currentTheme.hotkeys));
    priorityOptions.forEach((el) => el.classList.toggle('selected', el.dataset.priority === currentTheme.priority));
    fontOptions.forEach((el) => el.classList.toggle('selected', el.dataset.font === currentTheme.font));
    sizeOptions.forEach((el) => el.classList.toggle('selected', Number(el.dataset.scale) === currentTheme.scale));
    colorCustom.value = currentTheme.color;
    if (colorCustomHex) colorCustomHex.textContent = currentTheme.color.toUpperCase();
    backgroundOptions.forEach((el) => el.classList.toggle('selected', el.dataset.background === currentTheme.background));
    volumeStyleOptions.forEach((el) => el.classList.toggle('selected', el.dataset.volumeStyle === (currentTheme.volumeStyle || 'abre')));
    if (opacitySlider) {
      const pct = Math.round((currentTheme.loginOpacity === undefined ? 1 : currentTheme.loginOpacity) * 100);
      opacitySlider.value = String(pct);
      if (opacityValue) opacityValue.textContent = `${pct}%`;
      updateSliderFill(opacitySlider);
    }
    const volumesDisabled = currentTheme.sound === 'desligado';
    volumeKeys.forEach((key) => {
      const { slider, value } = volumeSliders[key];
      if (!slider) return;
      const pct = Math.round((currentTheme.volumes?.[key] ?? 1) * 100);
      slider.value = String(pct);
      slider.disabled = volumesDisabled;
      if (value) value.textContent = `${pct}%`;
      updateSliderFill(slider);
    });
  }

  function selectTab(tabName) {
    tabButtons.forEach((btn) => btn.classList.toggle('selected', btn.dataset.tab === tabName));
    panes.forEach((pane) => pane.classList.toggle('hidden', pane.dataset.pane !== tabName));
  }

  function updateTheme(patch) {
    currentTheme = { ...currentTheme, ...patch };
    applyTheme(currentTheme);
    saveTheme(currentTheme);
    refreshUI();
    if (patch.hotkeys !== undefined) syncHotkeysToMain();
    if (patch.priority !== undefined && window.__recomputeQualityRecommendation) {
      window.__recomputeQualityRecommendation(currentTheme.priority);
    }
    if (patch.background !== undefined && window.__setBackgroundStyle) {
      window.__setBackgroundStyle(currentTheme.background);
    }
  }

  function openSettings(tab = 'aparencia') {
    refreshUI();
    selectTab(tab);
    overlay.classList.remove('hidden');
  }
  window.__openSettingsTab = openSettings;

  function closeSettings() {
    overlay.classList.add('hidden');
  }

  if (btnOpen) btnOpen.addEventListener('click', () => openSettings());
  if (btnOpenRoom) btnOpenRoom.addEventListener('click', () => openSettings());
  btnClose.addEventListener('click', closeSettings);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  modeOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ mode: el.dataset.mode, modeExplicit: true }));
  });
  volumeStyleOptions.forEach((el) => {
    const choose = () => updateTheme({ volumeStyle: el.dataset.volumeStyle });
    el.addEventListener('click', choose);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  });
  // Previa: o mesmo controle das transmissoes, numa "pessoa" de mentira
  // (sem audio) - da pra testar os dois visuais antes de entrar numa sala.
  // (setTimeout: as definicoes do controle ficam mais abaixo no arquivo e so
  // existem depois que o script inteiro carregou.)
  setTimeout(() => {
    const previewSlot = document.getElementById('volume-preview-slot');
    if (previewSlot && !previewSlot.firstChild) previewSlot.appendChild(createVolumeControl('__volume-preview__'));
  }, 0);
  borderOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ border: el.dataset.border }));
  });
  soundOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ sound: el.dataset.sound }));
  });
  shareNotifyOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ shareNotify: el.dataset.shareNotify }));
  });
  discordRoomOptions.forEach((el) => {
    el.addEventListener('click', () => { updateTheme({ discordRoom: el.dataset.discordRoom }); updateDiscordPresence(); });
  });
  discordPeopleOptions.forEach((el) => {
    el.addEventListener('click', () => { updateTheme({ discordPeople: el.dataset.discordPeople }); updateDiscordPresence(); });
  });
  discordStatusOptions.forEach((el) => {
    el.addEventListener('click', () => {
      updateTheme({ discordStatus: el.dataset.discordStatus });
      updateDiscordPresence();
    });
  });
  pingPermissionOptions.forEach((el) => {
    el.addEventListener('click', () => {
      updateTheme({ allowPings: el.dataset.pingPermission });
      if (currentRoomId) window.rtc.setPingPermission(pingsAllowedByMe());
    });
  });
  hotkeyOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ hotkeys: el.dataset.hotkeys }));
  });
  priorityOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ priority: el.dataset.priority }));
  });
  fontOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ font: el.dataset.font }));
  });
  sizeOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ scale: Number(el.dataset.scale) }));
  });
  colorCustom.addEventListener('input', () => updateTheme({ color: colorCustom.value }));
  backgroundOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ background: el.dataset.background }));
  });
  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      updateTheme({ loginOpacity: Number(opacitySlider.value) / 100, loginOpacityExplicit: true });
    });
  }
  volumeKeys.forEach((key) => {
    const { slider } = volumeSliders[key];
    if (!slider) return;
    slider.addEventListener('input', () => {
      updateTheme({ volumes: { ...currentTheme.volumes, [key]: Number(slider.value) / 100 } });
    });
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectTab(btn.dataset.tab));
  });
}

// --- Novidades ----------------------------------------------------------
// Lista do changelog.js na aba "Novidades". Na primeira vez que o app abre
// numa versao nova (que tenha entrada no changelog), abre essa aba sozinho.
const LAST_SEEN_VERSION_STORAGE_KEY = 'telinhafix-last-seen-version';

function renderChangelog() {
  const list = document.getElementById('changelog-list');
  const entries = window.TELINHAFIX_CHANGELOG || [];
  if (!list) return;
  const current = window.appInfo.version;
  list.innerHTML = entries.map((e) => `
    <article class="changelog-entry${e.version === current ? ' changelog-entry-current' : ''}">
      <header>
        <span class="changelog-version">v${escapeHtml(e.version)}</span>
        <strong class="changelog-title">${escapeHtml(e.title)}</strong>
        ${e.version === current ? '<span class="changelog-badge">Sua versão</span>' : ''}
        <span class="changelog-date">${escapeHtml(e.date || '')}</span>
      </header>
      <ul>${e.items.map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>
    </article>`).join('');
}

function showNewsIfUpdated() {
  renderChangelog();
  const current = window.appInfo.version;
  let lastSeen = null;
  try { lastSeen = localStorage.getItem(LAST_SEEN_VERSION_STORAGE_KEY); } catch (err) {}
  const hasEntry = (window.TELINHAFIX_CHANGELOG || []).some((e) => e.version === current);
  if (lastSeen === current || !hasEntry) return;
  try { localStorage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, current); } catch (err) {}
  // depois da animacao de entrada da tela de login
  setTimeout(() => { if (window.__openSettingsTab) window.__openSettingsTab('novidades'); }, 1200);
}

setupSettingsPanel();
showNewsIfUpdated();

// --- Captura de keybinds customizaveis (atalhos globais) ------------------

const KEYBIND_ACTION_LABELS = {
  stopShare: 'Parar de compartilhar',
  toggleMute: 'Mutar/desmutar todos',
  quickShare: 'Compartilhar tela (preset rápido)',
};

// So nomes especiais que o formato "Accelerator" do Electron exige - letras/
// numeros/F1-F24 usam o proprio caractere, entao nao precisam de mapa.
const ACCELERATOR_KEY_NAMES = {
  ' ': 'Space', 'Escape': 'Esc', 'Enter': 'Return', 'Tab': 'Tab',
  'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
  'Backspace': 'Backspace', 'Delete': 'Delete', 'Insert': 'Insert',
  'Home': 'Home', 'End': 'End', 'PageUp': 'PageUp', 'PageDown': 'PageDown',
  ',': 'Comma', '.': 'Period', '-': 'Minus', '=': 'Plus',
};

// Converte um KeyboardEvent num Accelerator valido pro Electron (formato
// "Control+Alt+S"), ou null se ainda nao da pra formar um (so modificador
// pressionado) ou a tecla nao e suportada. Exige pelo menos 1 modificador -
// sem isso o atalho tomaria conta de uma tecla normal em qualquer outro
// programa do sistema, o que seria uma armadilha.
function keyboardEventToAccelerator(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');
  if (parts.length === 0) return null;

  const key = event.key;
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return null; // so modificador por enquanto

  let mainKey = ACCELERATOR_KEY_NAMES[key];
  if (!mainKey) {
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) mainKey = key;
    else if (key.length === 1) mainKey = key.toUpperCase();
    else return null; // tecla sem nome de Accelerator conhecido
  }

  parts.push(mainKey);
  return parts.join('+');
}

function formatAccelerator(accelerator) {
  return (accelerator || '').replace(/\bControl\b/, 'Ctrl').replace(/\bSuper\b/, 'Win');
}

function setupKeybindCapture() {
  const buttons = document.querySelectorAll('.keybind-capture');
  const errorEl = document.getElementById('keybind-error');
  const btnReset = document.getElementById('btn-keybinds-reset');
  if (buttons.length === 0) return;

  function refreshKeybindButtons() {
    buttons.forEach((btn) => {
      if (!btn.classList.contains('recording')) {
        btn.textContent = formatAccelerator(currentTheme.keybinds[btn.dataset.action]);
      }
    });
  }

  function showKeybindError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }

  function hideKeybindError() {
    if (!errorEl) return;
    errorEl.classList.add('hidden');
  }

  refreshKeybindButtons();

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('recording')) return;
      const action = btn.dataset.action;
      const previous = currentTheme.keybinds[action];
      hideKeybindError();
      btn.textContent = 'Pressione uma tecla... (Esc cancela)';
      btn.classList.add('recording');

      function cleanup() {
        document.removeEventListener('keydown', onKeydown, true);
        btn.classList.remove('recording');
      }

      function onKeydown(e) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
          cleanup();
          btn.textContent = formatAccelerator(previous);
          return;
        }

        const accelerator = keyboardEventToAccelerator(e);
        if (!accelerator) return; // continua esperando uma tecla principal valida

        cleanup();

        const conflictAction = Object.keys(currentTheme.keybinds).find(
          (otherAction) => otherAction !== action && currentTheme.keybinds[otherAction] === accelerator
        );
        if (conflictAction) {
          showKeybindError(`"${formatAccelerator(accelerator)}" ja esta em uso pra "${KEYBIND_ACTION_LABELS[conflictAction]}".`);
          btn.textContent = formatAccelerator(previous);
          return;
        }

        const trialKeybinds = { ...currentTheme.keybinds, [action]: accelerator };
        window.hotkeys.applyState({ enabled: currentTheme.hotkeys !== 'desligado', bindings: trialKeybinds }).then((result) => {
          if (result && result[action] === false) {
            showKeybindError(`"${formatAccelerator(accelerator)}" ja esta em uso por outro programa no seu PC.`);
            btn.textContent = formatAccelerator(previous);
            syncHotkeysToMain(); // restaura a combinacao antiga, que ainda funciona
          } else {
            currentTheme = { ...currentTheme, keybinds: trialKeybinds };
            saveTheme(currentTheme);
            btn.textContent = formatAccelerator(accelerator);
          }
        });
      }

      document.addEventListener('keydown', onKeydown, true);
    });
  });

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const trialKeybinds = { ...DEFAULT_KEYBINDS };
      window.hotkeys.applyState({ enabled: currentTheme.hotkeys !== 'desligado', bindings: trialKeybinds }).then((result) => {
        currentTheme = { ...currentTheme, keybinds: trialKeybinds };
        saveTheme(currentTheme);
        refreshKeybindButtons();
        if (result && (result.stopShare === false || result.toggleMute === false)) {
          showKeybindError('Uma das combinacoes padrao ja esta em uso por outro programa agora - troque ela manualmente.');
        } else {
          hideKeybindError();
        }
      });
    });
  }
}

setupKeybindCapture();

// --- Notificacoes sonoras (entrada/saida, chat, conexao caiu/voltou) ------
//
// Sintetizadas na hora via Web Audio (osciladores curtos com um envelope de
// volume pra nao estalar) em vez de arquivos de audio - sem asset pra
// empacotar/licenciar, e o resultado e leve e consistente com o resto do
// app (nada "importado").

let notifyAudioCtx = null;

function soundsEnabled() {
  return currentTheme.sound !== 'desligado';
}

function getNotifyAudioCtx() {
  if (!notifyAudioCtx) notifyAudioCtx = new AudioContext();
  return notifyAudioCtx;
}

// notes: lista de { freq, start, duration, type, gain } tocadas em paralelo/
// sequencia (start em segundos, relativo ao disparo). categoria: chave em
// currentTheme.volumes (ver aba "Sons" nas configuracoes) - escala o gain
// de cada nota, alem do liga/desliga geral em soundsEnabled().
function playTones(notes, categoria) {
  if (!soundsEnabled()) return;
  const volumeMult = categoria ? (currentTheme.volumes?.[categoria] ?? 1) : 1;
  if (volumeMult <= 0) return;
  try {
    const ctx = getNotifyAudioCtx();
    const now = ctx.currentTime;
    notes.forEach(({ freq, start = 0, duration = 0.12, type = 'sine', gain = 0.12 }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = now + start;
      const t1 = t0 + duration;
      // ataque/decaimento rapidos (poucos ms) pra nao estalar no inicio/fim.
      gainNode.gain.setValueAtTime(0, t0);
      gainNode.gain.linearRampToValueAtTime(gain * volumeMult, t0 + 0.012);
      gainNode.gain.linearRampToValueAtTime(0, t1);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    });
  } catch (err) {
    // Web Audio indisponivel por algum motivo - so nao toca o som.
  }
}

function playJoinSound() { playTones([{ freq: 523.25, duration: 0.09 }, { freq: 659.25, start: 0.08, duration: 0.14 }], 'join'); }
function playLeaveSound() { playTones([{ freq: 523.25, duration: 0.09 }, { freq: 392.0, start: 0.08, duration: 0.16 }], 'leave'); }
function playChatSound() { playTones([{ freq: 880, duration: 0.07, gain: 0.09 }], 'chat'); }
function playDisconnectSound() { playTones([{ freq: 220, duration: 0.22, type: 'sawtooth', gain: 0.08 }], 'connection'); }
function playReconnectedSound() { playTones([{ freq: 440, duration: 0.08 }, { freq: 880, start: 0.07, duration: 0.12 }], 'connection'); }

// --- Som de clique em botao (arquivos reais, nao sintetizado) ------------
// Toca em qualquer <button> clicado no app inteiro (delegado no document,
// sem precisar mexer em cada botao um por um). Botoes de fechar modal
// (.settings-modal-close) usam um som diferente do resto, pra dar uma
// distincao sutil entre "abrir/confirmar" e "fechar/cancelar".
const CLICK_SOUND_PRIMARY = new Audio('assets/sounds/click1.wav');
const CLICK_SOUND_CLOSE = new Audio('assets/sounds/click2.wav');
const CLICK_SOUND_BASE_VOLUME = 0.35;

function playButtonClickSound(isCloseAction) {
  if (!soundsEnabled()) return;
  const volumeMult = currentTheme.volumes?.buttons ?? 1;
  if (volumeMult <= 0) return;
  const base = isCloseAction ? CLICK_SOUND_CLOSE : CLICK_SOUND_PRIMARY;
  const node = base.cloneNode();
  node.volume = CLICK_SOUND_BASE_VOLUME * volumeMult;
  node.play().catch(() => {});
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  playButtonClickSound(btn.classList.contains('settings-modal-close'));
}, true);

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

// STUN sempre; os servidores TURN (plano B quando a conexao direta nao
// fecha - CGNAT, NAT simetrico, firewall) vem do servidor no join-room, com
// credenciais que nao ficam no codigo (ver "TURN" no server/index.js).
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

function setIceServersFromServer(list) {
  if (Array.isArray(list) && list.length > 0) iceServers = list;
}

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

// Senha global do servidor (APP_PASSWORD no Render) ja vem no app: o campo
// aparece preenchido e travado (readonly no HTML), e o login usa SEMPRE esta
// constante - nao o que estiver no campo. Se a APP_PASSWORD mudar no Render,
// precisa mudar aqui e lancar uma versao nova.
const BUILT_IN_SERVER_PASSWORD = 'md1';
document.getElementById('server-password').value = BUILT_IN_SERVER_PASSWORD;

// Lembra o nome da ultima vez que a pessoa entrou numa sala de verdade (nao
// salva a cada letra digitada - so quando realmente usou pra entrar, igual
// a senha acima).
const DISPLAY_NAME_STORAGE_KEY = 'telinhafix-display-name';

function restoreSavedDisplayName() {
  try {
    const saved = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (saved) document.getElementById('display-name').value = saved;
  } catch (err) {
    // localStorage indisponivel - segue sem lembrar o nome.
  }
}

function saveWorkingDisplayName(name) {
  if (!name) return; // nao salva o fallback "Anonimo" como se a pessoa tivesse escolhido
  try {
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
  } catch (err) {
    // localStorage indisponivel - segue sem lembrar o nome.
  }
}

restoreSavedDisplayName();

// Lembra os ultimos codigos de sala usados de verdade (so depois de um
// join que realmente funcionou, mesmo criterio de cima) - mostrados como
// sugestao nativa do navegador (<datalist>) no campo, sem precisar
// redigitar toda vez. O mais recente tambem vira o valor pre-preenchido
// do campo, do mesmo jeito que nome/senha ja funcionavam.
const ROOM_HISTORY_STORAGE_KEY = 'telinhafix-room-history';
const MAX_ROOM_HISTORY = 8;

function loadRoomHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROOM_HISTORY_STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter((r) => typeof r === 'string' && r) : [];
  } catch (err) {
    return [];
  }
}

function renderRoomHistoryDatalist() {
  const datalist = document.getElementById('room-history-list');
  if (!datalist) return;
  datalist.innerHTML = '';
  loadRoomHistory().forEach((roomId) => {
    const option = document.createElement('option');
    option.value = roomId;
    datalist.appendChild(option);
  });
}

function saveRoomToHistory(roomId) {
  if (!roomId) return;
  try {
    const history = loadRoomHistory().filter((r) => r !== roomId);
    history.unshift(roomId);
    localStorage.setItem(ROOM_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ROOM_HISTORY)));
  } catch (err) {
    // localStorage indisponivel - segue sem lembrar o historico.
  }
  renderRoomHistoryDatalist();
}

function restoreSavedRoomId() {
  const history = loadRoomHistory();
  if (history.length > 0) document.getElementById('room-id').value = history[0];
  renderRoomHistoryDatalist();
}

restoreSavedRoomId();

// Link de convite: o botao "Convidar" copia https://.../convite/X (ver
// renderInvitePage no server/index.js), que abre telinhafix://join?room=X
// (ver main.js). Na tela de login entra direto na sala; ja numa sala,
// pergunta antes de trocar (ver pendingInviteRoom abaixo).
// Mesma regra do servidor (normalizeRoomId em server/index.js): sem
// diferenca de maiuscula/minuscula, sem espaco nas pontas e sem barra no fim
// - alguns navegadores/apps abrem o link como "...?room=X/" e a pessoa caia
// sozinha numa sala "X/".
function normalizeRoomId(raw) {
  return String(raw || '').trim().replace(/\/+$/, '').trim().toLowerCase();
}

// Ja numa sala: em vez de ignorar o convite em silencio (a pessoa ficava
// presa na sala dela achando que o link nao funcionava), mostra um aviso com
// "Entrar" - so troca de sala se ela confirmar.
let pendingInviteRoom = null;

window.appLinks.onInviteRoom((rawRoomId) => {
  const roomId = normalizeRoomId(rawRoomId);
  if (!roomId) return;
  if (roomScreen.classList.contains('hidden')) {
    // Tela de login: entra direto na sala do convite. So se a pessoa ainda
    // nao tem nome salvo (primeira vez no app) pede o nome antes.
    document.getElementById('room-id').value = roomId;
    const nameInput = document.getElementById('display-name');
    if (!nameInput.value.trim()) {
      nameInput.focus();
      setLoginError(`Convite pra sala "${roomId}" - digite seu nome e clique em Entrar.`, true);
      return;
    }
    if (!btnJoin.disabled) btnJoin.click();
    return;
  }
  if (normalizeRoomId(roomLabel.textContent) === roomId) return; // ja esta nessa sala
  pendingInviteRoom = roomId;
  document.getElementById('invite-banner-text').textContent =
    `Você foi convidado pra sala "${roomId}". Sair da sala atual e entrar nela?`;
  document.getElementById('invite-banner').classList.remove('hidden');
  playChatSound();
});

document.getElementById('btn-invite-close').addEventListener('click', () => {
  pendingInviteRoom = null;
  document.getElementById('invite-banner').classList.add('hidden');
});

document.getElementById('btn-invite-accept').addEventListener('click', async () => {
  const roomId = pendingInviteRoom;
  pendingInviteRoom = null;
  document.getElementById('invite-banner').classList.add('hidden');
  if (!roomId) return;
  if (!roomScreen.classList.contains('hidden')) await leaveRoom();
  document.getElementById('room-id').value = roomId;
  btnJoin.click();
});

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
// peerId -> 'camera' | 'screen' | 'screen-native' | null - o que cada um
// esta transmitindo agora (ver onPeerShareMode/setShareMode), so pra saber
// quando espelhar o video (toda camera, sua ou de quem for, aparece
// espelhada pra todo mundo - ver updatePeerTileMirror).
const peerShareModes = new Map();

function updatePeerTileMirror(peerId) {
  const tile = document.getElementById(`tile-${peerId}`);
  const video = tile ? tile.querySelector('video') : null;
  if (video) video.classList.toggle('mirrored-video', peerShareModes.get(peerId) === 'camera');
}
// ids de espectadores admin invisiveis (ver onSpectatorJoined/Left abaixo) -
// o ontrack em createPeerConnection confere esse Set antes de criar
// qualquer tile/audio pra nao vazar a presenca deles: mesmo com a direcao
// da negociacao WebRTC correta (so o participante manda, o espectador so
// recebe), o navegador pode disparar ontrack uma vez durante a renegociacao
// (ex: colisao com a criacao do canal de chat) antes de estabilizar - essa
// checagem garante que a UI nunca mostra nada mesmo nesse caso.
const spectatorPeerIds = new Set();

// Quando o outro lado ja esta transmitindo, o addTrack reaproveita o
// transceiver que veio da oferta dele - e ate a renegociacao terminar o
// sender desse transceiver nao tem "encodings" (mexer nisso da
// InvalidModificationError e o limite de qualidade nunca era aplicado:
// acontecia com quem comecava a compartilhar por SEGUNDO). Entao espera
// os encodings aparecerem antes de ajustar.
const BITRATE_RETRY_MS = 300;
const BITRATE_MAX_TRIES = 40;

async function applyBitrateToSender(sender, quality, tries = 0) {
  if (!sender || !quality) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      if (tries < BITRATE_MAX_TRIES && sender.track) {
        setTimeout(() => applyBitrateToSender(sender, quality, tries + 1), BITRATE_RETRY_MS);
      }
      return;
    }
    params.encodings[0].maxBitrate = quality.maxBitrate;
    await sender.setParameters(params);
  } catch (err) {
    console.error('Falha ao ajustar bitrate do video:', err);
  }
}

// H264 vem SEMPRE primeiro: e o unico codec que o Chromium codifica na placa
// de video no Windows (MediaFoundation - Intel, NVIDIA, AMD). Medido no
// Electron 33, 1080p30: VP9 e AV1 saem sempre por software (libvpx/libaom)
// e gastavam ~3x mais processador; sem placa que codifique, o H264 cai pro
// OpenH264 (software), que ainda assim pesa menos que o VP9. Isso importa
// porque cada pessoa assistindo e uma codificacao a mais (uma conexao por
// pessoa) - num PC fraco (ex: i3 de 4 nucleos) o VP9 travava a transmissao.
// Depois do H264 vem o resultado do teste automatico de qualidade, se a
// pessoa rodou (ver quality-test.js), e o palpite padrao VP9 > AV1 > VP8.
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

  // O Chromium (Electron 33) valida setCodecPreferences contra os codecs de
  // RECEBIMENTO: a lista de envio traz um perfil de H264 (640032) que nao
  // existe na de recebimento, e por causa dele recusava a lista inteira
  // ("invalid codec with name H264"). Entao so usa as entradas de envio que
  // tambem existem no recebimento.
  const recvCaps = RTCRtpReceiver.getCapabilities ? RTCRtpReceiver.getCapabilities('video') : null;
  const recvKeys = new Set(((recvCaps && recvCaps.codecs) || []).map((c) => `${c.mimeType}|${c.sdpFmtpLine || ''}`));
  const recommended = getRecommendedCodec();
  const fallbackOrder = ['video/VP9', 'video/AV1', 'video/VP8'];
  const order = ['video/H264', ...(recommended ? [recommended, ...fallbackOrder.filter((c) => c !== recommended)] : fallbackOrder)];

  const filtered = caps.codecs.filter((c) => recvKeys.has(`${c.mimeType}|${c.sdpFmtpLine || ''}`));
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
  // clicar no nome abre o perfil da pessoa (o seu, se for voce)
  li.classList.add('participant-clickable');
  li.title = isSelf ? 'Ver seu perfil' : `Ver o perfil de ${name}`;
  li.addEventListener('click', () => openProfile(isSelf ? null : (peerNames.get(id) || name)));
  participantsList.appendChild(li);
}

// Etiqueta ao lado do nome na lista de participantes, pra dar pra ver sem
// abrir nada quando a conexao com alguem nao fecha: nada = conexao direta
// (normal), "via servidor" = passou pelo TURN, "sem conexao" = falhou.
const CONN_FAIL_AFTER_MS = 20000;

function setParticipantConnStatus(peerId, status) {
  const li = document.getElementById(`participant-${peerId}`);
  if (!li) return;
  let tag = li.querySelector('.conn-status');
  if (status !== 'relay' && status !== 'failed') {
    if (tag) tag.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('span');
    tag.className = 'conn-status';
    li.appendChild(tag);
  }
  tag.classList.toggle('conn-status-failed', status === 'failed');
  tag.textContent = status === 'relay' ? 'via servidor' : 'sem conexão';
  tag.title = status === 'relay'
    ? 'A rede de voces nao deixou ligar direto - o video esta passando por um servidor intermediario (TURN)'
    : 'Nao foi possivel ligar com essa pessoa - a rede de um dos dois esta bloqueando (VPN, firewall ou internet com CGNAT)';
}

// Descobre pelo getStats se a conexao que fechou e direta ou via TURN.
async function detectConnRoute(peerId, pc) {
  try {
    const stats = await pc.getStats();
    let pair = null;
    stats.forEach((r) => {
      if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId) || pair;
    });
    if (!pair) {
      stats.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
    }
    if (!pair) return;
    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    const viaRelay = (local && local.candidateType === 'relay') || (remote && remote.candidateType === 'relay');
    if (pc.connectionState === 'connected') setParticipantConnStatus(peerId, viaRelay ? 'relay' : 'ok');
  } catch (err) {
    console.error('Falha ao ler a rota da conexao:', err);
  }
}

function watchConnFailure(peerId, state) {
  if (state.connFailTimer) clearTimeout(state.connFailTimer);
  state.connFailTimer = setTimeout(() => {
    state.connFailTimer = null;
    if (peers.get(peerId) === state && state.pc.connectionState !== 'connected') {
      setParticipantConnStatus(peerId, 'failed');
    }
  }, CONN_FAIL_AFTER_MS);
}

function removeParticipantRow(id) {
  const li = document.getElementById(`participant-${id}`);
  if (li) li.remove();
  assignedAvatars.delete(id);
}

// --- Tela cheia, destacar (PiP) e modo foco -------------------------------

function toggleTileFullscreen(tile) {
  if (document.fullscreenElement === tile) {
    document.exitFullscreen().catch(() => {});
  } else {
    tile.requestFullscreen().catch((err) => console.error('Falha ao entrar em tela cheia:', err));
  }
}

// Esc sempre sai da tela cheia de uma transmissao - nao depende do Electron
// tratar a tecla sozinho (a janela entra em tela cheia de verdade, ver
// 'enter-html-full-screen' no main.js).
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.fullscreenElement && document.fullscreenElement.classList.contains('video-tile')) {
    document.exitFullscreen().catch(() => {});
  }
});

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
const remoteGainNodes = new Map(); // peerId -> { gainNode, sourceNode, track, sliderValue }
// Volume que voce escolheu pra cada pessoa (0-200) - guardado a parte do
// GainNode pra sobreviver a tile ser refeita (a pessoa parou e voltou a
// transmitir) e pra valer mesmo se voce mexer antes do audio chegar.
// Esquecido ao sair da sala.
const peerVolumes = new Map(); // peerId -> { value, lastVolume }

function peerVolumeOf(peerId) {
  return peerVolumes.get(peerId) || { value: 100, lastVolume: 100 };
}

// Mudo geral (atalho global Ctrl+Alt+M) - corta o audio de todo mundo de uma
// vez sem mexer nos sliders individuais de cada um, pra nao perder o volume
// que a pessoa tinha ajustado quando desmutar de novo.
let masterMuted = false;

function updateMuteAllButton() {
  const btn = document.getElementById('btn-mute-all');
  if (!btn) return;
  btn.innerHTML = masterMuted ? ICONS.speakerOff : ICONS.speakerOn;
  btn.classList.toggle('active-mute', masterMuted);
  btn.title = masterMuted ? 'Desmutar todos (Ctrl+Alt+M)' : 'Mutar todos (Ctrl+Alt+M)';
}

function toggleMasterMute() {
  masterMuted = !masterMuted;
  refreshAllGainsForSharingState();
  updateMuteAllButton();
}

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
  tile.querySelectorAll('.volume-control[data-volume-peer]').forEach(paintVolumeControl);
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
// o <video> fica SEMPRE mudo (ver getOrCreateVideoTile) - o audio so sai
// pelo GainNode, entao o mudo/slider da tile sempre tem efeito.
//
// Se ja existe um GainNode pra essa pessoa mas ligado em OUTRA track (ela
// voltou a transmitir, a conexao renegociou), refaz ligado na track nova -
// antes ele so retornava e o controle ficava preso numa track velha: ao
// sair e entrar de novo na sala, o audio tocava direto pelo <video> e o
// mudo nao fazia nada.
function wireRemoteAudioGain(peerId, video, audioTrack) {
  video.muted = true;
  const existing = remoteGainNodes.get(peerId);
  if (existing && existing.track === audioTrack) { applyGain(peerId); return; }
  if (existing) disconnectRemoteGain(existing);
  const audioCtx = getSharedAudioContext();
  const sourceNode = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
  const gainNode = audioCtx.createGain();
  sourceNode.connect(gainNode).connect(audioCtx.destination);
  remoteGainNodes.set(peerId, { gainNode, sourceNode, track: audioTrack, sliderValue: peerVolumeOf(peerId).value });
  applyGain(peerId);
}

function disconnectRemoteGain(entry) {
  try { entry.sourceNode && entry.sourceNode.disconnect(); } catch {}
  try { entry.gainNode.disconnect(); } catch {}
}

// Ao sair da sala: desliga todos os controles de volume (senao, ao voltar,
// os ids de quem continuou na sala sao os mesmos e o app achava que ja
// estava tudo ligado) e esquece volumes/ocultacoes da sala anterior.
function resetRemoteAudio() {
  for (const entry of remoteGainNodes.values()) disconnectRemoteGain(entry);
  remoteGainNodes.clear();
  peerVolumes.clear();
  hiddenPeers.clear();
}

// Enquanto voce compartilha com audio do sistema, o som que o TelinhaFix
// toca (quem voce esta ouvindo) podia entrar na sua captura e voltar pra
// eles em eco - por isso o app mutava todo mundo. O helper de audio agora
// deixa o TelinhaFix de fora da captura e avisa (audio-echo-risk = false);
// so mutamos se ele NAO conseguir (Windows antigo, captura caiu pro modo
// simples). Modo camera e audio de um programa so nao tem esse risco.
let audioEchoRisk = false;

function isRemoteAudioSuppressedForEcho() {
  return !!localStream && shareMode !== 'camera' && audioEchoRisk;
}

window.audioCapture.onEchoRisk((risk) => {
  audioEchoRisk = risk;
  refreshAllGainsForSharingState();
});

function applyGain(peerId) {
  const entry = remoteGainNodes.get(peerId);
  if (!entry) return;
  // So suprime o audio dos outros quando a sua captura de audio do sistema
  // pegaria o som deles (eco) - ver isRemoteAudioSuppressedForEcho.
  // E corta de vez quando a transmissao esta oculta (botao direito na tile).
  const hiddenFactor = hiddenPeers.has(peerId) ? 0 : 1;
  const suppressForEcho = isRemoteAudioSuppressedForEcho();
  const muteFactor = masterMuted ? 0 : 1;
  entry.gainNode.gain.value = (suppressForEcho ? 0 : entry.sliderValue / 100) * hiddenFactor * muteFactor;
}

// So pra deixar claro NA TELA o motivo do mixer "nao fazer nada" enquanto
// voce compartilha com audio do sistema (ver suppressForEcho em applyGain) -
// sem isso parece um controle quebrado, mexe e o volume de quem voce ta
// ouvindo nao muda nadinha.
const SUPPRESSED_VOLUME_TITLE = 'Você não está ouvindo os outros enquanto compartilha com áudio do sistema (evita eco). O volume e o mudo que você escolher valem quando parar.';

function updateVolumeControlsSuppressedState() {
  document.querySelectorAll('.volume-control[data-volume-peer]').forEach(paintVolumeControl);
}

// --- Controle de volume de cada transmissao --------------------------------
// Dois visuais pro MESMO controle (Configuracoes > Sons > Controle de volume):
//   "abre"    - botao redondo com o alto-falante que se abre pro lado e
//               mostra uma linha fina (padrao);
//   "degraus" - 10 barrinhas de 20% cada que sobem como medidor de sinal.
// Os dois mostram exatamente o volume aplicado no audio: a porcentagem e o
// ganho do GainNode x 100 (100% = volume original, ate 200% amplificando),
// a linha e as barrinhas usam a mesma escala (0-200, com marca no 100%) e
// uma barrinha pela metade e volume no meio daquele degrau. O estado e da
// PESSOA (peerVolumes), entao trocar o visual nao mexe no volume.
const VOLUME_MAX = 200;
const VOLUME_STEP_PCT = 20;
const VOLUME_STEP_COUNT = VOLUME_MAX / VOLUME_STEP_PCT;
const VOLUME_KEY_STEP = 5;

// Algo por cima do volume escolhido que faz a pessoa nao tocar agora.
function volumeOverrideReason(peerId) {
  if (masterMuted) return 'Mudo geral ligado - ninguém está tocando (Ctrl+Alt+M desliga).';
  if (hiddenPeers.has(peerId)) return 'Transmissão oculta - sem som até você mostrar de novo.';
  if (isRemoteAudioSuppressedForEcho()) return SUPPRESSED_VOLUME_TITLE;
  return '';
}

function clampVolume(v) {
  return Math.max(0, Math.min(VOLUME_MAX, Math.round(Number(v) || 0)));
}

function setPeerVolume(peerId, pct) {
  const v = clampVolume(pct);
  const saved = peerVolumeOf(peerId);
  peerVolumes.set(peerId, { value: v, lastVolume: v > 0 ? v : saved.lastVolume });
  const entry = remoteGainNodes.get(peerId);
  if (entry) {
    entry.sliderValue = v;
    applyGain(peerId);
  }
  document.querySelectorAll(`.volume-control[data-volume-peer="${CSS.escape(peerId)}"]`).forEach(paintVolumeControl);
}

function togglePeerMute(peerId) {
  const v = peerVolumeOf(peerId).value;
  // Volume de antes de mutar, pra voltar no mesmo nivel (nao sempre 100%).
  setPeerVolume(peerId, v === 0 ? (peerVolumeOf(peerId).lastVolume || 100) : 0);
}

function paintVolumeControl(row) {
  const peerId = row.dataset.volumePeer;
  const v = peerVolumeOf(peerId).value;
  const muted = v === 0;
  const reason = volumeOverrideReason(peerId);
  row.classList.toggle('is-muted', muted);
  row.classList.toggle('vol-over', v > 100);
  row.classList.toggle('vol-overridden', !!reason);
  row.classList.toggle('volume-control-suppressed', isRemoteAudioSuppressedForEcho());
  row.title = reason;
  row.style.setProperty('--vol-f', String(v / VOLUME_MAX));
  const icon = row.querySelector('.volume-icon');
  icon.innerHTML = muted ? ICONS.speakerMuted : ICONS.speakerOn;
  icon.title = muted ? 'Desmutar' : 'Mutar';
  icon.setAttribute('aria-label', icon.title);
  const slider = row.querySelector('.volume-slider');
  if (Number(slider.value) !== v) slider.value = String(v);
  slider.setAttribute('aria-valuetext', muted ? 'mudo' : `${v}%`);
  row.querySelectorAll('.vol-step').forEach((step, i) => {
    const fill = Math.max(0, Math.min(1, (v - i * VOLUME_STEP_PCT) / VOLUME_STEP_PCT));
    step.style.setProperty('--fill', String(fill));
    step.classList.toggle('on', fill > 0);
  });
  const steps = row.querySelector('.vol-c');
  steps.setAttribute('aria-valuenow', String(v));
  steps.setAttribute('aria-valuetext', muted ? 'mudo' : `${v}%`);
  row.querySelector('.vol-readout').textContent = muted ? 'mudo' : `${v}%`;
}

// Degraus: cada barrinha cobre 20% e o ponto exato dentro dela define o
// volume (preenchimento parcial = volume no meio do degrau). No espaco entre
// duas barrinhas, vale o limite entre elas.
function volumeFromStepsPointer(stepsEl, clientX) {
  const steps = Array.from(stepsEl.querySelectorAll('.vol-step'));
  const first = steps[0].getBoundingClientRect();
  if (clientX <= first.left) return 0;
  for (let i = 0; i < steps.length; i++) {
    const r = steps[i].getBoundingClientRect();
    if (clientX < r.left) return i * VOLUME_STEP_PCT;
    if (clientX <= r.right) return i * VOLUME_STEP_PCT + ((clientX - r.left) / r.width) * VOLUME_STEP_PCT;
  }
  return VOLUME_MAX;
}

function createVolumeControl(peerId) {
  const row = document.createElement('div');
  row.className = 'volume-control';
  row.dataset.volumePeer = peerId;
  const stepsHtml = Array.from({ length: VOLUME_STEP_COUNT }, (_, i) => {
    const amp = i >= VOLUME_STEP_COUNT / 2;
    const gap = i === VOLUME_STEP_COUNT / 2;
    // alturas em pixels inteiros: borda de cima nitida (sem meio-pixel borrado)
    return `<span class="vol-step${amp ? ' amp' : ''}${gap ? ' gap' : ''}" style="height:${6 + i * 2}px"></span>`;
  }).join('');
  row.innerHTML = `
    <button type="button" class="volume-icon"></button>
    <span class="vol-b"><input type="range" class="volume-slider" min="0" max="${VOLUME_MAX}" step="1" aria-label="Volume" title="Até 200% - passar de 100% amplifica. Duplo clique volta pra 100%."></span>
    <span class="vol-c" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="${VOLUME_MAX}" title="Até 200% - as barrinhas depois do espaço amplificam. Duplo clique volta pra 100%.">${stepsHtml}</span>
    <span class="vol-readout" aria-hidden="true"></span>`;
  const icon = row.querySelector('.volume-icon');
  const slider = row.querySelector('.volume-slider');
  const steps = row.querySelector('.vol-c');

  icon.addEventListener('click', (e) => { e.stopPropagation(); togglePeerMute(peerId); });
  slider.addEventListener('input', () => setPeerVolume(peerId, slider.value));

  // "vol-active": mantem o controle aberto enquanto arrasta, mesmo se o
  // mouse sair de cima dele no meio do movimento.
  row.addEventListener('pointerdown', () => {
    row.classList.add('vol-active');
    window.addEventListener('pointerup', () => row.classList.remove('vol-active'), { once: true });
  });
  steps.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // nunca comeca selecao/arrasto de texto (ver user-select no CSS)
    steps.focus({ preventScroll: true });
    steps.setPointerCapture(e.pointerId);
    setPeerVolume(peerId, volumeFromStepsPointer(steps, e.clientX));
  });
  steps.addEventListener('pointermove', (e) => {
    if (steps.hasPointerCapture(e.pointerId)) setPeerVolume(peerId, volumeFromStepsPointer(steps, e.clientX));
  });
  steps.addEventListener('keydown', (e) => {
    const v = peerVolumeOf(peerId).value;
    const next = { ArrowRight: v + VOLUME_KEY_STEP, ArrowUp: v + VOLUME_KEY_STEP, ArrowLeft: v - VOLUME_KEY_STEP, ArrowDown: v - VOLUME_KEY_STEP,
      PageUp: v + VOLUME_STEP_PCT, PageDown: v - VOLUME_STEP_PCT, Home: 0, End: VOLUME_MAX }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setPeerVolume(peerId, next);
  });
  // Rodinha do mouse em cima do controle: +-5%.
  row.addEventListener('wheel', (e) => {
    e.preventDefault();
    setPeerVolume(peerId, peerVolumeOf(peerId).value + (e.deltaY < 0 ? VOLUME_KEY_STEP : -VOLUME_KEY_STEP));
  }, { passive: false });
  // Duplo clique na linha/barrinhas: volta pra 100%. Nunca deixa o duplo
  // clique chegar na tile (que entraria em tela cheia).
  row.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (e.target.closest('.vol-b, .vol-c')) setPeerVolume(peerId, 100);
  });
  row.addEventListener('click', (e) => e.stopPropagation());
  paintVolumeControl(row);
  return row;
}

// Degraus "pulsam" quando sai som de verdade dessa pessoa (medido DEPOIS do
// volume, entao mutado/oculto nao pulsa). So roda com o visual degraus.
const VOLUME_PLAYING_RMS = 0.01;
setInterval(() => {
  if (!document.documentElement.classList.contains('volume-style-degraus')) return;
  for (const [peerId, entry] of remoteGainNodes) {
    if (!entry.analyser) {
      entry.analyser = entry.gainNode.context.createAnalyser();
      entry.analyser.fftSize = 512;
      entry.gainNode.connect(entry.analyser);
      entry.analyserData = new Float32Array(entry.analyser.fftSize);
    }
    entry.analyser.getFloatTimeDomainData(entry.analyserData);
    let sum = 0;
    for (const x of entry.analyserData) sum += x * x;
    const playing = Math.sqrt(sum / entry.analyserData.length) > VOLUME_PLAYING_RMS;
    document.querySelectorAll(`.volume-control[data-volume-peer="${CSS.escape(peerId)}"]`).forEach((row) => row.classList.toggle('vol-playing', playing));
  }
}, 200);

function refreshAllGainsForSharingState() {
  for (const peerId of remoteGainNodes.keys()) applyGain(peerId);
  updateVolumeControlsSuppressedState();
}

// Print da live: o frame que esta na tela agora, no tamanho real do video
// (nao o tamanho da tile), copiado como imagem - e so colar no Discord/
// WhatsApp. Camera sai espelhada igual aparece pra todo mundo.
let snapshotToastTimer = null;
async function copyTileSnapshot(tile, video, btn) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  let ok = false;
  if (w && h && !tile.classList.contains('content-hidden')) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (video.classList.contains('mirrored-video')) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, w, h);
      ok = await window.appLinks.copyImage(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Falha ao copiar print da transmissao:', err);
    }
  }
  btn.innerHTML = ok ? ICONS.check : ICONS.close;
  btn.classList.toggle('copied', ok);
  clearTimeout(btn._snapshotTimer);
  btn._snapshotTimer = setTimeout(() => { btn.innerHTML = ICONS.snapshot; btn.classList.remove('copied'); }, 1500);
  const toast = document.getElementById('snapshot-toast');
  if (toast) {
    toast.textContent = ok ? 'Print copiado - é só colar (Ctrl+V)' : 'Não deu pra tirar o print (o vídeo ainda não chegou?)';
    toast.classList.toggle('error', !ok);
    toast.classList.remove('hidden');
    clearTimeout(snapshotToastTimer);
    snapshotToastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }
  return ok;
}

function updateSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = ((Number(slider.value) - min) / (max - min)) * 100;
  // o visual (linha branca ate a bolinha) fica no CSS - ver .opacity-slider
  slider.style.setProperty('--f', String(Math.min(1, Math.max(0, pct / 100))));
}

function getOrCreateVideoTile(peerId, label, isSelf = false, opts = {}) {
  const { hasAudio = true } = opts;
  let tile = document.getElementById(`tile-${peerId}`);
  if (tile) return tile.querySelector('video');

  tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `tile-${peerId}`;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  // Sempre mudo: na sua tile, senao voce ouviria o proprio audio capturado
  // (eco); nas dos outros, porque o audio deles toca SO pelo controle de
  // volume (wireRemoteAudioGain) - se o <video> tocasse tambem, o mudo da
  // tile nao teria efeito nenhum.
  video.muted = true;

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
  btnFullscreen.innerHTML = ICONS.fullscreen;
  btnFullscreen.title = 'Tela cheia (ou 2 cliques no video)';
  btnFullscreen.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTileFullscreen(tile);
  });

  const btnPip = document.createElement('button');
  btnPip.className = 'tile-action-btn';
  btnPip.innerHTML = ICONS.pip;
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
  btnFocus.innerHTML = ICONS.focus;
  btnFocus.title = 'Focar (encolher os outros)';
  btnFocus.addEventListener('click', (e) => {
    e.stopPropagation();
    setFocus(peerId);
  });

  const btnSnapshot = document.createElement('button');
  btnSnapshot.className = 'tile-action-btn tile-snapshot-btn';
  btnSnapshot.innerHTML = ICONS.snapshot;
  btnSnapshot.title = 'Copiar print da transmissão (cola com Ctrl+V)';
  btnSnapshot.addEventListener('click', (e) => {
    e.stopPropagation();
    copyTileSnapshot(tile, video, btnSnapshot);
  });

  actionsRow.appendChild(btnSnapshot);
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
    // Alt + clique: aponta nesse ponto da transmissao (ver handleTilePing)
    tile.addEventListener('click', (e) => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      handleTilePing(peerId, tile, video, e);
    });
    const hiddenOverlay = document.createElement('div');
    hiddenOverlay.className = 'tile-hidden-overlay';
    hiddenOverlay.textContent = 'Transmissão oculta — clique com o botão direito para mostrar de novo';
    tile.appendChild(hiddenOverlay);
    // Voce tinha ocultado essa pessoa e ela voltou a transmitir: a tile nova
    // ja nasce oculta (o som tambem fica cortado - ver applyGain).
    if (hiddenPeers.has(peerId)) tile.classList.add('content-hidden');

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
  // Telas extras nunca tem audio (so a principal carrega som) - sem slider
  // nelas, pra nao mostrar um controle que nao faz nada.
  // O volume fica guardado por pessoa (peerVolumes), nao so no GainNode:
  // vale mesmo se voce mutar antes do audio chegar, e continua igual se a
  // pessoa parar e voltar a transmitir (a tile e refeita do zero). Ver
  // createVolumeControl.
  if (!isSelf && hasAudio) tile.appendChild(createVolumeControl(peerId));

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
    disconnectRemoteGain(gainEntry);
    remoteGainNodes.delete(peerId);
  }
  // peerVolumes e hiddenPeers NAO sao apagados: se a pessoa parar e voltar a
  // transmitir (ou trocar tela <-> camera), continua com o volume/mudo que
  // voce escolheu e continua OCULTA (sem imagem e sem som) se voce ocultou.
  // So esquece quando ela sai da sala (forgetPeerAudioPrefs) ou voce sai.
}

function forgetPeerAudioPrefs(peerId) {
  peerVolumes.delete(peerId);
  hiddenPeers.delete(peerId);
}

// Mostra/esconde o aviso de "reconectando" numa tile - a pessoa continua
// vendo o ultimo frame congelado por baixo (nao removemos nada durante a
// tentativa de reconexao), so fica claro que o app esta tentando voltar
// sozinho em vez de parecer travado sem explicacao.
function setTileReconnecting(peerId, reconnecting) {
  const tile = document.getElementById(`tile-${peerId}`);
  if (!tile) return;
  const wasReconnecting = tile.classList.contains('tile-reconnecting');
  tile.classList.toggle('tile-reconnecting', reconnecting);
  if (reconnecting && !wasReconnecting) playDisconnectSound();
  else if (!reconnecting && wasReconnecting) playReconnectedSound();
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
function addChatMessage({ author, text, timestamp, self, history }) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  const row = document.createElement('div');
  row.className = 'chat-message' + (self ? ' self' : '') + (history ? ' chat-history' : '');

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

  if (!self && !history) {
    playChatSound();
    if (!chatPanelOpen) {
      chatUnreadCount++;
      updateChatUnreadBadge();
    }
  }
}

// Mensagens que a sala trocou antes de voce entrar (o servidor guarda as
// ultimas 50) - aparecem mais apagadas, sem som e sem contar como nao lidas.
function renderChatHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return;
  messages.forEach((m) => addChatMessage({ author: String(m.author || 'Participante'), text: String(m.text || ''), timestamp: m.t || Date.now(), self: false, history: true }));
  addChatSystemMessage('— mensagens de antes de você entrar —');
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

  // copia pro historico da sala (pra quem entrar depois ver a conversa)
  window.rtc.storeChat(trimmed);

  const payload = JSON.stringify({ text: trimmed, timestamp });
  for (const [, state] of peers) {
    if (state.chatChannel && state.chatChannel.readyState === 'open') {
      try { state.chatChannel.send(payload); } catch (err) { console.error('Falha ao enviar mensagem de chat:', err); }
    }
  }
}

// --- Minijogo "Codigo Secreto" (Codenames) --------------------------------
// Estado de verdade mora no servidor, por sala (ver server/index.js) - os
// jogadores sao sempre quem estiver na mesma sala/codigo. Aqui so renderiza
// o que chega via window.game.onState() e manda as acoes do jogador.

let gameState = null;
let gameOverlayOpen = false;
let mySecretMap = null;
let mySecretMapRound = -1;
let mySecretMapBoardId = null;

// Chave do tabuleiro atual: o boardId do servidor (unico por tabuleiro).
// Servidor antigo sem boardId: cai no round, como era antes.
function currentBoardKey() {
  return gameState ? (gameState.boardId || `round-${gameState.round}`) : null;
}
function secretMapIsCurrent() {
  return !!mySecretMap && mySecretMapBoardId === currentBoardKey();
}
// Elementos das 25 cartas, mantidos entre renders (ver renderGameBoard) -
// reaproveitar o mesmo DOM em vez de recriar tudo a cada estado novo e o
// que permite a transicao CSS do flip tocar de verdade quando uma carta
// passa de "escondida" pra "revelada".
let boardCellEls = [];
let boardCellRound = -1; // guarda a chave do tabuleiro (ver currentBoardKey), nao so o round
let gameTickInterval = null;
// 'picker' | 'codenames' | 'stop' - qual tela o painel 🎮 ta mostrando.
let currentGameView = 'picker';

const GAME_TEAM_LABEL = { red: 'Vermelha', blue: 'Azul', green: 'Verde' };
const GAME_MODE_LABEL = { livre: 'Livre', '2x2': '2x2', '3x3': '3x3', ffa3: '2x2x2 Todos contra todos' };
const GAME_TITLES = { picker: 'Minijogos', codenames: 'Codenames', stop: 'Stop / Adedonha', sketch: 'Sketch do PC' };

// Codenames abre ocupando a janela inteira (e em tela cheia de verdade) -
// o tabuleiro + as duas colunas de equipe nao cabem legiveis no modal
// pequeno. Sai da tela cheia ao voltar pros jogos ou fechar o painel.
// Feito pelo processo principal (BrowserWindow.setFullScreen) e nao pela
// API de fullscreen do HTML, que exige um clique "fresco" e falha a toa
// (ex: entrando pelo convite/badge). So desfaz se fomos nos que ligamos.
let codenamesEnteredFullscreen = false;

function setCodenamesFullscreen(on) {
  const overlay = document.getElementById('game-overlay');
  if (overlay.classList.contains('game-overlay-fullscreen') === on) return;
  overlay.classList.toggle('game-overlay-fullscreen', on);
  if (on) {
    codenamesEnteredFullscreen = true;
    window.appWindow.setFullscreen(true)
      .then((wasFullscreen) => { if (wasFullscreen) codenamesEnteredFullscreen = false; })
      .catch((err) => console.warn('Nao deu pra entrar em tela cheia:', err));
  } else if (codenamesEnteredFullscreen) {
    codenamesEnteredFullscreen = false;
    window.appWindow.setFullscreen(false).catch(() => {});
  }
}

function showGamePicker() {
  setCodenamesFullscreen(false);
  currentGameView = 'picker';
  document.getElementById('game-title').textContent = GAME_TITLES.picker;
  document.getElementById('btn-game-back').classList.add('hidden');
  document.getElementById('game-picker-view').classList.remove('hidden');
  document.getElementById('codenames-view').classList.add('hidden');
  document.getElementById('stop-view').classList.add('hidden');
  document.getElementById('sketch-view').classList.add('hidden');
}

function selectGame(name) {
  currentGameView = name;
  document.getElementById('game-title').textContent = GAME_TITLES[name] || '';
  document.getElementById('btn-game-back').classList.remove('hidden');
  document.getElementById('game-picker-view').classList.add('hidden');
  document.getElementById('codenames-view').classList.toggle('hidden', name !== 'codenames');
  document.getElementById('stop-view').classList.toggle('hidden', name !== 'stop');
  document.getElementById('sketch-view').classList.toggle('hidden', name !== 'sketch');
  setCodenamesFullscreen(name === 'codenames');
  if (name === 'codenames') refreshGameState();
  else if (name === 'stop') refreshStopState();
  else if (name === 'sketch') refreshSketchState();
}

// Abre o painel 🎮 direto num jogo especifico (usado pelo badge de
// atividade na topbar - ver renderGameActivityBadge), pulando o seletor.
function jumpToGame(name) {
  gameOverlayOpen = true;
  document.getElementById('game-overlay').classList.remove('hidden');
  selectGame(name);
}

// Badge na topbar (do lado do nome da sala) avisando que algum minijogo
// esta rolando AGORA, mesmo com o painel 🎮 fechado - cada jogo broadcasta
// seu estado pra sala inteira independente do painel estar aberto (ver os
// tres window.*.onState abaixo), entao so precisa reagir a esses estados
// aqui tambem, sem depender de gameOverlayOpen/currentGameView.
function renderGameActivityBadge() {
  const container = document.getElementById('game-activity-badge');
  if (!container) return;

  const active = [];
  if (gameState && gameState.status === 'playing') active.push('codenames');
  if (stopState && (stopState.status === 'lobby' || stopState.status === 'playing')) active.push('stop');
  if (sketchState && sketchState.status === 'voting') active.push('sketch');

  renderGamePlayingBadge();
  container.innerHTML = '';
  container.classList.toggle('hidden', active.length === 0);
  active.forEach((name) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'game-activity-pill';
    pill.title = 'Abrir o minijogo';

    const dot = document.createElement('span');
    dot.className = 'dot';
    const label = document.createElement('span');
    label.innerHTML = `${ICONS.gamepad} ${GAME_TITLES[name]}`;

    pill.appendChild(dot);
    pill.appendChild(label);
    pill.addEventListener('click', () => jumpToGame(name));
    container.appendChild(pill);
  });
}

// Selo "N jogando" no botao de fliperama da Sala de jogos: quantas pessoas
// estao numa partida agora (quem so assiste o Codenames nao conta).
function gamePlayersNow() {
  let n = 0;
  if (gameState && gameState.status === 'playing') {
    for (const t of Object.values(gameState.teams || {})) n += (t.spymaster ? 1 : 0) + (t.agents || []).length;
  }
  if (stopState && stopState.status === 'playing') n += (stopState.players || []).length;
  else if (stopState && stopState.status === 'lobby') n += (stopState.lobbyPlayers || []).filter((p) => p.ready).length;
  if (sketchState && sketchState.status === 'voting') n += (sketchState.total || 0) + 1; // quem votou + quem criou
  return n;
}

function renderGamePlayingBadge() {
  const badge = document.getElementById('game-playing-badge');
  if (!badge) return;
  const n = gamePlayersNow();
  badge.classList.toggle('hidden', n === 0);
  document.getElementById('game-playing-count').textContent = `${n} jogando`;
  document.getElementById('btn-toggle-game').title = n ? `Minijogos - ${n} ${n === 1 ? 'pessoa jogando' : 'pessoas jogando'} agora` : 'Minijogos';
}

function myGameRole() {
  if (!gameState || !selfId) return null;
  for (const team of Object.keys(gameState.teams)) {
    const t = gameState.teams[team];
    if (t.spymaster && t.spymaster.id === selfId) return { team, role: 'spymaster' };
    if (t.agents.some((a) => a.id === selfId)) return { team, role: 'agent' };
  }
  return null;
}

// Minha entrada em Espectadores ({ id, name, withMap }) ou null.
function mySpectatorEntry() {
  if (!gameState || !selfId) return null;
  return (gameState.spectators || []).find((s) => s.id === selfId) || null;
}

// Quem ve o mapa secreto: o Mestre-Espiao (se o time dele nao caiu) ou o
// espectador que escolheu "assistir com mapa".
function canSeeSecretMap() {
  const role = myGameRole();
  if (role) {
    return role.role === 'spymaster'
      && !(gameState.status === 'playing' && gameState.eliminated?.includes(role.team));
  }
  const spec = mySpectatorEntry();
  return !!(spec && spec.withMap);
}

function spectatorNamesHtml() {
  const specs = gameState.spectators || [];
  if (!specs.length) return '<li class="game-agents-empty">Ninguém assistindo</li>';
  return specs.map((s) => `<li>${escapeHtml(s.name)}${s.id === selfId ? ' (você)' : ''}<span class="game-spectator-tag">${s.withMap ? 'com mapa' : 'sem mapa'}</span></li>`).join('');
}

function setGameError(msg) {
  const el = document.getElementById('game-lobby-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

async function refreshGameState() {
  try {
    gameState = withPhaseDeadline(await window.game.getState());
    renderGame();
  } catch (err) {
    console.error('Falha ao buscar estado do minijogo:', err);
  }
}

function openGameOverlay() {
  gameOverlayOpen = true;
  document.getElementById('game-overlay').classList.remove('hidden');
  showGamePicker();
}

function closeGameOverlay() {
  setCodenamesFullscreen(false);
  gameOverlayOpen = false;
  document.getElementById('game-overlay').classList.add('hidden');
  clearStopTimerInterval();
  clearGameTimerInterval();
}

function ensureSecretMap() {
  if (!gameState || (gameState.status !== 'playing' && gameState.status !== 'over')) return;
  if (!canSeeSecretMap()) return;
  if (secretMapIsCurrent()) return;
  window.game.getSecretMap().then((res) => {
    mySecretMap = res.map;
    mySecretMapRound = res.round;
    mySecretMapBoardId = res.boardId || `round-${res.round}`;
    renderGame();
  }).catch((err) => console.error('Falha ao buscar mapa secreto:', err));
}

// Nome com que VOCE entrou na sala (pra achar "seu lugar antes" no Codenames).
let mySelfName = null;
// "Entrar num time" no painel de espectadores: abre a escolha de vaga mesmo
// pra quem ja esta assistindo.
let gameJoinViewForced = false;

// Partida rolando e voce ainda nao escolheu nada (nem time nem assistir):
// mostra "Partida em andamento" em vez de jogar voce direto no tabuleiro.
function needsGameJoinChoice() {
  if (!gameState || gameState.status !== 'playing' || myGameRole()) return false;
  return gameJoinViewForced || !mySpectatorEntry();
}

function renderGame() {
  if (!gameState || !gameOverlayOpen || currentGameView !== 'codenames') return;
  const playing = gameState.status === 'playing' || gameState.status === 'over';
  if (myGameRole() || gameState.status !== 'playing') gameJoinViewForced = false;
  const choosing = needsGameJoinChoice();
  document.getElementById('game-lobby-view').classList.toggle('hidden', playing);
  document.getElementById('game-board-view').classList.toggle('hidden', !playing || choosing);
  document.getElementById('game-join-view').classList.toggle('hidden', !choosing);

  if (choosing) {
    renderGameJoinView();
  } else if (!playing) {
    renderGameLobby();
  } else {
    ensureSecretMap();
    renderGameBoard();
  }
}

function renderGameJoinView() {
  const maxAgents = GAME_MODE_MAX_AGENTS[gameState.mode] ?? Infinity;
  const me = normalizeRoomId(mySelfName || ''); // so pra comparar nomes sem maiuscula/espaco
  const sawMap = (gameState.mapViewers || []).includes(selfId);
  const vacated = gameState.vacated || [];
  const spec = mySpectatorEntry();
  const teamCards = Object.keys(gameState.teams).map((team) => {
    const t = gameState.teams[team];
    const eliminated = gameState.eliminated?.includes(team);
    const vacFor = (role) => vacated.find((v) => v.team === team && v.role === role);
    const mine = (v) => v && normalizeRoomId(v.name) === me;
    const vacTag = (v) => (v ? `<span class="game-join-vacated${mine(v) ? ' game-join-mine' : ''}">${mine(v) ? 'seu lugar antes' : `lugar de ${escapeHtml(v.name)}`}</span>` : '');
    const spyVac = vacFor('spymaster');
    const agentVac = vacFor('agent');
    const spySlot = t.spymaster
      ? `<span class="game-join-name">${escapeHtml(t.spymaster.name)}</span>`
      : `<button type="button" class="game-join-seat${mine(spyVac) ? ' game-join-seat-mine' : ''}" data-join-team="${team}" data-join-role="spymaster"${eliminated ? ' disabled' : ''}>Entrar como Mestre-Espião</button>${vacTag(spyVac)}`;
    const agentsFull = t.agents.length >= maxAgents;
    const agentBlocked = sawMap ? 'Você viu o mapa assistindo - nessa partida só dá pra entrar como Mestre-Espião' : '';
    const agentSlot = agentsFull
      ? '<span class="game-join-full">time cheio</span>'
      : `<button type="button" class="game-join-seat${mine(agentVac) ? ' game-join-seat-mine' : ''}" data-join-team="${team}" data-join-role="agent"${eliminated || agentBlocked ? ' disabled' : ''}${agentBlocked ? ` title="${escapeHtml(agentBlocked)}"` : ''}>Entrar como agente</button>${vacTag(agentVac)}`;
    return `
      <div class="game-team-card game-team-card-${team} game-join-team${eliminated ? ' game-join-eliminated' : ''}">
        <h3>Equipe ${GAME_TEAM_LABEL[team]}${eliminated ? ' · eliminada' : ''}</h3>
        <div class="game-team-slot"><span class="game-slot-label">Mestre-Espião</span>${spySlot}</div>
        <div class="game-team-slot game-team-slot-agents"><span class="game-slot-label">Agentes</span>
          <span class="game-join-name">${t.agents.length ? t.agents.map((a) => escapeHtml(a.name)).join(', ') : 'ninguém'}</span>
          ${agentSlot}
        </div>
      </div>`;
  }).join('');
  document.getElementById('game-join-content').innerHTML = `
    <div class="game-join-watch">
      <button type="button" class="game-join-watch-btn" data-join-watch="1"><strong>Assistir com mapa</strong><span>Vê a cor de todas as cartas, como os mestres-espiões.</span></button>
      <button type="button" class="game-join-watch-btn" data-join-watch="0"><strong>Assistir sem mapa</strong><span>Vê só as cartas que já foram reveladas.</span></button>
    </div>
    <h4 class="game-join-subtitle">Ou entre numa vaga</h4>
    <div class="game-teams-row game-join-teams">${teamCards}</div>
    ${sawMap ? '<p class="settings-hint">Você assistiu essa partida com o mapa, então como agente não dá (seria roubar) - só como Mestre-Espião.</p>' : ''}
    ${spec ? '<button type="button" class="ghost game-join-back" data-join-back>Voltar a assistir</button>' : ''}`;
}

const GAME_MODE_MAX_AGENTS = { livre: Infinity, '2x2': 1, '3x3': 2, ffa3: 1 };

function renderGameLobby() {
  const role = myGameRole();
  const activeTeams = Object.keys(gameState.teams);
  const maxAgents = GAME_MODE_MAX_AGENTS[gameState.mode] ?? Infinity;

  document.querySelectorAll('.game-mode-option[data-mode]').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.mode === gameState.mode);
  });
  // Servidor antigo nao manda "category" - ai as palavras sao sempre as normais.
  const category = gameState.category || 'normal';
  renderCustomCategoryButtons(category);
  document.querySelectorAll('.game-mode-option[data-category]').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.category === category);
  });

  // Carta da equipe Verde so existe no modo ffa3 - as outras duas (vermelha/
  // azul) aparecem em todo modo, entao nao precisam de toggle.
  const greenCard = document.querySelector('[data-team-card="green"]');
  if (greenCard) greenCard.classList.toggle('hidden', !activeTeams.includes('green'));

  activeTeams.forEach((team) => {
    const t = gameState.teams[team];
    document.querySelector(`[data-slot="${team}-spymaster"]`).textContent = t.spymaster ? t.spymaster.name : '—';

    const agentsEl = document.querySelector(`[data-slot="${team}-agents"]`);
    agentsEl.innerHTML = '';
    if (t.agents.length === 0) {
      const li = document.createElement('li');
      li.className = 'game-agents-empty';
      li.textContent = 'Ninguém ainda';
      agentsEl.appendChild(li);
    } else {
      t.agents.forEach((a) => {
        const li = document.createElement('li');
        li.textContent = a.name;
        agentsEl.appendChild(li);
      });
    }
  });

  document.querySelectorAll('.game-pick-btn').forEach((btn) => {
    const team = btn.dataset.team;
    if (!activeTeams.includes(team)) return; // time nao existe nesse modo (ex: verde fora do ffa3)
    const btnRole = btn.dataset.role;
    const isMine = !!(role && role.team === team && role.role === btnRole);
    const slotTaken = btnRole === 'spymaster'
      ? gameState.teams[team].spymaster && !isMine
      : gameState.teams[team].agents.length >= maxAgents && !isMine;
    btn.disabled = !!slotTaken;
    btn.classList.toggle('selected', isMine);
    if (btnRole === 'spymaster') {
      btn.textContent = isMine ? 'Você é o Mestre-Espião' : 'Escolher';
    } else {
      btn.textContent = isMine ? 'Você está jogando' : 'Entrar como agente';
    }
  });

  const spec = mySpectatorEntry();
  document.querySelector('[data-slot="spectators"]').innerHTML = spectatorNamesHtml();
  document.querySelectorAll('.game-spectate-btn').forEach((btn) => {
    const withMap = btn.dataset.withMap === '1';
    const isMine = !!(spec && spec.withMap === withMap);
    btn.classList.toggle('selected', isMine);
    btn.textContent = isMine
      ? `Você está assistindo ${withMap ? 'com' : 'sem'} mapa`
      : `Assistir ${withMap ? 'com' : 'sem'} mapa`;
  });

  const leaveBtn = document.getElementById('btn-game-leave-role');
  leaveBtn.classList.toggle('hidden', !role && !spec);
  leaveBtn.textContent = spec ? 'Parar de assistir' : 'Sair da equipe';

  const bothReady = activeTeams.every((team) => gameState.teams[team].spymaster && gameState.teams[team].agents.length >= 1);
  const amIHost = !gameState.hostId || gameState.hostId === selfId;
  const startBtn = document.getElementById('btn-game-start');
  startBtn.disabled = !bothReady || !amIHost;
  startBtn.title = amIHost ? '' : 'Só quem abriu o lobby pode iniciar a partida';
  document.getElementById('btn-game-shuffle').classList.toggle('hidden', !amIHost);
}

// Monta as 25 cartas do zero (fundo + verso, ver CSS .game-cell-inner) -
// chamado so quando comeca uma partida/rodada nova, nunca a cada
// atualizacao de estado (isso destruiria o DOM e quebraria a animacao do
// flip - ver renderGameBoard).
function buildBoardCells(boardEl) {
  boardEl.innerHTML = '';
  shownWordCells.clear();
  boardCellEls = gameState.board.map((cell, i) => {
    const div = document.createElement('div');
    div.className = 'game-cell';

    const inner = document.createElement('div');
    inner.className = 'game-cell-inner';

    const front = document.createElement('div');
    front.className = 'game-cell-face game-cell-front';
    const frontWord = document.createElement('span');
    frontWord.className = 'game-cell-word';
    frontWord.textContent = cell.word;
    front.appendChild(frontWord);
    const marks = document.createElement('div');
    marks.className = 'game-cell-marks';
    front.appendChild(marks);

    const back = document.createElement('div');
    back.className = 'game-cell-face game-cell-back';
    const photo = document.createElement('img');
    photo.className = 'game-cell-photo';
    photo.alt = '';
    photo.draggable = false;
    back.appendChild(photo);
    const tint = document.createElement('div');
    tint.className = 'game-cell-tint';
    back.appendChild(tint);
    const backWord = document.createElement('span');
    backWord.className = 'game-cell-word';
    backWord.textContent = cell.word;
    back.appendChild(backWord);

    inner.appendChild(front);
    inner.appendChild(back);
    div.appendChild(inner);
    boardEl.appendChild(div);

    div.addEventListener('click', () => handleGameCellClick(i));

    return { root: div, inner, front, back, photo, marks };
  });
}

// Clicar numa carta clicavel so SELECIONA (ver updateGuessConfirmUi) - so
// revela de verdade clicando de novo na MESMA carta (confirma) ou no botao
// "Confirmar" da barra que aparece. Clicar numa carta diferente so troca a
// selecao, sem revelar a anterior. Pedido explicito do Rafael: cliques sem
// querer perto do fim do turno estavam revelando a palavra errada.
let selectedGuessCellIndex = null;

// Cartas ja reveladas mostram so a foto; clicar alterna entre a foto e a
// palavra - so na tela de quem clicou.
const shownWordCells = new Set();

function handleGameCellClick(i) {
  const cellEl = boardCellEls[i];
  const cell = gameState?.board?.[i];
  if (cellEl && cell && (cell.revealed || (gameState.status === 'over' && cell.team))) {
    if (shownWordCells.has(i)) shownWordCells.delete(i); else shownWordCells.add(i);
    cellEl.root.classList.toggle('game-cell-show-word', shownWordCells.has(i));
    return;
  }
  if (cellEl && cellEl.root.classList.contains('game-cell-targetable')) {
    if (clueTargets.has(i)) clueTargets.delete(i); else clueTargets.add(i);
    cellEl.root.classList.toggle('game-cell-target', clueTargets.has(i));
    updateClueTargetHint();
    return;
  }
  if (!cellEl || !cellEl.root.classList.contains('game-cell-clickable')) return;
  if (selectedGuessCellIndex === i) {
    confirmGuess();
    return;
  }
  selectedGuessCellIndex = i;
  updateGuessConfirmUi();
  window.game.markCell(i).catch(() => {});
}

// Cartas que o Mestre-Espiao "tem em mente" pra pista que vai dar - so na
// tela dele, vai junto com a pista e so aparece pra todo mundo no resumo do
// fim ("O que os mestres quiseram dizer"). Opcional.
const clueTargets = new Set();

function updateClueTargetHint() {
  const el = document.getElementById('game-clue-target-hint');
  if (!el) return;
  el.textContent = clueTargets.size
    ? `${clueTargets.size} carta${clueTargets.size > 1 ? 's' : ''} marcada${clueTargets.size > 1 ? 's' : ''} como alvo da pista (só você vê; aparece no resumo do fim)`
    : 'Opcional: clique nas cartas que você quer que o time ache. Só você vê - aparece no resumo do fim da partida.';
}

function confirmGuess() {
  if (selectedGuessCellIndex === null) return;
  const index = selectedGuessCellIndex;
  selectedGuessCellIndex = null;
  updateGuessConfirmUi();
  window.game.revealWord(index).catch((err) => console.error('Falha ao revelar palavra:', err));
}

function cancelGuessSelection() {
  selectedGuessCellIndex = null;
  updateGuessConfirmUi();
  window.game.markCell(null).catch(() => {});
}

// Reflete a selecao pendente no tabuleiro (destaque na carta) e na barra de
// confirmacao - chamado a cada render do tabuleiro, pra limpar sozinho
// quando a selecao deixa de fazer sentido (a vez passou, a carta ja foi
// revelada por outra pessoa, etc).
function updateGuessConfirmUi() {
  if (selectedGuessCellIndex !== null) {
    const stillValid = gameState && gameState.status === 'playing' && gameState.phase === 'guess'
      && gameState.board[selectedGuessCellIndex] && !gameState.board[selectedGuessCellIndex].revealed
      && boardCellEls[selectedGuessCellIndex] && boardCellEls[selectedGuessCellIndex].root.classList.contains('game-cell-clickable');
    if (!stillValid) selectedGuessCellIndex = null;
  }

  boardCellEls.forEach((cellEl, i) => {
    cellEl.root.classList.toggle('game-cell-selected', i === selectedGuessCellIndex);
  });

  const bar = document.getElementById('game-guess-confirm');
  if (selectedGuessCellIndex === null) {
    bar.classList.add('hidden');
    return;
  }
  const word = gameState.board[selectedGuessCellIndex].word;
  document.getElementById('game-guess-confirm-text').textContent = `Revelar "${word.toUpperCase()}"?`;
  bar.classList.remove('hidden');
}

// Contagem regressiva do "tempo de resposta" (ver seletor Especialista/
// Sargento/Novato/Iniciante no lobby) - so decorativo no cliente, quem
// realmente derruba a vez quando estoura e o servidor (ver game-give-clue).
function updateGameAnswerTimerDisplay() {
  const el = document.getElementById('game-answer-timer');
  if (!el || !gameState) return;
  if (gameState.status !== 'playing' || !gameState.phaseDeadline) {
    el.classList.add('hidden');
    return;
  }
  const remainingMs = Math.max(0, gameState.phaseDeadline - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  el.textContent = `${gameState.phase === 'clue' ? 'Pista ' : ''}${mm}:${ss}`;
  el.classList.toggle('game-answer-timer-urgent', seconds <= 5);
  el.classList.remove('hidden');
}

// O servidor manda "quanto falta" (phaseEndsInMs) em vez do horario de
// inicio - assim o cronometro nao depende do relogio do PC bater com o do
// servidor. Vira um prazo no relogio local na hora que o estado chega.
function withPhaseDeadline(state) {
  if (state) state.phaseDeadline = state.phaseEndsInMs != null ? Date.now() + state.phaseEndsInMs : null;
  return state;
}

// Sons do Codenames (so pra quem esta com o jogo aberto): acerto, erro/
// neutra, assassino e troca de vez - comparando o estado anterior com o novo.
function playGameStateSounds(prev, next) {
  if (!prev || !next || !gameOverlayOpen || currentGameView !== 'codenames') return;
  const sameBoard = (prev.boardId || prev.round) === (next.boardId || next.round) && prev.board.length === next.board.length;
  if (!sameBoard || prev.status !== 'playing') return;
  const notes = [];
  next.board.forEach((c, i) => {
    if (!c.revealed || prev.board[i].revealed) return;
    if (c.team === 'assassin') {
      notes.push({ freq: 196, duration: 0.25, type: 'sawtooth', gain: 0.08 }, { freq: 147, start: 0.22, duration: 0.35, type: 'sawtooth', gain: 0.08 }, { freq: 98, start: 0.5, duration: 0.7, type: 'sawtooth', gain: 0.09 });
    } else if (c.team === prev.currentTeam) {
      notes.push({ freq: 659.25, duration: 0.1, gain: 0.11 }, { freq: 987.77, start: 0.09, duration: 0.2, gain: 0.11 });
    } else {
      notes.push({ freq: 311, duration: 0.16, type: 'triangle', gain: 0.13 }, { freq: 233, start: 0.14, duration: 0.26, type: 'triangle', gain: 0.13 });
    }
  });
  if (next.status === 'playing' && prev.currentTeam !== next.currentTeam) {
    const at = notes.length ? 0.55 : 0;
    notes.push({ freq: 523.25, start: at, duration: 0.09, gain: 0.07 }, { freq: 659.25, start: at + 0.09, duration: 0.09, gain: 0.07 }, { freq: 783.99, start: at + 0.18, duration: 0.14, gain: 0.07 });
  }
  if (notes.length) playTones(notes);
}

// Efeitos visuais do Codenames: tela treme + caveira quando alguem revela o
// assassino, e confete + letreiro na cor do time vencedor no fim da partida.
// So pra quem esta com o jogo aberto.
function playGameStateEffects(prev, next) {
  if (!prev || !next || !gameOverlayOpen || currentGameView !== 'codenames') return;
  const sameBoard = (prev.boardId || prev.round) === (next.boardId || next.round) && prev.board.length === next.board.length;
  if (!sameBoard || prev.status !== 'playing') return;
  const hitAssassin = next.board.some((c, i) => c.revealed && !prev.board[i].revealed && c.team === 'assassin');
  if (hitAssassin) playAssassinEffect();
  if (next.status === 'over' && next.winner) {
    setTimeout(() => celebrateWinner(next.winner), hitAssassin ? 1300 : 300);
  }
}

function playAssassinEffect() {
  const view = document.getElementById('game-board-view');
  const skull = document.getElementById('game-fx-skull');
  view.classList.remove('game-assassin-hit');
  void view.offsetWidth; // reinicia a animacao se vier dois seguidos
  view.classList.add('game-assassin-hit');
  skull.innerHTML = CARD_WATERMARKS.assassin;
  skull.classList.remove('hidden');
  setTimeout(() => { view.classList.remove('game-assassin-hit'); skull.classList.add('hidden'); }, 1400);
}

function celebrateWinner(team) {
  const label = GAME_TEAM_LABEL[team] || '';
  const el = document.getElementById('game-fx-victory');
  el.innerHTML = `<strong>Vitória!</strong><span>Equipe ${escapeHtml(label)}</span>`;
  el.className = `game-fx-victory game-fx-victory-${team}`;
  setTimeout(() => el.classList.add('hidden'), 3800);
  const teamColor = getComputedStyle(document.documentElement).getPropertyValue(`--game-${team}`).trim() || '#e2231a';
  launchConfetti([teamColor, teamColor, '#ffffff', '#ffd54a']);
  playTones([
    { freq: 523.25, duration: 0.12, gain: 0.09 }, { freq: 659.25, start: 0.12, duration: 0.12, gain: 0.09 },
    { freq: 783.99, start: 0.24, duration: 0.12, gain: 0.09 }, { freq: 1046.5, start: 0.36, duration: 0.4, gain: 0.1 },
  ]);
}

// Confete simples num canvas por cima de tudo (some sozinho em ~4s).
function launchConfetti(colors) {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-confetti';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const pieces = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    w: 6 + Math.random() * 7,
    h: 9 + Math.random() * 9,
    vx: -2 + Math.random() * 4,
    vy: 2.5 + Math.random() * 4.5,
    rot: Math.random() * Math.PI,
    vr: -0.2 + Math.random() * 0.4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = t > 3200 ? Math.max(0, 1 - (t - 3200) / 800) : 1;
    pieces.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (t < 4000) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// Tempo esgotou (pista ou palpite): aviso grande na tela + som, pra todo
// mundo perceber que a vez passou. timeoutSeq so cresce; o primeiro estado
// recebido (abrir a aba no meio da partida) so registra, nao avisa.
let lastSeenTimeoutSeq = null;
let gameTimeoutNoticeTimer = null;
function notifyGameTimeoutIfNew() {
  const seq = gameState?.timeoutSeq ?? 0;
  if (lastSeenTimeoutSeq === null || seq < lastSeenTimeoutSeq) { lastSeenTimeoutSeq = seq; return; }
  if (seq === lastSeenTimeoutSeq) return;
  lastSeenTimeoutSeq = seq;
  const lt = gameState.lastTimeout;
  const el = document.getElementById('game-timeout-notice');
  if (el && lt) {
    const who = lt.phase === 'clue' ? 'O Mestre-Espião não deu a pista a tempo' : 'Os agentes não escolheram a tempo';
    el.innerHTML = `<strong>Tempo esgotado!</strong><span>${who} - Equipe ${escapeHtml(GAME_TEAM_LABEL[lt.team] || '')} perdeu a vez</span>`;
    el.className = `game-timeout-notice game-timeout-notice-${lt.team}`;
    clearTimeout(gameTimeoutNoticeTimer);
    gameTimeoutNoticeTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }
  playTones([
    { freq: 660, duration: 0.14, type: 'square', gain: 0.07 },
    { freq: 520, start: 0.16, duration: 0.14, type: 'square', gain: 0.07 },
    { freq: 390, start: 0.32, duration: 0.3, type: 'square', gain: 0.07 },
  ]);
}

function startGameTimerInterval() {
  if (gameTickInterval) return;
  updateGameAnswerTimerDisplay();
  gameTickInterval = setInterval(updateGameAnswerTimerDisplay, 250);
}

function clearGameTimerInterval() {
  if (gameTickInterval) { clearInterval(gameTickInterval); gameTickInterval = null; }
}

// Iniciais pro avatar generico (sem foto de verdade - ver aviso no pedido
// do Rafael, nao da pra copiar a arte dos personagens do site oficial).
function avatarInitials(name) {
  const clean = (name || '?').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Nomes vem de outros participantes e vao parar em innerHTML - sempre escapar.
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function gameRolePersonHtml(person) {
  return `<div class="game-role-person"><div class="game-role-avatar" data-avatar-peer="${escapeHtml(person.id)}"><span class="game-role-initials">${escapeHtml(avatarInitials(person.name))}</span></div><div class="game-role-name">${escapeHtml(person.name)}</div></div>`;
}

// Card colorido da equipe (AGENTES ou MESTRE-ESPIÃO) - titulo, avatar
// grande redondo e o nome numa pilula escura embaixo, igual o site oficial.
function gameRoleCardHtml(title, people, acting) {
  const body = people.length
    ? people.map((p) => gameRolePersonHtml(p)).join('')
    : '<p class="game-role-empty">Ninguém ainda</p>';
  return `<div class="game-role-card${acting ? ' game-role-card-active' : ''}"><div class="game-role-title">${title}</div><div class="game-role-people">${body}</div></div>`;
}

// Faixa no topo copiando o "WAIT FOR [avatar] TO GIVE YOU A CLUE" do site
// oficial - quem precisa agir agora (dar a pista ou escolher uma palavra).
function renderGameTurnBanner() {
  const el = document.getElementById('game-turn-banner');
  if (gameState.status === 'over') { el.innerHTML = ''; el.className = 'game-turn-banner hidden'; return; }
  const team = gameState.currentTeam;
  const teamData = gameState.teams[team];
  let actorName = null;
  let text;
  if (gameState.phase === 'clue') {
    actorName = teamData?.spymaster?.name || null;
    text = `Aguardando ${actorName ? '' : 'o Mestre-Espião'} dar uma pista`;
  } else {
    text = 'Escolham uma palavra';
  }
  el.innerHTML = `
    ${actorName ? `<div class="game-avatar game-turn-banner-avatar">${escapeHtml(avatarInitials(actorName))}</div>` : ''}
    <span>${actorName ? `<strong>${escapeHtml(actorName)}</strong> vai ${text.toLowerCase().startsWith('aguardando') ? 'dar uma pista' : text}` : text}</span>
  `;
  el.className = `game-turn-banner game-turn-banner-${team}`;
}

// Paineis laterais (OPERATIVES/SPYMASTER por equipe, contagem restante,
// cronometro) copiando o layout do site oficial - distribui as equipes
// entre os dois lados (no modo ffa3, com 3 equipes, um lado fica com 2).
// Pistas que o time ja recebeu, da mais recente pra mais antiga, com
// quantas palavras certas o time achou em cada uma - ajuda a usar o
// palpite extra pra buscar palavra de pista antiga.
function clueHistoryHtml(team) {
  const clues = (gameState.clueHistory || []).filter((c) => c.team === team);
  if (!clues.length) return '';
  const items = clues.slice().reverse().map((c) => {
    const done = c.number > 0 && c.hits >= c.number;
    return `<li class="${done ? 'game-clue-done' : ''}"><span class="game-clue-word">${escapeHtml(c.word.toUpperCase())}</span><span class="game-clue-num">${c.number === 0 ? '∞' : c.number}</span><span class="game-clue-hits" title="Palavras certas achadas com essa pista">✓ ${c.hits}</span></li>`;
  }).join('');
  return `<div class="game-clue-history"><div class="game-clue-history-title">Pistas</div><ul>${items}</ul></div>`;
}

function renderGameSidePanels() {
  const leftEl = document.getElementById('game-panels-left');
  const rightEl = document.getElementById('game-panels-right');
  const teams = Object.keys(gameState.teams);

  const panelHtml = (team) => {
    const t = gameState.teams[team];
    const eliminated = gameState.eliminated?.includes(team);
    const isActingTeam = gameState.status === 'playing' && gameState.currentTeam === team;
    const showTimer = isActingTeam && !!gameState.phaseDeadline;
    // "Quem esta jogando" fica destacado: o time da vez inteiro ganha um
    // contorno, e dentro dele so a parte que realmente esta pra agir agora
    // (Mestre-Espiao na fase de pista, Agentes na fase de palpite).
    const agentsActing = isActingTeam && gameState.phase === 'guess';
    const spymasterActing = isActingTeam && gameState.phase === 'clue';
    return `
      <div class="game-team-panel game-team-panel-${team}${eliminated ? ' game-team-panel-eliminated' : ''}${isActingTeam ? ' game-team-panel-active' : ''}">
        ${gameRoleCardHtml('Agentes', t.agents, agentsActing)}
        <div class="game-remaining-row" title="Palavras que faltam">
          <span class="game-remaining-number">${eliminated ? '✕' : gameState.remaining[team]}</span>
          <div class="game-remaining-card">${CARD_WATERMARKS[team] || ''}</div>
        </div>
        ${gameRoleCardHtml('Mestre-Espião', t.spymaster ? [t.spymaster] : [], spymasterActing)}
        ${clueHistoryHtml(team)}
        ${showTimer ? `<div id="game-answer-timer" class="game-answer-timer"></div>` : ''}
      </div>
    `;
  };

  leftEl.innerHTML = teams.filter((_, i) => i % 2 === 0).map(panelHtml).join('');
  const rightTeamsHtml = teams.filter((_, i) => i % 2 === 1).map(panelHtml).join('');
  const logEl = document.getElementById('game-log');
  rightEl.innerHTML = rightTeamsHtml;
  rightEl.appendChild(logEl);
  rightEl.insertAdjacentHTML('beforeend', gameSpectatorsPanelHtml());
  refreshGameAvatarVideos();
}

// Quem esta assistindo, durante a partida. Quem nao esta num time ganha o
// botao de ver/esconder o mapa (vira espectador com/sem mapa na hora).
function gameSpectatorsPanelHtml() {
  const role = myGameRole();
  const spec = mySpectatorEntry();
  let toggle = '';
  if (!role && gameState.status === 'playing') {
    const turnOn = !(spec && spec.withMap);
    toggle = `<div class="game-spectate-actions"><button type="button" class="ghost game-spectate-toggle" data-with-map="${turnOn ? '1' : '0'}">${turnOn ? 'Mostrar mapa' : 'Esconder mapa'}</button>`
      + '<button type="button" class="ghost game-spectate-join" data-open-join>Entrar num time</button></div>';
  }
  if (!(gameState.spectators || []).length && !toggle) return '';
  return `<div class="game-spectators-panel"><div class="game-clue-history-title">Espectadores</div><ul class="game-spectators-list">${spectatorNamesHtml()}</ul>${toggle}</div>`;
}

// --- Camera no avatar do Codenames ---------------------------------------
// "Ligar câmera" dentro do Codenames e o mesmo compartilhamento de camera
// de sempre (startCameraShare) - so que aqui a camera de cada jogador
// aparece DENTRO do circulo do avatar dele na coluna da equipe. Os <video>
// ficam guardados por pessoa e sao so reencaixados a cada render (os
// paineis sao refeitos via innerHTML) - reinserir no mesmo tick nao pausa o
// video, entao nao pisca.
const gameAvatarVideos = new Map();

function cameraStreamFor(peerId) {
  if (peerId === selfId) return shareMode === 'camera' ? localStream : null;
  if (peerShareModes.get(peerId) !== 'camera') return null;
  const tileVideo = document.querySelector(`#tile-${CSS.escape(peerId)} video`);
  return tileVideo ? tileVideo.srcObject : null;
}

function refreshGameAvatarVideos() {
  const usedIds = new Set();
  document.querySelectorAll('#codenames-view [data-avatar-peer]').forEach((slot) => {
    const peerId = slot.dataset.avatarPeer;
    const stream = cameraStreamFor(peerId);
    slot.classList.toggle('game-role-avatar-has-video', !!stream);
    if (!stream) return;
    usedIds.add(peerId);
    let video = gameAvatarVideos.get(peerId);
    if (!video) {
      video = document.createElement('video');
      video.className = 'game-role-avatar-video mirrored-video';
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // o audio (se tiver) ja toca pela tile normal
      gameAvatarVideos.set(peerId, video);
    }
    if (video.srcObject !== stream) video.srcObject = stream;
    if (video.parentElement !== slot) slot.appendChild(video);
    if (video.paused) video.play().catch(() => {});
  });
  for (const [peerId, video] of gameAvatarVideos) {
    if (usedIds.has(peerId)) continue;
    video.srcObject = null;
    video.remove();
    gameAvatarVideos.delete(peerId);
  }
  updateGameCameraButton();
}

function updateGameCameraButton() {
  const btn = document.getElementById('btn-game-camera');
  if (!btn) return;
  const cameraOn = shareMode === 'camera';
  const sharingOther = !!localStream && !cameraOn;
  btn.textContent = cameraOn ? 'Desligar câmera' : 'Ligar câmera';
  btn.classList.toggle('active-camera', cameraOn);
  btn.disabled = sharingOther;
  btn.title = sharingOther ? 'Pare de compartilhar a tela pra ligar a câmera' : '';
}

function renderGameBoard() {
  const role = myGameRole();
  const boardEl = document.getElementById('game-board');
  // 2x2x2 tem 37 cartas: tabuleiro largo, 8 por linha (ultima linha centralizada).
  const wideBoard = gameState.board.length > 25;
  boardEl.classList.toggle('game-board-wide', wideBoard);
  document.querySelector('#codenames-view .game-table')?.classList.toggle('game-table-wide', wideBoard);

  if (currentBoardKey() !== boardCellRound || boardCellEls.length !== gameState.board.length) {
    buildBoardCells(boardEl);
    boardCellRound = currentBoardKey();
    selectedGuessCellIndex = null;
  }

  const mySpymasterClueTurn = gameState.status === 'playing' && gameState.phase === 'clue'
    && role && role.role === 'spymaster' && role.team === gameState.currentTeam;
  if (!mySpymasterClueTurn && clueTargets.size) clueTargets.clear();
  const seesMap = canSeeSecretMap();

  gameState.board.forEach((cell, i) => {
    const { root, inner, front, back, photo } = boardCellEls[i];

    // No fim da partida o servidor manda a cor de todas - vira todas, e as que
    // ninguem tinha revelado ficam um pouco apagadas pra dar pra diferenciar.
    const showBack = cell.revealed || (gameState.status === 'over' && !!cell.team);
    inner.classList.toggle('flipped', showBack);
    root.classList.toggle('game-cell-unrevealed-end', showBack && !cell.revealed);

    front.className = 'game-cell-face game-cell-front';
    if (!cell.revealed && seesMap && secretMapIsCurrent()) {
      front.classList.add(`game-cell-spy-${mySecretMap[i]}`);
    }

    if (showBack) {
      back.className = `game-cell-face game-cell-back game-cell-back-${cell.team}`;
      if (cell.photo != null) {
        const file = AVATAR_FILES[cell.photo % AVATAR_FILES.length];
        if (photo.dataset.file !== file) { photo.src = `assets/avatars/${file}`; photo.dataset.file = file; }
      }
    }
    root.classList.toggle('game-cell-revealed-photo', showBack);
    root.classList.toggle('game-cell-show-word', showBack && shownWordCells.has(i));

    const clickable = gameState.status === 'playing' && gameState.phase === 'guess'
      && role && role.role === 'agent' && role.team === gameState.currentTeam && !cell.revealed;
    root.classList.toggle('game-cell-clickable', !!clickable);

    const targetable = mySpymasterClueTurn && !cell.revealed;
    root.classList.toggle('game-cell-targetable', targetable);
    root.classList.toggle('game-cell-target', targetable && clueTargets.has(i));

    const cellMarks = (!cell.revealed && gameState.status === 'playing' && gameState.marks && gameState.marks[i]) || [];
    const marksKey = cellMarks.map((m) => m.id).join(',');
    if (boardCellEls[i].marks.dataset.key !== marksKey) {
      boardCellEls[i].marks.dataset.key = marksKey;
      boardCellEls[i].marks.innerHTML = cellMarks
        .map((m) => `<span class="game-cell-mark" title="${escapeHtml(m.name)}">${escapeHtml(avatarInitials(m.name))}</span>`).join('');
    }
  });

  updateGuessConfirmUi();

  renderGameTurnBanner();
  renderGameSidePanels();

  if (gameState.status === 'playing' && gameState.phaseDeadline) {
    startGameTimerInterval();
  } else {
    clearGameTimerInterval();
    updateGameAnswerTimerDisplay();
  }

  const clueActiveEl = document.getElementById('game-clue-active');
  if (gameState.clue && gameState.status === 'playing') {
    const allowedText = gameState.clue.guessesAllowed === null ? 'sem limite' : `${gameState.clue.guessesMade}/${gameState.clue.guessesAllowed}`;
    clueActiveEl.textContent = `Pista: "${gameState.clue.word.toUpperCase()}" ${gameState.clue.number} (palpites: ${allowedText})`;
    clueActiveEl.classList.remove('hidden');
  } else {
    clueActiveEl.classList.add('hidden');
  }

  const showClueForm = gameState.status === 'playing' && gameState.phase === 'clue'
    && role && role.role === 'spymaster' && role.team === gameState.currentTeam;
  document.getElementById('game-clue-form').classList.toggle('hidden', !showClueForm);
  document.getElementById('game-clue-target-hint').classList.toggle('hidden', !showClueForm);
  if (showClueForm) updateClueTargetHint();

  const showEndTurn = gameState.status === 'playing' && gameState.phase === 'guess'
    && role && role.role === 'agent' && role.team === gameState.currentTeam;
  document.getElementById('btn-game-end-turn').classList.toggle('hidden', !showEndTurn);

  // So quem abriu o lobby pode encerrar a partida pra todo mundo (mesma
  // regra de "so o anfitriao inicia" - ver isGameHost no servidor).
  const amIHostForAbort = !gameState.hostId || gameState.hostId === selfId;
  document.getElementById('btn-game-abort').classList.toggle('hidden', !amIHostForAbort);

  const logEl = document.getElementById('game-log');
  logEl.innerHTML = '';
  gameState.log.slice().reverse().forEach((entry) => {
    const p = document.createElement('div');
    p.className = 'game-log-entry';
    p.textContent = entry;
    logEl.appendChild(p);
  });

  const overBanner = document.getElementById('game-over-banner');
  if (gameState.status === 'over') {
    const winLabel = GAME_TEAM_LABEL[gameState.winner] || '';
    let reasonText = 'encontrou todas as suas palavras';
    if (gameState.winReason === 'assassin') reasonText = 'a outra equipe revelou o assassino';
    else if (gameState.winReason === 'last-standing') reasonText = 'foi a última equipe que sobrou depois dos assassinos';
    document.getElementById('game-over-text').textContent = `Equipe ${winLabel} venceu! (${reasonText})`;

    // Resumo da partida, na ordem em que aconteceu (do inicio pro fim, ao
    // contrario do #game-log acima que mostra o mais recente primeiro) -
    // reaproveita o mesmo historico que o servidor ja manda pra sala
    // inteira, so muda a ordem/apresentacao. O ultimo passo (o lance que
    // decidiu o jogo) fica em destaque.
    const recapEl = document.getElementById('game-over-recap');
    recapEl.innerHTML = '';
    gameState.log.forEach((entry, i) => {
      const li = document.createElement('li');
      li.textContent = entry;
      if (i === gameState.log.length - 1) li.classList.add('game-over-recap-fatal');
      recapEl.appendChild(li);
    });

    const intentsEl = document.getElementById('game-over-intents');
    const withTargets = (gameState.clueHistory || []).filter((c) => c.targets && c.targets.length);
    document.getElementById('game-over-intents-wrap').classList.toggle('hidden', withTargets.length === 0);
    intentsEl.innerHTML = withTargets.map((c) => {
      const words = c.targets.map((idx) => {
        const card = gameState.board[idx];
        if (!card) return '';
        const ok = card.revealed && card.team === c.team;
        return `<span class="game-intent-word ${ok ? 'game-intent-ok' : 'game-intent-miss'}">${escapeHtml(card.word)} ${ok ? '✓' : '✗'}</span>`;
      }).join('');
      return `<li><span class="game-intent-clue game-intent-${c.team}">${escapeHtml(c.word.toUpperCase())} ${c.number === 0 ? '∞' : c.number}</span>${words}</li>`;
    }).join('');

    const amIHost = !gameState.hostId || gameState.hostId === selfId;
    const playAgainBtn = document.getElementById('btn-game-play-again');
    playAgainBtn.disabled = !amIHost;
    playAgainBtn.title = amIHost ? '' : 'Só quem abriu o lobby pode iniciar a partida';

    overBanner.classList.remove('hidden');
  } else {
    overBanner.classList.add('hidden');
  }
}

// --- Convite de minijogo ----------------------------------------------------
// Quando alguem da sala abre o lobby / comeca um minijogo, o servidor manda
// 'minigame-invite' pra todo mundo (menos quem iniciou) e aparece o pop-up
// com "Entrar" (abre direto o jogo) ou "Agora não" (so fecha).
const MINIGAME_INVITE_TIMEOUT_MS = 30000;
let minigameInviteGameId = null;
let minigameInviteTimer = null;

function showMinigameInvite({ gameId, gameName, byName }) {
  if (!GAME_TITLES[gameId]) return;
  // Ja ta com esse jogo aberto - nao precisa convidar.
  if (gameOverlayOpen && currentGameView === gameId) return;
  minigameInviteGameId = gameId;
  const textEl = document.getElementById('minigame-invite-text');
  textEl.textContent = '';
  const who = document.createElement('strong');
  who.textContent = byName || 'Alguém';
  const game = document.createElement('strong');
  game.textContent = gameName || GAME_TITLES[gameId];
  textEl.append(who, ' iniciou um jogo de ', game);
  document.getElementById('minigame-invite').classList.remove('hidden');
  clearTimeout(minigameInviteTimer);
  minigameInviteTimer = setTimeout(hideMinigameInvite, MINIGAME_INVITE_TIMEOUT_MS);
}

function hideMinigameInvite() {
  clearTimeout(minigameInviteTimer);
  minigameInviteTimer = null;
  minigameInviteGameId = null;
  document.getElementById('minigame-invite').classList.add('hidden');
}

document.getElementById('btn-minigame-invite-join').addEventListener('click', () => {
  const gameId = minigameInviteGameId;
  hideMinigameInvite();
  if (gameId) jumpToGame(gameId);
});
document.getElementById('btn-minigame-invite-dismiss').addEventListener('click', hideMinigameInvite);

function resetGameUiState() {
  gameState = null;
  mySecretMap = null;
  mySecretMapRound = -1;
  mySecretMapBoardId = null;
  boardCellEls = [];
  boardCellRound = -1;
  selectedGuessCellIndex = null;
  lastSeenTimeoutSeq = null;
  shownWordCells.clear();
  stopState = null;
  stopFieldsBuilt = -1;
  clearTimeout(stopSyncDebounce);
  editableStopCategories = [];
  stopEditorSeededRound = -1;
  stopShowingEditor = false;
  sketchState = null;
  mySketchVote = null;
  mySketchRound = -1;
  closeGameOverlay();
  hideMinigameInvite();
  renderGameActivityBadge();
}

// --- Minijogo "Stop / Adedonha" -------------------------------------------
// Mesmo padrao do Codigo Secreto: estado de verdade no servidor, por sala.
// Sem equipes/papeis - todo mundo que estiver na sala quando a rodada
// comecar vira jogador. Os campos de texto sao sincronizados aos poucos
// (debounce) enquanto a pessoa digita, pra o servidor sempre ter uma copia
// atualizada na hora que alguem apertar "PARAR".

let stopState = null;
// round pra que os <input> em #stop-fields foram construidos da ultima vez -
// evita recriar os campos (e perder o foco/cursor de quem ta digitando) a
// cada atualizacao de estado recebida durante a mesma rodada.
let stopFieldsBuilt = -1;
let stopSyncDebounce = null;
let stopTickInterval = null;

// Lista padrao espelhando STOP_DEFAULT_CATEGORIES do servidor - so usada
// como ponto de partida do editor local antes do servidor confirmar algo
// (o servidor sempre revalida tudo de qualquer forma).
const STOP_DEFAULT_CATEGORIES_CLIENT = ['Nome', 'Animal', 'Fruta', 'Cor', 'País', 'Objeto'];
const STOP_MIN_CATEGORIES_CLIENT = 2;
const STOP_MAX_CATEGORIES_CLIENT = 10;
// Rascunho local das categorias sendo editadas (quem vai apertar "comecar"
// decide, por isso isso vive so no client ate o momento de iniciar - ver
// stop-start-round). "Jogar de novo" tambem passa por aqui, pra poder
// trocar as categorias entre rodadas, nao so na primeira vez.
let editableStopCategories = [];
let stopEditorSeededRound = -1;
let stopShowingEditor = false;

async function refreshStopState() {
  try {
    stopState = await window.stopGame.getState();
    renderStop();
  } catch (err) {
    console.error('Falha ao buscar estado do Stop:', err);
  }
}

function collectStopFieldValues() {
  const values = {};
  document.querySelectorAll('#stop-fields input').forEach((input) => {
    values[input.dataset.category] = input.value;
  });
  return values;
}

function buildStopFields() {
  const container = document.getElementById('stop-fields');
  container.innerHTML = '';
  stopState.categories.forEach((cat) => {
    const wrap = document.createElement('div');
    wrap.className = 'stop-field';
    const label = document.createElement('label');
    label.textContent = cat;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.dataset.category = cat;
    input.addEventListener('input', () => {
      clearTimeout(stopSyncDebounce);
      stopSyncDebounce = setTimeout(() => {
        window.stopGame.syncAnswers(collectStopFieldValues());
      }, 300);
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
  stopFieldsBuilt = stopState.round;
  container.querySelector('input')?.focus();
}

function updateStopTimerDisplay() {
  const el = document.getElementById('stop-timer');
  if (!el || !stopState || stopState.status !== 'playing' || !stopState.startedAt) return;
  const remainingMs = Math.max(0, stopState.durationMs - (Date.now() - stopState.startedAt));
  const seconds = Math.ceil(remainingMs / 1000);
  el.textContent = `${seconds}s`;
  el.classList.toggle('stop-timer-urgent', seconds <= 10);
  updateStopCallLockDisplay();
}

// "PARAR!" fica travado por um tempo minimo no comeco da rodada (mais
// categorias = mais tempo - ver computeStopMinStopMs no servidor), pra
// ninguem conseguir fechar a rodada injustamente cedo antes de todo mundo
// sequer ter lido as categorias. O servidor ja recusa a chamada de qualquer
// forma (defesa de verdade) - isso aqui e so a UI refletindo o mesmo prazo.
function updateStopCallLockDisplay() {
  const btn = document.getElementById('btn-stop-call');
  const lockEl = document.getElementById('stop-call-lock');
  if (!btn || !lockEl || !stopState || stopState.status !== 'playing' || !stopState.startedAt) return;
  const elapsed = Date.now() - stopState.startedAt;
  const minMs = stopState.minStopMs || 0;
  const locked = elapsed < minMs;
  btn.disabled = locked;
  lockEl.textContent = locked
    ? `Disponível em ${Math.ceil((minMs - elapsed) / 1000)}s (${stopState.categories.length} categorias)`
    : '';
}

function startStopTimerInterval() {
  if (stopTickInterval) return;
  updateStopTimerDisplay();
  stopTickInterval = setInterval(updateStopTimerDisplay, 250);
}

function clearStopTimerInterval() {
  if (stopTickInterval) { clearInterval(stopTickInterval); stopTickInterval = null; }
}

function setStopCategoriesError(msg) {
  const el = document.getElementById('stop-categories-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function ensureStopEditorSeeded() {
  if (stopEditorSeededRound !== stopState.round) {
    editableStopCategories = [...(stopState.categories && stopState.categories.length ? stopState.categories : STOP_DEFAULT_CATEGORIES_CLIENT)];
    stopEditorSeededRound = stopState.round;
  }
}

// Mostra o editor de categorias - usado tanto na primeira vez (sala nova,
// status 'idle') quanto quando alguem clica "Jogar de novo"/"Mudar
// categorias" depois de uma rodada ja ter acontecido (status 'reveal').
function openStopEditor() {
  stopShowingEditor = true;
  setStopCategoriesError('');
  renderStop();
}

function renderStopCategoriesEditor() {
  const listEl = document.getElementById('stop-categories-list');
  listEl.innerHTML = '';
  editableStopCategories.forEach((cat, i) => {
    const row = document.createElement('div');
    row.className = 'stop-category-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'stop-category-input';
    input.maxLength = 24;
    input.value = cat;
    input.addEventListener('input', () => { editableStopCategories[i] = input.value; });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost stop-remove-category-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remover categoria');
    removeBtn.disabled = editableStopCategories.length <= STOP_MIN_CATEGORIES_CLIENT;
    removeBtn.addEventListener('click', () => {
      editableStopCategories.splice(i, 1);
      renderStopCategoriesEditor();
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    listEl.appendChild(row);
  });

  const addBtn = document.getElementById('btn-stop-add-category');
  addBtn.disabled = editableStopCategories.length >= STOP_MAX_CATEGORIES_CLIENT;
}

function addStopCategoryFromInput() {
  const input = document.getElementById('stop-new-category');
  const val = input.value.trim();
  if (!val || editableStopCategories.length >= STOP_MAX_CATEGORIES_CLIENT) return;
  editableStopCategories.push(val);
  input.value = '';
  renderStopCategoriesEditor();
}

function renderStopPlaying() {
  document.getElementById('stop-letter-badge').textContent = stopState.letter || '';
  if (stopFieldsBuilt !== stopState.round) buildStopFields();
  document.getElementById('stop-call-error').classList.add('hidden');
  startStopTimerInterval();
  updateStopCallLockDisplay();
}

function renderStopLobby() {
  const catsEl = document.getElementById('stop-lobby-categories');
  catsEl.innerHTML = '';
  (stopState.categories || []).forEach((cat) => {
    const chip = document.createElement('span');
    chip.className = 'stop-cat-chip';
    chip.textContent = cat;
    catsEl.appendChild(chip);
  });

  const players = stopState.lobbyPlayers || [];
  const playersEl = document.getElementById('stop-lobby-players');
  playersEl.innerHTML = '';
  players.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'stop-lobby-player' + (p.ready ? ' ready' : '');

    const name = document.createElement('span');
    name.textContent = p.name + (p.id === selfId ? ' (você)' : '');

    const status = document.createElement('span');
    status.className = 'stop-lobby-player-status';
    status.textContent = p.ready ? 'Pronto' : 'Aguardando';

    row.appendChild(name);
    row.appendChild(status);
    playersEl.appendChild(row);
  });

  const readyCount = players.filter((p) => p.ready).length;
  document.getElementById('stop-lobby-count').textContent = `${readyCount} de ${players.length} prontos`;

  const me = players.find((p) => p.id === selfId);
  const toggleBtn = document.getElementById('btn-stop-toggle-ready');
  const amReady = !!(me && me.ready);
  toggleBtn.textContent = amReady ? 'Cancelar' : 'Pronto!';
  toggleBtn.classList.toggle('ghost', amReady);
}

function renderStopReveal() {
  clearStopTimerInterval();
  const results = stopState.results;
  if (!results) return;

  const letterEl = document.getElementById('stop-reveal-letter');
  letterEl.textContent = '';
  letterEl.appendChild(document.createTextNode('Letra sorteada: '));
  const letterSpan = document.createElement('span');
  letterSpan.textContent = results.letter;
  letterEl.appendChild(letterSpan);

  const resultsEl = document.getElementById('stop-results');
  resultsEl.innerHTML = '';
  results.perPlayer.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'stop-result-card';

    const head = document.createElement('div');
    head.className = 'stop-result-head';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${i + 1}º ${p.name}${p.id === selfId ? ' (você)' : ''}`;
    const totalSpan = document.createElement('span');
    totalSpan.className = 'stop-result-total';
    totalSpan.textContent = `${p.total} pts`;
    head.appendChild(nameSpan);
    head.appendChild(totalSpan);

    const breakdown = document.createElement('div');
    breakdown.className = 'stop-result-breakdown';
    results.categories.forEach((cat) => {
      const info = p.categories[cat];
      const item = document.createElement('span');
      item.className = `stop-item-${info.status}`;
      item.textContent = `${cat}: ${info.value || '—'} (${info.points})`;
      breakdown.appendChild(item);
    });

    card.appendChild(head);
    card.appendChild(breakdown);
    resultsEl.appendChild(card);
  });
}

function renderStop() {
  if (!stopState || !gameOverlayOpen || currentGameView !== 'stop') return;
  const showEditor = stopState.status === 'idle' || stopShowingEditor;
  const showLobby = stopState.status === 'lobby' && !showEditor;
  const showPlaying = stopState.status === 'playing' && !showEditor;
  const showReveal = stopState.status === 'reveal' && !showEditor;

  document.getElementById('stop-idle-view').classList.toggle('hidden', !showEditor);
  document.getElementById('stop-lobby-view').classList.toggle('hidden', !showLobby);
  document.getElementById('stop-playing-view').classList.toggle('hidden', !showPlaying);
  document.getElementById('stop-reveal-view').classList.toggle('hidden', !showReveal);

  if (showEditor) {
    clearStopTimerInterval();
    ensureStopEditorSeeded();
    renderStopCategoriesEditor();
  } else if (showLobby) {
    clearStopTimerInterval();
    renderStopLobby();
  } else if (showPlaying) {
    renderStopPlaying();
  } else {
    renderStopReveal();
  }
}

// --- Minijogo "Sketch do PC" ("Você prefere A ou B?") ---------------------
// Diferente do Codigo Secreto/Stop, aqui nao tem nada escondido - a
// contagem de votos e sempre publica e atualiza ao vivo pra todo mundo a
// cada voto. O unico estado "privado" e qual das duas opcoes EU escolhi, e
// isso a gente so guarda localmente (o broadcast publico manda so a
// contagem agregada, nao quem votou em que).

let sketchState = null;
let mySketchVote = null; // 'a' | 'b' | null
let mySketchRound = -1;

async function refreshSketchState() {
  try {
    sketchState = await window.sketchGame.getState();
    if (mySketchRound !== sketchState.round) { mySketchVote = null; mySketchRound = sketchState.round; }
    renderSketch();
  } catch (err) {
    console.error('Falha ao buscar estado do Sketch do PC:', err);
  }
}

function setSketchCreateError(msg) {
  const el = document.getElementById('sketch-create-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function renderSketch() {
  if (!sketchState || !gameOverlayOpen || currentGameView !== 'sketch') return;
  const isIdle = sketchState.status === 'idle';
  document.getElementById('sketch-idle-view').classList.toggle('hidden', !isIdle);
  document.getElementById('sketch-result-view').classList.toggle('hidden', isIdle);
  if (isIdle) return;

  const authorEl = document.getElementById('sketch-author');
  authorEl.innerHTML = '';
  authorEl.appendChild(document.createTextNode('Pergunta de '));
  const strong = document.createElement('strong');
  strong.textContent = sketchState.authorName || 'alguém';
  authorEl.appendChild(strong);
  authorEl.appendChild(document.createTextNode(':'));

  const total = sketchState.total || 0;
  const pctA = total > 0 ? Math.round((sketchState.counts.a / total) * 100) : 0;
  const pctB = total > 0 ? Math.round((sketchState.counts.b / total) * 100) : 0;

  document.getElementById('sketch-text-a').textContent = sketchState.optionA;
  document.getElementById('sketch-text-b').textContent = sketchState.optionB;
  document.getElementById('sketch-bar-a').style.width = `${pctA}%`;
  document.getElementById('sketch-bar-b').style.width = `${pctB}%`;
  document.getElementById('sketch-stats-a').textContent = `${sketchState.counts.a} voto(s) · ${pctA}%`;
  document.getElementById('sketch-stats-b').textContent = `${sketchState.counts.b} voto(s) · ${pctB}%`;
  document.getElementById('sketch-total').textContent = `${total} voto(s) no total`;

  const locked = sketchState.status === 'ended';
  const btnA = document.getElementById('sketch-btn-a');
  const btnB = document.getElementById('sketch-btn-b');
  btnA.classList.toggle('sketch-option-locked', locked);
  btnB.classList.toggle('sketch-option-locked', locked);
  btnA.classList.toggle('sketch-option-mine', mySketchVote === 'a');
  btnB.classList.toggle('sketch-option-mine', mySketchVote === 'b');

  document.getElementById('btn-sketch-end').classList.toggle('hidden', locked);
  document.getElementById('btn-sketch-new').classList.toggle('hidden', !locked);
}

function castSketchVote(choice) {
  if (!sketchState || sketchState.status !== 'voting') return;
  window.sketchGame.vote(choice).then(() => {
    mySketchVote = choice;
    renderSketch();
  }).catch((err) => console.error('Falha ao votar no Sketch do PC:', err));
}

function createPeerConnection(peerId) {
  const polite = selfId < peerId; // regra combinada dos dois lados

  const pc = new RTCPeerConnection({ iceServers });
  const state = {
    pc, polite, makingOffer: false, ignoreOffer: false,
    reconnecting: false, reconnectInterval: null,
    chatChannel: null, connFailTimer: null,
  };
  peers.set(peerId, state);
  // Se em 20s nao ligar nunca, marca "sem conexao" na lista de participantes.
  watchConnFailure(peerId, state);

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
    if (spectatorPeerIds.has(peerId)) return;
    const name = peerNames.get(peerId) || 'Participante';
    const stream = event.streams[0];

    const video = getOrCreateVideoTile(peerId, name);
    video.srcObject = stream;
    updatePeerTileMirror(peerId);
    refreshGameAvatarVideos();
    // So conecta ao Web Audio quando a track de AUDIO especificamente
    // chega - assim garante que o stream ja tem audio de verdade no
    // momento da conexao (ver comentario em wireRemoteAudioGain).
    if (event.track.kind === 'audio') {
      wireRemoteAudioGain(peerId, video, event.track);
    }
    event.track.onended = () => {};
  };

  pc.onconnectionstatechange = () => {
    const cs = pc.connectionState;

    if (cs === 'connected') {
      clearReconnectTimers(state);
      setTileReconnecting(peerId, false);
      if (state.connFailTimer) { clearTimeout(state.connFailTimer); state.connFailTimer = null; }
      detectConnRoute(peerId, pc);
      return;
    }

    if (cs === 'closed') {
      if (state.connFailTimer) { clearTimeout(state.connFailTimer); state.connFailTimer = null; }
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
      watchConnFailure(peerId, state);
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
    // Espelha a bolinha da camera (igual toda transmissao de camera - ver
    // .mirrored-video no CSS) - reflete em torno do proprio centro (cx) pra
    // nao mudar a posicao da bolinha na tela, so o conteudo dentro dela.
    compositeCtx.translate(cx, 0);
    compositeCtx.scale(-1, 1);
    compositeCtx.translate(-cx, 0);
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

// Atalho de "compartilhar com preset rapido": monitor principal, qualidade
// 1080p60 e audio do sistema todo exceto Discord - sem abrir o seletor.
// Avisa o processo principal (requestQuickShare) que o PROXIMO
// getDisplayMedia deve pular o seletor e usar esse preset direto, e so
// entao chama o startShare() normal - reaproveita toda a logica de
// qualidade/audio/finishStartingShare que ja existe, sem duplicar nada.
async function startQuickShare() {
  if (!selfId || localStream) return; // precisa estar numa sala e nao ja compartilhando algo
  await window.screenPicker.requestQuickShare();
  await startShare();
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
    bounds: { left: monitor.left, top: monitor.top, width: monitor.width, height: monitor.height },
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

// Forcar width E height exatos do preset escolhido (que supoe 16:9) deixava
// a imagem achatada/esticada errado sempre que a fonte capturada NAO e
// 16:9 de verdade - monitor ultrawide, ou resolucao "esticada" (comum em
// CS2/competitivo, tipo 4:3 renderizado e esticado pro monitor) cuja
// saida final nao bate com a proporcao do preset. Em vez de travar os
// dois lados no valor do preset, limita pelo lado que o preset realmente
// restringe (o mais apertado dos dois) e calcula o outro lado
// proporcionalmente, preservando a proporcao de verdade da tela
// capturada - so limita o tamanho, nunca distorce.
function computeAspectPreservingTarget(sourceWidth, sourceHeight, presetWidth, presetHeight) {
  if (!sourceWidth || !sourceHeight) return { width: presetWidth, height: presetHeight };
  const sourceAspect = sourceWidth / sourceHeight;
  const presetAspect = presetWidth / presetHeight;
  if (Math.abs(sourceAspect - presetAspect) < 0.01) return { width: presetWidth, height: presetHeight };
  if (sourceAspect > presetAspect) {
    // fonte mais larga que o preset (ex: ultrawide) - a largura e quem limita
    return { width: presetWidth, height: Math.round(presetWidth / sourceAspect) };
  }
  // fonte mais "quadrada"/estreita que o preset - a altura e quem limita
  return { width: Math.round(presetHeight * sourceAspect), height: presetHeight };
}

async function finishStartingShare(selfLabel) {
  const videoTrack = localVideoStream.getVideoTracks()[0];
  if (currentQuality && videoTrack && shareMode === 'screen') {
    try {
      const sourceSettings = videoTrack.getSettings();
      const target = computeAspectPreservingTarget(
        sourceSettings.width,
        sourceSettings.height,
        currentQuality.width,
        currentQuality.height
      );
      await videoTrack.applyConstraints({
        width: { ideal: target.width, max: target.width },
        height: { ideal: target.height, max: target.height },
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
  startCpuLimitWatch();
  // Suprime o audio dos outros participantes enquanto voce compartilha -
  // senao o que toca nas suas caixas de som entraria na sua propria
  // captura de sistema e viraria eco pra quem esta assistindo.
  refreshAllGainsForSharingState();

  selfTileLabel = selfLabel;
  const video = getOrCreateVideoTile(selfId, selfLabel, true);
  video.srcObject = localStream;
  video.classList.toggle('mirrored-video', shareMode === 'camera');
  window.rtc.setShareMode(shareMode);
  updateSelfAudienceLabel();

  btnShare.classList.add('hidden');
  btnShareNative.classList.add('hidden');
  btnShareCamera.classList.add('hidden');
  btnStopShare.classList.remove('hidden');

  localVideoStream.getVideoTracks()[0].addEventListener('ended', stopShare);
  refreshGameAvatarVideos();
}

// Aviso "PC no limite": o proprio WebRTC conta quando esta segurando a
// qualidade porque o processador nao da conta (qualityLimitationReason
// 'cpu'). Se isso durar ~15s seguidos numa transmissao, avisa quem esta
// transmitindo (uma vez por transmissao) pra baixar a qualidade.
const CPU_LIMIT_CHECK_MS = 5000;
const CPU_LIMIT_STRIKES = 3;
let cpuLimitTimer = null;
let cpuLimitStrikes = 0;
let cpuLimitWarned = false;

async function checkCpuLimitation() {
  if (!localStream || cpuLimitWarned) return;
  let limited = false;
  for (const [, state] of peers) {
    for (const sender of state.pc.getSenders()) {
      if (!sender.track || sender.track.kind !== 'video') continue;
      try {
        (await sender.getStats()).forEach((s) => {
          if (s.type === 'outbound-rtp' && s.qualityLimitationReason === 'cpu') limited = true;
        });
      } catch {}
    }
  }
  cpuLimitStrikes = limited ? cpuLimitStrikes + 1 : 0;
  if (cpuLimitStrikes >= CPU_LIMIT_STRIKES && localStream) {
    cpuLimitWarned = true;
    document.getElementById('cpu-limit-banner').classList.remove('hidden');
  }
}

function startCpuLimitWatch() {
  stopCpuLimitWatch();
  cpuLimitStrikes = 0;
  cpuLimitWarned = false;
  cpuLimitTimer = setInterval(checkCpuLimitation, CPU_LIMIT_CHECK_MS);
}

function stopCpuLimitWatch() {
  clearInterval(cpuLimitTimer);
  cpuLimitTimer = null;
  document.getElementById('cpu-limit-banner').classList.add('hidden');
}

document.getElementById('btn-cpu-limit-close').addEventListener('click', () => {
  document.getElementById('cpu-limit-banner').classList.add('hidden');
});

async function stopShare() {
  if (!localStream) return;
  window.pingOverlay.clear();
  stopCpuLimitWatch();

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
  window.rtc.setShareMode(null);
  refreshAllGainsForSharingState();

  teardownCapturedAudioTrack();

  removeVideoTile(selfId);

  btnShare.classList.remove('hidden');
  btnShareNative.classList.remove('hidden');
  btnShareCamera.classList.remove('hidden');
  btnToggleCamera.classList.add('hidden');
  btnStopShare.classList.add('hidden');
  refreshGameAvatarVideos();
}

// --- Status no Discord ------------------------------------------------------
// O card no perfil do Discord (ver discord-presence.js no main) mostra o que
// a pessoa esta fazendo: na tela inicial, em call, transmitindo, jogando.
// O nome da sala so aparece se a pessoa deixar (Configuracoes > Transmissao)
// - quem ve o perfil consegue entrar com ele.
// Recalcula a cada 5s e quando a opcao muda; o main so manda pro Discord o
// que mudou, respeitando o limite de atualizacoes dele.
let roomJoinedAt = null;
const DISCORD_GAME_NAMES = { codenames: 'Codenames', stop: 'Stop', sketch: '"A ou B"' };

let lastDiscordPresence = null; // o ultimo status mandado (pros testes conferirem)
function sendDiscordPresence(payload) {
  lastDiscordPresence = payload;
  window.appLinks.discordPresence(payload);
}
// Linha de cima (o que a pessoa esta fazendo), por prioridade: jogando >
// transmitindo > assistindo > em call. Linha de baixo: a sala (se a pessoa
// deixar) e quantas pessoas (se deixar). O tempo do card conta desde que o
// app conectou no Discord (ver discord-presence.js).
const DISCORD_TEAM_LABELS = { red: 'Vermelha', blue: 'Azul', green: 'Verde' };
function discordCodenamesScore() {
  const rem = (gameState && gameState.remaining) || {};
  const teams = ['red', 'blue', 'green'].filter((t) => typeof rem[t] === 'number' && gameState.teams && gameState.teams[t]);
  if (teams.length < 2) return '';
  if (teams.length === 2) return `${DISCORD_TEAM_LABELS[teams[0]]} ${rem[teams[0]]} x ${rem[teams[1]]} ${DISCORD_TEAM_LABELS[teams[1]]}`;
  return teams.map((t) => `${DISCORD_TEAM_LABELS[t]} ${rem[t]}`).join(' x ');
}
function discordActivityLine() {
  // partida de Codenames rolando e eu dentro (num time ou assistindo)
  const inMatch = gameState && gameState.status === 'playing' && (myGameRole() || mySpectatorEntry());
  if (inMatch) {
    const score = discordCodenamesScore();
    return score ? `Jogando Codenames · ${score}` : 'Jogando Codenames';
  }
  if (gameOverlayOpen && DISCORD_GAME_NAMES[currentGameView]) return `Jogando ${DISCORD_GAME_NAMES[currentGameView]}`;
  if (localStream) return shareMode === 'camera' ? 'Transmitindo Câmera' : 'Transmitindo Tela';
  if ([...peerShareModes.values()].some(Boolean)) return 'Assistindo Tela';
  return 'Em call';
}
function updateDiscordPresence() {
  if (currentTheme.discordStatus === 'desligado') {
    sendDiscordPresence({ enabled: false });
    return;
  }
  if (!currentRoomId || !roomJoinedAt) {
    sendDiscordPresence({ enabled: true, details: 'Na tela inicial' });
    return;
  }
  const people = peerNames.size + 1;
  let state = 'Sala Privada';
  if (currentTheme.discordRoom !== 'desligado') {
    state = currentRoomId;
    if (currentTheme.discordPeople !== 'desligado') state += ` · ${people} ${people === 1 ? 'pessoa' : 'pessoas'}`;
  }
  sendDiscordPresence({ enabled: true, details: discordActivityLine(), state });
}
setInterval(updateDiscordPresence, 5000);
setTimeout(updateDiscordPresence, 1500);

// --- Apontar na tela -------------------------------------------------------
// Alt + clique na transmissao de TELA de alguem: uma seta grande com o seu
// nome aparece naquele ponto pra todo mundo da sala e, pra quem transmite,
// por cima do monitor de verdade (ver showPingOverlay no main.js). Quem
// transmite pode desligar em Configuracoes > Transmissao.
const peerPingAllowed = new Map(); // peerId -> bool
const PING_SHOW_MS = 3600;
// 1 ping por minuto no total (em qualquer tela). O servidor tambem barra
// (vale pra quem esta em versao antiga); aqui so evita a ida e volta e
// mostra quanto falta.
const PING_COOLDOWN_MS = 60 * 1000;
let lastPingSentAt = 0;

function pingsAllowedByMe() {
  return currentTheme.allowPings !== 'desligado';
}
function pingColorFor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 80%, 55%)`;
}
// Parte do <video> onde a imagem esta de fato (object-fit: contain deixa
// faixas pretas em cima/embaixo ou dos lados).
function videoContentRect(video) {
  const box = video.getBoundingClientRect();
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const scale = Math.min(box.width / vw, box.height / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
}

async function handleTilePing(peerId, tile, video, e) {
  const name = peerNames.get(peerId) || 'Essa pessoa';
  const mode = peerShareModes.get(peerId);
  if (mode !== 'screen' && mode !== 'screen-native') { showRoomLockToast('Só dá pra apontar em transmissão de tela'); return; }
  if (peerPingAllowed.get(peerId) === false) { showRoomLockToast(`${name} não deixa apontar na tela`); return; }
  const r = videoContentRect(video);
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return; // clicou na faixa preta
  window.pingOverlay.altClick();
  const waitMs = PING_COOLDOWN_MS - (Date.now() - lastPingSentAt);
  if (waitMs > 0) { showRoomLockToast(`Você pode apontar de novo em ${Math.ceil(waitMs / 1000)}s`); return; }
  try {
    await window.rtc.screenPing(peerId, x, y);
    lastPingSentAt = Date.now();
  } catch (err) {
    if (err && err.message && err.message !== 'Calma') showRoomLockToast(err.message);
  }
}

function showTilePing(targetId, ping) {
  const tile = document.getElementById(`tile-${targetId}`);
  const video = tile && tile.querySelector('video');
  if (!tile || !video) return;
  const t = tile.getBoundingClientRect();
  const r = videoContentRect(video);
  const el = document.createElement('div');
  el.className = 'tile-ping';
  el.style.left = `${r.left - t.left + ping.x * r.width}px`;
  el.style.top = `${r.top - t.top + ping.y * r.height}px`;
  const color = pingColorFor(ping.name);
  const label = document.createElement('div');
  label.className = 'tile-ping-name';
  label.textContent = ping.name;
  label.style.background = color;
  el.appendChild(label);
  el.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 54 64" aria-hidden="true"><path d="M17 0h20v34h17L27 64 0 34h17Z" fill="${color}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>`);
  tile.appendChild(el);
  setTimeout(() => el.remove(), PING_SHOW_MS);
}

function onScreenPing(ping) {
  if (!ping || typeof ping.x !== 'number' || typeof ping.y !== 'number') return;
  showTilePing(ping.target, ping);
  // apontaram na MINHA tela: seta por cima do monitor que eu transmito
  if (ping.target === selfId && localStream && (shareMode === 'screen' || shareMode === 'screen-native')) {
    window.pingOverlay.show({ x: ping.x, y: ping.y, name: ping.name, color: pingColorFor(ping.name) });
  }
}

// Segurando Alt: cursor de mira nas transmissoes de tela que aceitam
function markPingableTiles(on) {
  document.querySelectorAll('.video-tile').forEach((tile) => {
    const peerId = tile.id.replace(/^tile-/, '');
    const mode = peerShareModes.get(peerId);
    tile.classList.toggle('ping-ready', on && peerId !== selfId && (mode === 'screen' || mode === 'screen-native') && peerPingAllowed.get(peerId) !== false);
  });
}
window.addEventListener('keydown', (e) => { if (e.key === 'Alt') markPingableTiles(true); });
window.addEventListener('keyup', (e) => { if (e.key === 'Alt') markPingableTiles(false); });
window.addEventListener('blur', () => markPingableTiles(false));

// --- Senha da sala ---------------------------------------------------------
// Cadeado do lado do "Convidar": o dono (1a pessoa da sala; se sair, passa
// pra proxima) poe, troca ou tira a senha; os outros so veem se esta
// trancada. A senha fica no servidor so como hash - o app do dono guarda a
// que ele digitou (myRoomPassword) pra mostrar de novo e pra reenviar se o
// servidor reiniciar. Ver roomLocks no server/index.js.
const LOCK_ICON_CLOSED = `<svg ${ICON_SVG_ATTRS}><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`;
const LOCK_ICON_OPEN = `<svg ${ICON_SVG_ATTRS}><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 7.5-2"></path></svg>`;
const EYE_ICON = `<svg ${ICON_SVG_ATTRS}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
let roomLock = null; // { locked, ownerId, ownerName }
let myRoomPassword = null; // a senha que EU pus (so o dono tem)
let currentRoomPassword = null; // a senha que eu digitei pra entrar

function applyRoomLockState(state) {
  roomLock = state || null;
  const btn = document.getElementById('btn-room-lock');
  if (!btn) return;
  const locked = !!(roomLock && roomLock.locked);
  const mine = !!(roomLock && roomLock.ownerId && roomLock.ownerId === selfId);
  if (!locked) myRoomPassword = mine ? myRoomPassword : null;
  btn.innerHTML = locked ? LOCK_ICON_CLOSED : LOCK_ICON_OPEN;
  btn.classList.toggle('locked', locked);
  btn.setAttribute('aria-label', locked ? 'Sala trancada com senha' : 'Sala aberta (sem senha)');
  btn.title = mine
    ? (locked ? 'Sala trancada com senha - clique pra trocar ou tirar' : 'Sala aberta - clique pra pôr uma senha')
    : `${locked ? 'Sala trancada com senha' : 'Sala aberta (sem senha)'}. Só ${roomLock && roomLock.ownerName ? roomLock.ownerName : 'o dono da sala'} pode mudar a senha.`;
}

function showRoomLockToast(text) {
  const toast = document.getElementById('snapshot-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove('error');
  toast.classList.remove('hidden');
  clearTimeout(snapshotToastTimer);
  snapshotToastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

(() => {
  const overlay = document.getElementById('room-lock-overlay');
  const input = document.getElementById('room-lock-input');
  const status = document.getElementById('room-lock-status');
  const removeBtn = document.getElementById('btn-room-lock-remove');
  const saveBtn = document.getElementById('btn-room-lock-save');
  const eye = document.getElementById('btn-room-lock-show');
  eye.innerHTML = EYE_ICON;
  const setStatus = (text, isError) => { status.textContent = text || ''; status.classList.toggle('suggestion-error', !!isError); };
  const close = () => overlay.classList.add('hidden');

  document.getElementById('btn-room-lock').addEventListener('click', () => {
    if (!roomLock || roomLock.ownerId !== selfId) {
      showRoomLockToast(`Só ${roomLock && roomLock.ownerName ? roomLock.ownerName : 'o dono da sala'} pode mudar a senha da sala`);
      return;
    }
    const locked = !!roomLock.locked;
    input.value = myRoomPassword || '';
    input.type = 'password';
    input.placeholder = locked && !myRoomPassword ? 'Digite uma senha nova' : 'De 3 a 32 caracteres';
    removeBtn.classList.toggle('hidden', !locked);
    saveBtn.textContent = locked ? 'Trocar senha' : 'Trancar sala';
    setStatus(locked ? 'A sala está trancada.' : '');
    overlay.classList.remove('hidden');
    input.focus();
  });
  eye.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; });
  document.getElementById('btn-room-lock-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('room-lock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = input.value;
    if (pw.length < 3) { setStatus('A senha precisa ter pelo menos 3 caracteres', true); return; }
    saveBtn.disabled = true;
    try {
      const r = await window.rtc.setRoomLock(pw);
      myRoomPassword = pw;
      applyRoomLockState(r.lock);
      close();
      showRoomLockToast('Sala trancada - quem entrar vai precisar da senha');
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  });
  removeBtn.addEventListener('click', async () => {
    try {
      const r = await window.rtc.clearRoomLock();
      myRoomPassword = null;
      applyRoomLockState(r.lock);
      close();
      showRoomLockToast('Senha tirada - a sala está aberta');
    } catch (err) {
      setStatus(err.message, true);
    }
  });
})();

// Pergunta a senha de uma sala trancada ao entrar. Resolve com a senha ou
// null se a pessoa desistir.
function askRoomPassword(roomId, errorText) {
  const overlay = document.getElementById('room-password-overlay');
  const input = document.getElementById('room-password-input');
  const form = document.getElementById('room-password-form');
  const cancel = document.getElementById('btn-room-password-cancel');
  document.getElementById('room-password-hint').textContent = `A sala "${roomId}" está trancada. Peça a senha pra quem está nela.`;
  document.getElementById('room-password-status').textContent = errorText || '';
  input.value = '';
  overlay.classList.remove('hidden');
  input.focus();
  return new Promise((resolve) => {
    const done = (value) => {
      overlay.classList.add('hidden');
      form.removeEventListener('submit', onSubmit);
      cancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onSubmit = (e) => { e.preventDefault(); if (input.value) done(input.value); };
    const onCancel = () => done(null);
    const onBackdrop = (e) => { if (e.target === overlay) done(null); };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    form.addEventListener('submit', onSubmit);
    cancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}
applyRoomLockState(null);

// --- Voltar sozinho pra sala ----------------------------------------------
// A internet caiu ou o servidor reiniciou (deploy, Render acordando): o
// socket.io reconecta sozinho, mas a conexao nova tem outro id e nao esta
// em sala nenhuma. Antes a pessoa ficava numa sala "morta" ate sair e entrar
// de novo; agora o app entra de volta sozinho, com o token que o servidor
// deu na entrada (ele devolve o lugar no Codenames e avisa os outros que
// foi so uma reconexao, sem "fulano saiu"/"fulano entrou").
let currentRoomId = null;
let myRejoinToken = null;
let rejoinInFlight = false;
let reconnectBannerTimer = null;
let selfTileLabel = 'Você (compartilhando)';

function setReconnectBanner(state, text) {
  const el = document.getElementById('reconnect-banner');
  if (!el) return;
  clearTimeout(reconnectBannerTimer);
  if (!state) { el.classList.add('hidden'); return; }
  el.dataset.state = state;
  document.getElementById('reconnect-banner-text').textContent = text;
  document.getElementById('btn-reconnect-leave').classList.toggle('hidden', state !== 'kicked');
  el.classList.remove('hidden');
  if (state === 'ok') reconnectBannerTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function onServerConnectionLost(reason) {
  if (!currentRoomId || reason === 'io client disconnect') return;
  if (reason === 'io server disconnect') {
    // o servidor derrubou de proposito (ex: admin expulsou) - nao volta sozinho
    setReconnectBanner('kicked', 'Você foi desconectado da sala pelo servidor.');
    return;
  }
  setReconnectBanner('lost', 'Sem conexão com o servidor - tentando voltar pra sala...');
  playDisconnectSound();
}

// Fecha tudo de uma pessoa (conexao, tile, linha na lista) sem mexer no
// volume/ocultar escolhido pra ela (isso e forgetPeerAudioPrefs).
function teardownPeer(peerId) {
  const state = peers.get(peerId);
  if (state) {
    clearReconnectTimers(state);
    if (state.connFailTimer) { clearTimeout(state.connFailTimer); state.connFailTimer = null; }
    state.pc.close();
  }
  peers.delete(peerId);
  peerNames.delete(peerId);
  peerShareModes.delete(peerId);
  peerPingAllowed.delete(peerId);
  spectatorPeerIds.delete(peerId);
  removeParticipantRow(peerId);
  removeVideoTile(peerId);
  refreshGameAvatarVideos();
  updateSelfAudienceLabel();
}

// Notificacao do Windows quando alguem COMECA a transmitir (trocar de tela
// pra camera nao conta). Opcao em Configuracoes > Sons; o main.js so mostra
// se a janela nao estiver na frente da pessoa.
let lastShareNotify = null; // ultimo aviso (pros testes conferirem)
const SHARE_MODE_LABELS = { screen: 'a tela', 'screen-native': 'a tela', camera: 'a câmera' };
function notifyShareStarted(peerId, mode) {
  if (currentTheme.shareNotify === 'desligado') return;
  if (hiddenPeers.has(peerId)) return; // voce ocultou essa pessoa
  const name = peerNames.get(peerId);
  if (!name) return;
  const what = SHARE_MODE_LABELS[mode] || 'a tela';
  const title = `${name} começou a transmitir`;
  const body = `${name} está compartilhando ${what} na sala ${currentRoomId || ''}`.trim();
  window.appLinks.notifyShare(title, body)
    .then((result) => { lastShareNotify = { title, body, result }; })
    .catch(() => {});
}

function copyPeerAudioPrefs(fromId, toId) {
  if (peerVolumes.has(fromId)) peerVolumes.set(toId, { ...peerVolumes.get(fromId) });
  if (hiddenPeers.has(fromId)) hiddenPeers.add(toId);
}

// Volume/ocultar de quem caiu, pelo nome, por uns minutos: quando a pessoa
// voltar (com id novo) ela continua com o que voce tinha escolhido. Depois
// de um servidor reiniciar, cada um volta numa ordem diferente - quem volta
// depois de voce chega como peer-joined comum, entao tambem vale ai.
const PREFS_BY_NAME_TTL_MS = 2 * 60 * 1000;
const prefsByName = new Map(); // nome -> { volume, hidden, until, anyJoin }
function rememberPeerPrefsByName(peerId, anyJoin) {
  const name = peerNames.get(peerId);
  if (!name || (!peerVolumes.has(peerId) && !hiddenPeers.has(peerId))) return;
  const sameName = [...peerNames.values()].filter((n) => n === name).length;
  if (sameName > 1) { prefsByName.delete(name); return; } // nome repetido: nao da pra saber quem e quem
  prefsByName.set(name, { volume: peerVolumes.get(peerId), hidden: hiddenPeers.has(peerId), until: Date.now() + PREFS_BY_NAME_TTL_MS, anyJoin });
}
function restorePeerPrefsByName(peerId, name, isRejoin) {
  const saved = prefsByName.get(name);
  if (!saved) return;
  prefsByName.delete(name);
  if (Date.now() > saved.until || !(isRejoin || saved.anyJoin)) return;
  if (saved.volume) peerVolumes.set(peerId, { ...saved.volume });
  if (saved.hidden) hiddenPeers.add(peerId);
}

async function rejoinAfterReconnect() {
  if (!currentRoomId || rejoinInFlight) return;
  rejoinInFlight = true;
  setReconnectBanner('lost', 'Conectado de novo - voltando pra sala...');
  try {
    // O dono reenvia a senha que tinha posto (se o servidor reiniciou, a sala
    // volta trancada); quem entrou digitando a senha usa ela de novo se o
    // token nao valer mais.
    const wasOwner = !!roomLock && roomLock.ownerId === selfId;
    const opts = { allowPings: pingsAllowedByMe() };
    if (wasOwner && roomLock.locked && myRoomPassword) opts.restoreRoomPassword = myRoomPassword;
    let res;
    try {
      res = await window.rtc.joinRoom(currentRoomId, mySelfName, myRejoinToken, opts);
    } catch (err) {
      const known = myRoomPassword || currentRoomPassword;
      if (!(err && err.needsPassword && known)) throw err;
      res = await window.rtc.joinRoom(currentRoomId, mySelfName, undefined, { roomPassword: known, allowPings: pingsAllowedByMe() });
    }
    applyRoomLockState(res.lock);
    if (!currentRoomId) return; // saiu da sala enquanto isso
    myRejoinToken = res.rejoinToken || null;
    setIceServersFromServer(res.iceServers);

    // Os ids de todo mundo podem ter mudado (servidor reiniciado): o
    // volume/ocultar de cada pessoa passa pro id novo pelo nome (so quando
    // o nome e unico na sala, pra nao trocar as preferencias de duas
    // pessoas) - inclusive de quem voltar DEPOIS de voce.
    for (const id of peerNames.keys()) rememberPeerPrefsByName(id, true);

    // Todas as conexoes de video sao refeitas do zero com os ids novos.
    for (const id of new Set([...peers.keys(), ...peerNames.keys()])) teardownPeer(id);
    resetRemoteAudio();
    for (const p of res.peers) restorePeerPrefsByName(p.id, p.name, true);

    const oldSelf = selfId;
    selfId = res.selfId;
    removeParticipantRow(oldSelf);
    addParticipantRow(selfId, mySelfName, true);
    if (localStream) {
      removeVideoTile(oldSelf);
      const video = getOrCreateVideoTile(selfId, selfTileLabel, true);
      video.srcObject = localStream;
      video.classList.toggle('mirrored-video', shareMode === 'camera');
      window.rtc.setShareMode(shareMode);
    }
    res.peers.forEach((p) => {
      peerShareModes.set(p.id, p.shareMode || null);
      peerPingAllowed.set(p.id, p.allowPings !== false);
      peerNames.set(p.id, p.name);
      addParticipantRow(p.id, p.name, false);
      createPeerConnection(p.id);
    });
    updateSelfAudienceLabel();
    refreshGameAvatarVideos();

    // Estado dos minijogos pode ter mudado (ou sumido, se o servidor reiniciou).
    await Promise.all([
      window.game.getState().then((s) => { gameState = withPhaseDeadline(s); }).catch(() => {}),
      window.stopGame.getState().then((s) => { stopState = s; }).catch(() => {}),
      window.sketchGame.getState().then((s) => { sketchState = s; }).catch(() => {}),
    ]);
    if (gameState && gameState.status !== 'playing' && gameState.status !== 'over') {
      boardCellRound = -1;
      mySecretMap = null;
      mySecretMapBoardId = null;
    }
    renderGame();
    renderStop();
    renderSketch();
    renderGameActivityBadge();

    addChatSystemMessage('Você reconectou');
    setReconnectBanner('ok', 'Reconectado!');
    playReconnectedSound();
  } catch (err) {
    console.error('Falha ao voltar pra sala:', err);
    setReconnectBanner('kicked', `Não deu pra voltar pra sala: ${err.message || err}`);
  } finally {
    rejoinInFlight = false;
  }
}

document.getElementById('btn-reconnect-leave').addEventListener('click', () => {
  setReconnectBanner(null);
  leaveRoom();
});

async function leaveRoom() {
  currentRoomId = null;
  roomJoinedAt = null;
  myRejoinToken = null;
  myRoomPassword = null;
  currentRoomPassword = null;
  applyRoomLockState(null);
  prefsByName.clear();
  setReconnectBanner(null);
  if (localStream) await stopShare();
  for (const [, state] of peers) state.pc.close();
  peers.clear();
  peerNames.clear();
  assignedAvatars.clear();
  resetRemoteAudio();
  masterMuted = false;
  updateMuteAllButton();
  videoGrid.innerHTML = '';
  participantsList.innerHTML = '';
  window.rtc.disconnect();

  document.getElementById('chat-messages').innerHTML = '';
  chatUnreadCount = 0;
  updateChatUnreadBadge();
  resetGameUiState();

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

const INVITE_BTN_DEFAULT_TEXT = `${ICONS.link} Convidar`;
document.getElementById('btn-copy-invite').addEventListener('click', async () => {
  const btn = document.getElementById('btn-copy-invite');
  const roomId = roomLabel.textContent;
  if (!roomId) return;
  // Link https (fica clicavel no Discord/WhatsApp, ao contrario do
  // telinhafix://) - a pagina do servidor abre o app ja com a sala.
  const link = `${DEFAULT_SERVER_URL}/convite/${encodeURIComponent(normalizeRoomId(roomId))}`;
  try {
    await window.appLinks.copyText(link);
  } catch (err) {
    console.error('Falha ao copiar link de convite:', err);
    return;
  }
  btn.innerHTML = `${ICONS.check} Link copiado!`;
  btn.classList.add('copied');
  clearTimeout(btn._copyResetTimer);
  btn._copyResetTimer = setTimeout(() => {
    btn.innerHTML = INVITE_BTN_DEFAULT_TEXT;
    btn.classList.remove('copied');
  }, 2000);
});

document.getElementById('btn-mute-all').addEventListener('click', toggleMasterMute);

document.getElementById('btn-toggle-chat').addEventListener('click', toggleChatPanel);
document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  sendChatMessage(input.value);
  input.value = '';
});

document.getElementById('btn-toggle-game').addEventListener('click', () => {
  if (gameOverlayOpen) closeGameOverlay();
  else openGameOverlay();
});
document.getElementById('btn-game-close').addEventListener('click', closeGameOverlay);
document.getElementById('btn-game-back').addEventListener('click', showGamePicker);
document.querySelectorAll('.game-picker-card').forEach((card) => {
  card.addEventListener('click', () => selectGame(card.dataset.game));
});

document.getElementById('btn-stop-start').addEventListener('click', () => {
  setStopCategoriesError('');
  window.stopGame.startRound(editableStopCategories).then(() => {
    stopShowingEditor = false;
  }).catch((err) => setStopCategoriesError(err.message));
});
document.getElementById('btn-stop-play-again').addEventListener('click', () => {
  openStopEditor();
});
document.getElementById('btn-stop-add-category').addEventListener('click', addStopCategoryFromInput);
document.getElementById('stop-new-category').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addStopCategoryFromInput(); }
});
document.getElementById('btn-stop-reset-categories').addEventListener('click', () => {
  editableStopCategories = [...STOP_DEFAULT_CATEGORIES_CLIENT];
  renderStopCategoriesEditor();
});
document.getElementById('btn-stop-call').addEventListener('click', () => {
  window.stopGame.callStop(collectStopFieldValues()).catch((err) => {
    const el = document.getElementById('stop-call-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  });
});
document.getElementById('btn-stop-toggle-ready').addEventListener('click', () => {
  window.stopGame.toggleReady().catch((err) => console.error('Falha ao marcar pronto no Stop:', err));
});
document.getElementById('btn-stop-force-start').addEventListener('click', () => {
  window.stopGame.forceStart().catch((err) => console.error('Falha ao forçar início do Stop:', err));
});
document.getElementById('btn-stop-cancel-lobby').addEventListener('click', () => {
  window.stopGame.cancelLobby().catch((err) => console.error('Falha ao sair do lobby do Stop:', err));
});

document.getElementById('sketch-create-form').addEventListener('submit', (e) => {
  e.preventDefault();
  setSketchCreateError('');
  const a = document.getElementById('sketch-option-a');
  const b = document.getElementById('sketch-option-b');
  window.sketchGame.create(a.value, b.value).then(() => {
    a.value = '';
    b.value = '';
  }).catch((err) => setSketchCreateError(err.message));
});
document.getElementById('sketch-btn-a').addEventListener('click', () => castSketchVote('a'));
document.getElementById('sketch-btn-b').addEventListener('click', () => castSketchVote('b'));
document.getElementById('btn-sketch-end').addEventListener('click', () => {
  window.sketchGame.endVote().catch((err) => console.error('Falha ao encerrar votação:', err));
});
document.getElementById('btn-sketch-new').addEventListener('click', () => {
  window.sketchGame.reset().catch((err) => console.error('Falha ao criar nova pergunta:', err));
});

document.querySelectorAll('.game-mode-option[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    // Clicar no modo que ja esta selecionado so zeraria as equipes a toa.
    if (gameState && gameState.mode === btn.dataset.mode) return;
    setGameError('');
    window.game.setMode(btn.dataset.mode).catch((err) => setGameError(err.message));
  });
});

// Delegado: as listas do pessoal sao botoes criados na hora (ver
// renderCustomCategoryButtons).
document.getElementById('game-category-options').addEventListener('click', (e) => {
  const btn = e.target.closest('.game-mode-option[data-category]');
  if (!btn) return;
  if (gameState && (gameState.category || 'normal') === btn.dataset.category) return;
  setGameError('');
  window.game.setCategory(btn.dataset.category).catch((err) => setGameError(err.message));
});

// --- Retrospectiva ("TelinhaFix Wrapped") ------------------------------------
// O servidor calcula (ver computeWrapped) so com o tempo da pessoa NESSA
// sala; aqui vira um card em imagem (1080x1350, formato de story) pra
// copiar e mandar no grupo.
const WRAPPED_DATA_START = Date.UTC(2026, 9, 19, 3); // 19/10/2026 - quando o servidor comecou a guardar a atividade
let wrappedPeriod = 'week';
let wrappedRequestSeq = 0;
let wrappedLogo = null;

function fmtWrappedDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
function fmtWrappedDate(t) {
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function loadWrappedLogo() {
  if (wrappedLogo) return Promise.resolve(wrappedLogo);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { wrappedLogo = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = 'assets/logo.png';
  });
}

// Texto que encolhe ate caber na largura
function fitWrappedText(ctx, text, maxWidth, size, weight, family) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > 12);
  return s;
}

async function renderWrappedCard(canvas, w) {
  await Promise.all([document.fonts.ready, loadWrappedLogo()]);
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const { base, bright } = deriveThemeColors(currentTheme.color || DEFAULT_THEME.color);
  const sans = "'Inter', 'Segoe UI', Arial, sans-serif";
  const display = "'Anton', 'Impact', sans-serif";
  const pad = 80;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, W * 1.1);
  glow.addColorStop(0, `rgba(${hexToRgbString(base)}, 0.55)`);
  glow.addColorStop(0.45, `rgba(${hexToRgbString(base)}, 0.12)`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // cabecalho
  let y = pad;
  if (wrappedLogo) {
    const lh = 64;
    const lw = (wrappedLogo.width / wrappedLogo.height) * lh;
    ctx.drawImage(wrappedLogo, pad, y, lw, lh);
  }
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `700 26px ${sans}`;
  ctx.textAlign = 'right';
  ctx.fillText(wrappedPeriod === 'month' ? 'ÚLTIMOS 30 DIAS' : 'ÚLTIMOS 7 DIAS', W - pad, y + 6);
  ctx.font = `500 24px ${sans}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`${fmtWrappedDate(w.since)} – ${fmtWrappedDate(w.until)} · sala ${w.roomId}`, W - pad, y + 40);
  ctx.textAlign = 'left';

  y += 130;
  ctx.fillStyle = bright;
  ctx.font = `800 26px ${sans}`;
  ctx.fillText('TELINHAFIX WRAPPED', pad, y);
  y += 40;
  ctx.fillStyle = '#fff';
  const nameSize = fitWrappedText(ctx, w.name.toUpperCase(), W - pad * 2, 110, 400, display);
  ctx.fillText(w.name.toUpperCase(), pad, y);
  y += nameSize + 36;

  // numero principal
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `600 30px ${sans}`;
  ctx.fillText('em call nessa sala', pad, y);
  y += 44;
  ctx.fillStyle = bright;
  fitWrappedText(ctx, fmtWrappedDuration(w.totalMs), W - pad * 2, 150, 400, display);
  ctx.fillText(fmtWrappedDuration(w.totalMs), pad, y);
  y += 170;
  if (w.rank) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `600 30px ${sans}`;
    const rankText = w.rank === 1 && w.rankOf > 1 ? `Quem mais ficou em call na sala (de ${w.rankOf} pessoas)` : `${w.rank}º em tempo de call (de ${w.rankOf} ${w.rankOf === 1 ? 'pessoa' : 'pessoas'})`;
    ctx.fillText(rankText, pad, y);
    y += 70;
  }

  // grade de numeros
  const days = wrappedPeriod === 'month' ? 30 : 7;
  const tiles = [
    { label: 'Dias com call', value: `${w.daysActive} de ${days}` },
    { label: 'Maior call', value: w.longestMs ? fmtWrappedDuration(w.longestMs) : '—' },
    { label: 'Horário favorito', value: w.peakHour === null ? '—' : `${w.peakHour}h` },
    { label: 'Transmissões', value: w.shares.count ? `${w.shares.count} · ${fmtWrappedDuration(w.shares.ms)}` : '0' },
    { label: 'Codenames', value: w.codenames.played ? `${w.codenames.wins} ${w.codenames.wins === 1 ? 'vitória' : 'vitórias'} em ${w.codenames.played}` : '—' },
    { label: 'Stop', value: w.stop.played ? `${w.stop.wins} ${w.stop.wins === 1 ? 'vitória' : 'vitórias'} em ${w.stop.played}` : '—' },
  ];
  const gap = 16;
  const tw = (W - pad * 2 - gap) / 2;
  const th = 104;
  tiles.forEach((t, i) => {
    const x = pad + (i % 2) * (tw + gap);
    const ty = y + Math.floor(i / 2) * (th + gap);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(x, ty, tw, th, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `600 24px ${sans}`;
    ctx.fillText(t.label.toUpperCase(), x + 26, ty + 18);
    ctx.fillStyle = '#fff';
    fitWrappedText(ctx, t.value, tw - 52, 44, 700, sans);
    ctx.fillText(t.value, x + 26, ty + 50);
  });
  y += 3 * (th + gap) + 30;

  // companhia
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `600 28px ${sans}`;
  ctx.fillText('Quem mais ficou em call com você', pad, y);
  y += 48;
  if (!w.companions.length) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = `500 32px ${sans}`;
    ctx.fillText('Ninguém ainda - chama a galera!', pad, y);
  }
  w.companions.forEach((c, i) => {
    ctx.fillStyle = i === 0 ? bright : 'rgba(255, 255, 255, 0.85)';
    ctx.font = `${i === 0 ? 800 : 600} ${i === 0 ? 40 : 32}px ${sans}`;
    const label = `${i + 1}. ${c.name}`;
    ctx.fillText(label, pad, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `600 30px ${sans}`;
    ctx.fillText(`${fmtWrappedDuration(c.ms)} juntos`, W - pad, y + (i === 0 ? 6 : 2));
    ctx.textAlign = 'left';
    y += i === 0 ? 58 : 46;
  });
}

async function loadWrapped(period) {
  wrappedPeriod = period;
  document.querySelectorAll('[data-wrapped-period]').forEach((b) => b.classList.toggle('selected', b.dataset.wrappedPeriod === period));
  const canvas = document.getElementById('wrapped-canvas');
  const empty = document.getElementById('wrapped-empty');
  const status = document.getElementById('wrapped-status');
  const copyBtn = document.getElementById('btn-wrapped-copy');
  const seq = ++wrappedRequestSeq;
  canvas.classList.add('loading');
  copyBtn.disabled = true;
  status.textContent = 'Calculando...';
  status.classList.remove('suggestion-error', 'suggestion-ok');
  try {
    const { wrapped } = await window.rtc.getWrapped(period);
    if (seq !== wrappedRequestSeq) return; // trocou de periodo no meio
    const hint = document.getElementById('wrapped-hint');
    hint.textContent = wrapped.since < WRAPPED_DATA_START
      ? 'Seu tempo e seus jogos nessa sala. (O TelinhaFix começou a guardar isso em 19/10.)'
      : 'Seu tempo e seus jogos nessa sala.';
    if (!wrapped.totalMs && !wrapped.codenames.played && !wrapped.stop.played) {
      empty.textContent = 'Ainda não tem nada seu nessa sala nesse período. Volta depois de umas calls!';
      empty.classList.remove('hidden');
      canvas.classList.add('hidden');
      status.textContent = '';
      return;
    }
    empty.classList.add('hidden');
    canvas.classList.remove('hidden');
    await renderWrappedCard(canvas, wrapped);
    status.textContent = '';
    copyBtn.disabled = false;
  } catch (err) {
    if (seq !== wrappedRequestSeq) return;
    status.textContent = err.message || 'Não deu pra montar a retrospectiva';
    status.classList.add('suggestion-error');
  } finally {
    if (seq === wrappedRequestSeq) canvas.classList.remove('loading');
  }
}

function openWrapped() {
  document.getElementById('wrapped-overlay').classList.remove('hidden');
  loadWrapped(wrappedPeriod);
}
document.getElementById('btn-wrapped').addEventListener('click', () => openProfile(null));
document.querySelectorAll('[data-wrapped-period]').forEach((b) => {
  b.addEventListener('click', () => { if (b.dataset.wrappedPeriod !== wrappedPeriod || !b.classList.contains('selected')) loadWrapped(b.dataset.wrappedPeriod); });
});
function closeWrapped() {
  wrappedRequestSeq += 1;
  document.getElementById('wrapped-overlay').classList.add('hidden');
}
document.getElementById('btn-wrapped-close').addEventListener('click', closeWrapped);
document.getElementById('wrapped-overlay').addEventListener('click', (e) => { if (e.target.id === 'wrapped-overlay') closeWrapped(); });
document.getElementById('btn-wrapped-copy').addEventListener('click', async () => {
  const status = document.getElementById('wrapped-status');
  const ok = await window.appLinks.copyImage(document.getElementById('wrapped-canvas').toDataURL('image/png')).catch(() => false);
  status.textContent = ok ? 'Imagem copiada - é só colar (Ctrl+V)' : 'Não deu pra copiar';
  status.classList.toggle('suggestion-ok', !!ok);
  status.classList.toggle('suggestion-error', !ok);
});

// --- Perfil + conquistas -----------------------------------------------------
// Botao do grafico (topo da sala) abre o seu Perfil; clicar no nome de alguem
// na lista abre o perfil dela. Numeros de todas as salas (ver computeProfile
// no server/index.js) e as 12 conquistas em bronze, prata e ouro. A
// retrospectiva (semana/mes) fica num botao dentro do SEU perfil.
const TIER_NAMES = ['Bloqueada', 'Bronze', 'Prata', 'Ouro'];
const TIER_COLORS = ['#3a3a42', '#c8813f', '#c9ced6', '#f2c14e'];
let profileRequestSeq = 0;

function medalSvg(level) {
  const c = TIER_COLORS[level];
  const ribbon = level ? c : '#2a2a30';
  return `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M10 0h8l4 14h-8Z M22 0h8l-4 14h-8Z" fill="${ribbon}" opacity="0.75"/><circle cx="20" cy="30" r="15" fill="${c}"/><circle cx="20" cy="30" r="10.5" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>${level ? `<path d="M20 22.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8Z" fill="rgba(0,0,0,0.3)"/>` : `<path d="M15 30h10" stroke="rgba(255,255,255,0.25)" stroke-width="2.5" stroke-linecap="round"/>`}</svg>`;
}
function fmtAchValue(v, unit) {
  const n = Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (!unit) return n;
  // "1 dia", "1 noite", "1 pessoa" (as unidades vem no plural)
  const u = v === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit;
  return `${n} ${u}`;
}
function escHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderProfile(p, isSelf) {
  const st = p.stats;
  const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatar = document.getElementById('profile-avatar');
  avatar.textContent = initial;
  avatar.style.background = pingColorFor(p.name);
  document.getElementById('profile-name').textContent = p.name;
  const since = p.firstSeen ? new Date(p.firstSeen).toLocaleDateString('pt-BR') : null;
  document.getElementById('profile-since').textContent = since
    ? `No TelinhaFix desde ${since}${p.firstSeen - p.dataSince < 2 * 86400000 ? ' (o TelinhaFix começou a guardar isso em 19/10/2026)' : ''}`
    : 'Ainda sem nenhuma call registrada';
  document.getElementById('btn-profile-wrapped').classList.toggle('hidden', !isSelf);

  const tiles = [
    ['Horas em call', fmtWrappedDuration(st.totalMs)],
    ['Dias com call', String(st.daysActive)],
    ['Maior call', st.longestMs ? fmtWrappedDuration(st.longestMs) : '—'],
    ['Transmissões', st.shares ? `${st.shares} · ${fmtWrappedDuration(st.screenMs)} de tela` : '0'],
    ['Pessoas na call', String(st.people)],
    ['Codenames', st.codenames.played ? `${st.codenames.wins} ${st.codenames.wins === 1 ? 'vitória' : 'vitórias'} em ${st.codenames.played}` : '—'],
    ['Stop', st.stop.played ? `${st.stop.wins} ${st.stop.wins === 1 ? 'vitória' : 'vitórias'} em ${st.stop.played}` : '—'],
    ['"A ou B" criadas', String(st.sketches)],
  ];
  const companions = p.companions.length
    ? p.companions.map((c, i) => `<li><span class="profile-rank">${i + 1}º</span><span class="profile-comp-name">${escHtml(c.name)}</span><span class="profile-comp-time">${fmtWrappedDuration(c.ms)} juntos</span></li>`).join('')
    : '<li class="profile-empty">Ninguém ainda.</li>';
  const earned = p.achievements.filter((a) => a.level > 0).length;
  const achievements = p.achievements.map((a) => {
    const target = a.next;
    const prevTier = a.level > 0 ? a.tiers[a.level - 1] : 0;
    const pct = target ? Math.max(0, Math.min(100, ((a.value - prevTier) / (target - prevTier)) * 100)) : 100;
    const progress = target
      ? `${fmtAchValue(a.value, a.unit)} de ${fmtAchValue(target, a.unit)} pro ${TIER_NAMES[a.level + 1].toLowerCase()}`
      : 'Nível máximo';
    return `<div class="ach ach-l${a.level}">
      <div class="ach-medal">${medalSvg(a.level)}</div>
      <div class="ach-text">
        <div class="ach-top"><span class="ach-name">${escHtml(a.name)}</span><span class="ach-tier">${TIER_NAMES[a.level]}</span></div>
        <div class="ach-desc">${escHtml(a.desc)} · ${a.tiers.map((t) => fmtAchValue(t, a.unit)).join(' / ')}</div>
        <div class="ach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><div style="width:${pct}%"></div></div>
        <div class="ach-progress">${progress}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('profile-body').innerHTML = `
    <div class="profile-stats">${tiles.map(([k, v]) => `<div class="profile-stat"><div class="profile-stat-label">${k}</div><div class="profile-stat-value">${escHtml(v)}</div></div>`).join('')}</div>
    <div class="profile-section">
      <h3>Quem mais ficou em call ${isSelf ? 'com você' : `com ${escHtml(p.name)}`}</h3>
      <ol class="profile-companions">${companions}</ol>
    </div>
    <div class="profile-section">
      <h3>Conquistas <span class="profile-count">${earned} de ${p.achievements.length}</span></h3>
      <div class="ach-grid">${achievements}</div>
    </div>`;
}

async function openProfile(name) {
  const overlay = document.getElementById('profile-overlay');
  const seq = ++profileRequestSeq;
  overlay.classList.remove('hidden');
  document.getElementById('profile-name').textContent = name || mySelfName || '';
  document.getElementById('profile-since').textContent = '';
  document.getElementById('profile-avatar').textContent = '';
  document.getElementById('btn-profile-wrapped').classList.add('hidden');
  document.getElementById('profile-body').innerHTML = '<p class="settings-hint">Carregando...</p>';
  try {
    const { profile, self } = await window.rtc.getProfile(name);
    if (seq !== profileRequestSeq) return;
    renderProfile(profile, self);
  } catch (err) {
    if (seq !== profileRequestSeq) return;
    document.getElementById('profile-body').innerHTML = `<p class="settings-hint suggestion-error">${escHtml(err.message || 'Não deu pra abrir o perfil')}</p>`;
  }
}
function closeProfile() {
  profileRequestSeq += 1;
  document.getElementById('profile-overlay').classList.add('hidden');
}
document.getElementById('btn-profile-close').addEventListener('click', closeProfile);
document.getElementById('profile-overlay').addEventListener('click', (e) => { if (e.target.id === 'profile-overlay') closeProfile(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('profile-overlay').classList.contains('hidden')) closeProfile(); });
document.getElementById('btn-profile-wrapped').addEventListener('click', () => { closeProfile(); openWrapped(); });

// --- Listas de palavras do pessoal ------------------------------------------
// Criadas por quem joga e salvas por sala no servidor (ver wordListsByRoom
// no server/index.js) - aparecem do lado de Normal/Counter-Strike.
function renderCustomCategoryButtons(category) {
  const slot = document.getElementById('game-custom-categories');
  const info = document.getElementById('game-wordlist-info');
  if (!slot) return;
  const lists = Array.isArray(gameState.customLists) ? gameState.customLists : [];
  const key = lists.map((l) => `${l.id}:${l.name}:${l.count}`).join('|');
  if (slot.dataset.key !== key) {
    slot.dataset.key = key;
    slot.innerHTML = '';
    lists.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'game-mode-option game-custom-category';
      b.dataset.category = `custom:${l.id}`;
      b.textContent = l.name;
      b.title = `${l.count} palavras - criada por ${l.author}`;
      slot.appendChild(b);
    });
  }
  const current = lists.find((l) => `custom:${l.id}` === category);
  info.classList.toggle('hidden', !current);
  if (current) {
    info.textContent = `${current.count} palavras · criada por ${current.author} · `;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'game-wordlist-edit';
    edit.textContent = 'Editar lista';
    edit.addEventListener('click', () => openWordListEditor(current.id));
    info.appendChild(edit);
  }
}

// Mesma regra do servidor (parseWordListText), so pra contar ao vivo.
function countWordListWords(raw) {
  const seen = new Set();
  String(raw || '').split(/[\n,;]+/).forEach((w) => {
    const word = w.replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR');
    if (word && word.length <= 20) seen.add(word);
  });
  return seen.size;
}

let editingWordListId = null;
function setWordListStatus(text, isError) {
  const el = document.getElementById('wordlist-status');
  el.textContent = text || '';
  el.classList.toggle('suggestion-error', !!isError);
}
function updateWordListCount() {
  const n = countWordListWords(document.getElementById('wordlist-words').value);
  const el = document.getElementById('wordlist-count');
  el.textContent = `${n} ${n === 1 ? 'palavra' : 'palavras'}`;
  el.classList.toggle('suggestion-ok', n >= 25);
}
async function openWordListEditor(listId) {
  editingWordListId = listId || null;
  const nameEl = document.getElementById('wordlist-name');
  const wordsEl = document.getElementById('wordlist-words');
  const delBtn = document.getElementById('btn-wordlist-delete');
  document.getElementById('wordlist-title').textContent = listId ? 'Editar lista de palavras' : 'Nova lista de palavras';
  delBtn.classList.toggle('hidden', !listId);
  delBtn.textContent = 'Apagar lista';
  delBtn.dataset.armed = '';
  nameEl.value = '';
  wordsEl.value = '';
  setWordListStatus('');
  document.getElementById('wordlist-overlay').classList.remove('hidden');
  if (listId) {
    setWordListStatus('Carregando...');
    try {
      const { list } = await window.game.getWordList(listId);
      nameEl.value = list.name;
      wordsEl.value = list.words.join('\n');
      setWordListStatus('');
    } catch (err) {
      setWordListStatus(err.message, true);
    }
  }
  updateWordListCount();
  nameEl.focus();
}
function closeWordListEditor() {
  document.getElementById('wordlist-overlay').classList.add('hidden');
  editingWordListId = null;
}
document.getElementById('btn-wordlist-new').addEventListener('click', () => openWordListEditor(null));
document.getElementById('btn-wordlist-cancel').addEventListener('click', closeWordListEditor);
document.getElementById('wordlist-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'wordlist-overlay') closeWordListEditor();
});
document.getElementById('wordlist-words').addEventListener('input', () => {
  updateWordListCount();
  setWordListStatus(''); // erro antigo ("tem 3") nao vale mais
});
document.getElementById('wordlist-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-wordlist-save');
  btn.disabled = true;
  setWordListStatus('Salvando...');
  try {
    await window.game.saveWordList(editingWordListId, document.getElementById('wordlist-name').value, document.getElementById('wordlist-words').value);
    closeWordListEditor();
  } catch (err) {
    setWordListStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
});
// Apagar pede 2 cliques (sem janela de confirmacao do sistema).
document.getElementById('btn-wordlist-delete').addEventListener('click', async () => {
  const btn = document.getElementById('btn-wordlist-delete');
  if (!editingWordListId) return;
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.textContent = 'Clique de novo pra apagar';
    return;
  }
  try {
    await window.game.deleteWordList(editingWordListId);
    closeWordListEditor();
  } catch (err) {
    setWordListStatus(err.message, true);
  }
});

function applyGameBoardTheme(theme) {
  const codenamesView = document.getElementById('codenames-view');
  codenamesView.classList.toggle('codenames-theme-light', theme === 'light');
  codenamesView.classList.toggle('codenames-theme-dark', theme !== 'light');
  document.querySelectorAll('[data-game-theme]').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.gameTheme === theme);
  });
  try { localStorage.setItem(CODENAMES_BOARD_THEME_STORAGE_KEY, theme); } catch (err) {}
}

(() => {
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem(CODENAMES_BOARD_THEME_STORAGE_KEY) || 'dark'; } catch (err) {}
  applyGameBoardTheme(savedTheme);
})();

document.querySelectorAll('[data-game-theme]').forEach((btn) => {
  btn.addEventListener('click', () => applyGameBoardTheme(btn.dataset.gameTheme));
});

function applyGameAgentsTheme(theme) {
  const normal = theme === 'normal';
  document.getElementById('codenames-view').classList.toggle('codenames-agents-plain', normal);
  document.querySelectorAll('[data-agents-theme]').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.agentsTheme === (normal ? 'normal' : 'latadelixo'));
  });
  try { localStorage.setItem(CODENAMES_AGENTS_THEME_STORAGE_KEY, normal ? 'normal' : 'latadelixo'); } catch (err) {}
}

(() => {
  let saved = 'latadelixo';
  try { saved = localStorage.getItem(CODENAMES_AGENTS_THEME_STORAGE_KEY) || 'latadelixo'; } catch (err) {}
  applyGameAgentsTheme(saved);
})();

document.querySelectorAll('[data-agents-theme]').forEach((btn) => {
  btn.addEventListener('click', () => applyGameAgentsTheme(btn.dataset.agentsTheme));
});

document.querySelectorAll('.game-pick-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setGameError('');
    window.game.setRole(btn.dataset.team, btn.dataset.role).catch((err) => setGameError(err.message));
  });
});

document.querySelectorAll('.game-spectate-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setGameError('');
    window.game.setSpectator(btn.dataset.withMap === '1').catch((err) => setGameError(err.message));
  });
});

// "Partida em andamento": assistir com/sem mapa, pegar uma vaga ou voltar a assistir.
document.getElementById('game-join-view').addEventListener('click', (e) => {
  const errEl = document.getElementById('game-join-error');
  const showErr = (err) => { errEl.textContent = err.message || String(err); errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');
  const watch = e.target.closest('[data-join-watch]');
  const seat = e.target.closest('[data-join-team]');
  if (watch) {
    window.game.setSpectator(watch.dataset.joinWatch === '1').then(() => { gameJoinViewForced = false; renderGame(); }).catch(showErr);
  } else if (seat && !seat.disabled) {
    window.game.setRole(seat.dataset.joinTeam, seat.dataset.joinRole).then(() => { gameJoinViewForced = false; renderGame(); }).catch(showErr);
  } else if (e.target.closest('[data-join-back]')) {
    gameJoinViewForced = false;
    renderGame();
  }
});

// Botao "Mostrar mapa / Esconder mapa" do painel de espectadores (o painel
// e refeito a cada render, entao o clique e tratado por delegacao).
document.getElementById('game-panels-right').addEventListener('click', (e) => {
  if (e.target.closest('[data-open-join]')) { gameJoinViewForced = true; renderGame(); return; }
  const btn = e.target.closest('.game-spectate-toggle');
  if (!btn) return;
  window.game.setSpectator(btn.dataset.withMap === '1').catch((err) => console.error('Falha ao trocar o modo de espectador:', err));
});

document.getElementById('btn-game-leave-role').addEventListener('click', () => {
  setGameError('');
  window.game.leaveRole().catch((err) => setGameError(err.message));
});

document.getElementById('btn-game-start').addEventListener('click', () => {
  setGameError('');
  window.game.start().catch((err) => setGameError(err.message));
});

document.getElementById('game-clue-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const wordInput = document.getElementById('game-clue-word');
  const number = Number(document.getElementById('game-clue-number').value);
  window.game.giveClue(wordInput.value, number, Array.from(clueTargets))
    .then(() => { wordInput.value = ''; clueTargets.clear(); })
    .catch((err) => console.error('Falha ao dar a pista:', err));
});

document.getElementById('btn-game-shuffle').addEventListener('click', () => {
  setGameError('');
  window.game.shuffleTeams().catch((err) => setGameError(err.message));
});

document.getElementById('btn-game-end-turn').addEventListener('click', () => {
  window.game.endTurn().catch((err) => console.error('Falha ao passar a vez:', err));
});

document.getElementById('btn-game-camera').addEventListener('click', () => {
  if (shareMode === 'camera') stopShare();
  else if (!localStream) startCameraShare();
});

document.getElementById('btn-game-guess-confirm').addEventListener('click', () => confirmGuess());
document.getElementById('btn-game-guess-cancel').addEventListener('click', () => cancelGuessSelection());

document.getElementById('btn-game-play-again').addEventListener('click', () => {
  window.game.playAgain().catch((err) => console.error('Falha ao jogar de novo:', err));
});

document.getElementById('btn-game-reset-lobby').addEventListener('click', () => {
  window.game.resetLobby().catch((err) => console.error('Falha ao voltar ao lobby:', err));
});

document.getElementById('btn-game-abort').addEventListener('click', () => {
  if (gameState && gameState.status === 'playing' && !confirm('Isso encerra a partida atual pra todo mundo. Continuar?')) return;
  window.game.resetLobby().catch((err) => console.error('Falha ao encerrar a partida:', err));
});

document.getElementById('credit-link').addEventListener('click', (e) => {
  e.preventDefault();
  window.appLinks.openCredit();
});

// --- "Dê uma sugestão ao dev" ------------------------------------------------
// Manda nome + sugestao pro servidor (POST /sugestao), que repassa pro Google
// Forms do Bunny (ver server/index.js). Fica na tela de entrar, entao nao
// usa o socket da sala - e uma chamada HTTP normal. 1 por minuto (o
// servidor tambem confere).
const SUGGESTION_COOLDOWN_MS = 60 * 1000;
const SUGGESTION_MAX_LEN = 1000;
let lastSuggestionSentAt = 0;
let suggestionSending = false;
const suggestionOverlay = document.getElementById('suggestion-overlay');
const suggestionText = document.getElementById('suggestion-text');
const suggestionName = document.getElementById('suggestion-name');

function setSuggestionStatus(msg, kind) {
  const el = document.getElementById('suggestion-status');
  el.textContent = msg || '';
  el.classList.toggle('suggestion-ok', kind === 'ok');
  el.classList.toggle('suggestion-error', kind === 'error');
}

function updateSuggestionCount() {
  document.getElementById('suggestion-count').textContent = `${suggestionText.value.length}/${SUGGESTION_MAX_LEN}`;
}

function openSuggestionModal() {
  if (!suggestionName.value.trim()) {
    suggestionName.value = (document.getElementById('display-name').value || '').trim().slice(0, 20);
  }
  setSuggestionStatus('');
  updateSuggestionCount();
  suggestionOverlay.classList.remove('hidden');
  (suggestionName.value ? suggestionText : suggestionName).focus();
}

function closeSuggestionModal() {
  if (suggestionSending) return;
  suggestionOverlay.classList.add('hidden');
}

document.getElementById('btn-suggestion').addEventListener('click', openSuggestionModal);
document.getElementById('btn-suggestion-cancel').addEventListener('click', closeSuggestionModal);
suggestionOverlay.addEventListener('click', (e) => { if (e.target === suggestionOverlay) closeSuggestionModal(); });
suggestionOverlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSuggestionModal(); });
suggestionText.addEventListener('input', updateSuggestionCount);

document.getElementById('suggestion-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (suggestionSending) return;
  const name = suggestionName.value.trim().slice(0, 20);
  const text = suggestionText.value.trim().slice(0, SUGGESTION_MAX_LEN);
  if (!text) { setSuggestionStatus('Escreve a sugestão antes de enviar.', 'error'); suggestionText.focus(); return; }
  const waitMs = lastSuggestionSentAt + SUGGESTION_COOLDOWN_MS - Date.now();
  if (waitMs > 0) { setSuggestionStatus(`Calma! Dá pra mandar outra em ${Math.ceil(waitMs / 1000)}s.`, 'error'); return; }

  const sendBtn = document.getElementById('btn-suggestion-send');
  suggestionSending = true;
  sendBtn.disabled = true;
  setSuggestionStatus('Enviando... (pode demorar se o servidor estava dormindo)');
  try {
    const res = await fetch(`${DEFAULT_SERVER_URL}/sugestao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text, version: window.appInfo.version }),
      signal: AbortSignal.timeout(90 * 1000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Erro ${res.status}`);
    lastSuggestionSentAt = Date.now();
    suggestionText.value = '';
    updateSuggestionCount();
    setSuggestionStatus('Valeu! Sua sugestão foi enviada pro dev.', 'ok');
  } catch (err) {
    const msg = err && err.name === 'TimeoutError' ? 'O servidor demorou demais pra responder. Tenta de novo daqui a pouco.' : (err.message || 'Não deu pra enviar.');
    setSuggestionStatus(msg, 'error');
  } finally {
    suggestionSending = false;
    sendBtn.disabled = false;
  }
});

document.getElementById('build-version').textContent = `build (${window.appInfo.version})`;

document.getElementById('btn-check-updates').addEventListener('click', () => {
  window.appInfo.checkForUpdates();
});

// Aviso mandado pelo painel de admin: faixa no topo da tela (texto puro),
// some sozinha em 30s ou no X.
let adminNoticeTimer = null;
function showAdminNotice(text) {
  const el = document.getElementById('admin-notice-banner');
  document.getElementById('admin-notice-text').textContent = String(text || '');
  el.classList.remove('hidden');
  playChatSound();
  clearTimeout(adminNoticeTimer);
  adminNoticeTimer = setTimeout(() => el.classList.add('hidden'), 30000);
}
document.getElementById('btn-admin-notice-close').addEventListener('click', () => {
  clearTimeout(adminNoticeTimer);
  document.getElementById('admin-notice-banner').classList.add('hidden');
});

// App desatualizado (o processo principal confere de tempos em tempos, ver
// setupAutoUpdater no main.js): o botao "Procurar atualizacoes" fica
// piscando e mostra a versao nova. Nada instala sozinho - so quando a
// pessoa clicar ou abrir o app de novo.
function applyUpdateStatus(status) {
  const btn = document.getElementById('btn-check-updates');
  const available = !!(status && status.available);
  btn.classList.toggle('update-available', available);
  btn.textContent = available ? `Atualização disponível (v${status.version})` : 'Procurar atualizações';
  btn.title = available ? 'Tem versão nova do TelinhaFix - clique pra baixar e instalar' : '';
}
window.appInfo.onUpdateStatus(applyUpdateStatus);
window.appInfo.getUpdateStatus().then(applyUpdateStatus).catch(() => {});
// Abriu o app com a versao nova ja baixada: o main instala e reabre sozinho.
window.appInfo.onUpdateInstalling((info) => {
  document.getElementById('update-installing-version').textContent = info && info.version ? `versão ${info.version}` : 'versão nova';
  document.getElementById('update-installing-overlay').classList.remove('hidden');
  btnJoin.disabled = true;
});

btnJoin.addEventListener('click', async () => {
  setLoginError('');
  const serverUrl = DEFAULT_SERVER_URL;
  const password = BUILT_IN_SERVER_PASSWORD;
  const rawName = document.getElementById('display-name').value.trim().slice(0, 20);
  const name = rawName || 'Anonimo';
  const roomId = normalizeRoomId(document.getElementById('room-id').value);
  document.getElementById('room-id').value = roomId;

  if (!roomId) {
    setLoginError('Preencha o código da sala.');
    return;
  }
  // mesmos limites do servidor (convite/historico podem trazer codigo maior)
  if (roomId.length > 20) {
    setLoginError('O código da sala pode ter no máximo 20 caracteres.');
    return;
  }

  btnJoin.disabled = true;
  setLoginError('Conectando... pode levar até 1 minuto se o servidor estava "dormindo".', true);
  try {
    await window.rtc.connect(serverUrl, password);
    setLoginError('');
    saveWorkingDisplayName(rawName);
    // Sala com senha: pergunta e tenta de novo na mesma conexao ate acertar
    // ou a pessoa desistir (ver askRoomPassword).
    let joinRes = null;
    let typedRoomPassword;
    for (;;) {
      try {
        const joinOpts = { allowPings: pingsAllowedByMe() };
        if (typedRoomPassword !== undefined) joinOpts.roomPassword = typedRoomPassword;
        joinRes = await window.rtc.joinRoom(roomId, name, undefined, joinOpts);
        break;
      } catch (err) {
        if (!err || !err.needsPassword) throw err;
        typedRoomPassword = await askRoomPassword(roomId, typedRoomPassword === undefined ? '' : err.message);
        if (typedRoomPassword === null) {
          window.rtc.disconnect();
          setLoginError('');
          return;
        }
      }
    }
    const { selfId: id, peers: existingPeers, iceServers: serverIceServers, rejoinToken, chatHistory, lock } = joinRes;
    currentRoomPassword = typedRoomPassword || null;
    selfId = id;
    roomJoinedAt = Date.now();
    applyRoomLockState(lock);
    currentRoomId = roomId;
    myRejoinToken = rejoinToken || null;
    setIceServersFromServer(serverIceServers);
    saveRoomToHistory(roomId);
    existingPeers.forEach((p) => peerShareModes.set(p.id, p.shareMode || null));
    existingPeers.forEach((p) => peerPingAllowed.set(p.id, p.allowPings !== false));

    window.rtc.onSignal(handleSignal);

    window.rtc.onPeerJoined(({ id: peerId, name: peerName, rejoin, replaces, allowPings }) => {
      peerPingAllowed.set(peerId, allowPings !== false);
      // Alguem que caiu e voltou sozinho: a conexao antiga dela (replaces)
      // ainda esta aqui - fecha em silencio e passa o volume/ocultar que
      // voce tinha escolhido pra ela pro id novo.
      if (replaces && peerNames.has(replaces)) {
        copyPeerAudioPrefs(replaces, peerId);
        teardownPeer(replaces);
      } else {
        restorePeerPrefsByName(peerId, peerName, !!rejoin);
      }
      peerNames.set(peerId, peerName);
      addParticipantRow(peerId, peerName, false);
      createPeerConnection(peerId);
      updateSelfAudienceLabel();
      if (rejoin) {
        addChatSystemMessage(`${peerName} reconectou`);
      } else {
        addChatSystemMessage(`${peerName} entrou na sala`);
        playJoinSound();
      }
    });

    window.rtc.onPeerLeft(({ id: peerId, replaced }) => {
      if (!peerNames.has(peerId) && !peers.has(peerId)) return; // ja trocada (ver onPeerJoined)
      const leftName = peerNames.get(peerId) || 'Alguém';
      if (!replaced) rememberPeerPrefsByName(peerId, false); // vale se ela voltar sozinha
      teardownPeer(peerId);
      forgetPeerAudioPrefs(peerId);
      if (replaced) return; // voltou com outro id - nao "saiu"
      addChatSystemMessage(`${leftName} saiu da sala`);
      playLeaveSound();
    });

    window.rtc.onAdminNotice(({ text }) => showAdminNotice(text));
    window.rtc.onUpdatePrompt(() => { window.appInfo.promptUpdate().catch(() => {}); });

    window.rtc.onPeerShareMode(({ id: peerId, mode }) => {
      const wasSharing = !!peerShareModes.get(peerId);
      peerShareModes.set(peerId, mode || null);
      if (mode && !wasSharing) notifyShareStarted(peerId, mode);
      updatePeerTileMirror(peerId);
      refreshGameAvatarVideos();
    });

    window.rtc.onDisconnected(onServerConnectionLost);
    window.rtc.onRoomLockState(applyRoomLockState);
    window.rtc.onScreenPing(onScreenPing);
    window.rtc.onPeerPingPermission(({ id: peerId, allow }) => peerPingAllowed.set(peerId, allow !== false));
    window.rtc.onReconnected(rejoinAfterReconnect);

    window.game.onState((newState) => {
      // "round" por si so nao basta pra saber se o tabuleiro precisa ser
      // reconstruido (ver renderGameBoard/buildBoardCells): resetar o lobby
      // ("Trocar equipes") zera o round de volta pra 0, entao a PROXIMA
      // partida pode cair exatamente no mesmo numero de round de uma
      // partida anterior na mesma sala, enganando a comparacao e deixando
      // as palavras antigas na tela mesmo com um tabuleiro novo chegando do
      // servidor. Resetar aqui (sempre que o estado NAO esta jogando) cobre
      // isso mesmo com o painel fechado, quando renderGame nem chega a rodar.
      if (newState.status !== 'playing' && newState.status !== 'over') {
        boardCellRound = -1;
        mySecretMap = null;
        mySecretMapBoardId = null;
      }
      playGameStateSounds(gameState, newState);
      playGameStateEffects(gameState, newState);
      gameState = withPhaseDeadline(newState);
      notifyGameTimeoutIfNew();
      renderGame();
      renderGameActivityBadge();
    });

    window.stopGame.onState((newState) => {
      stopState = newState;
      if (newState.status === 'lobby' || newState.status === 'playing') stopShowingEditor = false;
      renderStop();
      renderGameActivityBadge();
    });

    window.minigames.onInvite((invite) => {
      showMinigameInvite(invite);
      playJoinSound();
    });

    window.sketchGame.onState((newState) => {
      const roundChanged = mySketchRound !== newState.round;
      sketchState = newState;
      if (roundChanged) { mySketchVote = null; mySketchRound = newState.round; }
      renderSketch();
      renderGameActivityBadge();
    });

    // Busca o estado atual dos 3 minijogos uma vez ao entrar na sala, pra
    // quem chegar DEPOIS de um jogo ja ter comecado tambem ver o badge de
    // atividade na hora (sem isso, so apareceria na proxima acao de alguem
    // dentro do jogo, que pode demorar).
    Promise.all([
      window.game.getState().then((s) => { gameState = s; }).catch(() => {}),
      window.stopGame.getState().then((s) => { stopState = s; }).catch(() => {}),
      window.sketchGame.getState().then((s) => { sketchState = s; }).catch(() => {}),
    ]).then(renderGameActivityBadge);

    // Painel de admin: o dono do app pode entrar numa sala no modo
    // espectador invisivel. O servidor avisa por esses dois eventos em vez
    // de peer-joined/peer-left - de proposito NAO mexemos em nenhuma UI
    // (sem linha de participante, sem som, sem contagem) pra continuar
    // invisivel. createPeerConnection sozinho ja basta: como o espectador
    // nunca manda midia de volta, nosso lado nunca recebe 'ontrack' dele e
    // nenhuma tile de video chega a aparecer - so mandamos nosso audio/
    // video pra ele, exatamente como pra qualquer outro peer.
    window.rtc.onSpectatorJoined(({ id: peerId }) => {
      spectatorPeerIds.add(peerId);
      createPeerConnection(peerId);
    });

    window.rtc.onSpectatorLeft(({ id: peerId }) => {
      const state = peers.get(peerId);
      if (state) state.pc.close();
      peers.delete(peerId);
      spectatorPeerIds.delete(peerId);
    });

    roomLabel.textContent = roomId;
    addParticipantRow(selfId, name, true);
    mySelfName = name;
    existingPeers.forEach((p) => {
      peerNames.set(p.id, p.name);
      addParticipantRow(p.id, p.name, false);
      createPeerConnection(p.id);
    });
    renderChatHistory(chatHistory);

    loginScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
  } catch (err) {
    setLoginError(err.message || 'Falha ao entrar.');
  } finally {
    btnJoin.disabled = false;
  }
});

// "Apoie o Projeto do TelinhaFix" (tela inicial): QR code do Pix.
(() => {
  const overlay = document.getElementById('support-overlay');
  const close = () => overlay.classList.add('hidden');
  document.getElementById('btn-support').addEventListener('click', () => overlay.classList.remove('hidden'));
  document.getElementById('btn-support-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });
})();

// --- Musica do dia (tela inicial) ---------------------------------------------
// Uma musica por dia pra todo mundo (trecho de 30s do Deezer, ver
// handleMusic no server/index.js). Toca sozinha a 50% so na PRIMEIRA vez que
// o app abre no dia; fora isso fica pausada ate a pessoa dar play. Para
// quando a pessoa entra numa sala (nao vaza pra call nem pra transmissao).
const MUSIC_AUTOPLAY_DAY_KEY = 'telinhafix-music-autoplay-day';
const MUSIC_VOLUME_KEY = 'telinhafix-music-volume';
const MUSIC_DEFAULT_VOLUME = 50; // % do slider (curva em dB - ver musicGain)
const MUSIC_DEVICE_KEY = 'telinhafix-device-id';
const MUSIC_VOTED_TRACKS_KEY = 'telinhafix-music-voted-tracks'; // nome/capa das musicas votadas hoje
const MUSIC_ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>';
const MUSIC_ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>';
let musicOfDay = null;
let musicVotesLeft = 3;
let musicMyVotes = [];

function musicDeviceId() {
  try {
    let id = localStorage.getItem(MUSIC_DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(MUSIC_DEVICE_KEY, id); }
    return id;
  } catch { return `sem-armazenamento-${navigator.userAgent.length}`; }
}
function musicVolume() {
  try {
    const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : MUSIC_DEFAULT_VOLUME;
  } catch { return 15; }
}
// O ouvido percebe volume em decibeis, nao linear: com volume = %/100 o
// 10% ja soava alto. Aqui o slider anda 40 dB (100% = volume cheio, cada
// 10% = 4 dB a menos; 0% = mudo) - o padrao de 50% fica em -20 dB.
const MUSIC_DB_RANGE = 40;
function musicGain(pct) {
  const v = Math.min(100, Math.max(0, Number(pct) || 0));
  return v === 0 ? 0 : Math.pow(10, ((v / 100 - 1) * MUSIC_DB_RANGE) / 20);
}
function fmtMusicTime(s) {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
function loginScreenVisible() {
  return !document.getElementById('login-screen').classList.contains('hidden');
}

function renderMusicCard() {
  const m = musicOfDay;
  if (!m) return;
  const cover = document.getElementById('music-cover');
  const title = document.getElementById('music-title');
  if (cover.getAttribute('src') !== m.today.cover) cover.src = m.today.cover || '';
  cover.classList.toggle('hidden', !m.today.cover);
  cover.alt = `Capa de ${m.today.title}`;
  title.textContent = m.today.title;
  title.title = m.today.title;
  document.getElementById('music-artist').textContent = m.today.artist;
  document.getElementById('btn-music-play').disabled = !m.today.preview;
  const next = m.queue[0];
  document.getElementById('music-next-title').textContent = next ? `${next.title} - ${next.artist}` : 'Fila vazia - vote na sua!';
  document.getElementById('music-queue-info').classList.remove('hidden');
  document.getElementById('btn-music-vote').title = musicVotesLeft
    ? `Você ainda tem ${musicVotesLeft} ${musicVotesLeft === 1 ? 'voto' : 'votos'} hoje`
    : 'Você já usou seus votos de hoje';
}

function applyMusicState(data) {
  const audio = document.getElementById('music-audio');
  const changed = !musicOfDay || musicOfDay.today.id !== data.today.id;
  musicOfDay = data;
  musicVotesLeft = data.votesLeft;
  musicMyVotes = data.myVotes || [];
  if (data.today.preview && (changed || !audio.getAttribute('src'))) {
    const wasPlaying = !audio.paused;
    audio.src = data.today.preview;
    if (wasPlaying) audio.play().catch(() => {});
  }
  renderMusicCard();
}

// Se a busca falhar (app abriu antes da internet, servidor reiniciando,
// oscilacao), tenta de novo sozinho: 3s, 6s, 15s, 30s e depois a cada 1min
// enquanto a tela inicial estiver aberta. So mostra o erro (com "Tentar de
// novo") depois de algumas falhas - antes disso continua "Carregando...".
// O autoplay da 1a abertura do dia continua valendo quando enfim carregar.
const MUSIC_RETRY_DELAYS_MS = [3000, 6000, 15000, 30000, 60000];
const MUSIC_FETCH_TIMEOUT_MS = 20000;
let musicRetryTimer = null;
let musicFailures = 0;
let musicPendingAutoplay = false;
let musicLastError = null;

function showMusicLoadError(show) {
  const retry = document.getElementById('btn-music-retry');
  retry.classList.toggle('hidden', !show);
  retry.title = show && musicLastError ? `Motivo: ${musicLastError}` : '';
  if (show) {
    document.getElementById('music-title').textContent = 'Não deu pra carregar a música agora';
    document.getElementById('music-artist').textContent = '';
  }
}

async function loadMusicOfDay({ autoplay = false } = {}) {
  if (autoplay) musicPendingAutoplay = true;
  clearTimeout(musicRetryTimer);
  musicRetryTimer = null;
  try {
    const r = await fetch(`${DEFAULT_SERVER_URL}/musica?d=${encodeURIComponent(musicDeviceId())}`, { signal: AbortSignal.timeout(MUSIC_FETCH_TIMEOUT_MS) });
    const data = await r.json().catch(() => { throw new Error(`resposta inválida do servidor (HTTP ${r.status})`); });
    if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    musicFailures = 0;
    musicLastError = null;
    showMusicLoadError(false);
    applyMusicState(data);
    if (musicPendingAutoplay && data.today.preview && loginScreenVisible()) {
      musicPendingAutoplay = false;
      let last = null;
      try { last = localStorage.getItem(MUSIC_AUTOPLAY_DAY_KEY); } catch {}
      if (last !== data.day) {
        const audio = document.getElementById('music-audio');
        audio.volume = musicGain(musicVolume());
        audio.play().then(() => { try { localStorage.setItem(MUSIC_AUTOPLAY_DAY_KEY, data.day); } catch {} }).catch(() => {});
      }
    }
    musicPendingAutoplay = false;
  } catch (err) {
    musicFailures += 1;
    musicLastError = err.message || String(err);
    console.warn(`Musica do dia (tentativa ${musicFailures}):`, musicLastError);
    if (!musicOfDay) {
      if (musicFailures >= 3) showMusicLoadError(true);
      // so continua tentando sozinho enquanto a pessoa esta na tela inicial
      if (loginScreenVisible()) {
        const delay = MUSIC_RETRY_DELAYS_MS[Math.min(musicFailures - 1, MUSIC_RETRY_DELAYS_MS.length - 1)];
        musicRetryTimer = setTimeout(() => loadMusicOfDay(), delay);
      }
    }
  }
}

const musicVoteOverlay = document.getElementById('music-vote-overlay');
const musicResultAudio = document.getElementById('music-result-audio');
function closeMusicVote() {
  musicVoteOverlay.classList.add('hidden');
  musicResultAudio.pause();
}

(() => {
  const audio = document.getElementById('music-audio');
  const play = document.getElementById('btn-music-play');
  const fill = document.getElementById('music-progress-fill');
  const time = document.getElementById('music-time');
  const volume = document.getElementById('music-volume');
  play.innerHTML = MUSIC_ICON_PLAY;
  const mute = document.getElementById('btn-music-mute');
  const volumeValue = document.getElementById('music-volume-value');
  let volumeBeforeMute = musicVolume() || MUSIC_DEFAULT_VOLUME;
  const syncVolumeUi = () => {
    const v = Number(volume.value);
    volumeValue.textContent = `${v}%`;
    mute.innerHTML = v === 0 ? ICONS.speakerOff : ICONS.speakerOn;
    mute.setAttribute('aria-label', v === 0 ? 'Desmutar a música do dia' : 'Mutar a música do dia');
    updateSliderFill(volume);
  };
  const setMusicVolume = (v) => {
    volume.value = String(v);
    audio.volume = musicGain(v);
    try { localStorage.setItem(MUSIC_VOLUME_KEY, String(v)); } catch {}
    syncVolumeUi();
  };
  volume.value = String(musicVolume());
  audio.volume = musicGain(musicVolume());
  syncVolumeUi();
  mute.addEventListener('click', () => {
    const v = Number(volume.value);
    if (v > 0) { volumeBeforeMute = v; setMusicVolume(0); } else setMusicVolume(volumeBeforeMute || MUSIC_DEFAULT_VOLUME);
  });

  const syncButton = () => {
    play.innerHTML = audio.paused ? MUSIC_ICON_PLAY : MUSIC_ICON_PAUSE;
    play.setAttribute('aria-label', audio.paused ? 'Tocar' : 'Pausar');
  };
  audio.addEventListener('play', syncButton);
  audio.addEventListener('pause', syncButton);
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 30;
    fill.style.width = `${Math.min(100, (audio.currentTime / d) * 100)}%`;
    time.textContent = fmtMusicTime(audio.currentTime);
  });
  play.addEventListener('click', () => {
    if (audio.paused) {
      musicResultAudio.pause();
      audio.volume = musicGain(musicVolume());
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });
  document.getElementById('music-progress').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  volume.addEventListener('input', () => setMusicVolume(Number(volume.value)));
  // rodinha do mouse: de 5 em 5, igual o volume das transmissoes
  volume.parentElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    setMusicVolume(Math.min(100, Math.max(0, Number(volume.value) + (e.deltaY < 0 ? 5 : -5))));
  }, { passive: false });

  // Entrou numa sala: para. Voltou pra tela inicial: atualiza (sem tocar sozinha).
  new MutationObserver(() => {
    if (!loginScreenVisible()) { audio.pause(); closeMusicVote(); } else loadMusicOfDay();
  }).observe(document.getElementById('login-screen'), { attributes: true, attributeFilter: ['class'] });
  // virada do dia com o app aberto na tela inicial
  setInterval(() => { if (loginScreenVisible()) loadMusicOfDay(); }, 10 * 60 * 1000);

  // --- modal de voto ---
  const results = document.getElementById('music-results');
  const status = document.getElementById('music-vote-status');
  const left = document.getElementById('music-votes-left');
  const setStatus = (text, kind) => {
    status.textContent = text || '';
    status.classList.toggle('suggestion-error', kind === 'error');
    status.classList.toggle('suggestion-ok', kind === 'ok');
  };
  // Barra em 3 partes + uma vaga por voto (capa e nome da musica votada).
  // O servidor so devolve os ids votados: o nome/capa vem da fila (top 10)
  // ou do que ficou guardado aqui quando a pessoa votou.
  const segs = document.getElementById('music-votes-segs');
  const slots = document.getElementById('music-vote-slots');
  const voteTrackInfo = (id) => {
    const q = musicOfDay && musicOfDay.queue.find((x) => x.id === id);
    if (q) return q;
    try {
      const saved = JSON.parse(localStorage.getItem(MUSIC_VOTED_TRACKS_KEY) || 'null');
      if (saved && musicOfDay && saved.day === musicOfDay.day && saved.tracks[id]) return saved.tracks[id];
    } catch {}
    return null;
  };
  const rememberVotedTrack = (day, t) => {
    try {
      let saved = JSON.parse(localStorage.getItem(MUSIC_VOTED_TRACKS_KEY) || 'null');
      if (!saved || saved.day !== day) saved = { day, tracks: {} };
      saved.tracks[t.id] = { title: t.title, artist: t.artist, coverSmall: t.coverSmall || t.cover || '' };
      localStorage.setItem(MUSIC_VOTED_TRACKS_KEY, JSON.stringify(saved));
    } catch {}
  };
  const renderLeft = (justVotedId = null) => {
    const total = (musicOfDay && musicOfDay.votesPerDay) || 3;
    const used = Math.min(total, musicMyVotes.length);
    const remaining = Math.max(0, total - used);
    document.getElementById('music-votes-used').innerHTML = `<b>${used} de ${total}</b> votos usados`;
    document.getElementById('music-votes-note').textContent = used === 0
      ? `Você pode votar em até ${total} músicas hoje`
      : remaining > 0
        ? `Ainda dá pra votar em mais ${remaining} ${remaining === 1 ? 'música' : 'músicas'}`
        : 'Pronto! Amanhã tem mais';
    segs.style.setProperty('--n', total);
    slots.style.setProperty('--n', total);
    segs.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('');
    slots.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const slot = document.createElement('div');
      slot.className = 'music-vote-slot';
      const n = document.createElement('span');
      n.className = 'music-slot-n';
      n.textContent = `voto ${i + 1}`;
      const id = musicMyVotes[i];
      if (id === undefined) {
        slot.append(n, document.createTextNode('livre'));
      } else {
        const info = voteTrackInfo(id);
        slot.classList.add('filled');
        if (id === justVotedId) slot.classList.add('just');
        let cover;
        if (info && info.coverSmall) {
          cover = document.createElement('img');
          cover.src = info.coverSmall;
          cover.alt = '';
        } else {
          cover = document.createElement('div');
          cover.className = 'music-slot-cover';
        }
        const name = document.createElement('b');
        name.textContent = info ? info.title : 'Música votada';
        if (info) slot.title = `${info.title} - ${info.artist}`;
        slot.append(cover, name, n);
      }
      slots.appendChild(slot);
    }
    left.textContent = remaining > 0
      ? 'Cada voto coloca a música na fila (votar numa que já está na fila adianta ela).'
      : `Você já usou seus ${total} votos de hoje - amanhã tem mais!`;
  };
  let lastResults = [];
  let listeningId = null;
  function renderResults() {
    results.innerHTML = '';
    lastResults.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'music-result';
      const img = document.createElement('img');
      img.src = t.coverSmall || t.cover || '';
      img.alt = '';
      const text = document.createElement('div');
      text.className = 'music-result-text';
      const tt = document.createElement('div');
      tt.className = 'music-result-title';
      tt.textContent = t.title;
      const ta = document.createElement('div');
      ta.className = 'music-result-artist';
      ta.textContent = t.album && t.album !== t.title ? `${t.artist} · ${t.album}` : t.artist;
      text.append(tt, ta);
      const listen = document.createElement('button');
      listen.type = 'button';
      listen.className = 'ghost music-result-listen';
      const playingThis = listeningId === t.id && !musicResultAudio.paused;
      listen.innerHTML = playingThis ? MUSIC_ICON_PAUSE : MUSIC_ICON_PLAY;
      listen.title = playingThis ? 'Pausar' : 'Ouvir o trecho';
      listen.addEventListener('click', () => {
        if (listeningId === t.id && !musicResultAudio.paused) { musicResultAudio.pause(); return; }
        audio.pause();
        listeningId = t.id;
        musicResultAudio.src = t.preview;
        musicResultAudio.volume = musicGain(Math.max(30, musicVolume()));
        musicResultAudio.play().then(renderResults).catch(() => {});
      });
      const vote = document.createElement('button');
      vote.type = 'button';
      vote.className = 'music-result-vote';
      const isToday = !!musicOfDay && musicOfDay.today.id === t.id;
      const already = musicMyVotes.includes(t.id);
      vote.textContent = isToday ? 'É a de hoje' : already ? 'Votado' : 'Votar';
      vote.disabled = isToday || already || musicVotesLeft <= 0;
      vote.addEventListener('click', async () => {
        vote.disabled = true;
        setStatus('Votando...');
        let votedId = null;
        try {
          const r = await fetch(`${DEFAULT_SERVER_URL}/musica/voto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: musicDeviceId(), trackId: t.id, name: document.getElementById('display-name').value.trim() || 'Anônimo' }),
          });
          const data = await r.json();
          if (!data.ok) throw new Error(data.error || 'Não deu pra votar');
          rememberVotedTrack(data.day, t);
          applyMusicState(data);
          setStatus(`Votado! "${t.title}" está em ${data.position}º na fila.`, 'ok');
          votedId = t.id;
        } catch (err) {
          setStatus(err.message, 'error');
        }
        renderLeft(votedId);
        renderResults();
      });
      row.append(img, text, listen, vote);
      results.appendChild(row);
    });
  }
  musicResultAudio.addEventListener('pause', () => { if (!musicVoteOverlay.classList.contains('hidden')) renderResults(); });

  document.getElementById('btn-music-vote').addEventListener('click', () => {
    musicVoteOverlay.classList.remove('hidden');
    setStatus('');
    renderLeft();
    renderResults();
    document.getElementById('music-search').focus();
  });
  document.getElementById('btn-music-vote-close').addEventListener('click', closeMusicVote);
  musicVoteOverlay.addEventListener('click', (e) => { if (e.target === musicVoteOverlay) closeMusicVote(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !musicVoteOverlay.classList.contains('hidden')) closeMusicVote(); });
  document.getElementById('music-search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('music-search').value.trim();
    if (q.length < 2) { setStatus('Digite o nome da música', 'error'); return; }
    const btn = document.getElementById('btn-music-search');
    btn.disabled = true;
    setStatus('Buscando...');
    try {
      const r = await fetch(`${DEFAULT_SERVER_URL}/musica/busca?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || 'Não deu pra buscar');
      lastResults = data.results;
      if (lastResults.length) setStatus(''); else setStatus('Nada encontrado - tenta com o nome do artista junto', 'error');
      renderResults();
    } catch (err) {
      setStatus(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-music-retry').addEventListener('click', () => {
    document.getElementById('music-title').textContent = 'Carregando...';
    document.getElementById('btn-music-retry').classList.add('hidden');
    musicFailures = 0;
    loadMusicOfDay();
  });

  loadMusicOfDay({ autoplay: true });
})();
