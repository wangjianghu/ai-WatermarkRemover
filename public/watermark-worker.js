
// 优化的水印去除Web Worker
class WatermarkWorker {
  constructor() {
    this.isProcessing = false;
  }

  async processImage(imageData, width, height) {
    if (this.isProcessing) {
      throw new Error('Worker is busy');
    }

    this.isProcessing = true;
    
    try {
      // 多轮迭代处理以彻底去除水印
      let processedData = await this.processInChunks(imageData, width, height);
      
      // 二次处理，专门针对残留水印
      processedData = await this.secondaryProcessing(processedData, width, height);
      
      return processedData;
    } finally {
      this.isProcessing = false;
    }
  }

  async processInChunks(imageData, width, height) {
    const data = new Uint8ClampedArray(imageData.data);
    const chunkSize = Math.floor(height / 30); // 增加分块数量
    
    for (let chunkStart = 0; chunkStart < height; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, height);
      
      // 处理当前块
      this.processChunk(data, width, height, chunkStart, chunkEnd);
      
      // 发送进度更新
      const progress = Math.floor((chunkEnd / height) * 80); // 80%留给二次处理
      self.postMessage({
        type: 'progress',
        progress: progress
      });
      
      // 让出控制权，避免阻塞
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    return {
      data: data,
      width: width,
      height: height
    };
  }

  processChunk(data, width, height, startY, endY) {
    // 重点关注水印常见位置
    const watermarkRegions = this.getWatermarkRegions(width, height);
    
    for (const region of watermarkRegions) {
      this.processRegionChunk(data, width, height, region, startY, endY);
    }
    
    // 全图扫描，检测其他位置的水印
    this.globalWatermarkScan(data, width, height, startY, endY);
  }

  getWatermarkRegions(width, height) {
    return [
      // 右下角 - 最常见
      { x: Math.floor(width * 0.6), y: Math.floor(height * 0.7), w: Math.floor(width * 0.4), h: Math.floor(height * 0.3) },
      // 右上角
      { x: Math.floor(width * 0.6), y: 0, w: Math.floor(width * 0.4), h: Math.floor(height * 0.3) },
      // 左下角
      { x: 0, y: Math.floor(height * 0.7), w: Math.floor(width * 0.4), h: Math.floor(height * 0.3) },
      // 左上角
      { x: 0, y: 0, w: Math.floor(width * 0.4), h: Math.floor(height * 0.3) },
      // 中心偏下
      { x: Math.floor(width * 0.2), y: Math.floor(height * 0.6), w: Math.floor(width * 0.6), h: Math.floor(height * 0.3) }
    ];
  }

  processRegionChunk(data, width, height, region, startY, endY) {
    const regionStartY = Math.max(region.y, startY);
    const regionEndY = Math.min(region.y + region.h, endY);
    
    if (regionStartY >= regionEndY) return;
    
    for (let y = regionStartY; y < regionEndY; y++) {
      for (let x = region.x; x < region.x + region.w && x < width; x++) {
        const index = (y * width + x) * 4;
        
        if (this.isWatermarkPixel(data, index, x, y, width, height)) {
          this.advancedRepair(data, x, y, width, height);
        }
      }
    }
  }

  globalWatermarkScan(data, width, height, startY, endY) {
    // 全图扫描，使用更严格的检测条件
    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        
        if (this.isWatermarkPixelStrict(data, index, x, y, width, height)) {
          this.advancedRepair(data, x, y, width, height);
        }
      }
    }
  }

  isWatermarkPixel(data, index, x, y, width, height) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    const brightness = (r + g + b) / 3;
    const isTransparent = a < 240;
    const isExtremeBrightness = brightness > 200 || brightness < 60;
    const hasHighContrast = this.calculateContrast(data, x, y, width, height) > 35;
    const isTextLike = this.detectTextPattern(data, x, y, width, height);
    const isEdgePixel = this.isEdgePixel(data, x, y, width, height);
    
    // 综合判断，降低阈值以捕获更多水印像素
    let score = 0;
    if (isTransparent) score += 0.4;
    if (isExtremeBrightness) score += 0.3;
    if (hasHighContrast) score += 0.2;
    if (isTextLike) score += 0.3;
    if (isEdgePixel) score += 0.2;
    
    return score > 0.5;
  }

  isWatermarkPixelStrict(data, index, x, y, width, height) {
    // 更严格的全图检测
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    const brightness = (r + g + b) / 3;
    const isTransparent = a < 220;
    const isTextLike = this.detectTextPattern(data, x, y, width, height);
    const hasUniformColor = this.hasUniformColor(data, x, y, width, height);
    
    // 专门检测文字水印
    return (isTransparent && isTextLike) || (hasUniformColor && isTextLike);
  }

  detectTextPattern(data, x, y, width, height) {
    // 检测文字模式：规则的边缘和一致的颜色
    const radius = 2;
    let edgeCount = 0;
    let totalChecked = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const edgeStrength = this.calculateEdgeStrength(data, nx, ny, width, height);
          if (edgeStrength > 20) edgeCount++;
          totalChecked++;
        }
      }
    }
    
    return totalChecked > 0 && (edgeCount / totalChecked) > 0.3;
  }

  hasUniformColor(data, x, y, width, height) {
    // 检测颜色一致性
    const radius = 1;
    const centerIndex = (y * width + x) * 4;
    const centerR = data[centerIndex];
    const centerG = data[centerIndex + 1];
    const centerB = data[centerIndex + 2];
    
    let uniformCount = 0;
    let totalCount = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const colorDiff = Math.abs(data[nIndex] - centerR) + 
                           Math.abs(data[nIndex + 1] - centerG) + 
                           Math.abs(data[nIndex + 2] - centerB);
          
          if (colorDiff < 30) uniformCount++;
          totalCount++;
        }
      }
    }
    
    return totalCount > 0 && (uniformCount / totalCount) > 0.7;
  }

  calculateContrast(data, x, y, width, height) {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let maxDiff = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
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

  calculateEdgeStrength(data, x, y, width, height) {
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
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        gx += brightness * sobelX[i];
        gy += brightness * sobelY[i];
      }
    }
    
    return Math.sqrt(gx * gx + gy * gy);
  }

  isEdgePixel(data, x, y, width, height) {
    return this.calculateEdgeStrength(data, x, y, width, height) > 25;
  }

  advancedRepair(data, x, y, width, height) {
    // 高级修复算法，结合多种技术
    const radius = 4; // 增加修复半径
    const validNeighbors = [];
    
    // 收集有效的邻近像素
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          
          // 只使用非水印像素进行修复
          if (!this.isWatermarkPixel(data, neighborIndex, nx, ny, width, height)) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (distance * distance + 0.1);
            
            validNeighbors.push({
              r: data[neighborIndex],
              g: data[neighborIndex + 1],
              b: data[neighborIndex + 2],
              a: data[neighborIndex + 3],
              weight: weight,
              distance: distance
            });
          }
        }
      }
    }
    
    if (validNeighbors.length > 0) {
      // 使用距离权重进行修复
      let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
      
      // 优先使用距离较近的像素
      validNeighbors.sort((a, b) => a.distance - b.distance);
      const useCount = Math.min(validNeighbors.length, 8); // 使用最近的8个像素
      
      for (let i = 0; i < useCount; i++) {
        const neighbor = validNeighbors[i];
        totalR += neighbor.r * neighbor.weight;
        totalG += neighbor.g * neighbor.weight;
        totalB += neighbor.b * neighbor.weight;
        totalA += neighbor.a * neighbor.weight;
        totalWeight += neighbor.weight;
      }
      
      const index = (y * width + x) * 4;
      
      // 完全替换水印像素
      data[index] = Math.round(totalR / totalWeight);
      data[index + 1] = Math.round(totalG / totalWeight);
      data[index + 2] = Math.round(totalB / totalWeight);
      data[index + 3] = Math.round(totalA / totalWeight);
    }
  }

  async secondaryProcessing(processedData, width, height) {
    // 二次处理：平滑和增强
    const data = processedData.data;
    const tempData = new Uint8ClampedArray(data);
    
    // 应用轻微的双边滤波
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = (y * width + x) * 4;
        
        // 检查是否为修复过的区域
        if (this.wasRepaired(tempData, x, y, width, height)) {
          this.applyBilateralFilter(data, tempData, x, y, width, height);
        }
      }
      
      // 更新进度
      if (y % 20 === 0) {
        const progress = 80 + Math.floor((y / height) * 20);
        self.postMessage({
          type: 'progress',
          progress: progress
        });
        
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    return {
      data: data,
      width: width,
      height: height
    };
  }

  wasRepaired(data, x, y, width, height) {
    // 检测是否为修复过的区域（通过检查周围像素的相似性）
    const centerIndex = (y * width + x) * 4;
    const centerR = data[centerIndex];
    const centerG = data[centerIndex + 1];
    const centerB = data[centerIndex + 2];
    
    let similarCount = 0;
    let totalCount = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const colorDiff = Math.abs(data[nIndex] - centerR) + 
                           Math.abs(data[nIndex + 1] - centerG) + 
                           Math.abs(data[nIndex + 2] - centerB);
          
          if (colorDiff < 20) similarCount++;
          totalCount++;
        }
      }
    }
    
    return totalCount > 0 && (similarCount / totalCount) > 0.8;
  }

  applyBilateralFilter(data, tempData, x, y, width, height) {
    // 双边滤波保持边缘清晰
    const sigma_d = 1.5;
    const sigma_r = 25.0;
    
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      let weight = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIndex = (ny * width + nx) * 4;
            const centerIndex = (y * width + x) * 4;
            
            const spatialDist = Math.sqrt(dx * dx + dy * dy);
            const colorDist = Math.abs(tempData[centerIndex + c] - tempData[nIndex + c]);
            
            const spatialWeight = Math.exp(-(spatialDist * spatialDist) / (2 * sigma_d * sigma_d));
            const colorWeight = Math.exp(-(colorDist * colorDist) / (2 * sigma_r * sigma_r));
            
            const w = spatialWeight * colorWeight;
            sum += tempData[nIndex + c] * w;
            weight += w;
          }
        }
      }
      
      if (weight > 0) {
        const index = (y * width + x) * 4;
        data[index + c] = Math.round(sum / weight);
      }
    }
  }
}

// Worker事件处理
const worker = new WatermarkWorker();

self.onmessage = async function(e) {
  const { type, imageData, width, height } = e.data;
  
  if (type === 'process') {
    try {
      self.postMessage({ type: 'started' });
      
      const result = await worker.processImage(imageData, width, height);
      
      self.postMessage({
        type: 'completed',
        result: result
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.message
      });
    }
  }
};
