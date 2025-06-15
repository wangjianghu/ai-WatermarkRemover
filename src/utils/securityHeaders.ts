// Security headers and CSP management
export interface SecurityConfig {
  enableCSP: boolean;
  enableSecurityHeaders: boolean;
  reportViolations: boolean;
}

class SecurityHeadersManager {
  private static instance: SecurityHeadersManager;
  private config: SecurityConfig;
  
  private constructor() {
    this.config = {
      enableCSP: true,
      enableSecurityHeaders: true,
      reportViolations: true,
    };
    this.initializeSecurityHeaders();
  }
  
  static getInstance(): SecurityHeadersManager {
    if (!SecurityHeadersManager.instance) {
      SecurityHeadersManager.instance = new SecurityHeadersManager();
    }
    return SecurityHeadersManager.instance;
  }
  
  private initializeSecurityHeaders(): void {
    if (typeof document === 'undefined') return; // Skip in SSR
    
    // Set Content Security Policy
    if (this.config.enableCSP) {
      this.setContentSecurityPolicy();
    }
    
    // Set other security headers via meta tags
    if (this.config.enableSecurityHeaders) {
      this.setSecurityMetaTags();
    }
    
    // Monitor for security violations
    if (this.config.reportViolations) {
      this.setupViolationReporting();
    }
  }
  
  private setContentSecurityPolicy(): void {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: Consider removing unsafe-* in production
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stability.ai https:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
    
    // Try to set CSP via meta tag
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!existingCSP) {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', 'Content-Security-Policy');
      meta.setAttribute('content', cspDirectives);
      document.head.appendChild(meta);
      
      console.info('[Security] Content Security Policy applied');
    }
  }
  
  private setSecurityMetaTags(): void {
    const securityMetas = [
      { name: 'referrer', content: 'strict-origin-when-cross-origin' },
      { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      { 'http-equiv': 'X-Frame-Options', content: 'DENY' },
      { 'http-equiv': 'X-XSS-Protection', content: '1; mode=block' },
      { 'http-equiv': 'Permissions-Policy', content: 'camera=(), microphone=(), geolocation=()' }
    ];
    
    securityMetas.forEach(metaData => {
      const existing = document.querySelector(`meta[${Object.keys(metaData)[0]}="${Object.values(metaData)[0]}"]`);
      if (!existing) {
        const meta = document.createElement('meta');
        Object.entries(metaData).forEach(([key, value]) => {
          meta.setAttribute(key, value);
        });
        document.head.appendChild(meta);
      }
    });
    
    console.info('[Security] Security headers applied');
  }
  
  private setupViolationReporting(): void {
    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = {
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        timestamp: Date.now(),
      };
      
      console.warn('[Security] CSP Violation:', violation);
      
      // In production, you might want to report this to a monitoring service
      this.reportSecurityViolation(violation);
    });
    
    // Monitor for potential XSS attempts
    this.setupXSSDetection();
  }
  
  private setupXSSDetection(): void {
    // Monitor for suspicious script injections
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(this, tagName);
      
      if (tagName.toLowerCase() === 'script') {
        console.warn('[Security] Script element created - monitoring for XSS');
        
        // Add security check for script sources
        const originalSetAttribute = element.setAttribute;
        element.setAttribute = function(name: string, value: string) {
          if (name.toLowerCase() === 'src' && !SecurityHeadersManager.isAllowedScriptSource(value)) {
            console.error('[Security] Blocked potentially malicious script:', value);
            throw new Error('Security policy violation: Unauthorized script source');
          }
          return originalSetAttribute.call(this, name, value);
        };
      }
      
      return element;
    };
  }
  
  private static isAllowedScriptSource(src: string): boolean {
    const allowedDomains = [
      'self',
      location.origin,
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ];
    
    // Check if it's a data URI or blob
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      console.warn('[Security] Data/Blob script detected:', src.substring(0, 50));
      return false; // Block data/blob scripts for security
    }
    
    // Check against allowed domains
    try {
      const url = new URL(src, location.origin);
      return allowedDomains.some(domain => 
        domain === 'self' ? url.origin === location.origin : url.origin === domain
      );
    } catch {
      return false; // Invalid URL
    }
  }
  
  private reportSecurityViolation(violation: any): void {
    // Store violation locally for debugging
    const violations = JSON.parse(localStorage.getItem('security-violations') || '[]');
    violations.unshift(violation);
    
    // Keep only last 50 violations
    if (violations.length > 50) {
      violations.splice(50);
    }
    
    localStorage.setItem('security-violations', JSON.stringify(violations));
  }
  
  // Public methods for security monitoring
  getViolationHistory(): any[] {
    return JSON.parse(localStorage.getItem('security-violations') || '[]');
  }
  
  clearViolationHistory(): void {
    localStorage.removeItem('security-violations');
  }
  
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.info('[Security] Configuration updated:', this.config);
  }
}

export const securityHeaders = SecurityHeadersManager.getInstance();

// Utility functions for secure operations
export const sanitizeHTML = (html: string): string => {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

export const validateURL = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'data:', 'blob:'];
    return allowedProtocols.includes(urlObj.protocol);
  } catch {
    return false;
  }
};

export const generateSecureNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};
