import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Store from 'electron-store';
import type { AppConfig } from '@shared/types';
import { ConfigStore } from './config-store.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { OBSManager } from './obs/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;

// Single-instance-lock muss VOR app.whenReady() angefordert werden — sonst
// initialisiert die zweite Instanz Module/IPC, bevor sie merkt dass sie
// quitten muss. Bei zweitem Start: ersten Window fokussieren statt Quitten
// in dessen Process.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#1e1f22',
    title: 'Desktopstreamer',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  // Externe Links im System-Browser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Wenn zweite Instanz startet: existierendes Fenster fokussieren.
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (gotSingleInstanceLock) {
  void app.whenReady().then(() => {
    // ConfigStore initialisieren
    const electronStore = new Store<AppConfig>({
      defaults: ConfigStore.defaults()
    });
    const configStore = new ConfigStore(electronStore as never);

    const obsManager = new OBSManager();
    registerIpcHandlers(configStore, obsManager, () => mainWindow);

    createWindow();

    // OBS-Init starten — non-blocking, Renderer kriegt Status via Events
    void obsManager.ensureReady();

    app.on('before-quit', () => {
      void obsManager.shutdown();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
