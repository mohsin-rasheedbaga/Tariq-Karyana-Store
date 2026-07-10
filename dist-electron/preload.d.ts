declare global {
    interface Window {
        electronAPI?: {
            getAppVersion: () => Promise<string>;
            getAppDataPath: () => Promise<string>;
            getDbPath: () => Promise<string>;
            checkForUpdates: () => Promise<{
                checking: boolean;
                message?: string;
            }>;
            relaunchApp: () => Promise<void>;
            onUpdateAvailable: (callback: (info: {
                version: string;
                releaseDate: string;
                releaseNotes: string;
            }) => void) => void;
            onUpdateProgress: (callback: (progress: {
                percent: number;
                bytesPerSecond: number;
            }) => void) => void;
            onUpdateDownloaded: (callback: (info: {
                version: string;
            }) => void) => void;
            onUpdateError: (callback: (error: string) => void) => void;
            installUpdate: () => void;
        };
    }
}
export {};
