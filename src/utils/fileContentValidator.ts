
// Enhanced file content validation utilities
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  securityFlags?: string[];
}

// Comprehensive image file signatures for security validation
const IMAGE_SIGNATURES = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0], // JPEG JFIF
    [0xFF, 0xD8, 0xFF, 0xE1], // JPEG EXIF
    [0xFF, 0xD8, 0xFF, 0xE2], // JPEG with ICC profile
    [0xFF, 0xD8, 0xFF, 0xE3], // JPEG with extended
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF container (WebP)
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/bmp': [
    [0x42, 0x4D], // BMP
  ]
};

// Dangerous file signatures to detect polyglot attacks
const DANGEROUS_SIGNATURES = [
  [0x4D, 0x5A], // PE executable
  [0x50, 0x4B], // ZIP/Office documents (potential macro attacks)
  [0x7F, 0x45, 0x4C, 0x46], // ELF executable
  [0xCA, 0xFE, 0xBA, 0xBE], // Java class file
  [0x25, 0x50, 0x44, 0x46], // PDF (potential script injection)
];

export const validateFileContent = async (file: File): Promise<FileValidationResult> => {
  const warnings: string[] = [];
  const securityFlags: string[] = [];
  
  try {
    // Enhanced security checks
    const securityResult = await performSecurityChecks(file);
    if (!securityResult.isValid) {
      return securityResult;
    }
    securityFlags.push(...(securityResult.securityFlags || []));
    
    // Read extended file header for comprehensive validation
    const headerBytes = await readFileHeader(file, 64);
    
    // Check for dangerous file signatures
    const dangerousCheck = checkDangerousSignatures(headerBytes);
    if (!dangerousCheck.isValid) {
      return dangerousCheck;
    }
    
    // Validate file signature
    const signatureResult = validateFileSignature(headerBytes, file.type);
    if (!signatureResult.isValid) {
      return signatureResult;
    }
    
    // Additional content validation for images
    if (file.type.startsWith('image/')) {
      const imageValidation = await validateImageContent(file);
      if (!imageValidation.isValid) {
        return imageValidation;
      }
      warnings.push(...(imageValidation.warnings || []));
      securityFlags.push(...(imageValidation.securityFlags || []));
    }
    
    // Check for metadata anomalies
    const metadataCheck = await checkMetadataAnomalies(file);
    warnings.push(...metadataCheck.warnings);
    securityFlags.push(...metadataCheck.securityFlags);
    
    return { isValid: true, warnings, securityFlags };
  } catch (error: any) {
    return { isValid: false, error: `文件内容验证失败: ${error.message}` };
  }
};

const performSecurityChecks = async (file: File): Promise<FileValidationResult> => {
  const securityFlags: string[] = [];
  
  // Check for suspicious file characteristics
  if (file.name.includes('\0')) {
    return { isValid: false, error: '文件名包含非法字符，可能是恶意文件。' };
  }
  
  // Check for double extensions (steganography/malware indicator)
  const doubleExtPattern = /\.(jpg|jpeg|png|gif|bmp)\.(exe|scr|bat|cmd|com|pif|js|vbs)$/i;
  if (doubleExtPattern.test(file.name)) {
    return { isValid: false, error: '检测到双重扩展名，可能是恶意文件。' };
  }
  
  // Check for extremely unusual file sizes
  if (file.size > 50 * 1024 * 1024) { // 50MB
    securityFlags.push('LARGE_FILE');
  }
  
  // Check for suspicious file size patterns (potential steganography)
  const sizeToName = file.size / file.name.length;
  if (sizeToName > 100000) { // Unusually large size relative to filename
    securityFlags.push('SUSPICIOUS_SIZE_RATIO');
  }
  
  return { isValid: true, securityFlags };
};

const readFileHeader = (file: File, byteCount: number): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => {
      reader.abort();
      reject(new Error('文件读取超时'));
    }, 5000);
    
    reader.onload = () => {
      clearTimeout(timeout);
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    
    reader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('无法读取文件头部'));
    };
    
    reader.readAsArrayBuffer(file.slice(0, byteCount));
  });
};

const checkDangerousSignatures = (headerBytes: Uint8Array): FileValidationResult => {
  for (const signature of DANGEROUS_SIGNATURES) {
    if (matchesSignature(headerBytes, signature)) {
      return { 
        isValid: false, 
        error: '检测到危险文件格式，文件可能包含可执行代码。' 
      };
    }
  }
  return { isValid: true };
};

const validateFileSignature = (headerBytes: Uint8Array, mimeType: string): FileValidationResult => {
  // Add support for more image types
  const allSupportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  
  if (!allSupportedTypes.includes(mimeType)) {
    return { isValid: false, error: '不支持的图片格式。' };
  }
  
  const signatures = IMAGE_SIGNATURES[mimeType as keyof typeof IMAGE_SIGNATURES];
  if (!signatures) {
    return { isValid: false, error: '无法验证文件格式。' };
  }
  
  for (const signature of signatures) {
    if (matchesSignature(headerBytes, signature)) {
      return { isValid: true };
    }
  }
  
  return { 
    isValid: false, 
    error: '文件内容与声明的格式不匹配，可能是伪造的扩展名或损坏的文件。' 
  };
};

const matchesSignature = (headerBytes: Uint8Array, signature: number[]): boolean => {
  if (headerBytes.length < signature.length) return false;
  
  for (let i = 0; i < signature.length; i++) {
    if (headerBytes[i] !== signature[i]) return false;
  }
  
  return true;
};

const validateImageContent = (file: File): Promise<FileValidationResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const warnings: string[] = [];
    const securityFlags: string[] = [];
    
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ 
        isValid: false, 
        error: '图片验证超时，文件可能已损坏或包含异常数据。' 
      });
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      
      // Enhanced security checks
      const aspectRatio = img.width / img.height;
      if (aspectRatio > 20 || aspectRatio < 0.05) {
        warnings.push('图片长宽比极端异常。');
        securityFlags.push('EXTREME_ASPECT_RATIO');
      }
      
      // Check for memory bomb potential
      const totalPixels = img.width * img.height;
      if (totalPixels > 25000000) { // ~5000x5000
        warnings.push('图片像素数量极大，可能导致内存耗尽。');
        securityFlags.push('MEMORY_BOMB_RISK');
      }
      
      // Check for unusual dimensions that might indicate steganography
      if (img.width % 16 !== 0 || img.height % 16 !== 0) {
        securityFlags.push('NON_STANDARD_DIMENSIONS');
      }
      
      // File size vs pixel count analysis
      const bytesPerPixel = file.size / totalPixels;
      if (bytesPerPixel > 10) { // Unusually high compression ratio
        securityFlags.push('HIGH_COMPRESSION_RATIO');
        warnings.push('文件大小相对于像素数异常，可能包含隐藏数据。');
      }
      
      resolve({ isValid: true, warnings, securityFlags });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ 
        isValid: false, 
        error: '图片文件已损坏、格式无效或包含恶意数据。' 
      });
    };
    
    img.src = url;
  });
};

const checkMetadataAnomalies = async (file: File): Promise<{ warnings: string[], securityFlags: string[] }> => {
  const warnings: string[] = [];
  const securityFlags: string[] = [];
  
  try {
    // Check for abnormal file creation patterns
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    if (file.lastModified > now) {
      warnings.push('文件修改时间异常（未来时间）。');
      securityFlags.push('FUTURE_TIMESTAMP');
    }
    
    if (file.lastModified < dayAgo * 365) { // Very old file
      securityFlags.push('VERY_OLD_FILE');
    }
    
    // Check filename patterns that might indicate automated generation
    const suspiciousPatterns = [
      /^[0-9a-f]{32}\.(jpg|png|gif)$/i, // MD5-like names
      /^img_\d{13}\.(jpg|png|gif)$/i,   // Timestamp-based names
      /^screenshot_\d+\.(jpg|png|gif)$/i, // Auto-generated names
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
      securityFlags.push('AUTOMATED_FILENAME');
    }
    
  } catch (error) {
    warnings.push('元数据检查时发生错误。');
  }
  
  return { warnings, securityFlags };
};

// Enhanced canvas security validation
export const validateCanvasOperation = (
  width: number, 
  height: number, 
  operation: string
): FileValidationResult => {
  const securityFlags: string[] = [];
  
  // Stricter canvas size limits
  const maxCanvasSize = 16777216; // 4096 * 4096
  const canvasSize = width * height;
  
  if (canvasSize > maxCanvasSize) {
    return { 
      isValid: false, 
      error: `Canvas操作尺寸过大 (${width}x${height})，可能导致浏览器崩溃或内存耗尽。` 
    };
  }
  
  // Check for potential memory issues
  if (canvasSize > 4194304) { // 2048 * 2048
    securityFlags.push('LARGE_CANVAS_OPERATION');
  }
  
  // Validate operation types more strictly
  const allowedOperations = [
    'watermark-removal', 
    'image-processing', 
    'mask-creation',
    'resize',
    'crop',
    'filter'
  ];
  
  if (!allowedOperations.includes(operation)) {
    return { 
      isValid: false, 
      error: `不支持的Canvas操作类型: ${operation}` 
    };
  }
  
  return { isValid: true, securityFlags };
};

// Memory usage monitoring
export const monitorMemoryUsage = (): { usage: number, warning: boolean } => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    return {
      usage: Math.round(usage * 100),
      warning: usage > 0.8 // Warning if over 80% memory usage
    };
  }
  
  return { usage: 0, warning: false };
};
