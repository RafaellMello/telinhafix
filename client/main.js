const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

// O Chromium no Windows captura tela usando a Windows Graphics Capture API
// (WGC) por padrao. O WGC as vezes desenha o cursor "fantasma" na captura
// mesmo quando o jogo escondeu o cursor de verdade na tela (acontece com
// alguns jogos que usam raw input pra travar o mouse durante a mira) -
// o cursor que aparece na transmissao nao e o que a pessoa que compartilha
// esta vendo na propria tela. Desativando o WGC so pra captura de MONITOR
// (nao janela, pra nao arriscar tela preta em jogos DirectX capturados por
// janela), o Chromium cai pro Desktop Duplication API (DXGI), que consulta
// o estado real de visibilidade do cursor do sistema em vez de compor um
// estado desatualizado.
app.commandLine.appendSwitch('disable-features', 'WebRtcWgcScreenCapturer');

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

function startAudioCapture(win, audioConfig) {
  if (audioHelperProcess) return;

  const config = audioConfig || { mode: 'exclude', target: 'Discord' };
  const helperArgs = config.mode === 'system' ? ['system'] : [config.mode, config.target];

  audioLeftover = Buffer.alloc(0);
  audioHelperProcess = spawn(getAudioHelperPath(), helperArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

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
    console.log('[audio-helper]', chunk.toString().trim());
  });

  audioHelperProcess.on('error', (err) => {
    console.error('Falha ao iniciar o helper de audio:', err);
    audioHelperProcess = null;
  });

  audioHelperProcess.on('exit', () => {
    audioHelperProcess = null;
  });
}

function stopAudioCapture() {
  if (audioHelperProcess) {
    audioHelperProcess.kill();
    audioHelperProcess = null;
  }
}

// --- Captura de tela nativa sem cursor (modo "beta") ----------------------
//
// A captura padrao do Electron (desktopCapturer/getDisplayMedia) sempre
// compoe o cursor do sistema por cima do frame capturado, mesmo quando o
// jogo/app escondeu ele de verdade na tela (comum em jogos com mira via
// raw input) - o WebRtcWgcScreenCapturer desativado la em cima nao resolveu
// isso porque o problema nao e WGC especifico, o Chromium sempre desenha
// esse cursor "fantasma" nao importa o backend. A Desktop Duplication API
// (DXGI) por baixo, por outro lado, NUNCA inclui o cursor no frame - ele
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

  // Libera o pedido de camera (getUserMedia) usado pela feature de webcam
  // (bolinha composta por cima da tela).
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  // Trata os pedidos de navigator.mediaDevices.getDisplayMedia() feitos no
  // renderer, abrindo o seletor proprio (pickScreenSource) pra escolher o
  // monitor. O audio do sistema NAO vem por aqui - o renderer pede so video
  // (audio: false) porque o audio real vem do helper nativo
  // (TelinhaFixAudioHelper), que captura o sistema todo excluindo o
  // Discord. Se por algum motivo o renderer pedir audio por esse caminho
  // mesmo assim, ainda respondemos com o loopback padrao como fallback.
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const source = await pickScreenSource(win);
      if (!source) {
        callback({});
        return;
      }
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

  ipcMain.handle('audio-capture-stop', () => {
    stopAudioCapture();
  });

  ipcMain.handle('native-screen-list', () => listNativeScreens());

  ipcMain.handle('native-screen-start', (event, opts) => {
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
  };
  let hotkeysEnabled = false;
  let hotkeyBindings = { stopShare: 'Control+Alt+S', toggleMute: 'Control+Alt+M' };

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

// Checa por versao nova no GitHub Releases (metadados gerados pelo proprio
// electron-builder no build) e baixa sozinho em segundo plano. So avisa a
// pessoa quando ja esta pronta pra instalar - reiniciar sem avisar no meio
// de uma transmissao seria pior que nao ter atualizacao nenhuma.
function setupAutoUpdater() {
  if (!app.isPackaged) return; // em dev nao tem app-update.yml, ia so dar erro

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checando por atualizacao...');
  });
  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] atualizacao disponivel: ${info.version} - baixando...`);
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log(`[updater] ja esta na versao mais recente (${info.version})`);
  });
  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] baixando: ${Math.round(progress.percent)}%`);
  });
  autoUpdater.on('error', (err) => {
    console.error('[updater] Falha ao checar/baixar atualizacao:', err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] atualizacao ${info.version} baixada - pronta pra instalar`);
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Atualização disponível',
        message: `Uma versão nova do TelinhaFix (${info.version}) foi baixada. Reiniciar agora para instalar?`,
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Falha ao checar atualizacao:', err);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

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
