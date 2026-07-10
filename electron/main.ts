import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import net from 'net';
import fs from 'fs';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { setupAutoUpdater } from './updater';

let mainWindow: BrowserWindow | null = null;
let childServer: ChildProcess | null = null;
let serverPort = 3000;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

// Logging
const logFile = path.join(app.getPath('userData'), 'app.log');
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  console.log(msg);
}

// Find free port
function findFreePort(start: number): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(start, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
    s.on('error', () => findFreePort(start + 1).then(resolve));
  });
}

// Ensure data dir
function ensureDataDir(): string {
  const d = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Get standalone directory path.
 * - Packaged app: extraResources are placed in <app>/resources/ (OUTSIDE asar).
 *   process.resourcesPath resolves to this directory.
 * - Dev mode: use the local .next/standalone from project root.
 */
function getStandaloneDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'standalone');
  }
  return path.join(__dirname, '..', '.next', 'standalone');
}

// Build the DATABASE_URL with proper cross-platform path handling for SQLite
function buildDatabaseUrl(dataDir: string): string {
  const dbPath = path.join(dataDir, 'custom.db');
  // Normalize to forward slashes for the URL
  const normalizedPath = dbPath.replace(/\\/g, '/');

  // file:// URI format for absolute paths
  if (path.isAbsolute(normalizedPath)) {
    if (normalizedPath.startsWith('/')) {
      // Unix: /path/to/db -> file:///path/to/db
      return `file://${normalizedPath}`;
    } else {
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
async function startServer(): Promise<number> {
  serverPort = await findFreePort(3000);
  const dataDir = ensureDataDir();
  const dbUrl = buildDatabaseUrl(dataDir);
  const standaloneDir = getStandaloneDir();
  const nmPath = path.join(standaloneDir, 'node_modules');

  log('=== Server Startup Configuration ===');
  log(`standaloneDir: ${standaloneDir}`);
  log(`dataDir: ${dataDir}`);
  log(`DATABASE_URL: ${dbUrl}`);
  log(`PORT: ${serverPort}`);
  log(`isPackaged: ${app.isPackaged}`);
  log(`resourcesPath: ${process.resourcesPath}`);
  log(`__dirname: ${__dirname}`);
  log(`execPath: ${process.execPath}`);

  // Verify standalone directory
  if (!fs.existsSync(standaloneDir)) {
    const msg = `Standalone directory not found: ${standaloneDir}`;
    log(`FATAL: ${msg}`);
    throw new Error(msg);
  }

  // Verify server.js
  const serverScript = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverScript)) {
    const msg = `server.js not found at ${serverScript}`;
    log(`FATAL: ${msg}`);
    throw new Error(msg);
  }

  // Verify node_modules exists
  if (!fs.existsSync(nmPath)) {
    const msg = `node_modules not found at ${nmPath}`;
    log(`FATAL: ${msg}`);
    throw new Error(msg);
  }

  // CRITICAL: Verify the 'next' module exists in standalone node_modules
  const nextModulePath = path.join(nmPath, 'next');
  if (!fs.existsSync(nextModulePath)) {
    const msg = `'next' module not found at ${nextModulePath}. The build may be incomplete.`;
    log(`FATAL: ${msg}`);
    throw new Error(msg);
  }
  log(`next module verified at: ${nextModulePath}`);

  // Also verify styled-jsx (commonly missing sub-dependency of next)
  const styledJsxPath = path.join(nmPath, 'styled-jsx');
  if (!fs.existsSync(styledJsxPath)) {
    const msg = `'styled-jsx' module not found at ${styledJsxPath}. Build is incomplete.`;
    log(`FATAL: ${msg}`);
    throw new Error(msg);
  }
  log(`styled-jsx module verified at: ${styledJsxPath}`);

  // Verify Prisma engine binary exists
  const prismaClientDir = path.join(nmPath, '.prisma', 'client');
  if (fs.existsSync(prismaClientDir)) {
    const engineFiles = fs.readdirSync(prismaClientDir).filter(
      f => f.endsWith('.node') || f.endsWith('.exe') || f.endsWith('.dll')
    );
    log(`Prisma engine files found: ${engineFiles.length > 0 ? engineFiles.join(', ') : 'NONE - may use library mode'}`);

    // Log all files in .prisma/client for debugging
    log(`.prisma/client contents: ${fs.readdirSync(prismaClientDir).slice(0, 20).join(', ')}`);
  } else {
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
  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'production',
    PORT: String(serverPort),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: dbUrl,
    ELECTRON_RUN_AS_NODE: '1',
    // NODE_PATH helps Node.js resolve bare module specifiers from the
    // standalone directory's node_modules even if cwd resolution fails
    NODE_PATH: nmPath,
  };

  return new Promise<number>((resolve, reject) => {
    let childExited = false;
    let childExitCode: number | null = null;
    let stderrBuf = '';

    const child = spawn(process.execPath, [serverScript], {
      env: childEnv,
      cwd: standaloneDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    childServer = child;

    // Capture output
    child.stdout?.on('data', (d: Buffer) => {
      const msg = d.toString().trimEnd();
      log(`[Server OUT] ${msg}`);
    });

    child.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trimEnd();
      log(`[Server ERR] ${msg}`);
      stderrBuf += msg + '\n';
    });

    child.on('error', (e: Error) => {
      log(`[Server FATAL] spawn error: ${e.message}`);
      if (!childExited) {
        childExited = true;
        reject(new Error(`Failed to spawn server process: ${e.message}`));
      }
    });

    child.on('exit', (code: number | null, signal: string | null) => {
      log(`[Server EXIT] code=${code} signal=${signal}`);
      childExited = true;
      childExitCode = code;
      // If server crashes before we create the window, reject immediately
      if (code !== null && code !== 0 && !mainWindow) {
        reject(new Error(
          `Server exited with code ${code}.\n\nstderr:\n${stderrBuf.slice(-2000)}`
        ));
      }
    });

    // Poll for server readiness
    let attempts = 0;
    const maxAttempts = 60;

    const check = () => {
      // If child already crashed, fail fast
      if (childExited && childExitCode !== null && childExitCode !== 0) {
        reject(new Error(
          `Server process exited with code ${childExitCode}.\n\nstderr:\n${stderrBuf.slice(-2000)}\n\nCheck log: ${logFile}`
        ));
        return;
      }

      attempts++;

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: serverPort,
          path: '/',
          method: 'GET',
          timeout: 2000,
        },
        (res) => {
          log(`Server ready after ${attempts} attempts (status: ${res.statusCode})`);
          try { res.destroy(); } catch {}
          resolve(serverPort);
        }
      );

      req.on('error', () => {
        if (attempts < maxAttempts) {
          if (attempts % 10 === 0) {
            log(`Waiting for server... attempt ${attempts}/${maxAttempts}`);
          }
          setTimeout(check, 1000);
        } else {
          log(`Server failed to respond after ${maxAttempts} attempts`);
          // Don't reject - let the loading page show the error
          resolve(serverPort);
        }
      });

      req.on('timeout', () => {
        try { req.destroy(); } catch {}
        if (attempts < maxAttempts) {
          setTimeout(check, 1000);
        } else {
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
function writeLoadingHTML(port: number): string {
  const p = path.join(app.getPath('userData'), 'loading.html');
  fs.writeFileSync(p, `<!DOCTYPE html>
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
function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700,
    title: 'Tariq Karyana Store - POS System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    show: false,
  });

  const loadingPath = writeLoadingHTML(port);
  mainWindow.loadFile(loadingPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (app.isPackaged) setupAutoUpdater(mainWindow!);
  });

  // Open DevTools on F12
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I'))
      mainWindow?.webContents.toggleDevTools();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-data-path', () => app.getPath('userData'));
ipcMain.handle('get-db-path', () => path.join(ensureDataDir(), 'custom.db'));
ipcMain.handle('get-log-path', () => logFile);
ipcMain.handle('open-log', () => shell.openPath(logFile));
ipcMain.handle('open-devtools', () => mainWindow?.webContents.openDevTools());
ipcMain.handle('relaunch-app', () => { app.relaunch(); app.quit(); });

// App lifecycle
app.whenReady().then(async () => {
  log('=== Tariq Karyana Store Starting ===');
  log(`Electron: ${process.versions.electron} Node: ${process.versions.node}`);
  log(`Platform: ${process.platform} ${process.arch} Version: ${app.getVersion()}`);
  log(`isPackaged: ${app.isPackaged}`);
  log(`resourcesPath: ${process.resourcesPath}`);
  log(`__dirname: ${__dirname}`);
  log(`execPath: ${process.execPath}`);

  // Diagnose standalone directory contents
  const sd = getStandaloneDir();
  log(`Standalone dir: ${sd}`);
  log(`Standalone dir exists: ${fs.existsSync(sd)}`);
  if (fs.existsSync(sd)) {
    try {
      const items = fs.readdirSync(sd);
      log(`Standalone top-level contents: ${items.slice(0, 20).join(', ')}`);
      log(`server.js exists: ${fs.existsSync(path.join(sd, 'server.js'))}`);
      log(`.next/static exists: ${fs.existsSync(path.join(sd, '.next', 'static'))}`);
      log(`public exists: ${fs.existsSync(path.join(sd, 'public'))}`);

      const nm = path.join(sd, 'node_modules');
      if (fs.existsSync(nm)) {
        const nmItems = fs.readdirSync(nm);
        log(`node_modules (${nmItems.length} entries): ${nmItems.slice(0, 20).join(', ')}`);
      } else {
        log(`WARNING: node_modules not found in standalone dir!`);
      }
    } catch (e: any) {
      log(`Error listing standalone dir: ${e.message}`);
    }
  } else {
    log(`ERROR: Standalone directory does not exist!`);
  }

  try {
    log('Starting server...');
    const port = await startServer();
    log(`Server started on port ${port}`);
    createWindow(port);
    log('=== App Ready ===');
  } catch (err: any) {
    log(`FATAL: ${err.message}\n${err.stack}`);
    dialog.showErrorBox('Startup Error', `${err.message}\n\nCheck log: ${logFile}`);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverPort);
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', () => {
  if (childServer) {
    // Use child.kill() without signal argument for cross-platform compatibility.
    // On POSIX this sends SIGTERM; on Windows it calls TerminateProcess.
    childServer.kill();
    childServer = null;
  }
});

app.on('second-instance', () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});