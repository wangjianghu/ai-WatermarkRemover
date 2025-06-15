// Security headers and CSP management
export interface SecurityConfig {
  enableCSP: boolean;
  enableSecurityHeaders: boolean;
  reportViolations: boolean;
}

class SecurityHeadersManager {
  private static instance: SecurityHeadersManager;
  private config: SecurityConfig;
  private nonce: string;
  
  private constructor() {
    this.config = {
      enableCSP: true,
      enableSecurityHeaders: true,
      reportViolations: true,
    };
    this.nonce = this.generateNonce();
    this.initializeSecurityHeaders();
  }
  
  static getInstance(): SecurityHeadersManager {
    if (!SecurityHeadersManager.instance) {
      SecurityHeadersManager.instance = new SecurityHeadersManager();
    }
    return SecurityHeadersManager.instance;
  }
  
  private generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  private initializeSecurityHeaders(): void {
    if (typeof document === 'undefined') return; // Skip in SSR
    
    if (this.config.enableCSP) {
      this.setContentSecurityPolicy();
    }
    
    if (this.config.enableSecurityHeaders) {
      this.setSecurityMetaTags();
    }
    
    if (this.config.reportViolations) {
      this.setupViolationReporting();
    }
  }
  
  private setContentSecurityPolicy(): void {
    // React-compatible CSP without Trusted Types requirement for development
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${this.nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'", // Required for Tailwind CSS
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stability.ai",
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
      "block-all-mixed-content"
      // Removed require-trusted-types-for to allow React to work properly
    ].join('; ');
    
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!existingCSP) {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', 'Content-Security-Policy');
      meta.setAttribute('content', cspDirectives);
      document.head.appendChild(meta);
      
      console.info('[Security] React-compatible Content Security Policy applied');
    }
  }
  
  private setSecurityMetaTags(): void {
    const securityMetas = [
      { name: 'referrer', content: 'strict-origin-when-cross-origin' },
      { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      { 'http-equiv': 'X-Frame-Options', content: 'DENY' },
      { 'http-equiv': 'X-XSS-Protection', content: '1; mode=block' },
      { 'http-equiv': 'Permissions-Policy', content: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
      { 'http-equiv': 'Cross-Origin-Embedder-Policy', content: 'require-corp' },
      { 'http-equiv': 'Cross-Origin-Opener-Policy', content: 'same-origin' },
      { 'http-equiv': 'Cross-Origin-Resource-Policy', content: 'same-origin' }
    ];
    
    securityMetas.forEach(metaData => {
      const selector = Object.keys(metaData)[0];
      const value = Object.values(metaData)[0];
      const existing = document.querySelector(`meta[${selector}="${value}"]`);
      if (!existing) {
        const meta = document.createElement('meta');
        Object.entries(metaData).forEach(([key, val]) => {
          meta.setAttribute(key, val);
        });
        document.head.appendChild(meta);
      }
    });
    
    console.info('[Security] Enhanced security headers applied');
  }
  
  private setupViolationReporting(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = {
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        timestamp: Date.now(),
        documentURI: event.documentURI,
        effectiveDirective: event.effectiveDirective,
      };
      
      console.warn('[Security] CSP Violation:', violation);
      this.reportSecurityViolation(violation);
    });
    
    this.setupAdvancedXSSDetection();
  }
  
  private setupAdvancedXSSDetection(): void {
    // Enhanced XSS detection with multiple layers
    const originalCreateElement = document.createElement;
    const securityInstance = this;
    
    document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(this, tagName);
      
      if (tagName.toLowerCase() === 'script') {
        console.warn('[Security] Script element created - enhanced monitoring active');
        
        const originalSetAttribute = element.setAttribute;
        element.setAttribute = function(name: string, value: string) {
          if (name.toLowerCase() === 'src') {
            if (!securityInstance.isAllowedScriptSource(value)) {
              console.error('[Security] Blocked unauthorized script:', value);
              securityInstance.reportSecurityViolation({
                type: 'blocked_script',
                src: value,
                timestamp: Date.now()
              });
              throw new Error('Security policy violation: Unauthorized script source');
            }
          }
          return originalSetAttribute.call(this, name, value);
        };
      }
      
      return element;
    };
    
    // Monitor for DOM modifications that could indicate XSS
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              this.scanElementForThreats(element);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href', 'onclick', 'onload', 'onerror', 'onmouseover']
    });
  }
  
  private scanElementForThreats(element: Element): void {
    // Check for dangerous event handlers
    const dangerousEvents = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
    dangerousEvents.forEach(event => {
      if (element.hasAttribute(event)) {
        console.warn(`[Security] Dangerous event handler detected: ${event}`);
        element.removeAttribute(event);
        this.reportSecurityViolation({
          type: 'dangerous_event_handler',
          element: element.tagName,
          event,
          timestamp: Date.now()
        });
      }
    });
    
    // Check for javascript: protocols
    const urlAttributes = ['href', 'src', 'action'];
    urlAttributes.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && value.toLowerCase().startsWith('javascript:')) {
        console.error('[Security] JavaScript protocol detected and blocked:', value);
        element.removeAttribute(attr);
        this.reportSecurityViolation({
          type: 'javascript_protocol',
          attribute: attr,
          value,
          timestamp: Date.now()
        });
      }
    });
  }
  
  private isAllowedScriptSource(src: string): boolean {
    const allowedDomains = [
      location.origin,
      'https://cdn.jsdelivr.net',
      'https://unpkg.com'
    ];
    
    // Block data: and blob: URIs for scripts
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return false;
    }
    
    try {
      const url = new URL(src, location.origin);
      return allowedDomains.some(domain => 
        url.origin === domain || (domain !== location.origin && url.origin.startsWith(domain))
      );
    } catch {
      return false;
    }
  }
  
  private reportSecurityViolation(violation: any): void {
    const violations = JSON.parse(localStorage.getItem('security-violations') || '[]');
    violations.unshift(violation);
    
    if (violations.length > 100) {
      violations.splice(100);
    }
    
    localStorage.setItem('security-violations', JSON.stringify(violations));
    
    // Report to security monitor
    import('./securityMonitor').then(({ securityMonitor }) => {
      securityMonitor.logEvent('xss_attempt', 'high', violation);
    });
  }
  
  getNonce(): string {
    return this.nonce;
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

// Enhanced utility functions
export const sanitizeHTML = (html: string): string => {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

export const validateURL = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const allowedProtocols = ['https:', 'data:', 'blob:'];
    return allowedProtocols.includes(urlObj.protocol);
  } catch {
    return false;
  }
};

export const generateSecureNonce = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Content sanitization for user inputs
export const sanitizeUserInput = (input: string): string => {
  return input
    .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim()
    .slice(0, 1000);
};
