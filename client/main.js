const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, dialog, globalShortcut, screen, clipboard, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

// Ja tentamos desativar o WGC (Windows Graphics Capture, o backend padrao
// do Chromium no Windows) pra tentar resolver o cursor "fantasma" na
// captura - NAO funcionou (o Chromium continuou desenhando o cursor de
// qualquer jeito, nao importa o backend; ver historico do commit 79b7138),
// entao a correcao de verdade virou o helper nativo separado usado pelo
// botao "Compartilhar sem cursor (beta)". Manter o WGC desativado sem
// nenhum beneficio real so trazia um efeito colateral ruim: a Desktop
// Duplication API (DXGI), pra onde o Chromium caia sem o WGC, trava num
// frame parado quando a pessoa esta com um jogo em tela cheia EXCLUSIVA
// (osu! e um exemplo classico) ate o jogo sair desse modo - o WGC lida
// com isso bem melhor, entao deixamos ele ligado (padrao do Chromium) pro
// compartilhamento normal de novo.

let audioHelperProcess = null;
let audioLeftover = Buffer.alloc(0);

function getAudioHelperPath() {
  const exeName = 'TelinhaFixAudioHelper.exe';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native', exeName);
  }
  return path.join(__dirname, 'native', exeName);
}

// Lista processos com janela visivel (proxy razoavel pra "programas abertos
// que a pessoa reconheceria"), pro seletor de "audio so de um programa".
function listRunningApps() {
  return new Promise((resolve) => {
    const cmd =
      'powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne \'\' } | ' +
      'Select-Object -Property ProcessName,MainWindowTitle -Unique | ConvertTo-Json -Compress"';
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout || !stdout.trim()) {
        resolve([]);
        return;
      }
      try {
        let parsed = JSON.parse(stdout);
        if (!Array.isArray(parsed)) parsed = [parsed];
        const seen = new Set();
        const apps = [];
        for (const p of parsed) {
          if (!p.ProcessName || seen.has(p.ProcessName)) continue;
          seen.add(p.ProcessName);
          apps.push({ name: p.ProcessName, title: p.MainWindowTitle || p.ProcessName });
        }
        apps.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
        resolve(apps);
      } catch (e) {
        console.error('Falha ao interpretar lista de processos:', e);
        resolve([]);
      }
    });
  });
}

// Avisa o renderer se a captura de audio do sistema pode estar pegando o som
// que o proprio TelinhaFix toca (o audio de quem voce esta ouvindo) - nesse
// caso ele precisa mutar os outros enquanto voce compartilha, senao volta
// eco pra eles. Com o helper novo (--self-pid) o TelinhaFix fica de fora da
// captura e o helper avisa "ECHO_SAFE" - ai ninguem precisa ser mutado.
function sendAudioEchoRisk(win, risk) {
  if (win && !win.isDestroyed()) win.webContents.send('audio-echo-risk', risk);
}

function startAudioCapture(win, audioConfig) {
  if (audioHelperProcess) return;

  const config = audioConfig || { mode: 'exclude', target: 'Discord' };
  const helperArgs = config.mode === 'system' ? ['system'] : [config.mode, config.target];
  // So "include" (audio de UM programa) nao pega o som do TelinhaFix - nos
  // outros modos, ate o helper confirmar ECHO_SAFE, assume que ha risco.
  const capturesWholeSystem = config.mode !== 'include';
  if (capturesWholeSystem) helperArgs.push('--self-pid', String(process.pid));
  sendAudioEchoRisk(win, capturesWholeSystem);

  audioLeftover = Buffer.alloc(0);
  audioHelperProcess = spawn(getAudioHelperPath(), helperArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  const thisHelper = audioHelperProcess;

  // Float32 estereo: 2 canais * 4 bytes = 8 bytes por frame. Os pedacos que
  // chegam do stdout nao respeitam esse alinhamento, entao remontamos aqui.
  const FRAME_SIZE = 8;
  audioHelperProcess.stdout.on('data', (chunk) => {
    const data = Buffer.concat([audioLeftover, chunk]);
    const usableLength = data.length - (data.length % FRAME_SIZE);
    audioLeftover = Buffer.from(data.subarray(usableLength));
    const aligned = data.subarray(0, usableLength);
    if (aligned.length > 0 && win && !win.isDestroyed()) {
      win.webContents.send('telinhafix-audio-chunk', aligned);
    }
  });

  audioHelperProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    console.log('[audio-helper]', text.trim());
    if (/^ECHO_SAFE\s*$/m.test(text) && audioHelperProcess === thisHelper) sendAudioEchoRisk(win, false);
  });

  audioHelperProcess.on('error', (err) => {
    console.error('Falha ao iniciar o helper de audio:', err);
    if (audioHelperProcess === thisHelper) {
      audioHelperProcess = null;
      sendAudioEchoRisk(win, false);
    }
  });

  audioHelperProcess.on('exit', () => {
    if (audioHelperProcess === thisHelper) {
      audioHelperProcess = null;
      sendAudioEchoRisk(win, false);
    }
  });
}

function stopAudioCapture(win) {
  if (audioHelperProcess) {
    audioHelperProcess.kill();
    audioHelperProcess = null;
  }
  sendAudioEchoRisk(win, false);
}

// --- Captura de tela nativa sem cursor (modo "beta") ----------------------
//
// A captura padrao do Electron (desktopCapturer/getDisplayMedia) sempre
// compoe o cursor do sistema por cima do frame capturado, mesmo quando o
// jogo/app escondeu ele de verdade na tela (comum em jogos com mira via
// raw input) - ja tentamos desativar o WGC (ver comentario no topo do
// arquivo) achando que resolveria isso, mas nao resolveu: o Chromium
// sempre desenha esse cursor "fantasma" nao importa o backend. A Desktop
// Duplication API (DXGI) por baixo, por outro lado, NUNCA inclui o cursor
// no frame quando usada diretamente (como aqui) - ele
// vem como metadado separado (forma/posicao) e so aparece se o app que
// capturou desenhar ele por cima manualmente. Esse helper nativo usa a
// DXGI diretamente e nunca desenha o cursor, entao o problema nao existe
// aqui por construcao.
let screenHelperProcess = null;
let screenFrameLeftover = Buffer.alloc(0);

function getScreenHelperPath() {
  const exeName = 'TelinhaFixScreenHelper.exe';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native', exeName);
  }
  return path.join(__dirname, 'native', exeName);
}

function listNativeScreens() {
  return new Promise((resolve) => {
    const proc = spawn(getScreenHelperPath(), ['list'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (chunk) => { out += chunk.toString(); });
    proc.stderr.on('data', (chunk) => console.log('[screen-helper:list]', chunk.toString().trim()));
    proc.on('error', (err) => {
      console.error('Falha ao listar monitores (helper nativo):', err);
      resolve([]);
    });
    proc.on('exit', () => {
      try {
        resolve(JSON.parse(out.trim() || '[]'));
      } catch (err) {
        console.error('Falha ao interpretar lista de monitores:', err);
        resolve([]);
      }
    });
  });
}

function startNativeScreenCapture(win, { adapterIndex, outputIndex, fps, quality, maxWidth }) {
  stopNativeScreenCapture();

  screenFrameLeftover = Buffer.alloc(0);
  screenHelperProcess = spawn(
    getScreenHelperPath(),
    ['capture', String(adapterIndex), String(outputIndex), String(fps), String(quality), String(maxWidth)],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // Protocolo do helper: [4 bytes big-endian = tamanho][bytes JPEG], repetido.
  screenHelperProcess.stdout.on('data', (chunk) => {
    screenFrameLeftover = Buffer.concat([screenFrameLeftover, chunk]);
    while (true) {
      if (screenFrameLeftover.length < 4) break;
      const len = screenFrameLeftover.readUInt32BE(0);
      if (screenFrameLeftover.length < 4 + len) break;
      const frame = screenFrameLeftover.subarray(4, 4 + len);
      if (win && !win.isDestroyed()) {
        win.webContents.send('native-screen-frame', frame);
      }
      screenFrameLeftover = screenFrameLeftover.subarray(4 + len);
    }
  });

  screenHelperProcess.stderr.on('data', (chunk) => {
    console.log('[screen-helper]', chunk.toString().trim());
  });

  screenHelperProcess.on('error', (err) => {
    console.error('Falha ao iniciar o helper de captura de tela:', err);
    screenHelperProcess = null;
  });

  screenHelperProcess.on('exit', () => {
    screenHelperProcess = null;
  });
}

function stopNativeScreenCapture() {
  if (screenHelperProcess) {
    screenHelperProcess.kill();
    screenHelperProcess = null;
  }
}

// Qualidades disponiveis no seletor. maxBitrate em bits/s - usado depois
// pra configurar o RTCRtpSender de cada conexao (ver renderer.js).
// Bitrates mais altos que o "recomendado" generico de streaming de video,
// de proposito: conteudo de TELA (texto, UI, cursor se movendo) fica
// borrado/blocado com bitrate baixo de um jeito muito mais perceptivel do
// que video comum - isso e so um teto (RTCRtpSender ainda reduz sozinho se
// a conexao real nao aguentar), entao subir isso nao piora quem tem
// internet fraca, so permite mais qualidade pra quem tem banda de sobra.
const QUALITY_PRESETS = {
  '720p30': { width: 1280, height: 720, frameRate: 30, maxBitrate: 3_500_000 },
  '720p60': { width: 1280, height: 720, frameRate: 60, maxBitrate: 4_500_000 },
  '720p120': { width: 1280, height: 720, frameRate: 120, maxBitrate: 6_000_000 },
  '1080p30': { width: 1920, height: 1080, frameRate: 30, maxBitrate: 6_000_000 },
  '1080p60': { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_500_000 },
  '1080p120': { width: 1920, height: 1080, frameRate: 120, maxBitrate: 11_000_000 },
  '1440p30': { width: 2560, height: 1440, frameRate: 30, maxBitrate: 9_000_000 },
  '1440p60': { width: 2560, height: 1440, frameRate: 60, maxBitrate: 12_000_000 },
  '2160p30': { width: 3840, height: 2160, frameRate: 30, maxBitrate: 16_000_000 },
  '2160p60': { width: 3840, height: 2160, frameRate: 60, maxBitrate: 25_000_000 },
};

// Preset fixo usado quando a pessoa compartilha so a webcam (sem tela) -
// nao passa pelo seletor de qualidade, entao nao faz sentido oferecer
// 4K/120fps pra uma fonte que normalmente nem suporta isso.
const CAMERA_QUALITY_PRESET = { width: 1280, height: 720, frameRate: 30, maxBitrate: 3_000_000 };

// Qualidade escolhida na ultima vez que o seletor foi usado. O renderer
// busca isso via IPC (get-last-picked-quality) depois que o getDisplayMedia
// resolve, pra aplicar via track.applyConstraints + RTCRtpSender.
let lastPickedQuality = QUALITY_PRESETS['1080p30'];

// Configuracao de audio escolhida no seletor: { mode: 'exclude'|'include'|'system', target }
let lastPickedAudioConfig = { mode: 'exclude', target: 'Discord' };

// Abre uma janelinha propria com miniaturas de cada monitor/janela (ou
// programa especifico) pra escolher o que compartilhar, junto com a
// qualidade (resolucao + fps). O seletor nativo do Windows (useSystemPicker)
// as vezes nao esta disponivel e cai num fallback silencioso sem perguntar
// nada - isso aqui garante que sempre aparece uma escolha.
function pickScreenSource(parentWin) {
  return new Promise(async (resolve) => {
    let sources;
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
      });
    } catch (err) {
      console.error('Falha ao listar telas/janelas:', err);
      resolve(null);
      return;
    }

    if (sources.length === 0) {
      resolve(null);
      return;
    }

    const pickerWin = new BrowserWindow({
      width: 820,
      height: 700,
      parent: parentWin || undefined,
      modal: !!parentWin,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title: 'Escolha o que compartilhar - TelinhaFix',
      backgroundColor: '#060607',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'picker', 'picker-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    pickerWin.once('ready-to-show', () => pickerWin.show());

    let settled = false;
    const finish = (source) => {
      if (settled) return;
      settled = true;
      resolve(source);
    };

    const onChoice = (event, { sourceId, quality, audioMode, audioTarget }) => {
      lastPickedQuality = QUALITY_PRESETS[quality] || QUALITY_PRESETS['1080p30'];
      lastPickedAudioConfig =
        audioMode === 'include' || audioMode === 'system'
          ? { mode: audioMode, target: audioTarget }
          : { mode: 'exclude', target: 'Discord' };
      finish(sources.find((s) => s.id === sourceId) || sources[0]);
      if (!pickerWin.isDestroyed()) pickerWin.close();
    };

    ipcMain.once('screen-picker:choice', onChoice);

    pickerWin.on('closed', () => {
      ipcMain.removeListener('screen-picker:choice', onChoice);
      finish(null);
    });

    pickerWin.webContents.once('did-finish-load', () => {
      const payload = sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.id.startsWith('screen:') ? 'screen' : 'window',
        thumbnail: s.thumbnail.toDataURL(),
      }));
      pickerWin.webContents.send('screen-picker:sources', payload);
    });

    pickerWin.loadFile(path.join(__dirname, 'picker', 'picker.html'));
  });
}

// Acha a fonte do desktopCapturer que corresponde ao monitor PRINCIPAL (o
// que o Windows tem marcado como principal nas configuracoes de tela), pra
// usar no "compartilhar com preset rapido" (atalho de teclado) - sem abrir
// o seletor. display_id vem do desktopCapturer desde o Electron 11 e bate
// com o id que o modulo screen usa pros monitores.
async function getPrimaryScreenSource() {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
  if (sources.length === 0) return null;
  const primaryId = String(screen.getPrimaryDisplay().id);
  return sources.find((s) => s.display_id === primaryId) || sources[0];
}

let mainWindow = null;

// --- Link de convite (telinhafix://join?room=X) ---------------------------
// Protocolo customizado registrado no Windows na instalacao (ver "protocols"
// no package.json) - clicar num link assim abre o app (ou foca o que ja
// esta aberto, via single-instance lock abaixo) e preenche o codigo da sala
// sozinho, sem precisar copiar/colar ou ditar o codigo por audio.
const INVITE_PROTOCOL = 'telinhafix';

function extractInviteRoomFromArgv(argv) {
  const urlArg = argv.find((arg) => arg.startsWith(`${INVITE_PROTOCOL}://`));
  if (!urlArg) return null;
  try {
    return new URL(urlArg).searchParams.get('room') || null;
  } catch (err) {
    return null;
  }
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function sendInviteRoomToRenderer(roomId) {
  if (!roomId || !mainWindow) return;
  focusMainWindow();
  mainWindow.webContents.send('invite-room', { roomId });
}

app.setAsDefaultProtocolClient(INVITE_PROTOCOL);

// Sem isso o Windows nao mostra as notificacoes do app (precisa bater com o
// appId do atalho que o instalador cria).
if (process.platform === 'win32') app.setAppUserModelId('com.telinhafix.app');

// --- Apontar na tela: seta por cima do monitor transmitido -----------------
// Quem assiste faz Alt + clique na sua transmissao de tela e a seta aparece
// por cima do monitor que voce esta compartilhando - numa janela
// transparente, sempre na frente, que nao recebe clique e fica FORA da
// propria captura (setContentProtection), senao quem assiste veria a seta
// duas vezes. So da pra saber o monitor quando a transmissao e de um monitor
// inteiro; compartilhando uma janela so, a seta aparece so no app de quem
// assiste. Jogo em tela cheia exclusiva pode ficar por cima da camada.
let pingTargetBounds = null; // area (em DIP) do monitor sendo transmitido
let pingOverlayWin = null;
let pingOverlayHideTimer = null;
let suppressNextAltUp = false;

function setPingTargetDisplayId(displayId) {
  const display = screen.getAllDisplays().find((d) => String(d.id) === String(displayId));
  pingTargetBounds = display ? display.bounds : null;
}
function setPingTargetPhysicalRect(rect) {
  if (!rect || !(rect.width > 0 && rect.height > 0)) { pingTargetBounds = null; return; }
  try {
    const dip = process.platform === 'win32' ? screen.screenToDipRect(null, { x: rect.left, y: rect.top, width: rect.width, height: rect.height }) : { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    pingTargetBounds = screen.getDisplayMatching(dip).bounds;
  } catch {
    pingTargetBounds = null;
  }
}
function clearPingOverlay() {
  pingTargetBounds = null;
  clearTimeout(pingOverlayHideTimer);
  if (pingOverlayWin && !pingOverlayWin.isDestroyed()) pingOverlayWin.destroy();
  pingOverlayWin = null;
}
function showPingOverlay(ping) {
  if (!pingTargetBounds || !ping) return;
  const x = Number(ping.x);
  const y = Number(ping.y);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return;
  const color = /^(#[0-9a-f]{6}|hsl\([0-9., %]+\))$/i.test(String(ping.color || '')) ? ping.color : '#e2231a';
  const payload = JSON.stringify({ x, y, name: String(ping.name || '').slice(0, 40), color });
  const show = () => {
    pingOverlayWin.setBounds(pingTargetBounds);
    pingOverlayWin.showInactive();
    pingOverlayWin.setAlwaysOnTop(true, 'screen-saver');
    // fora da captura: so pega com a janela JA visivel (testado - ligar antes
    // de mostrar nao funciona), entao liga de novo a cada vez que aparece
    pingOverlayWin.setContentProtection(true);
    pingOverlayWin.webContents.executeJavaScript(`window.showPing(${payload})`).catch(() => {});
    clearTimeout(pingOverlayHideTimer);
    pingOverlayHideTimer = setTimeout(() => { if (pingOverlayWin && !pingOverlayWin.isDestroyed()) pingOverlayWin.hide(); }, 4500);
  };
  if (pingOverlayWin && !pingOverlayWin.isDestroyed()) { show(); return; }
  pingOverlayWin = new BrowserWindow({
    ...pingTargetBounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  pingOverlayWin.setIgnoreMouseEvents(true);
  pingOverlayWin.webContents.once('did-finish-load', show);
  pingOverlayWin.loadFile(path.join(__dirname, 'renderer', 'ping-overlay.html'));
}

// Notificacao do Windows "Fulano comecou a transmitir" (o renderer decide
// quando - ver notifyShareStarted). So aparece se a janela NAO estiver na
// frente da pessoa; clicar nela traz o app pra frente.
function showShareNotification({ title, body } = {}) {
  if (!mainWindow || !Notification.isSupported()) return 'unsupported';
  if (mainWindow.isFocused() && mainWindow.isVisible() && !mainWindow.isMinimized()) return 'focused';
  // testes automaticos: decide tudo mas nao mostra nada na tela de ninguem
  if (process.env.TELINHAFIX_TEST_DRYRUN) return 'dry-run';
  const n = new Notification({
    title: String(title || 'TelinhaFix').slice(0, 120),
    body: String(body || '').slice(0, 200),
    icon: nativeImage.createFromPath(path.join(__dirname, 'renderer', 'assets', 'icon.ico')),
    silent: false,
  });
  n.on('click', () => focusMainWindow());
  n.show();
  return 'shown';
}

// So uma janela do TelinhaFix por vez - clicar num link de convite com o
// app ja aberto deve focar a janela existente (e preencher a sala nela),
// nunca abrir uma segunda instancia do zero.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const roomId = extractInviteRoomFromArgv(argv);
    if (roomId) sendInviteRoomToRenderer(roomId);
    else focusMainWindow();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'TelinhaFix',
    icon: path.join(__dirname, 'renderer', 'assets', 'logo.png'),
    autoHideMenuBar: true,
    backgroundColor: '#060607',
    // A janela so aparece quando o conteudo ja terminou de carregar/pintar -
    // sem isso, o Electro mostra a janela (branca, por padrao) antes do
    // HTML/CSS estarem prontos, dando a impressao de "tela branca travada".
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Sem isso, o Chromium desacelera timers/requestAnimationFrame quando
      // a janela perde o foco - o que acontece o tempo todo ao compartilhar
      // tela (voce fica olhando pra outro programa). Isso travava/dava
      // ghosting na composicao da webcam (que roda via requestAnimationFrame).
      backgroundThrottling: false,
    },
  });

  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  // Alt + clique (apontar na tela): soltar o Alt depois do clique nao abre
  // o menu da janela (autoHideMenuBar mostra o menu com Alt sozinho).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Alt' && input.type === 'keyUp' && suppressNextAltUp) {
      suppressNextAltUp = false;
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // O botao de "tela cheia" numa tile chama Element.requestFullscreen() no
  // renderer - isso so muda o estado interno do DOM (document.fullscreenElement),
  // o Electron NAO coloca a janela de verdade em tela cheia sozinho por
  // padrao. Sem esse par de listeners, o clique parecia "nao fazer nada".
  win.webContents.on('enter-html-full-screen', () => {
    win.setFullScreen(true);
  });
  win.webContents.on('leave-html-full-screen', () => {
    win.setFullScreen(false);
  });

  // Libera so o que o app usa: camera (getUserMedia, bolinha da webcam) e
  // tela cheia (botao de tela cheia / 2 cliques numa transmissao - no
  // Electron isso tambem passa por aqui; negando, o requestFullscreen()
  // ficava esperando pra sempre e o botao nao fazia nada).
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'fullscreen');
  });

  // Trata os pedidos de navigator.mediaDevices.getDisplayMedia() feitos no
  // renderer, abrindo o seletor proprio (pickScreenSource) pra escolher o
  // monitor. O audio do sistema NAO vem por aqui - o renderer pede so video
  // (audio: false) porque o audio real vem do helper nativo
  // (TelinhaFixAudioHelper), que captura o sistema todo excluindo o
  // Discord. Se por algum motivo o renderer pedir audio por esse caminho
  // mesmo assim, ainda respondemos com o loopback padrao como fallback.
  // "Compartilhar com preset rapido" (atalho de teclado, ver quickShareRequested
  // abaixo) pula o seletor inteiro: pega o monitor principal direto e ja
  // define qualidade 1080p60 + audio do sistema todo exceto Discord, do
  // jeito que a pessoa pediu pra esse atalho.
  let quickShareRequested = false;
  ipcMain.handle('quick-share-screen-request', () => {
    quickShareRequested = true;
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      let source;
      if (quickShareRequested) {
        quickShareRequested = false;
        source = await getPrimaryScreenSource();
        lastPickedQuality = QUALITY_PRESETS['1080p60'];
        lastPickedAudioConfig = { mode: 'exclude', target: 'Discord' };
      } else {
        source = await pickScreenSource(win);
      }
      if (!source) {
        callback({});
        return;
      }
      // monitor inteiro: guarda qual e (pra seta do "apontar na tela")
      if (String(source.id).startsWith('screen:')) setPingTargetDisplayId(source.display_id);
      else pingTargetBounds = null;
      const response = { video: source };
      if (request.audioRequested) response.audio = 'loopback';
      callback(response);
    } catch (err) {
      console.error('Falha ao capturar tela:', err);
      callback({});
    }
  });

  ipcMain.handle('audio-capture-start', (event) => {
    startAudioCapture(BrowserWindow.fromWebContents(event.sender), lastPickedAudioConfig);
  });

  ipcMain.handle('audio-capture-stop', (event) => {
    stopAudioCapture(BrowserWindow.fromWebContents(event.sender));
  });

  ipcMain.handle('native-screen-list', () => listNativeScreens());

  ipcMain.handle('native-screen-start', (event, opts) => {
    setPingTargetPhysicalRect(opts && opts.bounds);
    startNativeScreenCapture(BrowserWindow.fromWebContents(event.sender), opts);
  });

  ipcMain.handle('native-screen-stop', () => {
    stopNativeScreenCapture();
  });

  // Deixa o seletor do modo "sem cursor" escolher o audio tambem, em vez de
  // sempre reaproveitar silenciosamente a ultima escolha feita no seletor
  // normal (que passa por pickScreenSource/picker.html, um fluxo que esse
  // modo nao usa).
  ipcMain.handle('native-screen-set-audio', (event, config) => {
    lastPickedAudioConfig =
      config && (config.mode === 'include' || config.mode === 'system')
        ? { mode: config.mode, target: config.target }
        : { mode: 'exclude', target: 'Discord' };
  });

  ipcMain.handle('get-last-picked-quality', () => lastPickedQuality);
  ipcMain.handle('get-camera-quality', () => CAMERA_QUALITY_PRESET);
  ipcMain.handle('get-last-picked-audio-config', () => lastPickedAudioConfig);
  ipcMain.handle('list-running-apps', () => listRunningApps());

  // Link fixo de credito - so abre essa URL especifica no navegador padrao
  // do sistema (nunca dentro da propria janela do app).
  ipcMain.handle('open-credit-link', () => {
    shell.openExternal('https://rafaelmello.site');
  });

  // Copiar pra area de transferencia (botao "Convidar") via o modulo nativo
  // do Electron, e nao navigator.clipboard.writeText() do renderer - o
  // setPermissionRequestHandler acima so libera 'media', entao a API web
  // de clipboard seria negada (testado: "NotAllowedError: Write permission
  // denied"). O modulo nativo nao passa pelo modelo de permissoes da web,
  // entao funciona direto.
  ipcMain.handle('share-notify', (_event, payload) => showShareNotification(payload));
  ipcMain.on('ping-overlay-show', (_event, ping) => showPingOverlay(ping));
  ipcMain.on('ping-overlay-clear', () => clearPingOverlay());
  ipcMain.on('ping-alt-click', () => { suppressNextAltUp = true; });
  ipcMain.handle('copy-image', (_event, dataUrl) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > 80 * 1024 * 1024) return false;
    const img = nativeImage.createFromDataURL(dataUrl);
    if (img.isEmpty()) return false;
    // testes automaticos: nao mexe na area de transferencia de quem roda
    if (process.env.TELINHAFIX_TEST_DRYRUN) return img.getSize();
    clipboard.writeImage(img);
    return true;
  });
  ipcMain.handle('copy-to-clipboard', (_event, text) => {
    clipboard.writeText(String(text || ''));
  });

  ipcMain.handle('check-for-updates', () => {
    checkForUpdatesManually();
  });

  ipcMain.handle('get-update-status', () => ({ available: !!availableUpdateVersion, version: availableUpdateVersion }));

  // Admin apertou "Pedir pra atualizar": se tiver versao nova, baixa e
  // pergunta "Reiniciar agora / Depois"; se ja estiver em dia, nao aparece nada.
  ipcMain.handle('update-prompt', () => {
    if (app.isPackaged) runUpdateCheck('prompt');
  });

  // Tela cheia da janela (usada ao entrar no Codenames) - retorna se ja
  // estava em tela cheia antes, pro renderer saber se deve desfazer depois.
  ipcMain.handle('window-set-fullscreen', (event, on) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const wasFullscreen = win.isFullScreen();
    win.setFullScreen(!!on);
    return wasFullscreen;
  });

  // Atalhos globais (funcionam mesmo com o TelinhaFix em segundo plano, tipo
  // enquanto a pessoa ta num jogo) - a pessoa escolhe a combinacao de cada
  // um e pode desligar tudo nas configuracoes de aparencia; esse estado
  // inteiro (ligado/desligado + qual tecla pra cada acao) mora no renderer
  // (localStorage), entao aqui so aplicamos o que ele mandar via IPC.
  // Sempre reconstroi do zero (unregisterAll + registra de novo) em vez de
  // tentar atualizar so o que mudou - mais simples e sem risco de deixar
  // uma combinacao antiga presa registrada por engano.
  const HOTKEY_CHANNELS = {
    stopShare: 'global-hotkey-stop-share',
    toggleMute: 'global-hotkey-toggle-mute',
    quickShare: 'global-hotkey-quick-share',
  };
  let hotkeysEnabled = false;
  let hotkeyBindings = { stopShare: 'Control+Alt+S', toggleMute: 'Control+Alt+M', quickShare: 'Control+Alt+Q' };

  function applyHotkeys() {
    globalShortcut.unregisterAll();
    const results = {};
    for (const [action, channel] of Object.entries(HOTKEY_CHANNELS)) {
      const accelerator = hotkeyBindings[action];
      if (!hotkeysEnabled || !accelerator) {
        results[action] = true;
        continue;
      }
      const ok = globalShortcut.register(accelerator, () => {
        if (!win.isDestroyed()) win.webContents.send(channel);
      });
      results[action] = ok;
      if (!ok) console.error(`Falha ao registrar atalho ${accelerator} (${action}) - outro programa deve estar usando essa combinacao.`);
    }
    return results;
  }

  // state: { enabled, bindings: { stopShare, toggleMute } }. Retorna
  // { stopShare: bool, toggleMute: bool } dizendo quais combinacoes
  // conseguiram ser registradas de verdade no sistema operacional - o
  // renderer usa isso pra saber se precisa avisar a pessoa de um conflito
  // com outro programa e desfazer a troca.
  ipcMain.handle('hotkeys-apply-state', (event, state) => {
    hotkeysEnabled = !!(state && state.enabled);
    if (state && state.bindings) hotkeyBindings = { ...hotkeyBindings, ...state.bindings };
    return applyHotkeys();
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Atualizacao - decisao do Rafael: NUNCA reiniciar o app de ninguem sozinho
// (tem gente usando). Fluxo:
// - ao abrir o app: se tiver versao nova, baixa e pergunta "Reiniciar agora /
//   Depois" (Depois = instala quando a pessoa fechar o app);
// - "Procurar atualizacoes" (botao do login / menu Ajuda): o mesmo, com avisos;
// - com o app aberto: so CONFERE de tempos em tempos se tem versao nova (sem
//   baixar, sem perguntar) e avisa a tela pra fazer o botao piscar.
let updateCheckMode = null; // 'startup' | 'manual' | 'background' - quem pediu a checagem em andamento
let updateDownloadStarted = false;
let availableUpdateVersion = null;

function setAvailableUpdate(version) {
  if (availableUpdateVersion === version) return;
  availableUpdateVersion = version;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { available: !!version, version });
  }
  buildAppMenu();
}

function runUpdateCheck(mode) {
  // checagem manual "vence" uma automatica que ja estava rodando (mostra os avisos)
  if (updateCheckMode && mode !== 'manual' && mode !== 'prompt') return;
  updateCheckMode = mode;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error(`[updater] Falha ao checar atualizacao (${mode}):`, err);
    if (mode === 'manual') showUpdateError(err);
    updateCheckMode = null;
  });
}

function showUpdateError(err) {
  dialog.showMessageBox({
    type: 'error',
    title: 'Falha ao procurar atualizações',
    message: `Não foi possível checar atualizações agora.\n\n${(err && err.message) || err}`,
    buttons: ['OK'],
  });
}

function checkForUpdatesManually() {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Procurar atualizações',
      message: 'Checagem de atualização só funciona no app instalado (fora do modo de desenvolvimento).',
      buttons: ['OK'],
    });
    return;
  }
  runUpdateCheck('manual');
}

function setupAutoUpdater() {
  if (!app.isPackaged) return; // em dev nao tem app-update.yml, ia so dar erro

  autoUpdater.autoDownload = false; // quem decide baixar e o fluxo acima, nao a biblioteca
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    const mode = updateCheckMode;
    updateCheckMode = null;
    console.log(`[updater] atualizacao disponivel: ${info.version} (${mode})`);
    setAvailableUpdate(info.version);
    if (mode === 'background') return; // so faz o botao piscar
    if (mode === 'manual') {
      dialog.showMessageBox({
        type: 'info',
        title: 'Atualização encontrada',
        message: `Encontramos a versão ${info.version}. Baixando agora em segundo plano - você será avisado quando estiver pronta pra instalar.`,
        buttons: ['OK'],
      });
    }
    if (!updateDownloadStarted) {
      updateDownloadStarted = true;
      autoUpdater.downloadUpdate().catch((err) => {
        updateDownloadStarted = false;
        console.error('[updater] Falha ao baixar atualizacao:', err);
        if (mode === 'manual') showUpdateError(err);
      });
    }
  });
  autoUpdater.on('update-not-available', (info) => {
    const mode = updateCheckMode;
    updateCheckMode = null;
    console.log(`[updater] ja esta na versao mais recente (${info.version})`);
    setAvailableUpdate(null);
    if (mode === 'manual') {
      dialog.showMessageBox({
        type: 'info',
        title: 'Sem atualizações',
        message: `Você já está na versão mais recente (${app.getVersion()}).`,
        buttons: ['OK'],
      });
    }
  });
  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] baixando: ${Math.round(progress.percent)}%`);
  });
  autoUpdater.on('error', (err) => {
    const mode = updateCheckMode;
    updateCheckMode = null;
    updateDownloadStarted = false;
    console.error('[updater] Falha ao checar/baixar atualizacao:', err);
    if (mode === 'manual') showUpdateError(err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloadStarted = false;
    console.log(`[updater] atualizacao ${info.version} baixada - pronta pra instalar`);
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Atualização disponível',
        message: `Uma versão nova do TelinhaFix (${info.version}) foi baixada. Reiniciar agora para instalar?`,
        detail: 'Se escolher "Depois", ela é instalada quando você fechar o app.',
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then((result) => {
        // isSilent=true: usa o instalador ja baixado sem telas pra clicar;
        // isForceRunAfter=true: reabre o app no final.
        if (result.response === 0) autoUpdater.quitAndInstall(true, true);
      });
  });

  runUpdateCheck('startup');
  setInterval(() => runUpdateCheck('background'), 60 * 1000);
}

// Menu nativo do app (some sozinho por causa do autoHideMenuBar - aparece
// com Alt) - a unica entrada que precisa existir por enquanto e a checagem
// manual de atualizacao.
function buildAppMenu() {
  const label = availableUpdateVersion
    ? `Procurar atualizações (nova versão ${availableUpdateVersion}!)`
    : 'Procurar atualizações';
  const template = [
    {
      label: availableUpdateVersion ? 'Ajuda ●' : 'Ajuda',
      submenu: [
        { label, click: () => checkForUpdatesManually() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  buildAppMenu();
  setupAutoUpdater();

  // Abertura "a frio" (app nao estava rodando) clicando num link de convite -
  // o Windows passa a URL como argumento de linha de comando na primeira
  // abertura. Espera a pagina carregar antes de mandar o IPC, senao o
  // listener do renderer ainda nao existe pra receber.
  const coldStartRoomId = extractInviteRoomFromArgv(process.argv);
  if (coldStartRoomId) {
    mainWindow.webContents.once('did-finish-load', () => sendInviteRoomToRenderer(coldStartRoomId));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopAudioCapture();
  stopNativeScreenCapture();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopAudioCapture();
  stopNativeScreenCapture();
  globalShortcut.unregisterAll();
});
