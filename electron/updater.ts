import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

// Configure auto-updater for Windows NSIS - delta updates
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  log.info(`[Updater] Current version: ${app.getVersion()}`);
  log.info(`[Updater] Feed URL: https://github.com/mohsin-rasheedbaga/Tariq-Karyana-Store/releases/latest`);

  // Set the feed URL to GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mohsin-rasheedbaga',
    repo: 'Tariq-Karyana-Store',
  });

  // Check for updates on startup (with a delay to let app settle)
  setTimeout(() => {
    log.info('[Updater] Auto-checking for updates on startup...');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[Updater] Auto-update check failed:', err);
      sendUpdateStatus(mainWindow, 'error', `Update check failed: ${err.message}`);
    });
  }, 10000);

  // Auto-update events → send unified 'update-status' to renderer
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
    sendUpdateStatus(mainWindow, 'checking', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[Updater] Update available: v${info.version} (current: v${app.getVersion()})`);
    sendUpdateStatus(mainWindow, 'available', `Version ${info.version} is available! Downloading...`);
    // Auto-download since we set autoDownload = true
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    const speed = progress.bytesPerSecond ? `${(progress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s` : '';
    const msg = `Downloading update... ${percent}% ${speed}`.trim();
    log.info(`[Updater] Download progress: ${percent}%`);
    sendUpdateStatus(mainWindow, 'downloading', msg, percent);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[Updater] Update downloaded: v${info.version}`);
    sendUpdateStatus(mainWindow, 'downloaded', `Version ${info.version} is ready to install!`);

    // Show dialog to install
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded!`,
        detail: 'Click "Restart Now" to install the update. The app will close and reopen with the new version.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        noLink: true,
      }).then(({ response }) => {
        if (response === 0) {
          log.info('[Updater] User chose to restart and install');
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info(`[Updater] No update available. Current: v${app.getVersion()}`);
    sendUpdateStatus(mainWindow, 'not-available', `You are on the latest version (v${app.getVersion()})`);
  });

  autoUpdater.on('error', (err) => {
    log.error(`[Updater] Error: ${err.message}`);
    // Only show error to user on manual check, not auto-check
    sendUpdateStatus(mainWindow, 'error', `Update error: ${err.message}`);
  });
}

function sendUpdateStatus(window: BrowserWindow, status: string, message: string, percent?: number) {
  try {
    if (window && !window.isDestroyed()) {
      window.webContents.send('update-status', {
        status,
        message,
        currentVersion: app.getVersion(),
        percent: percent ?? undefined,
      });
    }
  } catch {}
}

// IPC handler for manual update check (from renderer)
ipcMain.on('check-updates-manual', () => {
  log.info('[Updater] Manual update check requested');
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('[Updater] Manual update check failed:', err);
  });
});

// IPC handler to install update (from renderer)
ipcMain.on('install-update', () => {
  log.info('[Updater] Install update requested');
  autoUpdater.quitAndInstall();
});