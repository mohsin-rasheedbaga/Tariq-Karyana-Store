import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import { setupAutoUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort = 3000;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Find a free port
function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      findFreePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

// Ensure data directory exists
function ensureDataDir(): string {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

// Start the Next.js standalone server
async function startServer(): Promise<number> {
  serverPort = await findFreePort(3000);
  const dataDir = ensureDataDir();
  const dbPath = path.join(dataDir, 'custom.db');
  const dbUrl = `file:${dbPath}`;

  // Determine the standalone server path
  let serverScript: string;
  if (app.isPackaged) {
    serverScript = path.join(process.resourcesPath, 'standalone', 'server.js');
  } else {
    serverScript = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
  }

  if (!fs.existsSync(serverScript)) {
    console.error(`Server script not found at: ${serverScript}`);
    // Fallback: try to find it relative to the app
    const altPath = path.join(process.cwd(), '.next', 'standalone', 'server.js');
    if (fs.existsSync(altPath)) {
      serverScript = altPath;
    } else {
      dialog.showErrorBox(
        'Startup Error',
        'Could not find the application server. Please reinstall the application.'
      );
      app.quit();
      return serverPort;
    }
  }

  return new Promise<number>((resolve) => {
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(serverPort),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: dbUrl,
    };

    serverProcess = spawn(process.execPath, [serverScript], {
      env,
      cwd: app.isPackaged
        ? path.join(process.resourcesPath, 'standalone')
        : path.join(__dirname, '..', '.next', 'standalone'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log(`[Server] ${msg}`);
      if (msg.includes('Ready') || msg.includes('started') || msg.includes('listening')) {
        resolve(serverPort);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Server Error] ${data.toString()}`);
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
      serverProcess = null;
    });

    // Resolve after timeout even if "Ready" message not detected
    setTimeout(() => resolve(serverPort), 5000);
  });
}

// Create the main window
function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Tariq Karyana Store - POS System',
    icon: path.join(__dirname, '..', 'public', 'logo.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Show window when ready to show
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // Check for updates after window is shown
    if (app.isPackaged) {
      setupAutoUpdater(mainWindow!);
    }
  });

  // Load the app
  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation outside the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-db-path', () => {
  return path.join(ensureDataDir(), 'custom.db');
});

ipcMain.handle('check-for-updates', async () => {
  if (mainWindow && app.isPackaged) {
    // This is handled by the auto-updater module
    return { checking: true };
  }
  return { checking: false, message: 'Updates only available in packaged app' };
});

ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.quit();
});

// App lifecycle
app.whenReady().then(async () => {
  const port = await startServer();
  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

app.on('window-all-closed', () => {
  // On Windows/Linux, quit when all windows are closed
  // On macOS, keep running (standard macOS behavior)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill the server process
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('second-instance', () => {
  // If someone tries to open a second instance, focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});