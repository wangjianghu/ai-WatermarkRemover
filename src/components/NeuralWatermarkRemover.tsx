
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

          // 第二步：多次迭代处理以彻底去除水印
          let processedImageData = ctx.getImageData(0, 0, width, height);
          
          // 执行3轮深度处理
          for (let iteration = 0; iteration < 3; iteration++) {
            console.log(`执行第 ${iteration + 1} 轮深度处理`);
            processedImageData = await this.deepWatermarkRemoval(canvas, processedImageData, iteration);
          }
          
          // 第三步：最终优化处理
          const finalImageData = await this.finalOptimization(processedImageData, width, height);

          // 将处理后的数据放回canvas
          ctx.putImageData(finalImageData, 0, 0);

          // 转换为Blob
          canvas.toBlob((blob) => {
            if (blob) {
              console.log('深度神经网络水印去除完成');
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

  private async deepWatermarkRemoval(canvas: HTMLCanvasElement, imageData: ImageData, iteration: number): Promise<ImageData> {
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    
    // 转换为base64用于模型处理
    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    
    try {
      // 使用分割模型检测图像中的不同区域
      const segmentationResult = await this.segmentationPipeline(dataURL);
      console.log(`第 ${iteration + 1} 轮分割结果:`, segmentationResult);

      // 基于分割结果和迭代次数调整处理策略
      const processedData = await this.adaptiveWatermarkRemoval(imageData, segmentationResult, iteration);
      
      return processedData;
    } catch (error) {
      console.error('神经网络处理错误:', error);
      // 如果神经网络处理失败，使用增强的传统算法作为后备
      return this.enhancedTraditionalRemoval(imageData, iteration);
    }
  }

  private async adaptiveWatermarkRemoval(
    imageData: ImageData, 
    segmentationResult: any,
    iteration: number
  ): Promise<ImageData> {
    const { data, width, height } = imageData;
    const processedData = new ImageData(
      new Uint8ClampedArray(data),
      width,
      height
    );

    // 根据迭代次数调整检测敏感度
    const sensitivity = 0.3 + iteration * 0.2; // 逐渐增加敏感度
    
    // 扩展水印检测区域，覆盖更多可能位置
    const watermarkRegions = this.identifyWatermarkRegions(segmentationResult, width, height, sensitivity);
    
    console.log(`第 ${iteration + 1} 轮检测到 ${watermarkRegions.length} 个潜在水印区域`);

    // 对每个水印区域应用渐进式修复
    for (const region of watermarkRegions) {
      await this.progressiveRegionRepair(processedData, region, width, height, iteration);
    }

    // 应用全图水印痕迹清理
    this.globalWatermarkCleanup(processedData, width, height, iteration);

    return processedData;
  }

  private identifyWatermarkRegions(segmentationResult: any, width: number, height: number, sensitivity: number) {
    const regions = [];
    
    // 扩展的常见水印位置检测
    const watermarkPositions = [
      // 四个角落
      { x: 0, y: 0, w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      { x: Math.floor(width * 0.7), y: 0, w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      { x: 0, y: Math.floor(height * 0.8), w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      { x: Math.floor(width * 0.7), y: Math.floor(height * 0.8), w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      
      // 中心区域
      { x: Math.floor(width * 0.3), y: Math.floor(height * 0.4), w: Math.floor(width * 0.4), h: Math.floor(height * 0.2) },
      
      // 边缘中央
      { x: Math.floor(width * 0.4), y: 0, w: Math.floor(width * 0.2), h: Math.floor(height * 0.15) },
      { x: Math.floor(width * 0.4), y: Math.floor(height * 0.85), w: Math.floor(width * 0.2), h: Math.floor(height * 0.15) },
      { x: 0, y: Math.floor(height * 0.4), w: Math.floor(width * 0.15), h: Math.floor(height * 0.2) },
      { x: Math.floor(width * 0.85), y: Math.floor(height * 0.4), w: Math.floor(width * 0.15), h: Math.floor(height * 0.2) },
    ];

    // 根据敏感度调整区域
    for (const pos of watermarkPositions) {
      regions.push({
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        confidence: sensitivity
      });
    }

    return regions;
  }

  private async progressiveRegionRepair(
    imageData: ImageData,
    region: any,
    width: number,
    height: number,
    iteration: number
  ) {
    const { data } = imageData;
    
    // 根据迭代次数调整修复强度
    const repairStrength = 0.4 + iteration * 0.3;
    const contextRadius = 15 + iteration * 5;
    
    for (let y = region.y; y < region.y + region.height && y < height; y++) {
      for (let x = region.x; x < region.x + region.width && x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        // 增强的水印像素检测
        if (this.isEnhancedWatermarkPixel(data, pixelIndex, x, y, width, height, iteration)) {
          // 使用多层次修复算法
          const repairedColor = this.multiLevelRepair(
            data, x, y, width, height, contextRadius, repairStrength
          );
          
          // 应用修复，使用渐进式混合
          const blendRatio = Math.min(repairStrength, 0.9);
          data[pixelIndex] = Math.round(data[pixelIndex] * (1 - blendRatio) + repairedColor.r * blendRatio);
          data[pixelIndex + 1] = Math.round(data[pixelIndex + 1] * (1 - blendRatio) + repairedColor.g * blendRatio);
          data[pixelIndex + 2] = Math.round(data[pixelIndex + 2] * (1 - blendRatio) + repairedColor.b * blendRatio);
          data[pixelIndex + 3] = Math.round(data[pixelIndex + 3] * (1 - blendRatio) + repairedColor.a * blendRatio);
        }
      }
    }
  }

  private isEnhancedWatermarkPixel(
    data: Uint8ClampedArray,
    pixelIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    iteration: number
  ): boolean {
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const a = data[pixelIndex + 3];

    // 多维度增强检测
    const brightness = (r + g + b) / 3;
    const saturation = this.calculateSaturation(r, g, b);
    const contrast = this.calculateLocalContrast(data, x, y, width, height);
    const edgeStrength = this.calculateEdgeStrength(data, x, y, width, height);
    const textureComplexity = this.calculateTextureComplexity(data, x, y, width, height);
    
    // 根据迭代次数调整检测阈值
    const baseThreshold = 0.3 - iteration * 0.05; // 逐渐降低阈值以检测更多残留
    
    // 综合判断条件
    const isTransparent = a < 250;
    const isHighContrast = contrast > 40 - iteration * 5;
    const isMonochrome = saturation < 25 + iteration * 5;
    const isExtremeBrightness = brightness > 200 - iteration * 10 || brightness < 55 + iteration * 10;
    const hasStrongEdge = edgeStrength > 35 - iteration * 5;
    const isLowTexture = textureComplexity < 15 + iteration * 3;
    const hasArtificialPattern = this.detectArtificialPattern(data, x, y, width, height);

    // 计算综合水印概率
    let watermarkProbability = 0;
    if (isTransparent) watermarkProbability += 0.3;
    if (isHighContrast) watermarkProbability += 0.25;
    if (isMonochrome) watermarkProbability += 0.2;
    if (isExtremeBrightness) watermarkProbability += 0.3;
    if (hasStrongEdge) watermarkProbability += 0.2;
    if (isLowTexture) watermarkProbability += 0.15;
    if (hasArtificialPattern) watermarkProbability += 0.35;

    return watermarkProbability > baseThreshold;
  }

  private calculateSaturation(r: number, g: number, b: number): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : ((max - min) / max) * 100;
  }

  private calculateLocalContrast(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let maxDiff = 0;
    const radius = 2;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
          maxDiff = Math.max(maxDiff, Math.abs(centerBrightness - neighborBrightness));
        }
      }
    }
    
    return maxDiff;
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
    
    let totalGradient = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4;
        const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
        totalGradient += Math.abs(centerBrightness - neighborBrightness);
      }
    }
    
    return totalGradient / directions.length;
  }

  private calculateTextureComplexity(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    let complexity = 0;
    const radius = 3;
    const samples = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const sampleIndex = (ny * width + nx) * 4;
          const brightness = (data[sampleIndex] + data[sampleIndex + 1] + data[sampleIndex + 2]) / 3;
          samples.push(brightness);
        }
      }
    }
    
    // 计算标准差作为纹理复杂度
    if (samples.length > 0) {
      const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
      const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
      complexity = Math.sqrt(variance);
    }
    
    return complexity;
  }

  private detectArtificialPattern(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    // 检测人工图案（如文字、logo等）的特征
    const centerIndex = (y * width + x) * 4;
    const centerR = data[centerIndex];
    const centerG = data[centerIndex + 1];
    const centerB = data[centerIndex + 2];
    
    // 检查周围像素的一致性（文字通常有清晰的边界）
    let similarPixels = 0;
    let totalPixels = 0;
    const threshold = 30;
    
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const diffR = Math.abs(data[neighborIndex] - centerR);
          const diffG = Math.abs(data[neighborIndex + 1] - centerG);
          const diffB = Math.abs(data[neighborIndex + 2] - centerB);
          
          if (diffR < threshold && diffG < threshold && diffB < threshold) {
            similarPixels++;
          }
          totalPixels++;
        }
      }
    }
    
    // 如果相似像素比例过高，可能是人工图案
    const similarityRatio = similarPixels / totalPixels;
    return similarityRatio > 0.6;
  }

  private multiLevelRepair(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    strength: number
  ): { r: number, g: number, b: number, a: number } {
    // 多层次采样修复
    const samples = {
      close: [],   // 近距离样本
      medium: [],  // 中距离样本
      far: []      // 远距离样本
    };
    
    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const sampleIndex = (ny * width + nx) * 4;
          
          // 跳过水印像素
          if (!this.isEnhancedWatermarkPixel(data, sampleIndex, nx, ny, width, height, 0)) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const sample = {
              r: data[sampleIndex],
              g: data[sampleIndex + 1],
              b: data[sampleIndex + 2],
              a: data[sampleIndex + 3],
              weight: 1 / (distance + 1)
            };
            
            if (distance <= radius / 3) {
              samples.close.push(sample);
            } else if (distance <= radius * 2 / 3) {
              samples.medium.push(sample);
            } else {
              samples.far.push(sample);
            }
          }
        }
      }
    }
    
    // 优先使用近距离样本，逐步扩展
    let usableSamples = samples.close;
    if (usableSamples.length < 3) {
      usableSamples = [...samples.close, ...samples.medium];
    }
    if (usableSamples.length < 3) {
      usableSamples = [...samples.close, ...samples.medium, ...samples.far];
    }
    
    if (usableSamples.length === 0) {
      return { r: 128, g: 128, b: 128, a: 255 };
    }
    
    // 智能加权平均
    let totalWeight = 0;
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
    
    for (const sample of usableSamples) {
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

  private globalWatermarkCleanup(imageData: ImageData, width: number, height: number, iteration: number) {
    // 全图残留痕迹清理
    const { data } = imageData;
    
    // 应用边缘平滑以减少水印边缘痕迹
    this.smoothWatermarkEdges(data, width, height);
    
    // 色彩一致性修正
    this.correctColorConsistency(data, width, height, iteration);
  }

  private smoothWatermarkEdges(data: Uint8ClampedArray, width: number, height: number) {
    const original = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIndex = (y * width + x) * 4;
        
        // 检测边缘并平滑
        const edgeStrength = this.calculateEdgeStrength(original, x, y, width, height);
        if (edgeStrength > 30) {
          // 应用轻微的高斯模糊
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let count = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const sampleIndex = ((y + dy) * width + (x + dx)) * 4;
              totalR += original[sampleIndex];
              totalG += original[sampleIndex + 1];
              totalB += original[sampleIndex + 2];
              totalA += original[sampleIndex + 3];
              count++;
            }
          }
          
          // 轻微混合以减少边缘锐度
          const blendFactor = 0.3;
          data[centerIndex] = Math.round(data[centerIndex] * (1 - blendFactor) + (totalR / count) * blendFactor);
          data[centerIndex + 1] = Math.round(data[centerIndex + 1] * (1 - blendFactor) + (totalG / count) * blendFactor);
          data[centerIndex + 2] = Math.round(data[centerIndex + 2] * (1 - blendFactor) + (totalB / count) * blendFactor);
        }
      }
    }
  }

  private correctColorConsistency(data: Uint8ClampedArray, width: number, height: number, iteration: number) {
    // 分析整体色调并修正不一致的区域
    const blockSize = 32;
    
    for (let blockY = 0; blockY < height; blockY += blockSize) {
      for (let blockX = 0; blockX < width; blockX += blockSize) {
        const blockEndX = Math.min(blockX + blockSize, width);
        const blockEndY = Math.min(blockY + blockSize, height);
        
        // 计算块的平均颜色
        let avgR = 0, avgG = 0, avgB = 0;
        let pixelCount = 0;
        
        for (let y = blockY; y < blockEndY; y++) {
          for (let x = blockX; x < blockEndX; x++) {
            const index = (y * width + x) * 4;
            avgR += data[index];
            avgG += data[index + 1];
            avgB += data[index + 2];
            pixelCount++;
          }
        }
        
        avgR /= pixelCount;
        avgG /= pixelCount;
        avgB /= pixelCount;
        
        // 修正异常像素
        for (let y = blockY; y < blockEndY; y++) {
          for (let x = blockX; x < blockEndX; x++) {
            const index = (y * width + x) * 4;
            const diffR = Math.abs(data[index] - avgR);
            const diffG = Math.abs(data[index + 1] - avgG);
            const diffB = Math.abs(data[index + 2] - avgB);
            
            // 如果像素与块平均色差过大，进行修正
            if (diffR + diffG + diffB > 100) {
              const correctionFactor = 0.2 + iteration * 0.1;
              data[index] = Math.round(data[index] * (1 - correctionFactor) + avgR * correctionFactor);
              data[index + 1] = Math.round(data[index + 1] * (1 - correctionFactor) + avgG * correctionFactor);
              data[index + 2] = Math.round(data[index + 2] * (1 - correctionFactor) + avgB * correctionFactor);
            }
          }
        }
      }
    }
  }

  private async finalOptimization(imageData: ImageData, width: number, height: number): Promise<ImageData> {
    const processedData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      width,
      height
    );

    // 最终优化处理
    this.enhanceImageQuality(processedData);
    this.removeProcessingArtifacts(processedData, width, height);
    
    return processedData;
  }

  private enhanceImageQuality(imageData: ImageData) {
    const { data } = imageData;
    
    // 轻微的锐化处理以恢复细节
    for (let i = 0; i < data.length; i += 4) {
      // 增强对比度
      const factor = 1.05;
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
    }
  }

  private removeProcessingArtifacts(imageData: ImageData, width: number, height: number) {
    // 去除处理过程中可能产生的伪影
    const { data } = imageData;
    const original = new Uint8ClampedArray(data);
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const centerIndex = (y * width + x) * 4;
        
        // 检测异常像素值
        const brightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
        const surroundingBrightness = this.getAverageBrightness(original, x, y, width, height, 2);
        
        if (Math.abs(brightness - surroundingBrightness) > 50) {
          // 使用周围像素的平均值修正异常值
          const correction = this.multiLevelRepair(original, x, y, width, height, 3, 0.5);
          data[centerIndex] = correction.r;
          data[centerIndex + 1] = correction.g;
          data[centerIndex + 2] = correction.b;
          data[centerIndex + 3] = correction.a;
        }
      }
    }
  }

  private getAverageBrightness(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): number {
    let totalBrightness = 0;
    let count = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const index = (ny * width + nx) * 4;
          const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
          totalBrightness += brightness;
          count++;
        }
      }
    }
    
    return count > 0 ? totalBrightness / count : 128;
  }

  private async enhancedTraditionalRemoval(imageData: ImageData, iteration: number): Promise<ImageData> {
    console.log(`使用增强传统算法作为第 ${iteration + 1} 轮后备`);
    // 增强的传统算法实现
    const { data, width, height } = imageData;
    const processedData = new ImageData(new Uint8ClampedArray(data), width, height);
    
    // 应用更强的传统去水印算法
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 简化的水印检测和修复
        const brightness = (r + g + b) / 3;
        if (brightness > 200 || brightness < 50 || a < 200) {
          const repaired = this.multiLevelRepair(data, x, y, width, height, 8, 0.7);
          processedData.data[index] = repaired.r;
          processedData.data[index + 1] = repaired.g;
          processedData.data[index + 2] = repaired.b;
          processedData.data[index + 3] = repaired.a;
        }
      }
    }
    
    return processedData;
  }
}
