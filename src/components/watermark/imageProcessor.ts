
import { processWithSDInpainting } from '../SDInpaintingProcessor';
import { WatermarkMark } from './types';

// LaMa algorithm implementation
const applyLamaInpainting = async (canvas: HTMLCanvasElement, maskRegion: WatermarkMark): Promise<void> => {
    // ... all LaMa logic here
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const maskLeft = Math.floor(maskRegion.x * canvas.width);
    const maskTop = Math.floor(maskRegion.y * canvas.height);
    const maskRight = Math.floor((maskRegion.x + maskRegion.width) * canvas.width);
    const maskBottom = Math.floor((maskRegion.y + maskRegion.height) * canvas.height);

    // LaMa inspired multi-scale inpainting
    for (let scale = 0; scale < 3; scale++) {
      const radius = Math.pow(2, scale + 1);
      for (let y = maskTop; y < maskBottom; y++) {
        for (let x = maskLeft; x < maskRight; x++) {
          const repaired = lamaInpaint(data, x, y, canvas.width, canvas.height, radius);
          if (repaired) {
            const index = (y * canvas.width + x) * 4;
            data[index] = repaired.r;
            data[index + 1] = repaired.g;
            data[index + 2] = repaired.b;
            data[index + 3] = repaired.a;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
};

const lamaInpaint = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number, radius: number) => {
    const validPixels: Array<{
      r: number;
      g: number;
      b: number;
      a: number;
      distance: number;
      weight: number;
    }> = [];

    // Use more intelligent sampling strategy
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
      for (let r = radius; r <= radius * 3; r += 2) {
        const nx = Math.round(x + Math.cos(angle) * r);
        const ny = Math.round(y + Math.sin(angle) * r);
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const distance = Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y));

          // Texture consistency check
          const textureScore = calculateTextureConsistency(data, nx, ny, width, height);
          const weight = 1 / (distance + 1) * (1 + textureScore);
          validPixels.push({
            r: data[nIndex],
            g: data[nIndex + 1],
            b: data[nIndex + 2],
            a: data[nIndex + 3],
            distance: distance,
            weight: weight
          });
        }
      }
    }
    if (validPixels.length === 0) return null;

    // Advanced blending based on weights
    validPixels.sort((a, b) => b.weight - a.weight);
    const topPixels = validPixels.slice(0, Math.min(12, validPixels.length));
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      totalA = 0,
      totalWeight = 0;
    topPixels.forEach(pixel => {
      totalR += pixel.r * pixel.weight;
      totalG += pixel.g * pixel.weight;
      totalB += pixel.b * pixel.weight;
      totalA += pixel.a * pixel.weight;
      totalWeight += pixel.weight;
    });
    return {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
      a: Math.round(totalA / totalWeight)
    };
};

const calculateTextureConsistency = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    let consistency = 0;
    let count = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const index = (y * width + x) * 4;
        const nIndex = (ny * width + nx) * 4;
        const colorDiff = Math.abs(data[index] - data[nIndex]) + Math.abs(data[index + 1] - data[nIndex + 1]) + Math.abs(data[index + 2] - data[nIndex + 2]);
        consistency += Math.max(0, 255 - colorDiff) / 255;
        count++;
      }
    }
    return count > 0 ? consistency / count : 0;
};

const detectWatermark = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    let confidence = 0;
    const isWhiteish = r > 200 && g > 200 && b > 200;
    const isSemiTransparent = a > 50 && a < 250;
    const brightness = (r + g + b) / 3;
    if (isWhiteish && isSemiTransparent) {
      confidence += 0.8;
    }
    if (brightness > 220 && isSemiTransparent) {
      confidence += 0.7;
    }
    if (r > 150 && g < 100 && b < 100) {
      confidence += 0.6;
    }
    if (r > 180 && g > 100 && g < 200 && b < 100) {
      confidence += 0.5;
    }
    if (a < 245) {
      confidence += 0.4;
    }
    const edgeStrength = calculateEdgeStrength(data, x, y, width, height);
    if (edgeStrength > 30) {
      confidence += 0.3;
    }
    const colorUniformity = checkColorUniformity(data, x, y, width, height);
    if (colorUniformity > 0.7) {
      confidence += 0.2;
    }
    return Math.min(confidence, 1.0);
};

const calculateEdgeStrength = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    let maxDiff = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
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
};

const checkColorUniformity = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const centerIndex = (y * width + x) * 4;
    const centerR = data[centerIndex];
    const centerG = data[centerIndex + 1];
    const centerB = data[centerIndex + 2];
    let uniformCount = 0;
    let totalCount = 0;
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const colorDiff = Math.abs(data[nIndex] - centerR) + Math.abs(data[nIndex + 1] - centerG) + Math.abs(data[nIndex + 2] - centerB);
          if (colorDiff < 40) uniformCount++;
          totalCount++;
        }
      }
    }
    return totalCount > 0 ? uniformCount / totalCount : 0;
};

const isInMarkedWatermarkArea = (x: number, y: number, mark?: WatermarkMark): boolean => {
    if (!mark) return false;
    return x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height;
};

const repairPixel = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number, confidence: number) => {
    const radius = Math.min(12, Math.max(6, Math.floor(confidence * 12)));
    const validPixels: Array<{
      r: number;
      g: number;
      b: number;
      a: number;
      weight: number;
    }> = [];
    for (let ring = 1; ring <= 3; ring++) {
      const ringRadius = radius * ring / 3;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const dx = Math.round(Math.cos(angle) * ringRadius);
        const dy = Math.round(Math.sin(angle) * ringRadius);
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const neighborConfidence = detectWatermark(data, nx, ny, width, height);
          if (neighborConfidence < 0.1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (distance * distance + 0.1) / ring;
            validPixels.push({
              r: data[neighborIndex],
              g: data[neighborIndex + 1],
              b: data[neighborIndex + 2],
              a: data[neighborIndex + 3],
              weight: weight
            });
          }
        }
      }
    }
    if (validPixels.length === 0) return null;
    validPixels.sort((a, b) => b.weight - a.weight);
    const useCount = Math.min(20, validPixels.length);
    return weightedAverage(validPixels.slice(0, useCount));
};

const weightedAverage = (pixels: Array<{
    r: number;
    g: number;
    b: number;
    a: number;
    weight: number;
  }>) => {
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      totalA = 0,
      totalWeight = 0;
    pixels.forEach(pixel => {
      totalR += pixel.r * pixel.weight;
      totalG += pixel.g * pixel.weight;
      totalB += pixel.b * pixel.weight;
      totalA += pixel.a * pixel.weight;
      totalWeight += pixel.weight;
    });
    return {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
      a: Math.round(totalA / totalWeight)
    };
};

export const processImageCanvas = async (imageFile: File, mark: WatermarkMark | undefined, processingAlgorithm: string, existingProcessedUrl?: string): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        if (processingAlgorithm === 'sd-inpainting' && mark) {
          console.log('使用Stable Diffusion Inpainting算法处理');
          const processedBlob = await processWithSDInpainting(imageFile, mark);
          resolve(processedBlob);
          return;
        }

        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法获取Canvas上下文'));
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          try {
            if (processingAlgorithm === 'lama' && mark) {
              console.log('使用LaMa算法处理水印区域');
              await applyLamaInpainting(canvas, mark);
            } else {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              for (let pass = 0; pass < 3; pass++) {
                let processedPixels = 0;
                const watermarkPixels: Array<{
                  x: number;
                  y: number;
                  confidence: number;
                }> = [];
                for (let y = 0; y < canvas.height; y++) {
                  for (let x = 0; x < canvas.width; x++) {
                    const normalizedX = x / canvas.width;
                    const normalizedY = y / canvas.height;
                    let confidence = 0;
                    if (mark) {
                      if (isInMarkedWatermarkArea(normalizedX, normalizedY, mark)) {
                        confidence = 0.98;
                      }
                    } else {
                      confidence = detectWatermark(data, x, y, canvas.width, canvas.height);
                    }
                    let threshold = 0.2;
                    if (processingAlgorithm === 'conservative') threshold = 0.35;else if (processingAlgorithm === 'aggressive') threshold = 0.12;
                    if (confidence > threshold) {
                      watermarkPixels.push({
                        x,
                        y,
                        confidence
                      });
                    }
                  }
                }
                watermarkPixels.forEach(({
                  x,
                  y,
                  confidence
                }) => {
                  const repaired = repairPixel(data, x, y, canvas.width, canvas.height, confidence);
                  if (repaired) {
                    const index = (y * canvas.width + x) * 4;
                    const blendFactor = Math.min(0.98, confidence + 0.3);
                    data[index] = Math.round(data[index] * (1 - blendFactor) + repaired.r * blendFactor);
                    data[index + 1] = Math.round(data[index + 1] * (1 - blendFactor) + repaired.g * blendFactor);
                    data[index + 2] = Math.round(data[index + 2] * (1 - blendFactor) + repaired.b * blendFactor);
                    data[index + 3] = Math.round(data[index + 3] * (1 - blendFactor) + repaired.a * blendFactor);
                    processedPixels++;
                  }
                });
                console.log(`Pass ${pass + 1}: 修复了 ${processedPixels} 个水印像素`);
              }
              ctx.putImageData(imageData, 0, 0);
            }
            canvas.toBlob(blob => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('无法生成处理后的图片'));
              }
            }, 'image/png', 1.0);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = existingProcessedUrl || URL.createObjectURL(imageFile);
      } catch (error) {
        reject(error);
      }
    });
};

