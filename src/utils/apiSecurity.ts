
// Enhanced API Security utilities with comprehensive validation
export const validateApiKey = (apiKey: string): boolean => {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // Enhanced validation for Stability AI API keys
  const trimmedKey = apiKey.trim();
  
  // Basic format validation
  const apiKeyRegex = /^sk-[a-zA-Z0-9]{48,64}$/;
  if (!apiKeyRegex.test(trimmedKey)) return false;
  
  // Additional entropy check
  const keyPart = trimmedKey.substring(3);
  const uniqueChars = new Set(keyPart).size;
  if (uniqueChars < 16) return false; // Ensure sufficient entropy
  
  return true;
};

export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>'"&\x00-\x1f\x7f-\x9f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim()
    .slice(0, 1000);
};

export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  // Enhanced file type validation
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: '不支持的文件类型。仅支持 JPEG、PNG、WebP 和 GIF 格式的图片。' 
    };
  }
  
  // Stricter file size validation
  const maxSize = 25 * 1024 * 1024; // Reduced to 25MB
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: '文件大小超过限制。请上传小于 25MB 的图片。' 
    };
  }
  
  // Enhanced minimum file size check
  if (file.size < 1024) { // 1KB minimum
    return { 
      isValid: false, 
      error: '文件过小，可能已损坏或不是有效的图片文件。' 
    };
  }
  
  // Enhanced file name validation
  const nameRegex = /^[a-zA-Z0-9._\-\s\u4e00-\u9fa5]{1,255}\.(jpg|jpeg|png|webp|gif)$/i;
  if (!nameRegex.test(file.name)) {
    return { 
      isValid: false, 
      error: '文件名包含无效字符或格式不正确。请使用标准字符和有效扩展名。' 
    };
  }
  
  // Check for null bytes in filename (security)
  if (file.name.includes('\0')) {
    return { 
      isValid: false, 
      error: '文件名包含非法字符，可能是恶意文件。' 
    };
  }
  
  // Enhanced MIME type consistency check
  const ext = file.name.toLowerCase().split('.').pop();
  const mimeMap: { [key: string]: string[] } = {
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg'],
    'png': ['image/png'],
    'webp': ['image/webp'],
    'gif': ['image/gif']
  };
  
  if (ext && mimeMap[ext] && !mimeMap[ext].includes(file.type)) {
    return { 
      isValid: false, 
      error: '文件扩展名与实际格式不匹配，可能是伪造的文件。' 
    };
  }
  
  return { isValid: true };
};

export const validateImageDimensions = (width: number, height: number): { isValid: boolean; error?: string } => {
  const maxDimension = 8192; // Increased max
  const minDimension = 16; // Reduced min
  
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { isValid: false, error: '图片尺寸必须为整数。' };
  }
  
  if (width <= 0 || height <= 0) {
    return { isValid: false, error: '图片尺寸必须为正数。' };
  }
  
  if (width > maxDimension || height > maxDimension) {
    return { 
      isValid: false, 
      error: `图片尺寸过大。最大支持 ${maxDimension}x${maxDimension} 像素。` 
    };
  }
  
  if (width < minDimension || height < minDimension) {
    return { 
      isValid: false, 
      error: `图片尺寸过小。最小支持 ${minDimension}x${minDimension} 像素。` 
    };
  }
  
  // Enhanced aspect ratio validation
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  if (aspectRatio > 50) {
    return { 
      isValid: false, 
      error: '图片长宽比过于极端，可能无法正常处理。' 
    };
  }
  
  // Check for potential memory issues
  const totalPixels = width * height;
  if (totalPixels > 67108864) { // 8192 * 8192
    return { 
      isValid: false, 
      error: '图片像素总数过大，可能导致内存不足。' 
    };
  }
  
  return { isValid: true };
};

// Enhanced rate limiting with adaptive thresholds
class AdvancedRateLimiter {
  private requests: number[] = [];
  private violations: number[] = [];
  private maxRequests: number;
  private timeWindow: number;
  private burstLimit: number;
  private burstWindow: number;
  private adaptiveThreshold: boolean;
  
  constructor(
    maxRequests: number = 10, 
    timeWindowMs: number = 60000,
    burstLimit: number = 3,
    burstWindowMs: number = 5000,
    adaptiveThreshold: boolean = true
  ) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
    this.burstLimit = burstLimit;
    this.burstWindow = burstWindowMs;
    this.adaptiveThreshold = adaptiveThreshold;
  }
  
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Clean old requests and violations
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    this.violations = this.violations.filter(time => now - time < this.timeWindow * 2);
    
    // Adaptive rate limiting based on recent violations
    let currentBurstLimit = this.burstLimit;
    let currentMaxRequests = this.maxRequests;
    
    if (this.adaptiveThreshold && this.violations.length > 0) {
      currentBurstLimit = Math.max(1, this.burstLimit - this.violations.length);
      currentMaxRequests = Math.max(3, this.maxRequests - this.violations.length * 2);
    }
    
    // Check burst limit
    const recentRequests = this.requests.filter(time => now - time < this.burstWindow);
    if (recentRequests.length >= currentBurstLimit) {
      this.recordViolation();
      return false;
    }
    
    // Check overall limit
    if (this.requests.length >= currentMaxRequests) {
      this.recordViolation();
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
  
  private recordViolation(): void {
    this.violations.push(Date.now());
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
  
  getViolationCount(): number {
    const now = Date.now();
    return this.violations.filter(time => now - time < this.timeWindow).length;
  }
  
  reset(): void {
    this.requests = [];
    this.violations = [];
  }
}

export const apiRateLimiter = new AdvancedRateLimiter(8, 60000, 2, 3000, true);

// Enhanced validation functions
export const validateZoomLevel = (zoom: number): { isValid: boolean; error?: string } => {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) {
    return { isValid: false, error: '缩放级别必须为有效数字。' };
  }
  
  const minZoom = 0.05;
  const maxZoom = 10.0;
  
  if (zoom < minZoom || zoom > maxZoom) {
    return { 
      isValid: false, 
      error: `缩放级别必须在 ${minZoom} 到 ${maxZoom} 之间。` 
    };
  }
  
  return { isValid: true };
};

export const validateWatermarkMark = (mark: any): { isValid: boolean; error?: string } => {
  if (!mark || typeof mark !== 'object') {
    return { isValid: false, error: '水印标记必须为有效对象。' };
  }
  
  const { x, y, width, height } = mark;
  
  // Enhanced type validation
  if (typeof x !== 'number' || typeof y !== 'number' || 
      typeof width !== 'number' || typeof height !== 'number') {
    return { isValid: false, error: '水印标记坐标必须为数字。' };
  }
  
  // Check for NaN or Infinity
  if (!Number.isFinite(x) || !Number.isFinite(y) || 
      !Number.isFinite(width) || !Number.isFinite(height)) {
    return { isValid: false, error: '水印标记坐标必须为有限数字。' };
  }
  
  // Enhanced range validation
  if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) {
    return { isValid: false, error: '水印标记位置超出安全范围。' };
  }
  
  if (width <= 0 || height <= 0 || width > 1.2 || height > 1.2) {
    return { isValid: false, error: '水印标记尺寸无效或超出安全范围。' };
  }
  
  if (x + width > 1.1 || y + height > 1.1) {
    return { isValid: false, error: '水印标记超出图片安全边界。' };
  }
  
  // Enhanced minimum and maximum size validation
  const minSize = 0.005; // 0.5% of image
  const maxSize = 0.8;   // 80% of image
  
  if (width < minSize || height < minSize) {
    return { isValid: false, error: '水印标记尺寸过小，无法有效处理。' };
  }
  
  if (width > maxSize || height > maxSize) {
    return { isValid: false, error: '水印标记尺寸过大，可能影响处理效果。' };
  }
  
  return { isValid: true };
};

// Request fingerprinting for additional security
export const generateRequestFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.deviceMemory || 0
  ];
  
  const fingerprint = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  
  return Array.from(new Uint8Array(data))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
};

// Content Security Policy validation
export const validateCSPCompliance = (operation: string): boolean => {
  const allowedOperations = [
    'image-processing',
    'file-upload',
    'watermark-detection',
    'canvas-operation',
    'api-request'
  ];
  
  return allowedOperations.includes(operation);
};
