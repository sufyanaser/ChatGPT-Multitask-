import { session, Session } from 'electron';

export class SessionManager {
  private static instance: SessionManager;
  private persistentSession: Session | null = null;
  private readonly partition = 'persist:chatgpt';

  // Allowed domain patterns for ChatGPT and official authentication providers
  private readonly allowedOrigins = [
    'chatgpt.com',
    'oaistatic.com',
    'oaiusercontent.com',
    'openai.com',
    'auth0.openai.com',
    'accounts.google.com',
    'appleid.apple.com',
    'login.microsoftonline.com',
    'live.com'
  ];

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public getSession(): Session {
    if (!this.persistentSession) {
      this.persistentSession = session.fromPartition(this.partition);
      this.configureSession(this.persistentSession);
    }
    return this.persistentSession;
  }

  public isUrlAllowed(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return false;
      }
      return this.allowedOrigins.some(domain =>
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  private configureSession(sess: Session): void {
    // Standard Chromium session configuration without User-Agent spoofing or bot mitigation.

    // 1. Standard Permission Request Handler
    sess.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || webContents.getURL();
      const isAllowedOrigin = this.isUrlAllowed(requestingUrl);

      if (!isAllowedOrigin) {
        callback(false);
        return;
      }

      // Allow essential ChatGPT permissions: microphone, clipboard, notifications
      const allowedPermissions = [
        'media',
        'clipboard-read',
        'clipboard-sanitized-write',
        'notifications',
        'fullscreen'
      ];

      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        callback(false);
      }
    });

    // 2. Download management
    sess.on('will-download', (_event, item) => {
      console.log(`[SessionManager] Download started: ${item.getFilename()} (${item.getTotalBytes()} bytes)`);

      item.once('done', (_event, state) => {
        if (state === 'completed') {
          console.log(`[SessionManager] Download completed: ${item.getSavePath()}`);
        } else {
          console.warn(`[SessionManager] Download state: ${state}`);
        }
      });
    });
  }
}
