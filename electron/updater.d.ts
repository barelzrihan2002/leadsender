import type { BrowserWindow } from 'electron';
export declare function setUpdaterMainWindow(win: BrowserWindow | null): void;
export declare function setupAutoUpdater(): void;
export declare function checkForUpdates(): Promise<import("electron-updater").UpdateCheckResult>;
export declare function downloadUpdate(): Promise<string[]>;
export declare function quitAndInstall(): void;
