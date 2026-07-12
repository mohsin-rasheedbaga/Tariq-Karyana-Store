interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getAppDataPath: () => Promise<string>;
  getDbPath: () => Promise<string>;
  relaunchApp: () => Promise<void>;
  // Auto-update
  checkForUpdates: () => void;
  installUpdate: () => void;
  onUpdateStatus: (callback: (data: { status: string; message: string; currentVersion: string; percent?: number }) => void) => () => void;
  // Printer
  printerListPorts: () => Promise<Array<{ path: string; manufacturer?: string }>>;
  printerAutoDetect: () => Promise<string | null>;
  printerTest: (comPort: string, baudRate?: number) => Promise<{ success: boolean; message: string }>;
  printerPrint: (comPort: string, data: string, baudRate?: number) => Promise<{ success: boolean; message: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};