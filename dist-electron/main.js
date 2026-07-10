"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const net_1 = __importDefault(require("net"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const child_process_1 = require("child_process");
const updater_1 = require("./updater");
let mainWindow = null;
let childServer = null;
let serverPort = 3000;
// Ensure single instance
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock)
    electron_1.app.quit();
// Logging
const logFile = path_1.default.join(electron_1.app.getPath('userData'), 'app.log');
const logDir = path_1.default.dirname(logFile);
if (!fs_1.default.existsSync(logDir))
    fs_1.default.mkdirSync(logDir, { recursive: true });
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
        fs_1.default.appendFileSync(logFile, line);
    }
    catch { }
    console.log(msg);
}
// Find free port
function findFreePort(start) {
    return new Promise((resolve) => {
        const s = net_1.default.createServer();
        s.listen(start, '127.0.0.1', () => {
            const p = s.address().port;
            s.close(() => resolve(p));
        });
        s.on('error', () => findFreePort(start + 1).then(resolve));
    });
}
// Ensure data dir
function ensureDataDir() {
    const d = path_1.default.join(electron_1.app.getPath('userData'), 'data');
    if (!fs_1.default.existsSync(d))
        fs_1.default.mkdirSync(d, { recursive: true });
    return d;
}
/**
 * Get standalone directory path.
 * - Packaged app: extraResources are placed in <app>/resources/ (OUTSIDE asar).
 *   process.resourcesPath resolves to this directory.
 * - Dev mode: use the local .next/standalone from project root.
 */
function getStandaloneDir() {
    if (electron_1.app.isPackaged) {
        return path_1.default.join(process.resourcesPath, 'standalone');
    }
    return path_1.default.join(__dirname, '..', '.next', 'standalone');
}
// Build the DATABASE_URL with proper cross-platform path handling for SQLite
function buildDatabaseUrl(dataDir) {
    const dbPath = path_1.default.join(dataDir, 'custom.db');
    // Normalize to forward slashes for the URL
    const normalizedPath = dbPath.replace(/\\/g, '/');
    // file:// URI format for absolute paths
    if (path_1.default.isAbsolute(normalizedPath)) {
        if (normalizedPath.startsWith('/')) {
            // Unix: /path/to/db -> file:///path/to/db
            return `file://${normalizedPath}`;
        }
        else {
            // Windows: C:/path/to/db -> file:///C:/path/to/db
            return `file:///${normalizedPath}`;
        }
    }
    return `file:./${normalizedPath}`;
}
/**
 * Start Next.js standalone server as a child process.
 *
 * We CANNOT run the server in-process because:
 * 1. The main process runs inside an asar archive.
 * 2. Native modules (.node files) like Prisma's query engine cannot be
 *    loaded from outside asar when the requiring code is inside asar.
 * 3. Using ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as
 *    plain Node.js, which is exactly what the standalone server expects.
 */
async function startServer() {
    serverPort = await findFreePort(3000);
    const dataDir = ensureDataDir();
    const dbUrl = buildDatabaseUrl(dataDir);
    const standaloneDir = getStandaloneDir();
    const nmPath = path_1.default.join(standaloneDir, 'node_modules');
    log('=== Server Startup Configuration ===');
    log(`standaloneDir: ${standaloneDir}`);
    log(`dataDir: ${dataDir}`);
    log(`DATABASE_URL: ${dbUrl}`);
    log(`PORT: ${serverPort}`);
    log(`isPackaged: ${electron_1.app.isPackaged}`);
    log(`resourcesPath: ${process.resourcesPath}`);
    log(`__dirname: ${__dirname}`);
    log(`execPath: ${process.execPath}`);
    // Verify standalone directory
    if (!fs_1.default.existsSync(standaloneDir)) {
        const msg = `Standalone directory not found: ${standaloneDir}`;
        log(`FATAL: ${msg}`);
        throw new Error(msg);
    }
    // Verify server.js
    const serverScript = path_1.default.join(standaloneDir, 'server.js');
    if (!fs_1.default.existsSync(serverScript)) {
        const msg = `server.js not found at ${serverScript}`;
        log(`FATAL: ${msg}`);
        throw new Error(msg);
    }
    // Verify node_modules and Prisma engine
    if (!fs_1.default.existsSync(nmPath)) {
        const msg = `node_modules not found at ${nmPath}`;
        log(`FATAL: ${msg}`);
        throw new Error(msg);
    }
    // Verify Prisma engine binary exists
    const prismaClientDir = path_1.default.join(nmPath, '.prisma', 'client');
    if (fs_1.default.existsSync(prismaClientDir)) {
        const engineFiles = fs_1.default.readdirSync(prismaClientDir).filter(f => f.endsWith('.node') || f.endsWith('.exe') || f.endsWith('.dll'));
        log(`Prisma engine files found: ${engineFiles.length > 0 ? engineFiles.join(', ') : 'NONE - may use library mode'}`);
        // Log all files in .prisma/client for debugging
        log(`.prisma/client contents: ${fs_1.default.readdirSync(prismaClientDir).slice(0, 20).join(', ')}`);
    }
    else {
        log(`WARNING: .prisma/client not found at ${prismaClientDir}`);
    }
    // Set env vars in main process too (for any main-process Prisma usage)
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'production';
    process.env.PORT = String(serverPort);
    process.env.HOSTNAME = '127.0.0.1';
    log(`Spawning server: ${process.execPath} ${serverScript}`);
    log(`CWD: ${standaloneDir}`);
    // Build environment for child process
    const childEnv = {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(serverPort),
        HOSTNAME: '127.0.0.1',
        DATABASE_URL: dbUrl,
        ELECTRON_RUN_AS_NODE: '1',
        // NODE_PATH helps Node.js resolve bare module specifiers from the
        // standalone directory's node_modules even if cwd resolution fails
        NODE_PATH: nmPath,
    };
    return new Promise((resolve, reject) => {
        let childExited = false;
        let childExitCode = null;
        let stderrBuf = '';
        const child = (0, child_process_1.spawn)(process.execPath, [serverScript], {
            env: childEnv,
            cwd: standaloneDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
        childServer = child;
        // Capture output
        child.stdout?.on('data', (d) => {
            const msg = d.toString().trimEnd();
            log(`[Server OUT] ${msg}`);
        });
        child.stderr?.on('data', (d) => {
            const msg = d.toString().trimEnd();
            log(`[Server ERR] ${msg}`);
            stderrBuf += msg + '\n';
        });
        child.on('error', (e) => {
            log(`[Server FATAL] spawn error: ${e.message}`);
            if (!childExited) {
                childExited = true;
                reject(new Error(`Failed to spawn server process: ${e.message}`));
            }
        });
        child.on('exit', (code, signal) => {
            log(`[Server EXIT] code=${code} signal=${signal}`);
            childExited = true;
            childExitCode = code;
            // If server crashes before we create the window, reject immediately
            if (code !== null && code !== 0 && !mainWindow) {
                reject(new Error(`Server exited with code ${code}.\n\nstderr:\n${stderrBuf.slice(-2000)}`));
            }
        });
        // Poll for server readiness
        let attempts = 0;
        const maxAttempts = 60;
        const check = () => {
            // If child already crashed, fail fast
            if (childExited && childExitCode !== null && childExitCode !== 0) {
                reject(new Error(`Server process exited with code ${childExitCode}.\n\nstderr:\n${stderrBuf.slice(-2000)}\n\nCheck log: ${logFile}`));
                return;
            }
            attempts++;
            const req = http_1.default.request({
                hostname: '127.0.0.1',
                port: serverPort,
                path: '/',
                method: 'GET',
                timeout: 2000,
            }, (res) => {
                log(`Server ready after ${attempts} attempts (status: ${res.statusCode})`);
                try {
                    res.destroy();
                }
                catch { }
                resolve(serverPort);
            });
            req.on('error', () => {
                if (attempts < maxAttempts) {
                    if (attempts % 10 === 0) {
                        log(`Waiting for server... attempt ${attempts}/${maxAttempts}`);
                    }
                    setTimeout(check, 1000);
                }
                else {
                    log(`Server failed to respond after ${maxAttempts} attempts`);
                    // Don't reject - let the loading page show the error
                    resolve(serverPort);
                }
            });
            req.on('timeout', () => {
                try {
                    req.destroy();
                }
                catch { }
                if (attempts < maxAttempts) {
                    setTimeout(check, 1000);
                }
                else {
                    resolve(serverPort);
                }
            });
            req.end();
        };
        // Give the server a moment to start before polling
        setTimeout(check, 2000);
    });
}
// Write loading HTML to file
function writeLoadingHTML(port) {
    const p = path_1.default.join(electron_1.app.getPath('userData'), 'loading.html');
    fs_1.default.writeFileSync(p, `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Loading...</title>
<style>
body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.c{text-align:center}.sp{width:48px;height:48px;border:4px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:s .8s linear infinite;margin:0 auto 20px}
@keyframes s{to{transform:rotate(360deg)}}h2{margin:0 0 8px;font-size:20px}p{margin:0;font-size:14px;color:#94a3b8}
.er{color:#ef4444;margin-top:16px;font-size:13px;display:none;max-width:500px;word-wrap:break-word}
.btn{margin-top:12px;padding:8px 24px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;display:none}
.btn:hover{background:#2563eb}#st{margin-top:8px;color:#64748b;font-size:12px}
</style></head><body>
<div class="c"><div class="sp" id="sp"></div><h2>Tariq Karyana Store</h2>
<p id="sub">Starting server...</p><p class="er" id="er"></p>
<button class="btn" id="rb" onclick="location.reload()">Retry</button><p id="st"></p></div>
<script>
const P=${port};let a=0;
function tryLoad(){a++;
var x=new XMLHttpRequest();x.open('GET','http://127.0.0.1:'+P+'/',true);x.timeout=2000;
x.onload=function(){if(x.status===200||x.status===307||x.status===302){document.getElementById('sub').textContent='Loading...';window.location.href='http://127.0.0.1:'+P+'/';}else{wait();}};
x.onerror=function(){wait();};x.ontimeout=function(){wait();};x.send();}
function wait(){if(a>=60){document.getElementById('sp').style.display='none';document.getElementById('sub').textContent='Failed to start';document.getElementById('er').textContent='Server could not start. Check log file for details.';document.getElementById('er').style.display='block';document.getElementById('rb').style.display='inline-block';document.getElementById('st').textContent='';return;}
var m=['Starting server...','Initializing database...','Loading application...','Almost ready...'];
document.getElementById('sub').textContent=m[Math.min(Math.floor(a/15),m.length-1)];
document.getElementById('st').textContent='Attempt '+a+'/60';setTimeout(tryLoad,1000);}
setTimeout(tryLoad,1500);</script></body></html>`, 'utf-8');
    return p;
}
// Create window
function createWindow(port) {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400, height: 900, minWidth: 1024, minHeight: 700,
        title: 'Tariq Karyana Store - POS System',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false,
        },
        show: false,
    });
    const loadingPath = writeLoadingHTML(port);
    mainWindow.loadFile(loadingPath);
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        if (electron_1.app.isPackaged)
            (0, updater_1.setupAutoUpdater)(mainWindow);
    });
    // Open DevTools on F12
    mainWindow.webContents.on('before-input-event', (_, input) => {
        if (input.key === 'F12' || (input.control && input.shift && input.key === 'I'))
            mainWindow?.webContents.toggleDevTools();
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => { electron_1.shell.openExternal(url); return { action: 'deny' }; });
    mainWindow.on('closed', () => { mainWindow = null; });
}
// IPC
electron_1.ipcMain.handle('get-app-version', () => electron_1.app.getVersion());
electron_1.ipcMain.handle('get-app-data-path', () => electron_1.app.getPath('userData'));
electron_1.ipcMain.handle('get-db-path', () => path_1.default.join(ensureDataDir(), 'custom.db'));
electron_1.ipcMain.handle('get-log-path', () => logFile);
electron_1.ipcMain.handle('open-log', () => electron_1.shell.openPath(logFile));
electron_1.ipcMain.handle('open-devtools', () => mainWindow?.webContents.openDevTools());
electron_1.ipcMain.handle('relaunch-app', () => { electron_1.app.relaunch(); electron_1.app.quit(); });
// App lifecycle
electron_1.app.whenReady().then(async () => {
    log('=== Tariq Karyana Store Starting ===');
    log(`Electron: ${process.versions.electron} Node: ${process.versions.node}`);
    log(`Platform: ${process.platform} ${process.arch} Version: ${electron_1.app.getVersion()}`);
    log(`isPackaged: ${electron_1.app.isPackaged}`);
    log(`resourcesPath: ${process.resourcesPath}`);
    log(`__dirname: ${__dirname}`);
    log(`execPath: ${process.execPath}`);
    // Diagnose standalone directory contents
    const sd = getStandaloneDir();
    log(`Standalone dir: ${sd}`);
    log(`Standalone dir exists: ${fs_1.default.existsSync(sd)}`);
    if (fs_1.default.existsSync(sd)) {
        try {
            const items = fs_1.default.readdirSync(sd);
            log(`Standalone top-level contents: ${items.slice(0, 20).join(', ')}`);
            log(`server.js exists: ${fs_1.default.existsSync(path_1.default.join(sd, 'server.js'))}`);
            log(`.next/static exists: ${fs_1.default.existsSync(path_1.default.join(sd, '.next', 'static'))}`);
            log(`public exists: ${fs_1.default.existsSync(path_1.default.join(sd, 'public'))}`);
            const nm = path_1.default.join(sd, 'node_modules');
            if (fs_1.default.existsSync(nm)) {
                const nmItems = fs_1.default.readdirSync(nm);
                log(`node_modules (${nmItems.length} entries): ${nmItems.slice(0, 20).join(', ')}`);
            }
            else {
                log(`WARNING: node_modules not found in standalone dir!`);
            }
        }
        catch (e) {
            log(`Error listing standalone dir: ${e.message}`);
        }
    }
    else {
        log(`ERROR: Standalone directory does not exist!`);
    }
    try {
        log('Starting server...');
        const port = await startServer();
        log(`Server started on port ${port}`);
        createWindow(port);
        log('=== App Ready ===');
    }
    catch (err) {
        log(`FATAL: ${err.message}\n${err.stack}`);
        electron_1.dialog.showErrorBox('Startup Error', `${err.message}\n\nCheck log: ${logFile}`);
        electron_1.app.quit();
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow(serverPort);
    });
});
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
electron_1.app.on('before-quit', () => {
    if (childServer) {
        // Use child.kill() without signal argument for cross-platform compatibility.
        // On POSIX this sends SIGTERM; on Windows it calls TerminateProcess.
        childServer.kill();
        childServer = null;
    }
});
electron_1.app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
