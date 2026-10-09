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
const DEFAULT_KEYBINDS = { stopShare: 'Control+Alt+S', toggleMute: 'Control+Alt+M', quickShare: 'Control+Alt+Q' };
const DEFAULT_VOLUMES = { join: 1, leave: 1, chat: 1, connection: 1, buttons: 1 };
const DEFAULT_THEME = {
  font: 'inter', scale: 1, color: '#e2231a', mode: 'serio', border: 'arredondada',
  sound: 'ligado', hotkeys: 'ligado', keybinds: { ...DEFAULT_KEYBINDS }, priority: 'nitidez',
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
  const hotkeyOptions = document.querySelectorAll('.hotkeys-option');
  const priorityOptions = document.querySelectorAll('.priority-option');
  const fontOptions = document.querySelectorAll('.font-option');
  const sizeOptions = document.querySelectorAll('.size-option');
  const colorCustom = document.getElementById('color-custom');
  const colorCustomHex = document.getElementById('color-custom-hex');
  const backgroundOptions = document.querySelectorAll('.background-option');
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
    hotkeyOptions.forEach((el) => el.classList.toggle('selected', el.dataset.hotkeys === currentTheme.hotkeys));
    priorityOptions.forEach((el) => el.classList.toggle('selected', el.dataset.priority === currentTheme.priority));
    fontOptions.forEach((el) => el.classList.toggle('selected', el.dataset.font === currentTheme.font));
    sizeOptions.forEach((el) => el.classList.toggle('selected', Number(el.dataset.scale) === currentTheme.scale));
    colorCustom.value = currentTheme.color;
    if (colorCustomHex) colorCustomHex.textContent = currentTheme.color.toUpperCase();
    backgroundOptions.forEach((el) => el.classList.toggle('selected', el.dataset.background === currentTheme.background));
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

  function openSettings() {
    refreshUI();
    selectTab('aparencia');
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
    el.addEventListener('click', () => updateTheme({ mode: el.dataset.mode, modeExplicit: true }));
  });
  borderOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ border: el.dataset.border }));
  });
  soundOptions.forEach((el) => {
    el.addEventListener('click', () => updateTheme({ sound: el.dataset.sound }));
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

setupSettingsPanel();

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

// Link de convite (telinhafix://join?room=X, ver btn-copy-invite mais
// abaixo e main.js) - so preenche o codigo da sala se a pessoa ainda
// estiver na tela de login; clicar num link de convite enquanto ja esta
// numa call nao faz nada sozinho (nao da pra trocar de sala no meio de
// uma chamada sem avisar - mais seguro so ignorar que interromper algo).
window.appLinks.onInviteRoom((roomId) => {
  if (!roomId || !roomScreen.classList.contains('hidden')) return; // ja esta numa sala - ignora
  const input = document.getElementById('room-id');
  input.value = roomId;
  input.focus();
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
// ids de espectadores admin invisiveis (ver onSpectatorJoined/Left abaixo) -
// o ontrack em createPeerConnection confere esse Set antes de criar
// qualquer tile/audio pra nao vazar a presenca deles: mesmo com a direcao
// da negociacao WebRTC correta (so o participante manda, o espectador so
// recebe), o navegador pode disparar ontrack uma vez durante a renegociacao
// (ex: colisao com a criacao do canal de chat) antes de estabilizar - essa
// checagem garante que a UI nunca mostra nada mesmo nesse caso.
const spectatorPeerIds = new Set();

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
  const muteFactor = masterMuted ? 0 : 1;
  entry.gainNode.gain.value = (suppressForEcho ? 0 : entry.sliderValue / 100) * hiddenFactor * muteFactor;
}

// So pra deixar claro NA TELA o motivo do mixer "nao fazer nada" enquanto
// voce compartilha com audio do sistema (ver suppressForEcho em applyGain) -
// sem isso parece um controle quebrado, mexe e o volume de quem voce ta
// ouvindo nao muda nadinha.
function updateVolumeControlsSuppressedState() {
  const suppressed = !!localStream && shareMode !== 'camera';
  document.querySelectorAll('.volume-control').forEach((el) => {
    el.classList.toggle('volume-control-suppressed', suppressed);
    el.title = suppressed
      ? 'Desativado enquanto você compartilha com áudio do sistema (evita eco pra quem assiste)'
      : '';
  });
}

function refreshAllGainsForSharingState() {
  for (const peerId of remoteGainNodes.keys()) applyGain(peerId);
  updateVolumeControlsSuppressedState();
}

function updateSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = ((Number(slider.value) - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, var(--red-bright) 0%, var(--red-bright) ${pct}%, rgba(255, 255, 255, 0.25) ${pct}%, rgba(255, 255, 255, 0.25) 100%)`;
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
  // Telas extras nunca tem audio (so a principal carrega som) - sem slider
  // nelas, pra nao mostrar um controle que nao faz nada.
  if (!isSelf && hasAudio) {
    const volumeRow = document.createElement('div');
    volumeRow.className = 'volume-control';

    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'volume-icon';
    icon.innerHTML = ICONS.speakerOn;
    icon.title = 'Mutar';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '200';
    slider.value = '100';
    slider.title = 'Ate 200% - passar de 100% amplifica alem do volume original';
    slider.className = 'volume-slider';
    updateSliderFill(slider);

    // Volume lembrado de antes de mutar pelo icone, pra restaurar o mesmo
    // nivel ao desmutar (em vez de sempre voltar pra 100%).
    let lastVolume = 100;

    function setVolume(pct) {
      slider.value = String(pct);
      const entry = remoteGainNodes.get(peerId);
      if (entry) {
        entry.sliderValue = pct;
        applyGain(peerId);
      }
      const muted = pct === 0;
      icon.innerHTML = muted ? ICONS.speakerMuted : ICONS.speakerOn;
      icon.title = muted ? 'Desmutar' : 'Mutar';
      updateSliderFill(slider);
    }

    slider.addEventListener('input', () => {
      const pct = Number(slider.value);
      if (pct > 0) lastVolume = pct;
      setVolume(pct);
    });
    slider.addEventListener('click', (e) => e.stopPropagation());

    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      const isMuted = Number(slider.value) === 0;
      setVolume(isMuted ? (lastVolume || 100) : 0);
    });

    volumeRow.appendChild(icon);
    volumeRow.appendChild(slider);
    tile.appendChild(volumeRow);
    // Aplica o estado "suprimido" direto nesse controle, sem depender de
    // document.querySelectorAll (ver updateVolumeControlsSuppressedState) -
    // a tile ainda nao foi inserida na arvore do documento nesse ponto
    // (isso so acontece mais abaixo, em videoGrid.appendChild), entao uma
    // busca no document nao encontraria esse elemento ainda.
    const suppressedNow = !!localStream && shareMode !== 'camera';
    volumeRow.classList.toggle('volume-control-suppressed', suppressedNow);
    volumeRow.title = suppressedNow
      ? 'Desativado enquanto você compartilha com áudio do sistema (evita eco pra quem assiste)'
      : '';
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

  if (!self) {
    playChatSound();
    if (!chatPanelOpen) {
      chatUnreadCount++;
      updateChatUnreadBadge();
    }
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

// --- Minijogo "Codigo Secreto" (Codenames) --------------------------------
// Estado de verdade mora no servidor, por sala (ver server/index.js) - os
// jogadores sao sempre quem estiver na mesma sala/codigo. Aqui so renderiza
// o que chega via window.game.onState() e manda as acoes do jogador.

let gameState = null;
let gameOverlayOpen = false;
let mySecretMap = null;
let mySecretMapRound = -1;
// Elementos das 25 cartas, mantidos entre renders (ver renderGameBoard) -
// reaproveitar o mesmo DOM em vez de recriar tudo a cada estado novo e o
// que permite a transicao CSS do flip tocar de verdade quando uma carta
// passa de "escondida" pra "revelada".
let boardCellEls = [];
let boardCellRound = -1;
let gameTickInterval = null;
// 'picker' | 'codenames' | 'stop' - qual tela o painel 🎮 ta mostrando.
let currentGameView = 'picker';

const GAME_TEAM_LABEL = { red: 'Vermelha', blue: 'Azul', green: 'Verde' };
const GAME_MODE_LABEL = { livre: 'Livre', '2x2': '2x2', '3x3': '3x3', ffa3: '3x3 Todos contra todos' };
const GAME_TITLES = { picker: 'Minijogos', codenames: 'Codenames', stop: 'Stop / Adedonha', sketch: 'Sketch do PC' };

function showGamePicker() {
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

function myGameRole() {
  if (!gameState || !selfId) return null;
  for (const team of Object.keys(gameState.teams)) {
    const t = gameState.teams[team];
    if (t.spymaster && t.spymaster.id === selfId) return { team, role: 'spymaster' };
    if (t.agents.some((a) => a.id === selfId)) return { team, role: 'agent' };
  }
  return null;
}

function setGameError(msg) {
  const el = document.getElementById('game-lobby-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

async function refreshGameState() {
  try {
    gameState = await window.game.getState();
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
  gameOverlayOpen = false;
  document.getElementById('game-overlay').classList.add('hidden');
  clearStopTimerInterval();
  clearGameTimerInterval();
}

function ensureSecretMap() {
  const role = myGameRole();
  if (!role || role.role !== 'spymaster') return;
  if (!gameState || (gameState.status !== 'playing' && gameState.status !== 'over')) return;
  if (mySecretMapRound === gameState.round && mySecretMap) return;
  window.game.getSecretMap().then((res) => {
    mySecretMap = res.map;
    mySecretMapRound = res.round;
    renderGame();
  }).catch((err) => console.error('Falha ao buscar mapa secreto:', err));
}

function renderGame() {
  if (!gameState || !gameOverlayOpen || currentGameView !== 'codenames') return;
  const playing = gameState.status === 'playing' || gameState.status === 'over';
  document.getElementById('game-lobby-view').classList.toggle('hidden', playing);
  document.getElementById('game-board-view').classList.toggle('hidden', !playing);

  if (!playing) {
    renderGameLobby();
  } else {
    ensureSecretMap();
    renderGameBoard();
  }
}

const GAME_MODE_MAX_AGENTS = { livre: Infinity, '2x2': 1, '3x3': 2, ffa3: 1 };

function renderGameLobby() {
  const role = myGameRole();
  const activeTeams = Object.keys(gameState.teams);
  const maxAgents = GAME_MODE_MAX_AGENTS[gameState.mode] ?? Infinity;

  document.querySelectorAll('.game-mode-option[data-mode]').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.mode === gameState.mode);
  });
  document.querySelectorAll('.game-mode-option[data-answer-time]').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.answerTime === gameState.answerTimeMode);
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

  document.getElementById('btn-game-leave-role').classList.toggle('hidden', !role);

  const bothReady = activeTeams.every((team) => gameState.teams[team].spymaster && gameState.teams[team].agents.length >= 1);
  document.getElementById('btn-game-start').disabled = !bothReady;
}

// Monta as 25 cartas do zero (fundo + verso, ver CSS .game-cell-inner) -
// chamado so quando comeca uma partida/rodada nova, nunca a cada
// atualizacao de estado (isso destruiria o DOM e quebraria a animacao do
// flip - ver renderGameBoard).
function buildBoardCells(boardEl) {
  boardEl.innerHTML = '';
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

    const back = document.createElement('div');
    back.className = 'game-cell-face game-cell-back';
    const watermark = document.createElement('div');
    watermark.className = 'game-cell-watermark';
    back.appendChild(watermark);
    const backWord = document.createElement('span');
    backWord.className = 'game-cell-word';
    backWord.textContent = cell.word;
    back.appendChild(backWord);

    inner.appendChild(front);
    inner.appendChild(back);
    div.appendChild(inner);
    boardEl.appendChild(div);

    div.addEventListener('click', () => {
      if (!div.classList.contains('game-cell-clickable')) return;
      window.game.revealWord(i).catch((err) => console.error('Falha ao revelar palavra:', err));
    });

    return { root: div, inner, front, back, watermark };
  });
}

// Contagem regressiva do "tempo de resposta" (ver seletor Especialista/
// Sargento/Novato/Iniciante no lobby) - so decorativo no cliente, quem
// realmente derruba a vez quando estoura e o servidor (ver game-give-clue).
function updateGameAnswerTimerDisplay() {
  const el = document.getElementById('game-answer-timer');
  if (!el || !gameState) return;
  if (gameState.status !== 'playing' || gameState.phase !== 'guess' || !gameState.answerTimeMs || !gameState.clueGivenAt) {
    el.classList.add('hidden');
    return;
  }
  const remainingMs = Math.max(0, gameState.answerTimeMs - (Date.now() - gameState.clueGivenAt));
  const seconds = Math.ceil(remainingMs / 1000);
  el.textContent = `${seconds}s pra responder`;
  el.classList.toggle('game-answer-timer-urgent', seconds <= 5);
  el.classList.remove('hidden');
}

function startGameTimerInterval() {
  if (gameTickInterval) return;
  updateGameAnswerTimerDisplay();
  gameTickInterval = setInterval(updateGameAnswerTimerDisplay, 250);
}

function clearGameTimerInterval() {
  if (gameTickInterval) { clearInterval(gameTickInterval); gameTickInterval = null; }
}

function renderGameBoard() {
  const role = myGameRole();
  const boardEl = document.getElementById('game-board');

  if (gameState.round !== boardCellRound || boardCellEls.length !== gameState.board.length) {
    buildBoardCells(boardEl);
    boardCellRound = gameState.round;
  }

  gameState.board.forEach((cell, i) => {
    const { root, inner, front, back, watermark } = boardCellEls[i];

    inner.classList.toggle('flipped', cell.revealed);

    front.className = 'game-cell-face game-cell-front';
    if (!cell.revealed && role && role.role === 'spymaster' && mySecretMap && mySecretMapRound === gameState.round) {
      front.classList.add(`game-cell-spy-${mySecretMap[i]}`);
    }

    if (cell.revealed) {
      back.className = `game-cell-face game-cell-back game-cell-back-${cell.team}`;
      watermark.innerHTML = CARD_WATERMARKS[cell.team] || '';
    }

    const clickable = gameState.status === 'playing' && gameState.phase === 'guess'
      && role && role.role === 'agent' && role.team === gameState.currentTeam && !cell.revealed;
    root.classList.toggle('game-cell-clickable', !!clickable);
  });

  if (gameState.status === 'playing' && gameState.phase === 'guess' && gameState.answerTimeMs) {
    startGameTimerInterval();
  } else {
    clearGameTimerInterval();
    updateGameAnswerTimerDisplay();
  }

  const teamLabel = GAME_TEAM_LABEL[gameState.currentTeam] || '';
  const turnEl = document.getElementById('game-turn-indicator');
  if (gameState.status === 'over') {
    turnEl.textContent = '';
  } else if (gameState.phase === 'clue') {
    turnEl.textContent = `Vez da equipe ${teamLabel} — aguardando pista do Mestre-Espião`;
  } else {
    turnEl.textContent = `Vez da equipe ${teamLabel} — escolham uma palavra`;
  }

  document.getElementById('game-remaining').textContent = Object.keys(gameState.teams)
    .map((team) => {
      const eliminatedTag = gameState.eliminated?.includes(team) ? ' (eliminada)' : '';
      return `${GAME_TEAM_LABEL[team]}: ${gameState.remaining[team]} restantes${eliminatedTag}`;
    })
    .join(' · ');

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

  const showEndTurn = gameState.status === 'playing' && gameState.phase === 'guess'
    && role && role.team === gameState.currentTeam;
  document.getElementById('btn-game-end-turn').classList.toggle('hidden', !showEndTurn);

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
  boardCellEls = [];
  boardCellRound = -1;
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
    if (spectatorPeerIds.has(peerId)) return;
    const name = peerNames.get(peerId) || 'Participante';
    const stream = event.streams[0];

    const video = getOrCreateVideoTile(peerId, name);
    video.srcObject = stream;
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
  const link = `telinhafix://join?room=${encodeURIComponent(roomId)}`;
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

document.querySelectorAll('.game-mode-option[data-answer-time]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (gameState && gameState.answerTimeMode === btn.dataset.answerTime) return;
    setGameError('');
    window.game.setAnswerTime(btn.dataset.answerTime).catch((err) => setGameError(err.message));
  });
});

document.querySelectorAll('.game-pick-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setGameError('');
    window.game.setRole(btn.dataset.team, btn.dataset.role).catch((err) => setGameError(err.message));
  });
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
  window.game.giveClue(wordInput.value, number)
    .then(() => { wordInput.value = ''; })
    .catch((err) => console.error('Falha ao dar a pista:', err));
});

document.getElementById('btn-game-end-turn').addEventListener('click', () => {
  window.game.endTurn().catch((err) => console.error('Falha ao passar a vez:', err));
});

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

document.getElementById('build-version').textContent = `build (${window.appInfo.version})`;

btnJoin.addEventListener('click', async () => {
  setLoginError('');
  const serverUrl = DEFAULT_SERVER_URL;
  const password = document.getElementById('server-password').value;
  const rawName = document.getElementById('display-name').value.trim();
  const name = rawName || 'Anonimo';
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
    saveWorkingDisplayName(rawName);
    const { selfId: id, peers: existingPeers } = await window.rtc.joinRoom(roomId, name);
    selfId = id;
    saveRoomToHistory(roomId);

    window.rtc.onSignal(handleSignal);

    window.rtc.onPeerJoined(({ id: peerId, name: peerName }) => {
      peerNames.set(peerId, peerName);
      addParticipantRow(peerId, peerName, false);
      createPeerConnection(peerId);
      updateSelfAudienceLabel();
      addChatSystemMessage(`${peerName} entrou na sala`);
      playJoinSound();
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
      playLeaveSound();
    });

    window.rtc.onDisconnected(() => {
      setLoginError('Conexão com o servidor perdida.');
    });

    window.game.onState((newState) => {
      gameState = newState;
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
