"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAutoUpdater = setupAutoUpdater;
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
// Configure logging
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = 'info';
electron_updater_1.autoUpdater.logger = electron_log_1.default;
// Configure auto-updater for delta updates
electron_updater_1.autoUpdater.autoDownload = true;
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
electron_updater_1.autoUpdater.allowDowngrade = false;
// Enable differential downloads (delta updates)
electron_updater_1.autoUpdater.downloadUpdate = async function (updateInfo) {
    // electron-updater handles differential downloads automatically
    // when blockmap files are available on the release
    return electron_updater_1.autoUpdater.downloadUpdate(updateInfo);
};
function setupAutoUpdater(mainWindow) {
    // Set the feed URL to GitHub Releases
    electron_updater_1.autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'mohsin-rasheedbaga',
        repo: 'Tariq-Karyana-Store',
    });
    // Check for updates on startup (with a small delay)
    setTimeout(() => {
        electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
            electron_log_1.default.error('Auto-update check failed:', err);
        });
    }, 3000);
    // Auto-update events
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        electron_log_1.default.info('Checking for updates...');
        mainWindow.webContents.send('update-status', { status: 'checking' });
    });
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        electron_log_1.default.info(`Update available: ${info.version}`);
        mainWindow.webContents.send('update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
        });
        // Show dialog to user
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `Version ${info.version} is available!`,
            detail: 'A new version is available. It will be downloaded automatically. The update will be installed when you restart the app.',
            buttons: ['Download Now', 'Later'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) {
                electron_updater_1.autoUpdater.downloadUpdate();
            }
        });
    });
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        electron_log_1.default.info(`Download progress: ${percent}%`);
        mainWindow.webContents.send('update-progress', {
            percent,
            bytesPerSecond: progress.bytesPerSecond,
            transferred: progress.transferred,
            total: progress.total,
        });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        electron_log_1.default.info(`Update downloaded: ${info.version}`);
        mainWindow.webContents.send('update-downloaded', {
            version: info.version,
        });
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded!`,
            detail: 'The update will be installed when you restart the application. Click "Restart Now" to update immediately.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) {
                electron_updater_1.autoUpdater.quitAndInstall();
            }
        });
    });
    electron_updater_1.autoUpdater.on('update-not-available', (info) => {
        electron_log_1.default.info('No update available.');
        mainWindow.webContents.send('update-status', {
            status: 'not-available',
            currentVersion: electron_updater_1.autoUpdater.currentVersion?.version || electron_1.app.getVersion(),
        });
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        electron_log_1.default.error('Update error:', err);
        mainWindow.webContents.send('update-error', err.message);
    });
}
// IPC handler for manual update check
electron_1.ipcMain.on('check-updates-manual', () => {
    electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
        electron_log_1.default.error('Manual update check failed:', err);
    });
});
// IPC handler to install update
electron_1.ipcMain.on('install-update', () => {
    electron_updater_1.autoUpdater.quitAndInstall();
});
