const { app, BrowserWindow, session, desktopCapturer } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'ScreenBunny',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Trata os pedidos de navigator.mediaDevices.getDisplayMedia() feitos no
  // renderer. Tenta usar o seletor nativo do Windows (que ja deixa escolher
  // o monitor/janela e tem a opcao de incluir audio do sistema). Se o
  // seletor nativo nao estiver disponivel, cai no fallback abaixo, que
  // pega a tela principal com audio do sistema (loopback) automaticamente.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        if (!sources.length) {
          callback({});
          return;
        }
        callback({ video: sources[0], audio: 'loopback' });
      } catch (err) {
        console.error('Falha ao capturar tela:', err);
        callback({});
      }
    },
    { useSystemPicker: true }
  );

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
