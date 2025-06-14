
export class OptimizedWatermarkProcessor {
  private worker: Worker | null = null;
  private isProcessing = false;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      this.worker = new Worker('/watermark-worker.js');
    } catch (error) {
      console.warn('Web Worker not available, falling back to main thread processing');
    }
  }

  async removeWatermark(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    if (this.isProcessing) {
      throw new Error('处理器正忙，请稍后再试');
    }

    this.isProcessing = true;

    try {
      // 首先压缩图像以提高处理速度
      const compressedImage = await this.compressImage(file);
      
      if (this.worker) {
        return await this.processWithWorker(compressedImage, onProgress);
      } else {
        return await this.processOnMainThread(compressedImage, onProgress);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async compressImage(file: File): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法获取Canvas上下文'));
          return;
        }

        // 限制最大尺寸以提高性能
        const maxSize = 1200;
        let { width, height } = this.calculateOptimalSize(img.width, img.height, maxSize);
        
        canvas.width = width;
        canvas.height = height;
        
        // 使用高质量缩放
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve({ canvas, ctx });
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  private calculateOptimalSize(originalWidth: number, originalHeight: number, maxSize: number) {
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    if (originalWidth > originalHeight) {
      return {
        width: maxSize,
        height: Math.round(maxSize / aspectRatio)
      };
    } else {
      return {
        width: Math.round(maxSize * aspectRatio),
        height: maxSize
      };
    }
  }

  private async processWithWorker(
    { canvas, ctx }: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker未初始化'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('处理超时'));
      }, 30000); // 30秒超时

      this.worker.onmessage = (e) => {
        const { type, progress, result, error } = e.data;
        
        switch (type) {
          case 'progress':
            onProgress?.(progress);
            break;
            
          case 'completed':
            clearTimeout(timeout);
            ctx.putImageData(new ImageData(
              new Uint8ClampedArray(result.data),
              result.width,
              result.height
            ), 0, 0);
            
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('生成处理结果失败'));
              }
            }, 'image/jpeg', 0.92);
            break;
            
          case 'error':
            clearTimeout(timeout);
            reject(new Error(error));
            break;
        }
      };

      this.worker.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Worker处理出错'));
      };

      // 发送处理任务
      this.worker.postMessage({
        type: 'process',
        imageData: {
          data: Array.from(imageData.data),
          width: imageData.width,
          height: imageData.height
        },
        width: canvas.width,
        height: canvas.height
      });
    });
  }

  private async processOnMainThread(
    { canvas, ctx }: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 分块处理避免阻塞
    const chunks = 50;
    const chunkSize = Math.floor(canvas.height / chunks);
    
    for (let i = 0; i < chunks; i++) {
      const startY = i * chunkSize;
      const endY = Math.min(startY + chunkSize, canvas.height);
      
      this.processChunkMainThread(imageData, canvas.width, canvas.height, startY, endY);
      
      onProgress?.(Math.floor(((i + 1) / chunks) * 100));
      
      // 让出控制权
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('生成处理结果失败'));
        }
      }, 'image/jpeg', 0.92);
    });
  }

  private processChunkMainThread(imageData: ImageData, width: number, height: number, startY: number, endY: number) {
    // 简化的主线程处理逻辑
    const data = imageData.data;
    
    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        const brightness = (r + g + b) / 3;
        
        // 简化的水印检测
        if (brightness > 200 || brightness < 50 || a < 200) {
          // 简单的邻域平均修复
          this.simpleRepair(data, x, y, width, height);
        }
      }
    }
  }

  private simpleRepair(data: Uint8ClampedArray, x: number, y: number, width: number, height: number) {
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0, count = 0;
    
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          totalR += data[neighborIndex];
          totalG += data[neighborIndex + 1];
          totalB += data[neighborIndex + 2];
          totalA += data[neighborIndex + 3];
          count++;
        }
      }
    }
    
    if (count > 0) {
      const index = (y * width + x) * 4;
      const blendFactor = 0.6;
      
      data[index] = Math.round(data[index] * (1 - blendFactor) + (totalR / count) * blendFactor);
      data[index + 1] = Math.round(data[index + 1] * (1 - blendFactor) + (totalG / count) * blendFactor);
      data[index + 2] = Math.round(data[index + 2] * (1 - blendFactor) + (totalB / count) * blendFactor);
      data[index + 3] = Math.round(data[index + 3] * (1 - blendFactor) + (totalA / count) * blendFactor);
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
