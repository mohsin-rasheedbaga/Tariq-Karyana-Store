import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';
autoUpdater.logger = log;

// Configure auto-updater for delta updates
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

// Enable differential downloads (delta updates)
(autoUpdater as any).downloadUpdate = async function (updateInfo: any) {
  // electron-updater handles differential downloads automatically
  // when blockmap files are available on the release
  return (autoUpdater as any).downloadUpdate(updateInfo);
};

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  // Set the feed URL to GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mohsin-rasheedbaga',
    repo: 'Tariq-Karyana-Store',
  });

  // Check for updates on startup (with a small delay)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Auto-update check failed:', err);
    });
  }, 3000);

  // Auto-update events
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    mainWindow.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`Update available: ${info.version}`);
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });

    // Show dialog to user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available!`,
      detail: 'A new version is available. It will be downloaded automatically. The update will be installed when you restart the app.',
      buttons: ['Download Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    log.info(`Download progress: ${percent}%`);
    mainWindow.webContents.send('update-progress', {
      percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`Update downloaded: ${info.version}`);
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
    });

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded!`,
      detail: 'The update will be installed when you restart the application. Click "Restart Now" to update immediately.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('No update available.');
    mainWindow.webContents.send('update-status', {
      status: 'not-available',
      currentVersion: autoUpdater.currentVersion?.version || app.getVersion(),
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('Update error:', err);
    mainWindow.webContents.send('update-error', err.message);
  });
}

// IPC handler for manual update check
ipcMain.on('check-updates-manual', () => {
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Manual update check failed:', err);
  });
});

// IPC handler to install update
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});