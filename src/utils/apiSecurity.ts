// Enhanced API security and rate limiting
interface RequestMetrics {
  timestamp: number;
  endpoint: string;
  responseTime: number;
  success: boolean;
  size: number;
}

interface SecurityContext {
  userAgent: string;
  timestamp: number;
  sessionId: string;
  requestCount: number;
  memoryUsage: number;
  connectionType: string;
}

class ApiSecurityManager {
  private static instance: ApiSecurityManager;
  private requestHistory: RequestMetrics[] = [];
  private rateLimitMap: Map<string, number[]> = new Map();
  private suspiciousIPs: Set<string> = new Set();
  private sessionId: string;
  private requestCount: number = 0;
  
  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeSecurityMonitoring();
  }
  
  static getInstance(): ApiSecurityManager {
    if (!ApiSecurityManager.instance) {
      ApiSecurityManager.instance = new ApiSecurityManager();
    }
    return ApiSecurityManager.instance;
  }
  
  private generateSessionId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  private initializeSecurityMonitoring(): void {
    // Monitor navigation timing for performance analysis
    if ('performance' in window && 'timing' in performance) {
      window.addEventListener('load', () => {
        this.analyzePerformanceMetrics();
      });
    }
    
    // Monitor for suspicious activity patterns
    this.startAnomalyDetection();
  }
  
  private analyzePerformanceMetrics(): void {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
    
    console.info('[API Security] Performance metrics:', {
      loadTime,
      domReady,
      sessionId: this.sessionId
    });
    
    if (loadTime > 10000) {
      console.warn('[API Security] Slow page load detected, possible attack');
      import('./securityMonitor').then(({ securityMonitor }) => {
        securityMonitor.logEvent('suspicious_activity', 'medium', {
          type: 'slow_page_load',
          loadTime,
          sessionId: this.sessionId
        });
      });
    }
  }
  
  private startAnomalyDetection(): void {
    setInterval(() => {
      this.detectAnomalousPatterns();
      this.cleanupOldMetrics();
    }, 30000); // Check every 30 seconds
  }
  
  private detectAnomalousPatterns(): void {
    const recentRequests = this.requestHistory.filter(
      req => Date.now() - req.timestamp < 60000 // Last minute
    );
    
    // Check for excessive request frequency
    if (recentRequests.length > 50) {
      console.warn('[API Security] Excessive request frequency detected');
      import('./securityMonitor').then(({ securityMonitor }) => {
        securityMonitor.logEvent('suspicious_activity', 'high', {
          type: 'excessive_requests',
          count: recentRequests.length,
          sessionId: this.sessionId
        });
      });
    }
    
    // Check for unusual error patterns
    const errorRate = recentRequests.filter(req => !req.success).length / recentRequests.length;
    if (errorRate > 0.5 && recentRequests.length > 10) {
      console.warn('[API Security] High error rate detected:', errorRate);
      import('./securityMonitor').then(({ securityMonitor }) => {
        securityMonitor.logEvent('suspicious_activity', 'medium', {
          type: 'high_error_rate',
          errorRate,
          requestCount: recentRequests.length,
          sessionId: this.sessionId
        });
      });
    }
  }
  
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 300000; // 5 minutes
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoffTime);
    
    // Clean up rate limit tracking
    this.rateLimitMap.forEach((timestamps, key) => {
      const filtered = timestamps.filter(ts => ts > cutoffTime);
      if (filtered.length === 0) {
        this.rateLimitMap.delete(key);
      } else {
        this.rateLimitMap.set(key, filtered);
      }
    });
  }
  
  validateRequest(endpoint: string, options: RequestInit = {}): boolean {
    // Check rate limits
    if (!this.checkRateLimit(endpoint)) {
      console.warn('[API Security] Rate limit exceeded for endpoint:', endpoint);
      return false;
    }
    
    // Validate request headers
    if (!this.validateHeaders(options.headers)) {
      console.warn('[API Security] Invalid headers detected');
      return false;
    }
    
    // Check for suspicious patterns
    if (this.detectSuspiciousActivity(endpoint, options)) {
      console.warn('[API Security] Suspicious activity detected');
      return false;
    }
    
    return true;
  }
  
  // Make checkRateLimit public so it can be used by apiRateLimiter
  checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    const maxRequests = this.getMaxRequestsForEndpoint(endpoint);
    
    const timestamps = this.rateLimitMap.get(endpoint) || [];
    const recentTimestamps = timestamps.filter(ts => now - ts < timeWindow);
    
    if (recentTimestamps.length >= maxRequests) {
      return false;
    }
    
    recentTimestamps.push(now);
    this.rateLimitMap.set(endpoint, recentTimestamps);
    return true;
  }
  
  private getMaxRequestsForEndpoint(endpoint: string): number {
    // Different rate limits for different endpoints
    if (endpoint.includes('stability.ai')) {
      return 10; // 10 requests per minute for AI API
    }
    return 100; // Default rate limit
  }
  
  private validateHeaders(headers: HeadersInit | undefined): boolean {
    if (!headers) return true;
    
    const headersObj = headers instanceof Headers ? 
      Object.fromEntries(headers.entries()) : 
      headers as Record<string, string>;
    
    // Check for suspicious header values
    for (const [key, value] of Object.entries(headersObj)) {
      if (typeof value === 'string') {
        // Check for potential injection attempts
        if (this.containsSuspiciousContent(value)) {
          console.warn('[API Security] Suspicious header content:', key, value);
          return false;
        }
        
        // Check header length
        if (value.length > 10000) {
          console.warn('[API Security] Excessively long header:', key);
          return false;
        }
      }
    }
    
    return true;
  }
  
  private containsSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:\s*text\/html/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(content));
  }
  
  private detectSuspiciousActivity(endpoint: string, options: RequestInit): boolean {
    // Check for unusual request patterns
    const recentSameEndpoint = this.requestHistory.filter(
      req => req.endpoint === endpoint && Date.now() - req.timestamp < 10000
    );
    
    if (recentSameEndpoint.length > 5) {
      console.warn('[API Security] Rapid repeated requests to same endpoint');
      return true;
    }
    
    // Check request body size
    if (options.body) {
      const bodySize = this.estimateBodySize(options.body);
      if (bodySize > 50 * 1024 * 1024) { // 50MB
        console.warn('[API Security] Excessively large request body:', bodySize);
        return true;
      }
    }
    
    return false;
  }
  
  private estimateBodySize(body: BodyInit): number {
    if (typeof body === 'string') {
      return new Blob([body]).size;
    } else if (body instanceof FormData) {
      // Estimate FormData size
      let size = 0;
      try {
        const entries = Array.from(body.entries());
        for (const [key, value] of entries) {
          size += key.length;
          if (typeof value === 'string') {
            size += value.length;
          } else if (value instanceof File) {
            size += value.size;
          }
        }
      } catch {
        size = 1000; // Default estimate
      }
      return size;
    } else if (body instanceof ArrayBuffer) {
      return body.byteLength;
    } else if (body instanceof Blob) {
      return body.size;
    }
    return 0;
  }
  
  recordResponse(endpoint: string, responseTime: number, success: boolean, size: number = 0): void {
    this.requestCount++;
    
    const metric: RequestMetrics = {
      timestamp: Date.now(),
      endpoint,
      responseTime,
      success,
      size
    };
    
    this.requestHistory.push(metric);
    
    // Log slow responses
    if (responseTime > 30000) { // 30 seconds
      console.warn('[API Security] Slow response detected:', {
        endpoint,
        responseTime,
        sessionId: this.sessionId
      });
      
      import('./securityMonitor').then(({ securityMonitor }) => {
        securityMonitor.logEvent('api_call', 'medium', {
          type: 'slow_response',
          endpoint,
          responseTime,
          sessionId: this.sessionId
        });
      });
    }
  }
  
  getSecurityContext(): SecurityContext {
    // Get connection info safely
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const connectionType = connection ? connection.effectiveType || 'unknown' : 'unknown';
    
    // Get memory info safely
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize || 0;
    }
    
    return {
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      requestCount: this.requestCount,
      memoryUsage,
      connectionType
    };
  }
  
  // Circuit breaker pattern for external API calls
  private circuitBreakerState: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();
  
  checkCircuitBreaker(endpoint: string): boolean {
    const state = this.circuitBreakerState.get(endpoint);
    if (!state) {
      this.circuitBreakerState.set(endpoint, { failures: 0, lastFailure: 0, isOpen: false });
      return true;
    }
    
    // Reset circuit breaker after 5 minutes
    if (state.isOpen && Date.now() - state.lastFailure > 300000) {
      state.isOpen = false;
      state.failures = 0;
    }
    
    return !state.isOpen;
  }
  
  recordFailure(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint) || { failures: 0, lastFailure: 0, isOpen: false };
    state.failures++;
    state.lastFailure = Date.now();
    
    // Open circuit breaker after 5 failures
    if (state.failures >= 5) {
      state.isOpen = true;
      console.warn('[API Security] Circuit breaker opened for endpoint:', endpoint);
    }
    
    this.circuitBreakerState.set(endpoint, state);
  }
  
  recordSuccess(endpoint: string): void {
    const state = this.circuitBreakerState.get(endpoint);
    if (state) {
      state.failures = Math.max(0, state.failures - 1);
      this.circuitBreakerState.set(endpoint, state);
    }
  }
  
  // Request sanitization
  sanitizeRequestData(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    } else if (Array.isArray(data)) {
      return data.map(item => this.sanitizeRequestData(item));
    } else if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeRequestData(value);
      }
      return sanitized;
    }
    return data;
  }
  
  private sanitizeString(str: string): string {
    return str
      .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .trim()
      .slice(0, 10000); // Limit string length
  }
  
  getMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  } {
    const totalRequests = this.requestHistory.length;
    const totalResponseTime = this.requestHistory.reduce((sum, req) => sum + req.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const errors = this.requestHistory.filter(req => !req.success).length;
    const errorRate = totalRequests > 0 ? errors / totalRequests : 0;
    
    // Calculate top endpoints
    const endpointCounts: Record<string, number> = {};
    this.requestHistory.forEach(req => {
      endpointCounts[req.endpoint] = (endpointCounts[req.endpoint] || 0) + 1;
    });
    
    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      topEndpoints
    };
  }
}

export const apiSecurity = ApiSecurityManager.getInstance();

// Rate limiter instance for external use
export const apiRateLimiter = {
  canMakeRequest: () => apiSecurity.checkRateLimit('default'),
  recordRequest: () => apiSecurity.recordResponse('default', 0, true)
};

// Validation functions for external use
export const validateFileUpload = (file: File) => {
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!file) {
    return { isValid: false, error: '请选择文件' };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: '文件大小不能超过50MB' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: '只支持 JPEG、PNG、WebP 和 GIF 格式' };
  }
  
  return { isValid: true };
};

export const validateImageDimensions = (width: number, height: number) => {
  const maxDimension = 8192;
  const minDimension = 32;
  
  if (width < minDimension || height < minDimension) {
    return { isValid: false, error: `图片尺寸不能小于 ${minDimension}x${minDimension}` };
  }
  
  if (width > maxDimension || height > maxDimension) {
    return { isValid: false, error: `图片尺寸不能超过 ${maxDimension}x${maxDimension}` };
  }
  
  return { isValid: true };
};

export const validateZoomLevel = (zoom: number) => {
  if (zoom < 0.1 || zoom > 10) {
    return { isValid: false, error: '缩放级别必须在 0.1 到 10 之间' };
  }
  
  return { isValid: true };
};

export const validateWatermarkMark = (mark: any) => {
  if (!mark) {
    return { isValid: false, error: '水印标记不能为空' };
  }
  
  if (typeof mark !== 'object') {
    return { isValid: false, error: '水印标记格式无效' };
  }
  
  const { x, y, width, height } = mark;
  
  if (typeof x !== 'number' || typeof y !== 'number' || 
      typeof width !== 'number' || typeof height !== 'number') {
    return { isValid: false, error: '水印标记坐标必须是数字' };
  }
  
  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return { isValid: false, error: '水印标记尺寸无效' };
  }
  
  if (x + width > 1 || y + height > 1) {
    return { isValid: false, error: '水印标记超出图片范围' };
  }
  
  return { isValid: true };
};

export const validateApiKey = (key: string) => {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Basic format validation for Stability AI API keys
  if (key.length < 20 || !key.startsWith('sk-')) {
    return false;
  }
  
  return true;
};

export const sanitizeInput = (input: string) => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim()
    .slice(0, 1000); // Limit length
};

// Enhanced security wrapper for fetch calls
export const secureApiCall = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  // Validate the request
  if (!apiSecurity.validateRequest(url, options)) {
    throw new Error('Request blocked by security policy');
  }
  
  // Check circuit breaker
  if (!apiSecurity.checkCircuitBreaker(url)) {
    throw new Error('Service temporarily unavailable');
  }
  
  // Sanitize request data
  if (options.body && typeof options.body === 'string') {
    try {
      const data = JSON.parse(options.body);
      const sanitized = apiSecurity.sanitizeRequestData(data);
      options.body = JSON.stringify(sanitized);
    } catch {
      // Not JSON, leave as is
    }
  }
  
  const startTime = Date.now();
  let success = false;
  let responseSize = 0;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Session-ID': apiSecurity.getSecurityContext().sessionId,
        'X-Request-ID': crypto.randomUUID(),
        ...options.headers,
      },
    });
    
    success = response.ok;
    responseSize = parseInt(response.headers.get('content-length') || '0', 10);
    
    if (!response.ok) {
      apiSecurity.recordFailure(url);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    apiSecurity.recordSuccess(url);
    
    const result = await response.json();
    return result;
  } catch (error) {
    if (!success) {
      apiSecurity.recordFailure(url);
    }
    throw error;
  } finally {
    const responseTime = Date.now() - startTime;
    apiSecurity.recordResponse(url, responseTime, success, responseSize);
  }
};
