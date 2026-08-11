import { autoUpdater } from 'electron-updater';
// Kept separate from main.ts to avoid a circular import (main.ts -> ipc.ts -> main.ts).
// main.ts has top-level side effects (protocol.registerSchemesAsPrivileged) that must run
// before app is ready; if ipc.ts imports from main.ts, bundling can duplicate that top-level
// code into a lazily-loaded chunk, re-running it after the app is already ready and crashing.
let mainWindowRef = null;
export function setUpdaterMainWindow(win) {
    mainWindowRef = win;
}
export function setupAutoUpdater() {
    const isDev = process.env.VITE_DEV_SERVER_URL;
    // Don't check for updates in development mode
    if (isDev) {
        console.log('🔧 Development mode - auto-updater disabled');
        return;
    }
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Don't download automatically - ask user first
    autoUpdater.autoInstallOnAppQuit = true; // Install automatically when app quits
    // Log all auto-updater events
    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 Checking for updates...');
        mainWindowRef?.webContents.send('updater:checking-for-update');
    });
    autoUpdater.on('update-available', (info) => {
        console.log('✅ Update available:', info.version);
        mainWindowRef?.webContents.send('updater:update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
    });
    autoUpdater.on('update-not-available', (info) => {
        console.log('✅ App is up to date:', info.version);
        mainWindowRef?.webContents.send('updater:update-not-available');
    });
    autoUpdater.on('error', (err) => {
        console.error('❌ Error in auto-updater:', err);
        mainWindowRef?.webContents.send('updater:error', err.message);
    });
    autoUpdater.on('download-progress', (progressObj) => {
        const log = `Downloaded ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`;
        console.log('⬇️', log);
        mainWindowRef?.webContents.send('updater:download-progress', {
            percent: progressObj.percent,
            transferred: progressObj.transferred,
            total: progressObj.total,
            bytesPerSecond: progressObj.bytesPerSecond
        });
    });
    autoUpdater.on('update-downloaded', (info) => {
        console.log('✅ Update downloaded:', info.version);
        mainWindowRef?.webContents.send('updater:update-downloaded', {
            version: info.version
        });
    });
    // Check for updates when app starts (after a 3-second delay to let the app load)
    setTimeout(() => {
        console.log('🚀 Starting auto-update check...');
        autoUpdater.checkForUpdates().catch(err => {
            console.error('❌ Failed to check for updates:', err);
        });
    }, 3000);
}
// Manually check for updates
export function checkForUpdates() {
    return autoUpdater.checkForUpdates();
}
// Download update
export function downloadUpdate() {
    return autoUpdater.downloadUpdate();
}
// Install update
export function quitAndInstall() {
    autoUpdater.quitAndInstall();
}
