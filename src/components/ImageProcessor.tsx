
export class ImageProcessor {
  async removeWatermark(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('无法获取Canvas上下文'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          
          // 绘制原图
          ctx.drawImage(img, 0, 0);
          
          // 获取图像数据
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          console.log('开始处理水印，图片尺寸:', canvas.width, 'x', canvas.height);
          
          // 进行水印去除处理
          this.processWatermarkRemoval(imageData, canvas.width, canvas.height);
          
          // 将处理后的数据放回canvas
          ctx.putImageData(imageData, 0, 0);
          
          // 转换为Blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('图片处理失败'));
            }
          }, file.type, 0.95);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  private processWatermarkRemoval(imageData: ImageData, width: number, height: number) {
    const data = imageData.data;
    
    // 扩大水印检测区域，覆盖更多可能出现水印的位置
    const watermarkRegions = [
      // 右下角主要区域
      {
        x: Math.floor(width * 0.6),
        y: Math.floor(height * 0.8),
        width: Math.floor(width * 0.4),
        height: Math.floor(height * 0.2)
      },
      // 右下角扩展区域
      {
        x: Math.floor(width * 0.7),
        y: Math.floor(height * 0.75),
        width: Math.floor(width * 0.3),
        height: Math.floor(height * 0.25)
      },
      // 右侧中下部
      {
        x: Math.floor(width * 0.75),
        y: Math.floor(height * 0.7),
        width: Math.floor(width * 0.25),
        height: Math.floor(height * 0.3)
      }
    ];

    console.log('处理水印区域:', watermarkRegions);

    // 对每个区域进行处理
    watermarkRegions.forEach((region, index) => {
      console.log(`处理第 ${index + 1} 个区域`);
      this.detectAndRemoveWatermark(data, width, height, region);
    });
  }

  private detectAndRemoveWatermark(
    data: Uint8ClampedArray, 
    width: number, 
    height: number, 
    region: {x: number, y: number, width: number, height: number}
  ) {
    const watermarkPixels: Array<{x: number, y: number, confidence: number}> = [];
    
    // 第一遍：检测水印像素
    for (let y = region.y; y < region.y + region.height && y < height; y++) {
      for (let x = region.x; x < region.x + region.width && x < width; x++) {
        const index = (y * width + x) * 4;
        
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        const confidence = this.calculateWatermarkConfidence(r, g, b, a, data, width, height, x, y);
        
        if (confidence > 0.3) { // 降低阈值以检测更多潜在水印像素
          watermarkPixels.push({x, y, confidence});
        }
      }
    }

    console.log(`在区域中检测到 ${watermarkPixels.length} 个潜在水印像素`);

    // 按置信度排序，优先处理高置信度的像素
    watermarkPixels.sort((a, b) => b.confidence - a.confidence);

    // 第二遍：修复检测到的水印像素
    watermarkPixels.forEach(({x, y, confidence}) => {
      this.repairPixel(data, width, height, x, y, confidence);
    });
  }

  private calculateWatermarkConfidence(
    r: number, g: number, b: number, a: number,
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ): number {
    let confidence = 0;
    
    // 检查透明度特征（半透明通常是水印）
    if (a < 255 && a > 100) {
      confidence += 0.4;
    }
    
    // 检查亮度特征
    const brightness = (r + g + b) / 3;
    
    // 白色或浅色文字（常见水印颜色）
    if (brightness > 180) {
      confidence += 0.3;
      
      // 检查是否与背景形成对比
      const backgroundBrightness = this.getAverageBackgroundBrightness(data, width, height, x, y);
      if (Math.abs(brightness - backgroundBrightness) > 60) {
        confidence += 0.3;
      }
    }
    
    // 深色文字在浅背景上
    if (brightness < 80) {
      const backgroundBrightness = this.getAverageBackgroundBrightness(data, width, height, x, y);
      if (backgroundBrightness > 150) {
        confidence += 0.4;
      }
    }
    
    // 检查颜色单一性（水印通常颜色比较单一）
    const colorVariance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
    if (colorVariance < 30) {
      confidence += 0.2;
    }
    
    // 检查边缘特征（文字边缘通常有明显的颜色变化）
    if (this.hasTextEdgeFeature(data, width, height, x, y)) {
      confidence += 0.3;
    }
    
    return Math.min(confidence, 1.0);
  }

  private getAverageBackgroundBrightness(
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ): number {
    const samplePoints = [
      {dx: -5, dy: -5}, {dx: 0, dy: -5}, {dx: 5, dy: -5},
      {dx: -5, dy: 0}, {dx: 5, dy: 0},
      {dx: -5, dy: 5}, {dx: 0, dy: 5}, {dx: 5, dy: 5}
    ];

    let totalBrightness = 0;
    let validSamples = 0;

    samplePoints.forEach(({dx, dy}) => {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const index = (ny * width + nx) * 4;
        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
        totalBrightness += brightness;
        validSamples++;
      }
    });

    return validSamples > 0 ? totalBrightness / validSamples : 128;
  }

  private hasTextEdgeFeature(
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ): boolean {
    const currentIndex = (y * width + x) * 4;
    const currentBrightness = (data[currentIndex] + data[currentIndex + 1] + data[currentIndex + 2]) / 3;

    // 检查水平和垂直方向的梯度
    const gradients = [];
    const directions = [
      {dx: -1, dy: 0}, {dx: 1, dy: 0}, // 水平
      {dx: 0, dy: -1}, {dx: 0, dy: 1}, // 垂直
      {dx: -1, dy: -1}, {dx: 1, dy: 1}, // 对角线
      {dx: -1, dy: 1}, {dx: 1, dy: -1}
    ];

    directions.forEach(({dx, dy}) => {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4;
        const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
        gradients.push(Math.abs(currentBrightness - neighborBrightness));
      }
    });

    const maxGradient = Math.max(...gradients);
    return maxGradient > 40; // 文字边缘通常有较大的梯度变化
  }

  private repairPixel(
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number, confidence: number
  ) {
    const index = (y * width + x) * 4;
    
    // 根据置信度调整修复范围
    const radius = Math.max(2, Math.floor(confidence * 6));
    const neighbors = [];
    
    // 收集周围的非水印像素用于修复
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const nr = data[neighborIndex];
          const ng = data[neighborIndex + 1];
          const nb = data[neighborIndex + 2];
          const na = data[neighborIndex + 3];
          
          // 检查这个像素是否看起来像水印
          const neighborConfidence = this.calculateWatermarkConfidence(nr, ng, nb, na, data, width, height, nx, ny);
          
          if (neighborConfidence < 0.3) { // 只使用非水印像素进行修复
            const distance = Math.sqrt(dx * dx + dy * dy);
            neighbors.push({
              r: nr, g: ng, b: nb, a: na,
              weight: 1 / (distance + 0.1)
            });
          }
        }
      }
    }
    
    if (neighbors.length > 0) {
      // 使用加权平均进行修复
      let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
      
      neighbors.forEach(neighbor => {
        totalR += neighbor.r * neighbor.weight;
        totalG += neighbor.g * neighbor.weight;
        totalB += neighbor.b * neighbor.weight;
        totalA += neighbor.a * neighbor.weight;
        totalWeight += neighbor.weight;
      });
      
      // 应用修复，根据置信度混合原像素和修复像素
      const blendFactor = Math.min(confidence, 0.8); // 最大80%的修复强度
      
      data[index] = Math.round(data[index] * (1 - blendFactor) + (totalR / totalWeight) * blendFactor);
      data[index + 1] = Math.round(data[index + 1] * (1 - blendFactor) + (totalG / totalWeight) * blendFactor);
      data[index + 2] = Math.round(data[index + 2] * (1 - blendFactor) + (totalB / totalWeight) * blendFactor);
      data[index + 3] = Math.round(data[index + 3] * (1 - blendFactor) + (totalA / totalWeight) * blendFactor);
    }
  }
}
