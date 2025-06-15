
// Runtime protection and integrity monitoring
interface ProtectionConfig {
  enableIntegrityCheck: boolean;
  enableDOMProtection: boolean;
  enableConsoleProtection: boolean;
  enableDebuggerProtection: boolean;
}

class RuntimeProtection {
  private static instance: RuntimeProtection;
  private config: ProtectionConfig;
  private originalConsole: Console;
  private protectionActive = false;
  
  private constructor() {
    this.config = {
      enableIntegrityCheck: true,
      enableDOMProtection: true,
      enableConsoleProtection: false, // Disabled for development
      enableDebuggerProtection: false, // Disabled for development
    };
    
    this.originalConsole = { ...console };
    this.initializeProtection();
  }
  
  static getInstance(): RuntimeProtection {
    if (!RuntimeProtection.instance) {
      RuntimeProtection.instance = new RuntimeProtection();
    }
    return RuntimeProtection.instance;
  }
  
  private initializeProtection(): void {
    if (this.protectionActive) return;
    
    if (this.config.enableIntegrityCheck) {
      this.setupIntegrityChecks();
    }
    
    if (this.config.enableDOMProtection) {
      this.setupDOMProtection();
    }
    
    if (this.config.enableConsoleProtection) {
      this.setupConsoleProtection();
    }
    
    if (this.config.enableDebuggerProtection) {
      this.setupDebuggerProtection();
    }
    
    this.protectionActive = true;
    console.info('[Security] Runtime protection initialized');
  }
  
  private setupIntegrityChecks(): void {
    // Monitor critical function modifications
    const criticalFunctions = [
      'fetch',
      'XMLHttpRequest',
      'localStorage.setItem',
      'sessionStorage.setItem',
      'eval',
      'Function',
    ];
    
    criticalFunctions.forEach(funcName => {
      this.monitorFunctionIntegrity(funcName);
    });
    
    // Check for suspicious globals
    this.monitorGlobalScope();
  }
  
  private monitorFunctionIntegrity(functionName: string): void {
    const parts = functionName.split('.');
    let obj: any = window;
    
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (!obj) return;
    }
    
    const propName = parts[parts.length - 1];
    const originalFunction = obj[propName];
    
    if (typeof originalFunction === 'function') {
      const originalDescriptor = Object.getOwnPropertyDescriptor(obj, propName);
      
      // Store original function signature
      const originalCode = originalFunction.toString();
      
      // Set up periodic integrity check
      setInterval(() => {
        const currentFunction = obj[propName];
        const currentCode = currentFunction ? currentFunction.toString() : '';
        
        if (currentCode !== originalCode) {
          console.warn(`[Security] Function integrity violation detected: ${functionName}`);
          
          // Log security event
          import('./securityMonitor').then(({ securityMonitor }) => {
            securityMonitor.logEvent('suspicious_activity', 'critical', {
              type: 'function_modification',
              function: functionName,
              originalLength: originalCode.length,
              currentLength: currentCode.length,
            });
          });
          
          // Attempt to restore if possible
          if (originalDescriptor) {
            try {
              Object.defineProperty(obj, propName, originalDescriptor);
            } catch (error) {
              console.error(`[Security] Failed to restore function: ${functionName}`, error);
            }
          }
        }
      }, 5000); // Check every 5 seconds
    }
  }
  
  private monitorGlobalScope(): void {
    const suspiciousGlobals = [
      'eval',
      'Function',
      '__proto__',
      'constructor',
      'setTimeout',
      'setInterval',
    ];
    
    // Monitor for suspicious global additions
    const originalGlobals = new Set(Object.getOwnPropertyNames(window));
    
    setInterval(() => {
      const currentGlobals = new Set(Object.getOwnPropertyNames(window));
      const newGlobals = [...currentGlobals].filter(name => !originalGlobals.has(name));
      
      newGlobals.forEach(globalName => {
        if (suspiciousGlobals.some(sus => globalName.includes(sus))) {
          console.warn(`[Security] Suspicious global detected: ${globalName}`);
          
          import('./securityMonitor').then(({ securityMonitor }) => {
            securityMonitor.logEvent('suspicious_activity', 'high', {
              type: 'suspicious_global',
              globalName,
              value: typeof (window as any)[globalName],
            });
          });
        }
        
        originalGlobals.add(globalName);
      });
    }, 10000); // Check every 10 seconds
  }
  
  private setupDOMProtection(): void {
    // Monitor script injections
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check for script elements
            if (element.tagName === 'SCRIPT') {
              this.handleSuspiciousScript(element as HTMLScriptElement);
            }
            
            // Check for suspicious attributes
            this.checkSuspiciousAttributes(element);
            
            // Recursively check child elements
            element.querySelectorAll('script').forEach((script) => {
              this.handleSuspiciousScript(script);
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href', 'onclick', 'onload', 'onerror'],
    });
  }
  
  private handleSuspiciousScript(script: HTMLScriptElement): void {
    const src = script.src;
    const content = script.textContent || script.innerText;
    
    // Check for inline scripts with suspicious content
    const suspiciousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /innerHTML\s*=/,
      /outerHTML\s*=/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
    ];
    
    const hasSuspiciousContent = suspiciousPatterns.some(pattern => 
      pattern.test(content)
    );
    
    if (hasSuspiciousContent || (src && !this.isAllowedScriptSource(src))) {
      console.warn('[Security] Suspicious script detected and blocked:', {
        src,
        content: content.substring(0, 100),
      });
      
      // Remove the script
      script.remove();
      
      import('./securityMonitor').then(({ securityMonitor }) => {
        securityMonitor.logEvent('xss_attempt', 'critical', {
          type: 'script_injection',
          src,
          contentPreview: content.substring(0, 100),
          blocked: true,
        });
      });
    }
  }
  
  private checkSuspiciousAttributes(element: Element): void {
    const suspiciousAttributes = ['onclick', 'onload', 'onerror', 'onmouseover'];
    
    suspiciousAttributes.forEach(attr => {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        console.warn(`[Security] Suspicious event handler detected: ${attr}="${value}"`);
        
        // Remove the attribute
        element.removeAttribute(attr);
        
        import('./securityMonitor').then(({ securityMonitor }) => {
          securityMonitor.logEvent('xss_attempt', 'high', {
            type: 'event_handler_injection',
            attribute: attr,
            value,
            tagName: element.tagName,
            blocked: true,
          });
        });
      }
    });
  }
  
  private isAllowedScriptSource(src: string): boolean {
    const allowedDomains = [
      location.origin,
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
    ];
    
    try {
      const url = new URL(src, location.origin);
      return allowedDomains.some(domain => url.origin === domain || url.origin.startsWith(domain));
    } catch {
      return false;
    }
  }
  
  private setupConsoleProtection(): void {
    // Override console methods to prevent information leakage
    const protectedMethods = ['log', 'warn', 'error', 'info', 'debug'];
    
    protectedMethods.forEach(method => {
      const original = this.originalConsole[method as keyof Console] as Function;
      
      (console as any)[method] = (...args: any[]) => {
        // Filter out sensitive information
        const filteredArgs = args.map(arg => {
          if (typeof arg === 'string') {
            return arg.replace(/Bearer\s+[\w-]+/g, 'Bearer [REDACTED]')
                     .replace(/api[_-]?key[=:]\s*[\w-]+/gi, 'api_key=[REDACTED]');
          }
          return arg;
        });
        
        original.apply(console, filteredArgs);
      };
    });
  }
  
  private setupDebuggerProtection(): void {
    // Anti-debugging measures (disabled in development)
    setInterval(() => {
      const start = performance.now();
      debugger; // This will pause if dev tools are open
      const end = performance.now();
      
      if (end - start > 100) {
        console.warn('[Security] Debugger detected');
        
        import('./securityMonitor').then(({ securityMonitor }) => {
          securityMonitor.logEvent('suspicious_activity', 'medium', {
            type: 'debugger_detected',
            delay: end - start,
          });
        });
      }
    }, 1000);
  }
  
  updateConfig(newConfig: Partial<ProtectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.info('[Security] Runtime protection config updated:', this.config);
  }
  
  disable(): void {
    this.protectionActive = false;
    
    // Restore original console
    Object.assign(console, this.originalConsole);
    
    console.info('[Security] Runtime protection disabled');
  }
}

export const runtimeProtection = RuntimeProtection.getInstance();

// Security middleware for API calls
export const secureApiMiddleware = async (
  operation: () => Promise<any>,
  operationName: string
): Promise<any> => {
  const { securityMonitor } = await import('./securityMonitor');
  
  // Pre-operation checks
  if (securityMonitor.isSessionLocked()) {
    throw new Error('操作被安全系统阻止');
  }
  
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    securityMonitor.logEvent('api_call', 'low', {
      operation: operationName,
      duration,
      success: true,
    });
    
    return result;
  } catch (error: any) {
    const duration = performance.now() - startTime;
    
    securityMonitor.logEvent('api_call', 'medium', {
      operation: operationName,
      duration,
      error: error.message,
      success: false,
    });
    
    throw error;
  }
};
