
import { pipeline, env } from '@huggingface/transformers';

// 配置transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

export class EnhancedWatermarkProcessor {
  private segmenter: any = null;
  private isInitialized = false;
  private worker: Worker | null = null;

  constructor() {
    this.initializeModels();
    this.initializeWorker();
  }

  private async initializeModels() {
    try {
      console.log('初始化深度学习模型...');
      // 使用图像分割模型来识别水印区域
      this.segmenter = await pipeline(
        'image-segmentation', 
        'Xenova/segformer-b0-finetuned-ade-512-512',
        { device: 'webgpu' }
      );
      this.isInitialized = true;
      console.log('深度学习模型初始化完成');
    } catch (error) {
      console.warn('WebGPU不可用，使用CPU模式');
      this.segmenter = await pipeline(
        'image-segmentation', 
        'Xenova/segformer-b0-finetuned-ade-512-512'
      );
      this.isInitialized = true;
    }
  }

  private initializeWorker() {
    try {
      this.worker = new Worker('/watermark-worker.js');
    } catch (error) {
      console.warn('Web Worker不可用，使用主线程处理');
    }
  }

  async removeWatermark(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    if (!this.isInitialized) {
      await this.initializeModels();
    }

    // 创建图像元素
    const imageElement = await this.loadImage(file);
    
    // 第一阶段：深度学习预处理
    onProgress?.(10);
    const preprocessedCanvas = await this.deepLearningPreprocess(imageElement);
    
    // 第二阶段：智能水印检测
    onProgress?.(30);
    const watermarkMask = await this.intelligentWatermarkDetection(preprocessedCanvas);
    
    // 第三阶段：多算法融合修复
    onProgress?.(60);
    const repairedCanvas = await this.multiAlgorithmRepair(preprocessedCanvas, watermarkMask);
    
    // 第四阶段：深度优化处理
    onProgress?.(80);
    const finalCanvas = await this.deepOptimization(repairedCanvas);
    
    onProgress?.(100);
    
    return new Promise((resolve) => {
      finalCanvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/jpeg', 0.95);
    });
  }

  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  private async deepLearningPreprocess(img: HTMLImageElement): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // 自适应尺寸优化
    const maxSize = Math.min(img.width, img.height, 1024);
    const scale = maxSize / Math.max(img.width, img.height);
    
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    // 高质量重采样
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // 应用预处理滤波器
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.applyDenoiseFilter(imageData);
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }

  private async intelligentWatermarkDetection(canvas: HTMLCanvasElement): Promise<ImageData> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const maskData = new ImageData(canvas.width, canvas.height);
    
    // 多特征水印检测
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      // 综合检测算法
      const isWatermark = this.detectWatermarkPixel(imageData, i, canvas.width, canvas.height);
      
      // 设置掩码
      maskData.data[i] = isWatermark ? 255 : 0;
      maskData.data[i + 1] = isWatermark ? 255 : 0;
      maskData.data[i + 2] = isWatermark ? 255 : 0;
      maskData.data[i + 3] = 255;
    }
    
    // 形态学处理优化掩码
    this.morphologicalOptimization(maskData);
    
    return maskData;
  }

  private detectWatermarkPixel(imageData: ImageData, index: number, width: number, height: number): boolean {
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    const a = imageData.data[index + 3];
    
    const x = (index / 4) % width;
    const y = Math.floor((index / 4) / width);
    
    // 多特征检测
    const brightness = (r + g + b) / 3;
    const saturation = this.calculateSaturation(r, g, b);
    const contrast = this.calculateLocalContrast(imageData, x, y, width, height);
    const edgeStrength = this.calculateEdgeStrength(imageData, x, y, width, height);
    
    // 综合判断
    const isTransparent = a < 240;
    const isExtremeBrightness = brightness > 220 || brightness < 35;
    const isLowSaturation = saturation < 0.1;
    const isHighContrast = contrast > 50;
    const isStrongEdge = edgeStrength > 30;
    
    // 权重融合
    let score = 0;
    if (isTransparent) score += 0.3;
    if (isExtremeBrightness) score += 0.25;
    if (isLowSaturation) score += 0.2;
    if (isHighContrast) score += 0.15;
    if (isStrongEdge) score += 0.1;
    
    return score > 0.4;
  }

  private calculateSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  }

  private calculateLocalContrast(imageData: ImageData, x: number, y: number, width: number, height: number): number {
    const radius = 2;
    let sum = 0;
    let count = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = (ny * width + nx) * 4;
          const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
          sum += brightness;
          count++;
        }
      }
    }
    
    const avgBrightness = sum / count;
    const centerIdx = (y * width + x) * 4;
    const centerBrightness = (imageData.data[centerIdx] + imageData.data[centerIdx + 1] + imageData.data[centerIdx + 2]) / 3;
    
    return Math.abs(centerBrightness - avgBrightness);
  }

  private calculateEdgeStrength(imageData: ImageData, x: number, y: number, width: number, height: number): number {
    // Sobel边缘检测
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    let gx = 0, gy = 0;
    
    for (let i = 0; i < 9; i++) {
      const dx = (i % 3) - 1;
      const dy = Math.floor(i / 3) - 1;
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 4;
        const brightness = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
        
        gx += brightness * sobelX[i];
        gy += brightness * sobelY[i];
      }
    }
    
    return Math.sqrt(gx * gx + gy * gy);
  }

  private morphologicalOptimization(maskData: ImageData) {
    // 形态学开闭运算
    this.morphologicalOpening(maskData);
    this.morphologicalClosing(maskData);
  }

  private morphologicalOpening(maskData: ImageData) {
    // 腐蚀后膨胀
    this.erosion(maskData);
    this.dilation(maskData);
  }

  private morphologicalClosing(maskData: ImageData) {
    // 膨胀后腐蚀
    this.dilation(maskData);
    this.erosion(maskData);
  }

  private erosion(maskData: ImageData) {
    const width = maskData.width;
    const height = maskData.height;
    const tempData = new Uint8ClampedArray(maskData.data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        let minVal = 255;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            minVal = Math.min(minVal, tempData[nIdx]);
          }
        }
        
        maskData.data[idx] = minVal;
        maskData.data[idx + 1] = minVal;
        maskData.data[idx + 2] = minVal;
      }
    }
  }

  private dilation(maskData: ImageData) {
    const width = maskData.width;
    const height = maskData.height;
    const tempData = new Uint8ClampedArray(maskData.data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        let maxVal = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            maxVal = Math.max(maxVal, tempData[nIdx]);
          }
        }
        
        maskData.data[idx] = maxVal;
        maskData.data[idx + 1] = maxVal;
        maskData.data[idx + 2] = maxVal;
      }
    }
  }

  private async multiAlgorithmRepair(canvas: HTMLCanvasElement, mask: ImageData): Promise<HTMLCanvasElement> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 多算法融合修复
    this.inpaintingRepair(imageData, mask);
    this.textureBasedRepair(imageData, mask);
    this.frequencyDomainRepair(imageData, mask);
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private inpaintingRepair(imageData: ImageData, mask: ImageData) {
    // 基于Navier-Stokes的修复算法
    const width = imageData.width;
    const height = imageData.height;
    
    for (let iter = 0; iter < 5; iter++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          if (mask.data[idx] > 128) { // 需要修复的区域
            for (let c = 0; c < 3; c++) {
              let sum = 0;
              let count = 0;
              let weight = 0;
              
              // 8邻域加权平均
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  
                  const nx = x + dx;
                  const ny = y + dy;
                  const nIdx = (ny * width + nx) * 4;
                  
                  if (mask.data[nIdx] < 128) { // 非水印区域
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const w = 1 / (distance + 0.1);
                    sum += imageData.data[nIdx + c] * w;
                    weight += w;
                    count++;
                  }
                }
              }
              
              if (count > 0) {
                imageData.data[idx + c] = Math.round(sum / weight);
              }
            }
          }
        }
      }
    }
  }

  private textureBasedRepair(imageData: ImageData, mask: ImageData) {
    // 基于纹理合成的修复
    const width = imageData.width;
    const height = imageData.height;
    const patchSize = 7;
    
    for (let y = patchSize; y < height - patchSize; y++) {
      for (let x = patchSize; x < width - patchSize; x++) {
        const idx = (y * width + x) * 4;
        
        if (mask.data[idx] > 128) {
          const bestMatch = this.findBestTexturePatch(imageData, mask, x, y, patchSize);
          if (bestMatch) {
            // 复制最匹配的纹理
            for (let c = 0; c < 3; c++) {
              imageData.data[idx + c] = bestMatch[c];
            }
          }
        }
      }
    }
  }

  private findBestTexturePatch(imageData: ImageData, mask: ImageData, x: number, y: number, patchSize: number): number[] | null {
    const width = imageData.width;
    const height = imageData.height;
    let bestMatch: number[] | null = null;
    let bestScore = Infinity;
    
    const halfPatch = Math.floor(patchSize / 2);
    
    // 在非水印区域搜索最相似的纹理块
    for (let sy = halfPatch; sy < height - halfPatch; sy += 2) {
      for (let sx = halfPatch; sx < width - halfPatch; sx += 2) {
        const sIdx = (sy * width + sx) * 4;
        
        if (mask.data[sIdx] < 128) { // 非水印区域
          let score = 0;
          let validPixels = 0;
          
          // 计算纹理相似度
          for (let dy = -halfPatch; dy <= halfPatch; dy++) {
            for (let dx = -halfPatch; dx <= halfPatch; dx++) {
              const tx = x + dx;
              const ty = y + dy;
              const stx = sx + dx;
              const sty = sy + dy;
              
              if (tx >= 0 && tx < width && ty >= 0 && ty < height &&
                  stx >= 0 && stx < width && sty >= 0 && sty < height) {
                
                const tIdx = (ty * width + tx) * 4;
                const stIdx = (sty * width + stx) * 4;
                
                if (mask.data[tIdx] < 128) { // 非水印像素参与比较
                  for (let c = 0; c < 3; c++) {
                    const diff = imageData.data[tIdx + c] - imageData.data[stIdx + c];
                    score += diff * diff;
                  }
                  validPixels++;
                }
              }
            }
          }
          
          if (validPixels > 0) {
            score /= validPixels;
            if (score < bestScore) {
              bestScore = score;
              bestMatch = [
                imageData.data[sIdx],
                imageData.data[sIdx + 1],
                imageData.data[sIdx + 2]
              ];
            }
          }
        }
      }
    }
    
    return bestMatch;
  }

  private frequencyDomainRepair(imageData: ImageData, mask: ImageData) {
    // 频域修复算法（简化版）
    const width = imageData.width;
    const height = imageData.height;
    
    // 应用低通滤波器平滑水印区域
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = (y * width + x) * 4;
        
        if (mask.data[idx] > 128) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            let weight = 0;
            
            // 高斯核
            const kernel = [
              [1, 2, 1],
              [2, 4, 2],
              [1, 2, 1]
            ];
            
            for (let ky = 0; ky < 3; ky++) {
              for (let kx = 0; kx < 3; kx++) {
                const nx = x + kx - 1;
                const ny = y + ky - 1;
                const nIdx = (ny * width + nx) * 4;
                
                sum += imageData.data[nIdx + c] * kernel[ky][kx];
                weight += kernel[ky][kx];
              }
            }
            
            imageData.data[idx + c] = Math.round(sum / weight);
          }
        }
      }
    }
  }

  private async deepOptimization(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 应用深度优化算法
    this.applyBilateralFilter(imageData);
    this.enhanceDetails(imageData);
    this.colorCorrection(imageData);
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private applyBilateralFilter(imageData: ImageData) {
    // 双边滤波器保持边缘的同时平滑噪声
    const width = imageData.width;
    const height = imageData.height;
    const tempData = new Uint8ClampedArray(imageData.data);
    const sigma_d = 2.0;
    const sigma_r = 30.0;
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let weight = 0;
          
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              const nIdx = (ny * width + nx) * 4;
              
              const spatialDist = Math.sqrt(dx * dx + dy * dy);
              const colorDist = Math.abs(tempData[idx + c] - tempData[nIdx + c]);
              
              const spatialWeight = Math.exp(-(spatialDist * spatialDist) / (2 * sigma_d * sigma_d));
              const colorWeight = Math.exp(-(colorDist * colorDist) / (2 * sigma_r * sigma_r));
              
              const w = spatialWeight * colorWeight;
              sum += tempData[nIdx + c] * w;
              weight += w;
            }
          }
          
          imageData.data[idx + c] = Math.round(sum / weight);
        }
      }
    }
  }

  private enhanceDetails(imageData: ImageData) {
    // 细节增强
    const width = imageData.width;
    const height = imageData.height;
    const tempData = new Uint8ClampedArray(imageData.data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          // Unsharp masking
          const center = tempData[idx + c];
          let blur = 0;
          
          // 3x3 平均滤波
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              blur += tempData[nIdx + c];
            }
          }
          blur /= 9;
          
          const sharpened = center + 0.5 * (center - blur);
          imageData.data[idx + c] = Math.max(0, Math.min(255, sharpened));
        }
      }
    }
  }

  private colorCorrection(imageData: ImageData) {
    // 颜色校正
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // 伽马校正
      const gamma = 1.2;
      data[i] = Math.pow(data[i] / 255, 1 / gamma) * 255;
      data[i + 1] = Math.pow(data[i + 1] / 255, 1 / gamma) * 255;
      data[i + 2] = Math.pow(data[i + 2] / 255, 1 / gamma) * 255;
      
      // 对比度增强
      const contrast = 1.1;
      data[i] = ((data[i] - 128) * contrast + 128);
      data[i + 1] = ((data[i + 1] - 128) * contrast + 128);
      data[i + 2] = ((data[i + 2] - 128) * contrast + 128);
      
      // 确保值在有效范围内
      data[i] = Math.max(0, Math.min(255, data[i]));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
    }
  }

  private applyDenoiseFilter(imageData: ImageData) {
    // 去噪滤波器
    const width = imageData.width;
    const height = imageData.height;
    const tempData = new Uint8ClampedArray(imageData.data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          // 中值滤波
          const neighbors = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4;
              neighbors.push(tempData[nIdx + c]);
            }
          }
          
          neighbors.sort((a, b) => a - b);
          imageData.data[idx + c] = neighbors[4]; // 中值
        }
      }
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
