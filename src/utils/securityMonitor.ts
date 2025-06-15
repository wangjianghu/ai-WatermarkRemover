// Security monitoring and audit logging system
interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'api_call' | 'file_upload' | 'session_violation' | 'xss_attempt' | 'rate_limit' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  recentViolations: number;
  blockedRequests: number;
  suspiciousPatterns: number;
}

class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: SecurityEvent[] = [];
  private maxEvents = 1000;
  private suspiciousPatterns: Map<string, number> = new Map();
  private blockedIPs: Set<string> = new Set();
  
  private constructor() {
    this.startPeriodicCleanup();
    this.loadPersistedData();
  }
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  logEvent(type: SecurityEvent['type'], severity: SecurityEvent['severity'], details: Record<string, any>): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type,
      severity,
      details,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId(),
    };
    
    // Add to events list
    this.events.unshift(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    
    // Handle critical events immediately
    if (severity === 'critical') {
      this.handleCriticalEvent(event);
    }
    
    // Update suspicious patterns
    this.updateSuspiciousPatterns(event);
    
    // Persist important events
    this.persistEvent(event);
    
    console.warn(`[Security] ${severity.toUpperCase()} - ${type}:`, details);
  }
  
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getSessionId(): string {
    const session = sessionStorage.getItem('secure-watermark-session');
    return session ? btoa(session.substring(0, 10)) : 'anonymous';
  }
  
  private handleCriticalEvent(event: SecurityEvent): void {
    // Lock down session for critical events
    if (event.type === 'xss_attempt' || event.type === 'suspicious_activity') {
      this.lockdownSession();
    }
    
    // Rate limit aggressively
    if (event.type === 'rate_limit') {
      this.temporaryBlock(event.sessionId || 'unknown');
    }
    
    // Clear sensitive data
    if (event.type === 'session_violation') {
      this.clearSensitiveData();
    }
  }
  
  private updateSuspiciousPatterns(event: SecurityEvent): void {
    const patternKey = `${event.type}_${event.sessionId}`;
    const count = this.suspiciousPatterns.get(patternKey) || 0;
    this.suspiciousPatterns.set(patternKey, count + 1);
    
    // Auto-block if too many suspicious events
    if (count > 5 && event.severity !== 'low') {
      this.logEvent('suspicious_activity', 'critical', {
        pattern: patternKey,
        count: count + 1,
        autoBlocked: true
      });
    }
  }
  
  private lockdownSession(): void {
    // Clear all session data
    sessionStorage.clear();
    localStorage.removeItem('security-violations');
    
    // Disable API operations
    sessionStorage.setItem('security-lockdown', Date.now().toString());
    
    console.error('[Security] Session locked down due to critical security event');
  }
  
  private temporaryBlock(identifier: string): void {
    this.blockedIPs.add(identifier);
    
    // Auto-unblock after 15 minutes
    setTimeout(() => {
      this.blockedIPs.delete(identifier);
    }, 15 * 60 * 1000);
  }
  
  private clearSensitiveData(): void {
    // Remove API keys and sensitive session data
    sessionStorage.removeItem('sd-api-key-hash');
    
    // Clear any cached file data
    const cacheKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('processed-') || key.startsWith('file-cache-')
    );
    cacheKeys.forEach(key => sessionStorage.removeItem(key));
  }
  
  private persistEvent(event: SecurityEvent): void {
    if (event.severity === 'high' || event.severity === 'critical') {
      try {
        const auditLog = JSON.parse(localStorage.getItem('security-audit') || '[]');
        auditLog.unshift(event);
        
        // Keep only last 100 critical events
        if (auditLog.length > 100) {
          auditLog.splice(100);
        }
        
        localStorage.setItem('security-audit', JSON.stringify(auditLog));
      } catch (error) {
        console.warn('[Security] Failed to persist audit event:', error);
      }
    }
  }
  
  private loadPersistedData(): void {
    try {
      const auditLog = JSON.parse(localStorage.getItem('security-audit') || '[]');
      this.events = [...auditLog, ...this.events];
    } catch (error) {
      console.warn('[Security] Failed to load persisted security data:', error);
    }
  }
  
  private startPeriodicCleanup(): void {
    setInterval(() => {
      // Clean old events (older than 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.events = this.events.filter(event => event.timestamp > cutoff);
      
      // Clean old suspicious patterns
      this.suspiciousPatterns.clear();
      
      // Clean old violations from localStorage
      try {
        const violations = JSON.parse(localStorage.getItem('security-violations') || '[]');
        const recentViolations = violations.filter((v: any) => v.timestamp > cutoff);
        localStorage.setItem('security-violations', JSON.stringify(recentViolations));
      } catch (error) {
        console.warn('[Security] Failed to clean old violations:', error);
      }
    }, 60 * 60 * 1000); // Run every hour
  }
  
  // Public monitoring methods
  getSecurityMetrics(): SecurityMetrics {
    const recentCutoff = Date.now() - 60 * 60 * 1000; // Last hour
    const recentEvents = this.events.filter(e => e.timestamp > recentCutoff);
    
    return {
      totalEvents: this.events.length,
      criticalEvents: this.events.filter(e => e.severity === 'critical').length,
      recentViolations: recentEvents.length,
      blockedRequests: this.blockedIPs.size,
      suspiciousPatterns: this.suspiciousPatterns.size,
    };
  }
  
  getRecentEvents(limit = 50): SecurityEvent[] {
    return this.events.slice(0, limit);
  }
  
  isBlocked(identifier?: string): boolean {
    if (!identifier) return false;
    return this.blockedIPs.has(identifier);
  }
  
  isSessionLocked(): boolean {
    const lockdown = sessionStorage.getItem('security-lockdown');
    if (!lockdown) return false;
    
    const lockTime = parseInt(lockdown);
    const lockDuration = 30 * 60 * 1000; // 30 minutes
    
    return Date.now() - lockTime < lockDuration;
  }
  
  clearSecurityData(): void {
    this.events = [];
    this.suspiciousPatterns.clear();
    this.blockedIPs.clear();
    localStorage.removeItem('security-audit');
    localStorage.removeItem('security-violations');
    sessionStorage.removeItem('security-lockdown');
  }
}

export const securityMonitor = SecurityMonitor.getInstance();

// Runtime protection utilities
export const withSecurityCheck = <T extends (...args: any[]) => any>(
  fn: T,
  operation: string
): T => {
  return ((...args: any[]) => {
    if (securityMonitor.isSessionLocked()) {
      securityMonitor.logEvent('session_violation', 'high', {
        operation,
        blocked: true,
        reason: 'Session locked'
      });
      throw new Error('操作已被安全系统阻止');
    }
    
    try {
      const result = fn(...args);
      
      // Log successful operations
      securityMonitor.logEvent('api_call', 'low', {
        operation,
        success: true
      });
      
      return result;
    } catch (error: any) {
      securityMonitor.logEvent('api_call', 'medium', {
        operation,
        error: error.message,
        success: false
      });
      throw error;
    }
  }) as T;
};

export const detectAnomalousFileOperation = (file: File): boolean => {
  // Check for suspicious file characteristics
  const suspiciousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.com', '.pif'];
  const hasSuspiciousExt = suspiciousExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  // Check for double extensions
  const hasDoubleExt = /\.(jpg|png|gif|bmp)\.(exe|scr|bat)$/i.test(file.name);
  
  // Check for extremely large files
  const isExtremelyLarge = file.size > 100 * 1024 * 1024; // 100MB
  
  // Check for null bytes in filename
  const hasNullBytes = file.name.includes('\0');
  
  if (hasSuspiciousExt || hasDoubleExt || isExtremelyLarge || hasNullBytes) {
    securityMonitor.logEvent('suspicious_activity', 'critical', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      suspiciousExt: hasSuspiciousExt,
      doubleExt: hasDoubleExt,
      extremelyLarge: isExtremelyLarge,
      nullBytes: hasNullBytes
    });
    return true;
  }
  
  return false;
};
