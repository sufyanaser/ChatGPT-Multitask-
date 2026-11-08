import { app, BrowserWindow } from 'electron';
import { WindowManager } from './window-manager';
import { SessionManager } from './session-manager';

// Performance optimizations for Windows (GPU rasterization, zero-copy video/image buffers)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Stable Windows taskbar identity (must match the NSIS appId) for notifications
// and correct grouping of the installed application.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.chatgpt.multitask');
}

// Ensure single instance of the application
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let windowManager: WindowManager | null = null;

  app.on('second-instance', () => {
    // Focus existing window if a second instance is launched
    const win = windowManager?.getWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // Initialize SessionManager with persistent storage and sanitized headers
    SessionManager.getInstance();

    windowManager = new WindowManager();
    windowManager.createWindow();

    app.on('activate', () => {
      // On macOS, recreate window when dock icon is clicked and no windows exist
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager = new WindowManager();
        windowManager.createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Global error safety
  process.on('uncaughtException', (err) => {
    console.error('[Main] Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Main] Unhandled Rejection:', reason);
  });
}
