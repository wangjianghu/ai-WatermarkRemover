
// Secure error handling utilities
export interface SecureError {
  userMessage: string;
  logMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

class SecureErrorHandler {
  private static instance: SecureErrorHandler;
  private errorLog: SecureError[] = [];
  private maxLogSize = 100;
  
  private constructor() {}
  
  static getInstance(): SecureErrorHandler {
    if (!SecureErrorHandler.instance) {
      SecureErrorHandler.instance = new SecureErrorHandler();
    }
    return SecureErrorHandler.instance;
  }
  
  handleError(
    error: any, 
    context: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): SecureError {
    const secureError: SecureError = {
      userMessage: this.sanitizeErrorMessage(error, severity),
      logMessage: this.createLogMessage(error, context),
      severity,
      timestamp: Date.now(),
    };
    
    this.logError(secureError);
    return secureError;
  }
  
  private sanitizeErrorMessage(error: any, severity: string): string {
    // Never expose sensitive information to users
    const genericMessages = {
      low: '操作遇到轻微问题，请重试。',
      medium: '处理过程中出现错误，请检查输入并重试。',
      high: '系统遇到问题，请稍后重试或联系支持。',
      critical: '系统遇到严重错误，请联系技术支持。',
    };
    
    // For specific known error types, provide helpful but safe messages
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('fetch')) {
        return '网络连接问题，请检查网络设置后重试。';
      }
      
      if (message.includes('quota') || message.includes('limit')) {
        return '资源使用超出限制，请稍后重试。';
      }
      
      if (message.includes('timeout')) {
        return '操作超时，请重试或使用更小的文件。';
      }
      
      if (message.includes('memory') || message.includes('allocation')) {
        return '内存不足，请尝试使用更小的图片或刷新页面。';
      }
      
      if (message.includes('cors') || message.includes('origin')) {
        return '跨域访问问题，请检查API配置。';
      }
      
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return 'API密钥无效或权限不足，请检查配置。';
      }
    }
    
    return genericMessages[severity] || genericMessages.medium;
  }
  
  private createLogMessage(error: any, context: string): string {
    let logMessage = `[${context}] `;
    
    if (error?.name) {
      logMessage += `${error.name}: `;
    }
    
    if (error?.message) {
      // Sanitize sensitive information from logs
      let message = error.message;
      
      // Remove potential API keys
      message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, '[API_KEY_REDACTED]');
      
      // Remove file paths that might contain sensitive info
      message = message.replace(/\/[a-zA-Z0-9\/\-_]+\.(jpg|png|jpeg|webp)/gi, '[FILE_PATH_REDACTED]');
      
      // Remove URLs that might contain sensitive parameters
      message = message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
      
      logMessage += message;
    }
    
    if (error?.stack) {
      // Include stack trace but sanitize sensitive information
      let stack = error.stack;
      stack = stack.replace(/sk-[a-zA-Z0-9]{20,}/g, '[API_KEY_REDACTED]');
      logMessage += `\nStack: ${stack.split('\n').slice(0, 5).join('\n')}`;
    }
    
    return logMessage;
  }
  
  private logError(secureError: SecureError): void {
    // Add to internal log
    this.errorLog.unshift(secureError);
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
    
    // Log to console with appropriate level
    const consoleMethod = this.getConsoleMethod(secureError.severity);
    consoleMethod(`[SECURE_ERROR] ${secureError.logMessage}`);
    
    // In production, you might want to send critical errors to a monitoring service
    if (secureError.severity === 'critical') {
      this.reportCriticalError(secureError);
    }
  }
  
  private getConsoleMethod(severity: string): (...args: any[]) => void {
    switch (severity) {
      case 'low': return console.info;
      case 'medium': return console.warn;
      case 'high': return console.error;
      case 'critical': return console.error;
      default: return console.log;
    }
  }
  
  private reportCriticalError(secureError: SecureError): void {
    // In a production environment, you would send this to your error monitoring service
    // For now, we'll just log it prominently
    console.error('🚨 CRITICAL ERROR DETECTED:', {
      timestamp: new Date(secureError.timestamp).toISOString(),
      message: secureError.logMessage,
      userMessage: secureError.userMessage,
    });
  }
  
  getRecentErrors(limit: number = 10): SecureError[] {
    return this.errorLog.slice(0, limit);
  }
  
  clearErrorLog(): void {
    this.errorLog = [];
  }
}

export const secureErrorHandler = SecureErrorHandler.getInstance();

// Utility function for consistent error handling across the app
export const handleSecureError = (
  error: any, 
  context: string, 
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): string => {
  const secureError = secureErrorHandler.handleError(error, context, severity);
  return secureError.userMessage;
};

