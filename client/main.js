const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let audioHelperProcess = null;
let audioLeftover = Buffer.alloc(0);

function getAudioHelperPath() {
  const exeName = 'ScreenBunnyAudioHelper.exe';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native', exeName);
  }
  return path.join(__dirname, 'native', exeName);
}

function startAudioCapture(win) {
  if (audioHelperProcess) return;

  audioLeftover = Buffer.alloc(0);
  audioHelperProcess = spawn(getAudioHelperPath(), [], { stdio: ['ignore', 'pipe', 'pipe'] });

  // Float32 estereo: 2 canais * 4 bytes = 8 bytes por frame. Os pedacos que
  // chegam do stdout nao respeitam esse alinhamento, entao remontamos aqui.
  const FRAME_SIZE = 8;
  audioHelperProcess.stdout.on('data', (chunk) => {
    const data = Buffer.concat([audioLeftover, chunk]);
    const usableLength = data.length - (data.length % FRAME_SIZE);
    audioLeftover = Buffer.from(data.subarray(usableLength));
    const aligned = data.subarray(0, usableLength);
    if (aligned.length > 0 && win && !win.isDestroyed()) {
      win.webContents.send('screenbunny-audio-chunk', aligned);
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

// Abre uma janelinha propria com miniaturas de cada monitor/janela pra
// escolher qual compartilhar. O seletor nativo do Windows (useSystemPicker)
// as vezes nao esta disponivel e cai num fallback silencioso sem perguntar
// nada - isso aqui garante que sempre aparece uma escolha.
function pickScreenSource(parentWin) {
  return new Promise(async (resolve) => {
    let sources;
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 320, height: 180 },
      });
    } catch (err) {
      console.error('Falha ao listar telas:', err);
      resolve(null);
      return;
    }

    if (sources.length === 0) {
      resolve(null);
      return;
    }
    if (sources.length === 1) {
      resolve(sources[0]);
      return;
    }

    const pickerWin = new BrowserWindow({
      width: 780,
      height: 420,
      parent: parentWin || undefined,
      modal: !!parentWin,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title: 'Escolha a tela - ScreenBunny',
      backgroundColor: '#060607',
      webPreferences: {
        preload: path.join(__dirname, 'picker', 'picker-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    let settled = false;
    const finish = (source) => {
      if (settled) return;
      settled = true;
      resolve(source);
    };

    const onChoice = (event, chosenId) => {
      finish(sources.find((s) => s.id === chosenId) || sources[0]);
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
    title: 'ScreenBunny',
    icon: path.join(__dirname, 'renderer', 'assets', 'logo.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Trata os pedidos de navigator.mediaDevices.getDisplayMedia() feitos no
  // renderer, abrindo o seletor proprio (pickScreenSource) pra escolher o
  // monitor. O audio do sistema NAO vem por aqui - o renderer pede so video
  // (audio: false) porque o audio real vem do helper nativo
  // (ScreenBunnyAudioHelper), que captura o sistema todo excluindo o
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
    startAudioCapture(BrowserWindow.fromWebContents(event.sender));
  });

  ipcMain.handle('audio-capture-stop', () => {
    stopAudioCapture();
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
