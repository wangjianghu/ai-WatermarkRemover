
// File content validation utilities
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

// Image file header signatures for additional security
const IMAGE_SIGNATURES = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // JPEG
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
  ],
};

export const validateFileContent = async (file: File): Promise<FileValidationResult> => {
  const warnings: string[] = [];
  
  try {
    // Read file header for signature validation
    const headerBytes = await readFileHeader(file, 12);
    
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
    }
    
    return { isValid: true, warnings };
  } catch (error: any) {
    return { isValid: false, error: `文件内容验证失败: ${error.message}` };
  }
};

const readFileHeader = (file: File, byteCount: number): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    reader.onerror = () => reject(new Error('无法读取文件'));
    reader.readAsArrayBuffer(file.slice(0, byteCount));
  });
};

const validateFileSignature = (headerBytes: Uint8Array, mimeType: string): FileValidationResult => {
  const signatures = IMAGE_SIGNATURES[mimeType as keyof typeof IMAGE_SIGNATURES];
  if (!signatures) {
    return { isValid: false, error: '不支持的文件类型进行内容验证。' };
  }
  
  for (const signature of signatures) {
    if (matchesSignature(headerBytes, signature)) {
      return { isValid: true };
    }
  }
  
  return { isValid: false, error: '文件内容与声明的类型不匹配，可能是伪造的文件扩展名。' };
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
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const warnings: string[] = [];
      
      // Check for suspicious aspect ratios
      const aspectRatio = img.width / img.height;
      if (aspectRatio > 10 || aspectRatio < 0.1) {
        warnings.push('图片长宽比异常，可能影响处理效果。');
      }
      
      // Check for very large images that might cause memory issues
      const totalPixels = img.width * img.height;
      if (totalPixels > 16777216) { // 4096x4096
        warnings.push('图片像素过多，处理时可能消耗大量内存。');
      }
      
      resolve({ isValid: true, warnings });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ isValid: false, error: '图片文件已损坏或格式无效。' });
    };
    
    // Set timeout for validation
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ isValid: false, error: '图片验证超时，文件可能已损坏。' });
    }, 5000);
    
    img.src = url;
  });
};

// Canvas security validation
export const validateCanvasOperation = (
  width: number, 
  height: number, 
  operation: string
): FileValidationResult => {
  // Check for canvas size limits to prevent memory exhaustion
  const maxCanvasSize = 4096 * 4096;
  const canvasSize = width * height;
  
  if (canvasSize > maxCanvasSize) {
    return { 
      isValid: false, 
      error: `Canvas操作尺寸过大 (${width}x${height})，可能导致浏览器崩溃。` 
    };
  }
  
  // Check for valid operation types
  const allowedOperations = ['watermark-removal', 'image-processing', 'mask-creation'];
  if (!allowedOperations.includes(operation)) {
    return { 
      isValid: false, 
      error: '不支持的Canvas操作类型。' 
    };
  }
  
  return { isValid: true };
};
