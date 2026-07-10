import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),

  // Printer APIs
  printerListPorts: () => ipcRenderer.invoke('printer-list-ports'),
  printerAutoDetect: () => ipcRenderer.invoke('printer-auto-detect'),
  printerTest: (comPort: string, baudRate?: number) => ipcRenderer.invoke('printer-test', comPort, baudRate),
  printerPrint: (comPort: string, data: string, baudRate?: number) => ipcRenderer.invoke('printer-print', comPort, data, baudRate),

  // Update events
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateProgress: (callback: (progress: { percent: number; bytesPerSecond: number }) => void) => {
    ipcRenderer.on('update-progress', (_event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },
  installUpdate: () => ipcRenderer.send('install-update'),
});

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getAppDataPath: () => Promise<string>;
      getDbPath: () => Promise<string>;
      checkForUpdates: () => Promise<{ checking: boolean; message?: string }>;
      relaunchApp: () => Promise<void>;
      printerListPorts: () => Promise<Array<{ path: string; manufacturer?: string }>>;
      printerAutoDetect: () => Promise<string | null>;
      printerTest: (comPort: string, baudRate?: number) => Promise<{ success: boolean; message: string }>;
      printerPrint: (comPort: string, data: string, baudRate?: number) => Promise<{ success: boolean; message: string }>;
      onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: string }) => void) => void;
      onUpdateProgress: (callback: (progress: { percent: number; bytesPerSecond: number }) => void) => void;
      onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      installUpdate: () => void;
    };
  }
}