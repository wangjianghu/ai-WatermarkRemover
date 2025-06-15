
// API Security utilities
export const validateApiKey = (apiKey: string): boolean => {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // Basic format validation for Stability AI API keys
  const apiKeyRegex = /^sk-[a-zA-Z0-9]{48,}$/;
  return apiKeyRegex.test(apiKey.trim());
};

export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters
  return input.replace(/[<>'"&]/g, '').trim();
};

export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  // File type validation
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: '不支持的文件类型。请上传 JPEG、PNG 或 WebP 格式的图片。' };
  }
  
  // File size validation (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, error: '文件大小超过限制。请上传小于 10MB 的图片。' };
  }
  
  // File name validation
  const nameRegex = /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
  if (!nameRegex.test(file.name)) {
    return { isValid: false, error: '文件名包含无效字符。' };
  }
  
  return { isValid: true };
};

export const validateImageDimensions = (width: number, height: number): { isValid: boolean; error?: string } => {
  const maxDimension = 4096;
  const minDimension = 32;
  
  if (width > maxDimension || height > maxDimension) {
    return { isValid: false, error: `图片尺寸过大。最大支持 ${maxDimension}x${maxDimension} 像素。` };
  }
  
  if (width < minDimension || height < minDimension) {
    return { isValid: false, error: `图片尺寸过小。最小支持 ${minDimension}x${minDimension} 像素。` };
  }
  
  return { isValid: true };
};

// Rate limiting utility
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;
  
  constructor(maxRequests: number = 10, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }
  
  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
  
  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}

export const apiRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
