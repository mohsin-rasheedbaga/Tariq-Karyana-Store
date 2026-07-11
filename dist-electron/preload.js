"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getAppDataPath: () => electron_1.ipcRenderer.invoke('get-app-data-path'),
    getDbPath: () => electron_1.ipcRenderer.invoke('get-db-path'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    relaunchApp: () => electron_1.ipcRenderer.invoke('relaunch-app'),
    // Printer APIs
    printerListPorts: () => electron_1.ipcRenderer.invoke('printer-list-ports'),
    printerAutoDetect: () => electron_1.ipcRenderer.invoke('printer-auto-detect'),
    printerTest: (comPort, baudRate) => electron_1.ipcRenderer.invoke('printer-test', comPort, baudRate),
    printerPrint: (comPort, data, baudRate) => electron_1.ipcRenderer.invoke('printer-print', comPort, data, baudRate),
    // Update events
    onUpdateAvailable: (callback) => {
        electron_1.ipcRenderer.on('update-available', (_event, info) => callback(info));
    },
    onUpdateProgress: (callback) => {
        electron_1.ipcRenderer.on('update-progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback) => {
        electron_1.ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
    },
    onUpdateError: (callback) => {
        electron_1.ipcRenderer.on('update-error', (_event, error) => callback(error));
    },
    installUpdate: () => electron_1.ipcRenderer.send('install-update'),
});
