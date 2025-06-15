
// API Security utilities
export const validateApiKey = (apiKey: string): boolean => {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // Basic format validation for Stability AI API keys
  const apiKeyRegex = /^sk-[a-zA-Z0-9]{48,}$/;
  return apiKeyRegex.test(apiKey.trim());
};

export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters and normalize
  return input
    .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '') // Remove control chars and dangerous HTML chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 1000); // Limit length to prevent DoS
};

export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  // File type validation with MIME type verification
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: '不支持的文件类型。请上传 JPEG、PNG 或 WebP 格式的图片。' };
  }
  
  // File size validation (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, error: '文件大小超过限制。请上传小于 10MB 的图片。' };
  }
  
  // Minimum file size check to prevent empty files
  if (file.size < 100) {
    return { isValid: false, error: '文件过小，可能已损坏。' };
  }
  
  // File name validation with enhanced security
  const nameRegex = /^[a-zA-Z0-9._\-\u4e00-\u9fa5]+\.(jpg|jpeg|png|webp)$/i;
  if (!nameRegex.test(file.name)) {
    return { isValid: false, error: '文件名包含无效字符或格式不正确。' };
  }
  
  // File extension vs MIME type consistency check
  const ext = file.name.toLowerCase().split('.').pop();
  const mimeMap: { [key: string]: string[] } = {
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg'],
    'png': ['image/png'],
    'webp': ['image/webp']
  };
  
  if (ext && mimeMap[ext] && !mimeMap[ext].includes(file.type)) {
    return { isValid: false, error: '文件扩展名与实际格式不匹配。' };
  }
  
  return { isValid: true };
};

export const validateImageDimensions = (width: number, height: number): { isValid: boolean; error?: string } => {
  const maxDimension = 4096;
  const minDimension = 32;
  
  // Type validation
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { isValid: false, error: '图片尺寸必须为整数。' };
  }
  
  if (width <= 0 || height <= 0) {
    return { isValid: false, error: '图片尺寸必须为正数。' };
  }
  
  if (width > maxDimension || height > maxDimension) {
    return { isValid: false, error: `图片尺寸过大。最大支持 ${maxDimension}x${maxDimension} 像素。` };
  }
  
  if (width < minDimension || height < minDimension) {
    return { isValid: false, error: `图片尺寸过小。最小支持 ${minDimension}x${minDimension} 像素。` };
  }
  
  // Aspect ratio validation to prevent extreme ratios
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  if (aspectRatio > 20) {
    return { isValid: false, error: '图片长宽比过于极端，可能无法正常处理。' };
  }
  
  return { isValid: true };
};

// Enhanced rate limiting with burst control
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;
  private burstLimit: number;
  private burstWindow: number;
  
  constructor(
    maxRequests: number = 10, 
    timeWindowMs: number = 60000,
    burstLimit: number = 3,
    burstWindowMs: number = 5000
  ) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
    this.burstLimit = burstLimit;
    this.burstWindow = burstWindowMs;
  }
  
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Clean old requests
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    // Check burst limit
    const recentRequests = this.requests.filter(time => now - time < this.burstWindow);
    if (recentRequests.length >= this.burstLimit) {
      return false;
    }
    
    // Check overall limit
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
  
  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.timeWindow - (now - oldestRequest));
  }
}

export const apiRateLimiter = new RateLimiter(10, 60000, 3, 5000); // 10 requests per minute, max 3 in 5 seconds

// Zoom level validation
export const validateZoomLevel = (zoom: number): { isValid: boolean; error?: string } => {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) {
    return { isValid: false, error: '缩放级别必须为有效数字。' };
  }
  
  const minZoom = 0.1;
  const maxZoom = 5.0;
  
  if (zoom < minZoom || zoom > maxZoom) {
    return { isValid: false, error: `缩放级别必须在 ${minZoom} 到 ${maxZoom} 之间。` };
  }
  
  return { isValid: true };
};

// Watermark mark validation
export const validateWatermarkMark = (mark: any): { isValid: boolean; error?: string } => {
  if (!mark || typeof mark !== 'object') {
    return { isValid: false, error: '水印标记必须为有效对象。' };
  }
  
  const { x, y, width, height } = mark;
  
  // Type validation
  if (typeof x !== 'number' || typeof y !== 'number' || 
      typeof width !== 'number' || typeof height !== 'number') {
    return { isValid: false, error: '水印标记坐标必须为数字。' };
  }
  
  // Range validation (normalized coordinates 0-1)
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return { isValid: false, error: '水印标记位置超出图片范围。' };
  }
  
  if (width <= 0 || height <= 0 || width > 1 || height > 1) {
    return { isValid: false, error: '水印标记尺寸无效。' };
  }
  
  if (x + width > 1 || y + height > 1) {
    return { isValid: false, error: '水印标记超出图片边界。' };
  }
  
  // Minimum size validation
  const minSize = 0.01; // 1% of image
  if (width < minSize || height < minSize) {
    return { isValid: false, error: '水印标记尺寸过小。' };
  }
  
  return { isValid: true };
};

