import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),

  // Auto-update APIs
  checkForUpdates: () => ipcRenderer.send('check-updates-manual'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (callback: (data: { status: string; message: string; currentVersion: string; percent?: number }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // Printer APIs
  printerListPorts: () => ipcRenderer.invoke('printer-list-ports'),
  printerAutoDetect: () => ipcRenderer.invoke('printer-auto-detect'),
  printerTest: (comPort: string, baudRate?: number) => ipcRenderer.invoke('printer-test', comPort, baudRate),
  printerPrint: (comPort: string, data: string, baudRate?: number) => ipcRenderer.invoke('printer-print', comPort, data, baudRate),
});