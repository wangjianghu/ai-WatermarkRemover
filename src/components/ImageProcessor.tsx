
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
    
    // 定义水印可能出现的区域（右下角）
    const watermarkRegion = {
      x: Math.floor(width * 0.7),
      y: Math.floor(height * 0.85),
      width: Math.floor(width * 0.3),
      height: Math.floor(height * 0.15)
    };

    console.log('处理水印区域:', watermarkRegion);

    // 检测和去除水印的主要逻辑
    this.detectAndRemoveWatermark(data, width, height, watermarkRegion);
  }

  private detectAndRemoveWatermark(
    data: Uint8ClampedArray, 
    width: number, 
    height: number, 
    region: {x: number, y: number, width: number, height: number}
  ) {
    // 扫描水印区域，查找异常像素（通常水印文字会有特定的颜色特征）
    const watermarkPixels: Array<{x: number, y: number}> = [];
    
    for (let y = region.y; y < region.y + region.height && y < height; y++) {
      for (let x = region.x; x < region.x + region.width && x < width; x++) {
        const index = (y * width + x) * 4;
        
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 检测水印特征：
        // 1. 半透明文字 (alpha < 255)
        // 2. 特定颜色范围的文字
        // 3. 与周围像素差异较大的像素
        if (this.isWatermarkPixel(r, g, b, a, data, width, height, x, y)) {
          watermarkPixels.push({x, y});
        }
      }
    }

    console.log(`检测到 ${watermarkPixels.length} 个水印像素`);

    // 对检测到的水印像素进行修复
    watermarkPixels.forEach(({x, y}) => {
      this.repairPixel(data, width, height, x, y);
    });
  }

  private isWatermarkPixel(
    r: number, g: number, b: number, a: number,
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ): boolean {
    // 检查是否为半透明像素（常见的水印特征）
    if (a < 255 && a > 0) {
      return true;
    }

    // 检查是否为白色或浅色文字（常见的水印颜色）
    const brightness = (r + g + b) / 3;
    if (brightness > 200 && this.hasHighContrast(data, width, height, x, y)) {
      return true;
    }

    // 检查是否为深色文字在浅色背景上
    if (brightness < 100 && this.hasLightBackground(data, width, height, x, y)) {
      return true;
    }

    return false;
  }

  private hasHighContrast(
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ): boolean {
    const currentIndex = (y * width + x) * 4;
    const currentBrightness = (data[currentIndex] + data[currentIndex + 1] + data[currentIndex + 2]) / 3;

    // 检查周围像素的对比度
    const neighbors = [
      {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1}
    ];

    let contrastSum = 0;
    let validNeighbors = 0;

    neighbors.forEach(({dx, dy}) => {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4;
        const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
        contrastSum += Math.abs(currentBrightness - neighborBrightness);
        validNeighbors++;
      }
    });

    return validNeighbors > 0 && (contrastSum / validNeighbors) > 50;
  }

  private hasLightBackground(
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ): boolean {
    const neighbors = [
      {dx: -2, dy: -2}, {dx: -1, dy: -2}, {dx: 0, dy: -2}, {dx: 1, dy: -2}, {dx: 2, dy: -2},
      {dx: -2, dy: -1}, {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1}, {dx: 2, dy: -1},
      {dx: -2, dy: 0}, {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 2, dy: 0},
      {dx: -2, dy: 1}, {dx: -1, dy: 1}, {dx: 0, dy: 1}, {dx: 1, dy: 1}, {dx: 2, dy: 1},
      {dx: -2, dy: 2}, {dx: -1, dy: 2}, {dx: 0, dy: 2}, {dx: 1, dy: 2}, {dx: 2, dy: 2}
    ];

    let brightnessSum = 0;
    let validNeighbors = 0;

    neighbors.forEach(({dx, dy}) => {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4;
        const brightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
        brightnessSum += brightness;
        validNeighbors++;
      }
    });

    return validNeighbors > 0 && (brightnessSum / validNeighbors) > 180;
  }

  private repairPixel(
    data: Uint8ClampedArray, width: number, height: number, x: number, y: number
  ) {
    const index = (y * width + x) * 4;
    
    // 使用周围像素的平均值来修复当前像素
    const neighbors = [];
    const radius = 3; // 扩大采样半径以获得更好的修复效果
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue; // 跳过当前像素
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          
          // 检查这个邻居像素是否也是水印像素，如果是则跳过
          const nr = data[neighborIndex];
          const ng = data[neighborIndex + 1];
          const nb = data[neighborIndex + 2];
          const na = data[neighborIndex + 3];
          
          if (!this.isWatermarkPixel(nr, ng, nb, na, data, width, height, nx, ny)) {
            neighbors.push({
              r: nr,
              g: ng,
              b: nb,
              a: na,
              distance: Math.sqrt(dx * dx + dy * dy)
            });
          }
        }
      }
    }
    
    if (neighbors.length > 0) {
      // 使用距离加权平均
      let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
      
      neighbors.forEach(neighbor => {
        const weight = 1 / (neighbor.distance + 0.1); // 避免除零
        totalR += neighbor.r * weight;
        totalG += neighbor.g * weight;
        totalB += neighbor.b * weight;
        totalA += neighbor.a * weight;
        totalWeight += weight;
      });
      
      data[index] = Math.round(totalR / totalWeight);
      data[index + 1] = Math.round(totalG / totalWeight);
      data[index + 2] = Math.round(totalB / totalWeight);
      data[index + 3] = Math.round(totalA / totalWeight);
    }
  }
}
