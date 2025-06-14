
// 水印去除Web Worker
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
      // 分块处理以避免长时间阻塞
      const processedData = await this.processInChunks(imageData, width, height);
      return processedData;
    } finally {
      this.isProcessing = false;
    }
  }

  async processInChunks(imageData, width, height) {
    const data = new Uint8ClampedArray(imageData.data);
    const chunkSize = Math.floor(height / 20); // 分成20块处理
    
    for (let chunkStart = 0; chunkStart < height; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, height);
      
      // 处理当前块
      this.processChunk(data, width, height, chunkStart, chunkEnd);
      
      // 发送进度更新
      const progress = Math.floor((chunkEnd / height) * 100);
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
    // 优化的水印检测和去除算法
    const watermarkRegions = this.getWatermarkRegions(width, height);
    
    for (const region of watermarkRegions) {
      this.processRegionChunk(data, width, height, region, startY, endY);
    }
  }

  getWatermarkRegions(width, height) {
    return [
      // 右下角
      { x: Math.floor(width * 0.7), y: Math.floor(height * 0.8), w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      // 右上角
      { x: Math.floor(width * 0.7), y: 0, w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      // 左下角
      { x: 0, y: Math.floor(height * 0.8), w: Math.floor(width * 0.3), h: Math.floor(height * 0.2) },
      // 中心
      { x: Math.floor(width * 0.3), y: Math.floor(height * 0.4), w: Math.floor(width * 0.4), h: Math.floor(height * 0.2) }
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
          this.repairPixel(data, x, y, width, height);
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
    const isTransparent = a < 250;
    const isExtremeBrightness = brightness > 200 || brightness < 50;
    const hasHighContrast = this.calculateContrast(data, x, y, width, height) > 40;
    
    return isTransparent || isExtremeBrightness || hasHighContrast;
  }

  calculateContrast(data, x, y, width, height) {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let maxDiff = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
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

  repairPixel(data, x, y, width, height) {
    const radius = 3;
    const neighbors = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          
          if (!this.isWatermarkPixel(data, neighborIndex, nx, ny, width, height)) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            neighbors.push({
              r: data[neighborIndex],
              g: data[neighborIndex + 1],
              b: data[neighborIndex + 2],
              a: data[neighborIndex + 3],
              weight: 1 / (distance + 0.1)
            });
          }
        }
      }
    }
    
    if (neighbors.length > 0) {
      let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
      
      neighbors.forEach(neighbor => {
        totalR += neighbor.r * neighbor.weight;
        totalG += neighbor.g * neighbor.weight;
        totalB += neighbor.b * neighbor.weight;
        totalA += neighbor.a * neighbor.weight;
        totalWeight += neighbor.weight;
      });
      
      const index = (y * width + x) * 4;
      const blendFactor = 0.7;
      
      data[index] = Math.round(data[index] * (1 - blendFactor) + (totalR / totalWeight) * blendFactor);
      data[index + 1] = Math.round(data[index + 1] * (1 - blendFactor) + (totalG / totalWeight) * blendFactor);
      data[index + 2] = Math.round(data[index + 2] * (1 - blendFactor) + (totalB / totalWeight) * blendFactor);
      data[index + 3] = Math.round(data[index + 3] * (1 - blendFactor) + (totalA / totalWeight) * blendFactor);
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
