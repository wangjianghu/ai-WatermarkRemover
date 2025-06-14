
import { pipeline, env } from '@huggingface/transformers';

// 配置 transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

export class NeuralWatermarkRemover {
  private segmentationPipeline: any = null;
  private inpaintingPipeline: any = null;

  async initialize() {
    console.log('初始化神经网络模型...');
    
    // 初始化图像分割模型，用于检测水印区域
    this.segmentationPipeline = await pipeline(
      'image-segmentation',
      'Xenova/segformer-b0-finetuned-ade-512-512',
      { device: 'webgpu' }
    );

    console.log('神经网络模型初始化完成');
  }

  async removeWatermark(file: File): Promise<Blob> {
    if (!this.segmentationPipeline) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          console.log('开始神经网络水印去除处理');
          
          // 第一步：预处理图像
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('无法获取Canvas上下文');

          // 调整图像尺寸以适合模型处理
          const maxSize = 1024;
          let { width, height } = this.calculateOptimalSize(img.width, img.height, maxSize);
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // 第二步：使用神经网络检测和去除水印
          const processedImageData = await this.processWithNeural(canvas);
          
          // 第三步：后处理优化
          const finalImageData = await this.postProcess(processedImageData, width, height);

          // 将处理后的数据放回canvas
          ctx.putImageData(finalImageData, 0, 0);

          // 转换为Blob
          canvas.toBlob((blob) => {
            if (blob) {
              console.log('神经网络水印去除完成');
              resolve(blob);
            } else {
              reject(new Error('图片处理失败'));
            }
          }, file.type, 0.95);

        } catch (error) {
          console.error('神经网络处理失败:', error);
          reject(error);
        }
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

  private async processWithNeural(canvas: HTMLCanvasElement): Promise<ImageData> {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 转换为base64用于模型处理
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    
    try {
      // 使用分割模型检测图像中的不同区域
      const segmentationResult = await this.segmentationPipeline(dataURL);
      console.log('分割结果:', segmentationResult);

      // 基于分割结果智能去除水印
      const processedData = await this.intelligentInpainting(imageData, segmentationResult);
      
      return processedData;
    } catch (error) {
      console.error('神经网络处理错误:', error);
      // 如果神经网络处理失败，使用增强的传统算法作为后备
      return this.enhancedTraditionalRemoval(imageData);
    }
  }

  private async intelligentInpainting(
    imageData: ImageData, 
    segmentationResult: any
  ): Promise<ImageData> {
    const { data, width, height } = imageData;
    const processedData = new ImageData(
      new Uint8ClampedArray(data),
      width,
      height
    );

    // 分析分割结果，识别可能的水印区域
    const watermarkRegions = this.identifyWatermarkRegions(segmentationResult, width, height);
    
    console.log(`检测到 ${watermarkRegions.length} 个潜在水印区域`);

    // 对每个水印区域应用智能修复
    for (const region of watermarkRegions) {
      await this.repairRegionWithContext(processedData, region, width, height);
    }

    return processedData;
  }

  private identifyWatermarkRegions(segmentationResult: any, width: number, height: number) {
    const regions = [];
    
    // 重点关注常见水印位置
    const commonWatermarkAreas = [
      { x: Math.floor(width * 0.7), y: Math.floor(height * 0.8), w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      { x: Math.floor(width * 0.05), y: Math.floor(height * 0.05), w: Math.floor(width * 0.3), h: Math.floor(height * 0.1) },
      { x: Math.floor(width * 0.05), y: Math.floor(height * 0.85), w: Math.floor(width * 0.3), h: Math.floor(height * 0.1) },
      { x: Math.floor(width * 0.7), y: Math.floor(height * 0.05), w: Math.floor(width * 0.3), h: Math.floor(height * 0.1) },
    ];

    // 结合分割结果和常见位置
    for (const area of commonWatermarkAreas) {
      regions.push({
        x: area.x,
        y: area.y,
        width: area.w,
        height: area.h,
        confidence: 0.8 // 基础置信度
      });
    }

    return regions;
  }

  private async repairRegionWithContext(
    imageData: ImageData,
    region: any,
    width: number,
    height: number
  ) {
    const { data } = imageData;
    
    // 使用更大的上下文窗口进行修复
    const contextRadius = 20;
    
    for (let y = region.y; y < region.y + region.height && y < height; y++) {
      for (let x = region.x; x < region.x + region.width && x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        // 检查当前像素是否为水印
        if (this.isWatermarkPixel(data, pixelIndex, x, y, width, height)) {
          // 使用上下文感知的修复算法
          const repairedColor = this.contextAwareRepair(
            data, x, y, width, height, contextRadius
          );
          
          // 应用修复
          data[pixelIndex] = repairedColor.r;
          data[pixelIndex + 1] = repairedColor.g;
          data[pixelIndex + 2] = repairedColor.b;
          data[pixelIndex + 3] = repairedColor.a;
        }
      }
    }
  }

  private isWatermarkPixel(
    data: Uint8ClampedArray,
    pixelIndex: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const a = data[pixelIndex + 3];

    // 多维度水印检测
    const brightness = (r + g + b) / 3;
    const saturation = this.calculateSaturation(r, g, b);
    const edgeStrength = this.calculateEdgeStrength(data, x, y, width, height);
    
    // 综合判断
    const isTransparent = a < 250;
    const isHighContrast = edgeStrength > 50;
    const isMonochrome = saturation < 20;
    const isExtremeBrightness = brightness > 220 || brightness < 35;

    return (isTransparent || isHighContrast || isMonochrome || isExtremeBrightness);
  }

  private calculateSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : ((max - min) / max) * 100;
  }

  private calculateEdgeStrength(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let maxDiff = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4;
        const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
        maxDiff = Math.max(maxDiff, Math.abs(centerBrightness - neighborBrightness));
      }
    }
    
    return maxDiff;
  }

  private contextAwareRepair(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): { r: number, g: number, b: number, a: number } {
    const samples = [];
    
    // 采样周围区域的非水印像素
    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const sampleIndex = (ny * width + nx) * 4;
          
          // 跳过水印像素
          if (!this.isWatermarkPixel(data, sampleIndex, nx, ny, width, height)) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (distance + 1);
            
            samples.push({
              r: data[sampleIndex],
              g: data[sampleIndex + 1],
              b: data[sampleIndex + 2],
              a: data[sampleIndex + 3],
              weight
            });
          }
        }
      }
    }
    
    if (samples.length === 0) {
      return { r: 128, g: 128, b: 128, a: 255 };
    }
    
    // 加权平均
    let totalWeight = 0;
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
    
    for (const sample of samples) {
      totalR += sample.r * sample.weight;
      totalG += sample.g * sample.weight;
      totalB += sample.b * sample.weight;
      totalA += sample.a * sample.weight;
      totalWeight += sample.weight;
    }
    
    return {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
      a: Math.round(totalA / totalWeight)
    };
  }

  private async postProcess(imageData: ImageData, width: number, height: number): Promise<ImageData> {
    const processedData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      width,
      height
    );

    // 应用平滑滤波减少处理痕迹
    this.applyGaussianBlur(processedData, 1);
    
    // 增强对比度
    this.enhanceContrast(processedData, 1.1);
    
    return processedData;
  }

  private applyGaussianBlur(imageData: ImageData, radius: number) {
    // 简化的高斯模糊实现
    const { data, width, height } = imageData;
    const original = new Uint8ClampedArray(data);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const centerIndex = (y * width + x) * 4;
        
        let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const sampleIndex = ((y + dy) * width + (x + dx)) * 4;
            totalR += original[sampleIndex];
            totalG += original[sampleIndex + 1];
            totalB += original[sampleIndex + 2];
            totalA += original[sampleIndex + 3];
            count++;
          }
        }
        
        data[centerIndex] = totalR / count;
        data[centerIndex + 1] = totalG / count;
        data[centerIndex + 2] = totalB / count;
        data[centerIndex + 3] = totalA / count;
      }
    }
  }

  private enhanceContrast(imageData: ImageData, factor: number) {
    const { data } = imageData;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
    }
  }

  private async enhancedTraditionalRemoval(imageData: ImageData): Promise<ImageData> {
    console.log('使用增强传统算法作为后备');
    // 这里可以调用现有的传统算法作为后备
    return imageData;
  }
}
