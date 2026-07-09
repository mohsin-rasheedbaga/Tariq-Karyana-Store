"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const updater_1 = require("./updater");
let mainWindow = null;
let serverProcess = null;
let serverPort = 3000;
let serverReady = false;
// Log to file for debugging
const logDir = electron_1.app.getPath('userData');
const logFile = path_1.default.join(logDir, 'app.log');
if (!fs_1.default.existsSync(logDir))
    fs_1.default.mkdirSync(logDir, { recursive: true });
function log(msg) {
    try {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        fs_1.default.appendFileSync(logFile, line);
    }
    catch (e) { /* ignore */ }
    console.log(msg);
}
// Ensure single instance
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
// Find a free port
function findFreePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net_1.default.createServer();
        server.listen(startPort, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            findFreePort(startPort + 1).then(resolve).catch(reject);
        });
    });
}
// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path_1.default.join(electron_1.app.getPath('userData'), 'data');
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}
// Fix DATABASE_URL for Windows (forward slashes required by Prisma)
function getDatabaseUrl(dbPath) {
    // Convert Windows backslashes to forward slashes
    const normalizedPath = dbPath.replace(/\\/g, '/');
    // For absolute paths, use file:/// format
    if (path_1.default.isAbsolute(dbPath)) {
        return `file:///${normalizedPath}`;
    }
    return `file:./${normalizedPath}`;
}
// Check if server is responding
function checkServerReady(port) {
    return new Promise((resolve) => {
        const req = http_1.default.request({ hostname: '127.0.0.1', port, path: '/', method: 'GET', timeout: 3000 }, (res) => {
            const ok = res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 302;
            resolve(ok);
            try {
                res.destroy();
            }
            catch (e) { /* ignore */ }
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { try {
            req.destroy();
        }
        catch (e) { /* ignore */ } resolve(false); });
        req.end();
    });
}
// Write loading HTML to a temp file (more reliable than data: URL)
function writeLoadingHTML(port) {
    const htmlPath = path_1.default.join(electron_1.app.getPath('userData'), 'loading.html');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tariq Karyana Store - Loading...</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { text-align: center; }
    .spinner { width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
    p { margin: 0; font-size: 14px; color: #94a3b8; }
    .error { color: #ef4444; margin-top: 16px; font-size: 13px; display: none; max-width: 500px; word-wrap: break-word; }
    .retry-btn { margin-top: 12px; padding: 8px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; display: none; }
    .retry-btn:hover { background: #2563eb; }
    #status { margin-top: 8px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner" id="spinner"></div>
    <h2>Tariq Karyana Store</h2>
    <p id="subtitle">Starting server...</p>
    <p class="error" id="error"></p>
    <button class="retry-btn" id="retryBtn" onclick="location.reload()">Retry</button>
    <p id="status"></p>
  </div>
  <script>
    const PORT = ${port};
    let attempts = 0;
    const maxAttempts = 60;
    const subtitle = document.getElementById('subtitle');
    const error = document.getElementById('error');
    const spinner = document.getElementById('spinner');
    const retryBtn = document.getElementById('retryBtn');
    const status = document.getElementById('status');

    function tryLoad() {
      attempts++;
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'http://127.0.0.1:' + PORT + '/', true);
      xhr.timeout = 2000;
      xhr.onload = function() {
        if (xhr.status === 200 || xhr.status === 307 || xhr.status === 302) {
          subtitle.textContent = 'Loading application...';
          window.location.href = 'http://127.0.0.1:' + PORT + '/';
        } else {
          scheduleRetry();
        }
      };
      xhr.onerror = function() { scheduleRetry(); };
      xhr.ontimeout = function() { scheduleRetry(); };
      xhr.send();
    }

    function scheduleRetry() {
      if (attempts >= maxAttempts) {
        spinner.style.display = 'none';
        subtitle.textContent = 'Failed to start server';
        error.textContent = 'The server could not start within 60 seconds. Check the log file at: ' + 
          (window.navigator.userAgent.indexOf('Win') !== -1 ? '%APPDATA%' : '~') + 
          '/Tariq Karyana Store/app.log';
        error.style.display = 'block';
        retryBtn.style.display = 'inline-block';
        status.textContent = '';
        return;
      }
      var msgs = ['Starting server...', 'Initializing database...', 'Loading application...', 'Almost ready...'];
      subtitle.textContent = msgs[Math.min(Math.floor(attempts / 15), msgs.length - 1)];
      status.textContent = 'Attempt ' + attempts + '/' + maxAttempts;
      setTimeout(tryLoad, 1000);
    }

    setTimeout(tryLoad, 1500);
  </script>
</body>
</html>`;
    fs_1.default.writeFileSync(htmlPath, html, 'utf-8');
    return htmlPath;
}
// Start the Next.js standalone server
async function startServer() {
    serverPort = await findFreePort(3000);
    const dataDir = ensureDataDir();
    const dbPath = path_1.default.join(dataDir, 'custom.db');
    const dbUrl = getDatabaseUrl(dbPath);
    log(`=== Starting Server ===`);
    log(`Port: ${serverPort}`);
    log(`Database: ${dbPath}`);
    log(`DATABASE_URL: ${dbUrl}`);
    log(`App Data: ${electron_1.app.getPath('userData')}`);
    log(`isPackaged: ${electron_1.app.isPackaged}`);
    log(`resourcesPath: ${process.resourcesPath}`);
    log(`platform: ${process.platform} ${process.arch}`);
    // Determine the standalone server path
    let serverScript;
    let serverCwd;
    if (electron_1.app.isPackaged) {
        serverScript = path_1.default.join(process.resourcesPath, 'standalone', 'server.js');
        serverCwd = path_1.default.join(process.resourcesPath, 'standalone');
    }
    else {
        serverScript = path_1.default.join(__dirname, '..', '.next', 'standalone', 'server.js');
        serverCwd = path_1.default.join(__dirname, '..', '.next', 'standalone');
    }
    log(`Server script: ${serverScript}`);
    log(`Server cwd: ${serverCwd}`);
    // Check if server script exists
    if (!fs_1.default.existsSync(serverScript)) {
        log(`ERROR: Server script not found at: ${serverScript}`);
        // Try alternate paths
        const altPaths = [
            path_1.default.join(process.resourcesPath, 'app', 'standalone', 'server.js'),
            path_1.default.join(process.resourcesPath, 'app.asar.unpacked', 'standalone', 'server.js'),
            path_1.default.join(__dirname, 'standalone', 'server.js'),
        ];
        for (const alt of altPaths) {
            log(`  Trying: ${alt}`);
            if (fs_1.default.existsSync(alt)) {
                serverScript = alt;
                serverCwd = path_1.default.dirname(alt);
                log(`  Found at: ${alt}`);
                break;
            }
        }
        if (!fs_1.default.existsSync(serverScript)) {
            log(`FATAL: No server script found in any location`);
            // List what's in resourcesPath
            try {
                const listFiles = (dir, prefix = '') => {
                    if (!fs_1.default.existsSync(dir))
                        return;
                    const items = fs_1.default.readdirSync(dir, { withFileTypes: true });
                    for (const item of items.slice(0, 30)) {
                        if (item.name.startsWith('.'))
                            continue;
                        const fullPath = path_1.default.join(dir, item.name);
                        log(`  ${prefix}${item.name}${item.isDirectory() ? '/' : ''}`);
                        if (item.isDirectory() && prefix.length < 20) {
                            listFiles(fullPath, prefix + '  ');
                        }
                    }
                };
                log(`Contents of ${process.resourcesPath}:`);
                listFiles(process.resourcesPath);
                log(`Contents of ${electron_1.app.getPath('exe')}:`);
                log(`  exe dir: ${path_1.default.dirname(electron_1.app.getPath('exe'))}`);
                listFiles(path_1.default.dirname(electron_1.app.getPath('exe')));
            }
            catch (e) {
                log(`  Error listing: ${e.message}`);
            }
            return serverPort; // Return port anyway, loading page will show error
        }
    }
    return new Promise((resolve) => {
        const env = {
            ...process.env,
            NODE_ENV: 'production',
            PORT: String(serverPort),
            HOSTNAME: '127.0.0.1',
            DATABASE_URL: dbUrl,
        };
        log(`Spawning server: ${process.execPath} ${serverScript}`);
        serverProcess = (0, child_process_1.spawn)(process.execPath, [serverScript], {
            env,
            cwd: serverCwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let serverOutput = '';
        let serverErrors = '';
        serverProcess.stdout?.on('data', (data) => {
            const msg = data.toString();
            serverOutput += msg;
            log(`[STDOUT] ${msg.trimEnd()}`);
        });
        serverProcess.stderr?.on('data', (data) => {
            const msg = data.toString();
            serverErrors += msg;
            log(`[STDERR] ${msg.trimEnd()}`);
        });
        serverProcess.on('error', (err) => {
            log(`[ERROR] Server process error: ${err.message}`);
        });
        serverProcess.on('exit', (code, signal) => {
            log(`[EXIT] Server process exited: code=${code} signal=${signal}`);
            serverProcess = null;
        });
        // Poll until the server responds
        const maxWait = 60000;
        const startTime = Date.now();
        const poll = async () => {
            const ready = await checkServerReady(serverPort);
            if (ready) {
                serverReady = true;
                log(`Server is READY on port ${serverPort}`);
                resolve(serverPort);
                return;
            }
            if (Date.now() - startTime > maxWait) {
                log(`Server did not respond within ${maxWait}ms`);
                log(`Last output: ${serverOutput.slice(-1000)}`);
                log(`Last errors: ${serverErrors.slice(-1000)}`);
                resolve(serverPort); // Resolve anyway - loading page handles retries
                return;
            }
            setTimeout(poll, 1000);
        };
        setTimeout(poll, 3000); // Wait 3s before first check
    });
}
// Create the main window
function createWindow(port) {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'Tariq Karyana Store - POS System',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        show: false,
    });
    // Write and load loading screen from file (more reliable than data: URL)
    const loadingPath = writeLoadingHTML(port);
    mainWindow.loadFile(loadingPath);
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        if (electron_1.app.isPackaged) {
            (0, updater_1.setupAutoUpdater)(mainWindow);
        }
    });
    // If server is already ready, redirect immediately
    if (serverReady) {
        mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }
    // Open DevTools on F12
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
            mainWindow?.webContents.toggleDevTools();
        }
    });
    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// IPC Handlers
electron_1.ipcMain.handle('get-app-version', () => electron_1.app.getVersion());
electron_1.ipcMain.handle('get-app-data-path', () => electron_1.app.getPath('userData'));
electron_1.ipcMain.handle('get-db-path', () => path_1.default.join(ensureDataDir(), 'custom.db'));
electron_1.ipcMain.handle('get-server-port', () => serverPort);
electron_1.ipcMain.handle('get-log-path', () => logFile);
electron_1.ipcMain.handle('open-devtools', () => mainWindow?.webContents.openDevTools());
electron_1.ipcMain.handle('check-for-updates', async () => {
    if (mainWindow && electron_1.app.isPackaged)
        return { checking: true };
    return { checking: false };
});
electron_1.ipcMain.handle('relaunch-app', () => {
    electron_1.app.relaunch();
    electron_1.app.quit();
});
// App lifecycle
electron_1.app.whenReady().then(async () => {
    log('=== Tariq Karyana Store Starting ===');
    log(`Electron: ${process.versions.electron}`);
    log(`Node: ${process.versions.node}`);
    log(`Chrome: ${process.versions.chrome}`);
    log(`Platform: ${process.platform} ${process.arch}`);
    log(`Version: ${electron_1.app.getVersion()}`);
    try {
        const port = await startServer();
        createWindow(port);
        log('=== Application Ready ===');
    }
    catch (err) {
        log(`FATAL: ${err.message}\n${err.stack}`);
        electron_1.dialog.showErrorBox('Fatal Error', `Failed to start: ${err.message}`);
        electron_1.app.quit();
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow(serverPort);
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});
electron_1.app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
