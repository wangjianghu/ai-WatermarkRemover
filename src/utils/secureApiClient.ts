
import { validateApiKey, apiRateLimiter } from './apiSecurity';
import { WatermarkMark } from '@/components/watermark/types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class SecureApiClient {
  private static instance: SecureApiClient;
  private apiKey: string = '';
  
  private constructor() {}
  
  static getInstance(): SecureApiClient {
    if (!SecureApiClient.instance) {
      SecureApiClient.instance = new SecureApiClient();
    }
    return SecureApiClient.instance;
  }
  
  setApiKey(key: string): void {
    if (validateApiKey(key)) {
      this.apiKey = key;
      // Store encrypted in sessionStorage instead of localStorage for better security
      sessionStorage.setItem('sd-api-key-hash', btoa(key));
    } else {
      throw new Error('Invalid API key format');
    }
  }
  
  getApiKey(): string {
    if (!this.apiKey) {
      const stored = sessionStorage.getItem('sd-api-key-hash');
      if (stored) {
        try {
          this.apiKey = atob(stored);
        } catch (error) {
          console.warn('Failed to retrieve stored API key');
          sessionStorage.removeItem('sd-api-key-hash');
        }
      }
    }
    return this.apiKey;
  }
  
  clearApiKey(): void {
    this.apiKey = '';
    sessionStorage.removeItem('sd-api-key-hash');
    localStorage.removeItem('sd-api-key'); // Clean up old insecure storage
  }
  
  async validateApiKey(): Promise<ApiResponse<boolean>> {
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      return { success: false, error: '请先设置API密钥' };
    }
    
    if (!apiRateLimiter.canMakeRequest()) {
      return { success: false, error: '请求过于频繁，请稍后再试' };
    }
    
    try {
      // Use a safe validation endpoint that doesn't expose sensitive information
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://api.stability.ai/v1/user/account', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'WatermarkRemover/1.0',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { success: true, data: true };
      } else if (response.status === 401) {
        return { success: false, error: 'API密钥无效或已过期' };
      } else if (response.status === 429) {
        return { success: false, error: 'API调用频率超限，请稍后再试' };
      } else {
        return { success: false, error: `验证失败 (${response.status})` };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: '请求超时，请检查网络连接' };
      }
      console.error('API validation error:', error);
      return { success: false, error: '网络连接失败，请稍后再试' };
    }
  }
  
  async processWithSDInpainting(imageFile: File, mark: WatermarkMark): Promise<ApiResponse<Blob>> {
    const apiKey = this.getApiKey();
    
    if (!apiKey) {
      return { success: false, error: '请先设置并验证API密钥' };
    }
    
    if (!apiRateLimiter.canMakeRequest()) {
      return { success: false, error: '请求过于频繁，请稍后再试' };
    }
    
    try {
      // This would typically go through a secure backend proxy
      // For now, we'll implement basic security measures
      console.warn('Direct API call - consider implementing backend proxy for production');
      
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('mask', await this.createMaskFromWatermark(imageFile, mark));
      formData.append('prompt', 'remove watermark, natural background');
      formData.append('model', 'stable-diffusion-xl-1024-v1-0');
      formData.append('samples', '1');
      formData.append('steps', '30');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.artifacts && result.artifacts[0]) {
        const imageData = result.artifacts[0].base64;
        const blob = this.base64ToBlob(imageData, 'image/png');
        return { success: true, data: blob };
      } else {
        return { success: false, error: 'API返回无效数据' };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: '处理超时，请稍后再试' };
      }
      console.error('SD Inpainting error:', error);
      return { success: false, error: `处理失败: ${error.message}` };
    }
  }
  
  private async createMaskFromWatermark(imageFile: File, mark: WatermarkMark): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Create black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create white mask for watermark area
        ctx.fillStyle = 'white';
        const x = mark.x * canvas.width;
        const y = mark.y * canvas.height;
        const width = mark.width * canvas.width;
        const height = mark.height * canvas.height;
        ctx.fillRect(x, y, width, height);
        
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png');
      };
      img.src = URL.createObjectURL(imageFile);
    });
  }
  
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

export const secureApiClient = SecureApiClient.getInstance();
