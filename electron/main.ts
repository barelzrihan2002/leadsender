import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, Menu, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import { initDatabase } from './database/index';
import { setupIPCHandlers, campaignScheduler, warmUpService } from './ipc';
import { logger } from './logger';

// Register custom protocol for serving local files (e.g. chat photos)
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

// Initialize logger immediately to capture all logs
console.log('🚀 LeadSender starting...');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // In production, __dirname points to dist-electron
  // In dev, we need to use process.cwd()
  const isDev = process.env.VITE_DEV_SERVER_URL;
  
  const preloadPath = isDev 
    ? path.join(process.cwd(), 'dist-electron', 'preload.js')
    : path.join(__dirname, 'preload.js');
    
  const iconPath = isDev
    ? path.join(process.cwd(), 'src', 'images', 'lead-icon.png')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'assets', 'lead-icon-BXeTX-9O.png');
  
  console.log('Is Dev:', isDev);
  console.log('__dirname:', __dirname);
  console.log('process.cwd():', process.cwd());
  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', require('fs').existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath,
    autoHideMenuBar: true, // Hide menu bar
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev ? true : false // Enable DevTools only in development
    },
  });

  // Remove menu completely
  mainWindow.setMenuBarVisibility(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    // Development mode - load from dev server
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open DevTools in dev mode for debugging
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    // DO NOT open DevTools in production
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // DevTools control in production
  if (!isDev) {
    // Block default DevTools shortcuts
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Block F12
      if (input.key === 'F12') {
        event.preventDefault();
      }
      // Block Ctrl+Shift+I (Windows/Linux)
      if (input.control && input.shift && input.key === 'I') {
        event.preventDefault();
      }
      // Block Cmd+Option+I (Mac)
      if (input.meta && input.alt && input.key === 'I') {
        event.preventDefault();
      }
      
      // Allow Ctrl+Shift+D as secret DevTools toggle
      if (input.control && input.shift && input.key === 'D') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }
    });
  }

  // Enable right-click context menu for input fields
  // This is essential for copy/paste in Electron apps
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags, selectionText, isEditable } = params;
    
    // Show context menu for editable fields (input, textarea, contenteditable)
    if (isEditable || params.inputFieldType === 'plainText') {
      const hasText = selectionText && selectionText.length > 0;
      
      const menu = Menu.buildFromTemplate([
        {
          label: 'Cut',
          role: 'cut',
          accelerator: 'CmdOrCtrl+X',
          enabled: editFlags.canCut && hasText,
          visible: hasText
        },
        {
          label: 'Copy',
          role: 'copy',
          accelerator: 'CmdOrCtrl+C',
          enabled: editFlags.canCopy && hasText,
          visible: hasText
        },
        {
          label: 'Paste',
          role: 'paste',
          accelerator: 'CmdOrCtrl+V',
          enabled: editFlags.canPaste
        },
        {
          label: 'Delete',
          role: 'delete',
          enabled: editFlags.canDelete && hasText,
          visible: hasText
        },
        { 
          type: 'separator',
          visible: hasText
        },
        {
          label: 'Select All',
          role: 'selectAll',
          accelerator: 'CmdOrCtrl+A',
          enabled: editFlags.canSelectAll
        }
      ]);
      
      menu.popup();
    }
  });
}

// ==================== AUTO-UPDATER ====================
function setupAutoUpdater() {
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
    mainWindow?.webContents.send('updater:checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version);
    mainWindow?.webContents.send('updater:update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('✅ App is up to date:', info.version);
    mainWindow?.webContents.send('updater:update-not-available');
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Error in auto-updater:', err);
    mainWindow?.webContents.send('updater:error', err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const log = `Downloaded ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`;
    console.log('⬇️', log);
    mainWindow?.webContents.send('updater:download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    mainWindow?.webContents.send('updater:update-downloaded', {
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

// Export function to manually check for updates
export function checkForUpdates() {
  return autoUpdater.checkForUpdates();
}

// Export function to download update
export function downloadUpdate() {
  return autoUpdater.downloadUpdate();
}

// Export function to install update
export function quitAndInstall() {
  autoUpdater.quitAndInstall();
}

app.whenReady().then(async () => {
  // Register protocol handler for local files (chat photos, etc.)
  protocol.handle('local-file', (request) => {
    // URL comes as local-file:///C:/Users/... — strip scheme and leading slash before drive letter
    let filePath = decodeURIComponent(request.url.slice('local-file:///'.length));
    filePath = filePath.replace(/\//g, '\\');
    console.log('📸 local-file protocol - raw URL:', request.url);
    console.log('📸 local-file protocol - resolved path:', filePath);
    console.log('📸 local-file protocol - file exists:', fs.existsSync(filePath));
    try {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      };
      return new Response(data, {
        headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  // Initialize database
  await initDatabase();

  // Setup IPC handlers
  setupIPCHandlers();

  createWindow();
  
  // Setup auto-updater (after window is created)
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save state before quitting (campaigns and warmup will auto-resume on next start)
app.on('before-quit', () => {
  console.log('💾 App closing - state will be preserved in database for auto-resume');
  
  // Note: We don't need to do anything here!
  // The campaigns and warm-up sessions have status = 'running' in DB
  // They will auto-resume when the app starts again
  
  // Optional: You could pause everything here if you want manual resume instead:
  // campaignScheduler.pauseAll();
  // warmUpService.stopAll();
});

export { mainWindow };
