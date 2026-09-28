const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

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

// Qualidades disponiveis no seletor. maxBitrate em bits/s - usado depois
// pra configurar o RTCRtpSender de cada conexao (ver renderer.js).
const QUALITY_PRESETS = {
  '720p30': { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  '720p60': { width: 1280, height: 720, frameRate: 60, maxBitrate: 3_500_000 },
  '720p120': { width: 1280, height: 720, frameRate: 120, maxBitrate: 5_000_000 },
  '1080p30': { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_500_000 },
  '1080p60': { width: 1920, height: 1080, frameRate: 60, maxBitrate: 7_000_000 },
  '1080p120': { width: 1920, height: 1080, frameRate: 120, maxBitrate: 9_000_000 },
  '1440p30': { width: 2560, height: 1440, frameRate: 30, maxBitrate: 6_500_000 },
  '1440p60': { width: 2560, height: 1440, frameRate: 60, maxBitrate: 9_500_000 },
  '2160p30': { width: 3840, height: 2160, frameRate: 30, maxBitrate: 12_000_000 },
  '2160p60': { width: 3840, height: 2160, frameRate: 60, maxBitrate: 18_000_000 },
};

// Preset fixo usado quando a pessoa compartilha so a webcam (sem tela) -
// nao passa pelo seletor de qualidade, entao nao faz sentido oferecer
// 4K/120fps pra uma fonte que normalmente nem suporta isso.
const CAMERA_QUALITY_PRESET = { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 };

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

  ipcMain.handle('get-last-picked-quality', () => lastPickedQuality);
  ipcMain.handle('get-camera-quality', () => CAMERA_QUALITY_PRESET);
  ipcMain.handle('get-last-picked-audio-config', () => lastPickedAudioConfig);
  ipcMain.handle('list-running-apps', () => listRunningApps());

  // Link fixo de credito - so abre essa URL especifica no navegador padrao
  // do sistema (nunca dentro da propria janela do app).
  ipcMain.handle('open-credit-link', () => {
    shell.openExternal('https://rafaelmello.site');
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopAudioCapture();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopAudioCapture();
});
