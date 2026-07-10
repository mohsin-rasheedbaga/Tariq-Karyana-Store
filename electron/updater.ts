import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

// Configure auto-updater for Windows NSIS
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
autoUpdater.currentVersion = app.getVersion();

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  log.info(`[Updater] Current version: ${app.getVersion()}`);
  log.info(`[Updater] Feed URL: https://github.com/mohsin-rasheedbaga/Tariq-Karyana-Store/releases/latest`);

  // Set the feed URL to GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mohsin-rasheedbaga',
    repo: 'Tariq-Karyana-Store',
  });

  // Check for updates on startup (with a small delay to let app settle)
  setTimeout(() => {
    log.info('[Updater] Checking for updates...');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[Updater] Auto-update check failed:', err);
      sendUpdateStatus(mainWindow, 'error', `Update check failed: ${err.message}`);
    });
  }, 5000);

  // Auto-update events
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
    sendUpdateStatus(mainWindow, 'checking', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[Updater] Update available: v${info.version} (current: v${app.getVersion()})`);
    sendUpdateStatus(mainWindow, 'available', `Version ${info.version} is available!`);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available! (Current: v${app.getVersion()})`,
      detail: 'A new version is available. Click "Download Now" to update. The app will restart after download.',
      buttons: ['Download Now', 'Later'],
      defaultId: 0,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) {
        log.info('[Updater] User chose to download update');
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    log.info(`[Updater] Download progress: ${percent}%`);
    sendUpdateStatus(mainWindow, 'downloading', `Downloading update... ${percent}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[Updater] Update downloaded: v${info.version}`);
    sendUpdateStatus(mainWindow, 'downloaded', `Version ${info.version} ready to install`);

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
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info(`[Updater] No update available. Current: v${app.getVersion()}`);
    sendUpdateStatus(mainWindow, 'not-available', `You are on the latest version (v${app.getVersion()})`);
  });

  autoUpdater.on('error', (err) => {
    log.error(`[Updater] Error: ${err.message}`);
    // Don't spam the user with error dialogs, just log it
    // Common errors: network timeout, GitHub API rate limit
    sendUpdateStatus(mainWindow, 'error', `Update error: ${err.message}`);
  });
}

function sendUpdateStatus(window: BrowserWindow, status: string, message: string) {
  try {
    if (window && !window.isDestroyed()) {
      window.webContents.send('update-status', { status, message, currentVersion: app.getVersion() });
    }
  } catch {}
}

// IPC handler for manual update check
ipcMain.on('check-updates-manual', () => {
  log.info('[Updater] Manual update check requested');
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('[Updater] Manual update check failed:', err);
  });
});

// IPC handler to install update
ipcMain.on('install-update', () => {
  log.info('[Updater] Install update requested');
  autoUpdater.quitAndInstall();
});