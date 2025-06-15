
// Secure session management
interface SessionData {
  apiKeyHash?: string;
  userPreferences?: Record<string, any>;
  securityFlags?: {
    apiKeyValidated: boolean;
    lastValidation: number;
    failedAttempts: number;
  };
}

class SecureSessionManager {
  private static instance: SecureSessionManager;
  private sessionKey = 'secure-watermark-session';
  private maxFailedAttempts = 5;
  private lockoutDuration = 15 * 60 * 1000; // 15 minutes
  
  private constructor() {
    this.initializeSession();
  }
  
  static getInstance(): SecureSessionManager {
    if (!SecureSessionManager.instance) {
      SecureSessionManager.instance = new SecureSessionManager();
    }
    return SecureSessionManager.instance;
  }
  
  private initializeSession(): void {
    // Clean up any insecure data from localStorage
    this.migrateInsecureData();
    
    // Validate existing session
    this.validateSession();
  }
  
  private migrateInsecureData(): void {
    // Move any insecure data to secure storage or remove it
    const insecureKeys = ['sd-api-key', 'api-key', 'watermark-settings'];
    
    insecureKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        console.warn(`[Security] Removing insecure data: ${key}`);
        localStorage.removeItem(key);
      }
    });
  }
  
  private validateSession(): void {
    const session = this.getSessionData();
    
    // Check if session is locked due to too many failed attempts
    if (this.isSessionLocked(session)) {
      console.warn('[Security] Session locked due to security violations');
      this.clearSession();
      return;
    }
    
    // Validate API key if present
    if (session.apiKeyHash && session.securityFlags?.apiKeyValidated) {
      const timeSinceValidation = Date.now() - (session.securityFlags.lastValidation || 0);
      
      // Force re-validation after 1 hour
      if (timeSinceValidation > 60 * 60 * 1000) {
        session.securityFlags.apiKeyValidated = false;
        this.setSessionData(session);
      }
    }
  }
  
  private isSessionLocked(session: SessionData): boolean {
    const flags = session.securityFlags;
    if (!flags || flags.failedAttempts < this.maxFailedAttempts) {
      return false;
    }
    
    const timeSinceLock = Date.now() - (flags.lastValidation || 0);
    return timeSinceLock < this.lockoutDuration;
  }
  
  getSessionData(): SessionData {
    try {
      const data = sessionStorage.getItem(this.sessionKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('[Security] Failed to parse session data:', error);
      return {};
    }
  }
  
  setSessionData(data: SessionData): void {
    try {
      sessionStorage.setItem(this.sessionKey, JSON.stringify(data));
    } catch (error) {
      console.error('[Security] Failed to save session data:', error);
    }
  }
  
  updateSecurityFlags(updates: Partial<SessionData['securityFlags']>): void {
    const session = this.getSessionData();
    session.securityFlags = { ...session.securityFlags, ...updates };
    this.setSessionData(session);
  }
  
  recordFailedAttempt(): void {
    const session = this.getSessionData();
    const flags = session.securityFlags || { apiKeyValidated: false, lastValidation: 0, failedAttempts: 0 };
    
    flags.failedAttempts = (flags.failedAttempts || 0) + 1;
    flags.lastValidation = Date.now();
    
    session.securityFlags = flags;
    this.setSessionData(session);
    
    if (flags.failedAttempts >= this.maxFailedAttempts) {
      console.warn('[Security] Session locked due to multiple failed attempts');
    }
  }
  
  recordSuccessfulValidation(): void {
    const session = this.getSessionData();
    session.securityFlags = {
      apiKeyValidated: true,
      lastValidation: Date.now(),
      failedAttempts: 0,
    };
    this.setSessionData(session);
  }
  
  clearSession(): void {
    sessionStorage.removeItem(this.sessionKey);
    
    // Also clear any related secure data
    sessionStorage.removeItem('sd-api-key-hash');
  }
  
  isSessionValid(): boolean {
    const session = this.getSessionData();
    return !this.isSessionLocked(session);
  }
  
  setUserPreference(key: string, value: any): void {
    const session = this.getSessionData();
    session.userPreferences = session.userPreferences || {};
    session.userPreferences[key] = value;
    this.setSessionData(session);
  }
  
  getUserPreference(key: string, defaultValue?: any): any {
    const session = this.getSessionData();
    return session.userPreferences?.[key] ?? defaultValue;
  }
}

export const secureSession = SecureSessionManager.getInstance();
