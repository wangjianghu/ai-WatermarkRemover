import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, Trash2, MapPin, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  processedUrl: string | null;
  rotation: number;
  dimensions?: { width: number; height: number };
  watermarkMarks?: Array<{x: number, y: number, radius: number}>;
}

interface WatermarkMark {
  x: number;
  y: number;
  radius: number;
}

const WatermarkRemover = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [processingAlgorithm, setProcessingAlgorithm] = useState<'basic' | 'advanced' | 'combined'>('combined');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const dimensions = await loadImageDimensions(file);
          return {
            id: crypto.randomUUID(),
            file: file,
            url: URL.createObjectURL(file),
            processedUrl: null,
            rotation: 0,
            dimensions,
            watermarkMarks: [],
          };
        })
      );
      setImages(prevImages => [...prevImages, ...newImages]);
      if (newImages.length > 0 && !selectedImageId) {
        setSelectedImageId(newImages[0].id);
      }
      event.target.value = '';
    }
  };

  const handleImageClick = (event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId
          ? {
              ...img,
              watermarkMarks: [
                ...(img.watermarkMarks || []),
                { x, y, radius: 0.05 }
              ]
            }
          : img
      )
    );
  };

  const clearWatermarkMarks = (imageId: string) => {
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId ? { ...img, watermarkMarks: [] } : img
      )
    );
  };

  // 基础水印检测算法
  const isWatermarkPixel = (data: Uint8ClampedArray, index: number, x: number, y: number, width: number, height: number): boolean => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    const isInWatermarkRegion = isInPotentialWatermarkRegion(x, y, width, height);
    if (!isInWatermarkRegion) return false;
    
    const brightness = (r + g + b) / 3;
    const isTransparent = a < 180;
    const isExtremeBright = brightness > 240 || brightness < 20;
    const contrast = calculateLocalContrast(data, x, y, width, height);
    const hasHighContrast = contrast > 80;
    
    let suspicionScore = 0;
    if (isTransparent) suspicionScore += 0.5;
    if (isExtremeBright) suspicionScore += 0.4;
    if (hasHighContrast) suspicionScore += 0.3;
    
    return suspicionScore > 0.8;
  };

  // 高级水印检测算法
  const isWatermarkPixelAdvanced = (data: Uint8ClampedArray, index: number, x: number, y: number, width: number, height: number): boolean => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    const brightness = (r + g + b) / 3;
    const isTextLike = detectTextFeatures(data, x, y, width, height);
    const isIsolatedPixel = checkIsolatedPixel(data, x, y, width, height);
    const edgeStrength = calculateEdgeStrength(data, x, y, width, height);
    
    let score = 0;
    if (a < 200) score += 0.4;
    if (isTextLike) score += 0.5;
    if (isIsolatedPixel) score += 0.3;
    if (edgeStrength > 30) score += 0.3;
    
    return score > 0.7;
  };

  // 手动标记区域检测
  const isInMarkedWatermarkArea = (x: number, y: number, marks: WatermarkMark[]): boolean => {
    if (!marks || marks.length === 0) return false;
    
    return marks.some(mark => {
      const distance = Math.sqrt(Math.pow(x - mark.x, 2) + Math.pow(y - mark.y, 2));
      return distance <= mark.radius;
    });
  };

  const isInPotentialWatermarkRegion = (x: number, y: number, width: number, height: number): boolean => {
    const edgeThreshold = 0.15;
    
    if (x > width * (1 - edgeThreshold) && y > height * (1 - edgeThreshold)) return true;
    if (x > width * (1 - edgeThreshold) && y < height * edgeThreshold) return true;
    if (x < width * edgeThreshold && y > height * (1 - edgeThreshold)) return true;
    if (x < width * edgeThreshold && y < height * edgeThreshold) return true;
    
    return false;
  };

  const checkIsolatedPixel = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean => {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let differentNeighbors = 0;
    let totalNeighbors = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
          
          if (Math.abs(centerBrightness - neighborBrightness) > 50) {
            differentNeighbors++;
          }
          totalNeighbors++;
        }
      }
    }
    
    return totalNeighbors > 0 && (differentNeighbors / totalNeighbors) > 0.6;
  };

  const calculateLocalContrast = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
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
  };

  const detectTextFeatures = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean => {
    let edgeCount = 0;
    let totalPixels = 0;
    const radius = 1;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const edgeStrength = calculateEdgeStrength(data, nx, ny, width, height);
          if (edgeStrength > 50) {
            edgeCount++;
          }
          totalPixels++;
        }
      }
    }
    
    return totalPixels > 0 && (edgeCount / totalPixels) > 0.5;
  };

  const calculateEdgeStrength = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
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
  };

  const repairPixel = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number, radius: number) => {
    const validPixels: Array<{r: number, g: number, b: number, a: number, weight: number}> = [];
    const repairRadius = Math.min(radius, 3);
    
    for (let dy = -repairRadius; dy <= repairRadius; dy++) {
      for (let dx = -repairRadius; dx <= repairRadius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const weight = 1 / (distance * distance + 0.1);
          
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
    
    if (validPixels.length === 0) return null;
    
    validPixels.sort((a, b) => b.weight - a.weight);
    const usePixels = validPixels.slice(0, Math.min(validPixels.length, 4));
    
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
    
    usePixels.forEach(pixel => {
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

  const processImageCanvas = async (imageFile: File, marks?: WatermarkMark[]): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法获取Canvas上下文'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let processedPixels = 0;
        
        // 多算法组合处理
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % canvas.width;
          const y = Math.floor((i / 4) / canvas.width);
          const normalizedX = x / canvas.width;
          const normalizedY = y / canvas.height;
          
          let shouldProcess = false;
          
          // 检查是否在手动标记区域
          if (marks && marks.length > 0) {
            shouldProcess = isInMarkedWatermarkArea(normalizedX, normalizedY, marks);
          }
          
          // 如果不在手动标记区域，使用算法检测
          if (!shouldProcess) {
            switch (processingAlgorithm) {
              case 'basic':
                shouldProcess = isWatermarkPixel(data, i, x, y, canvas.width, canvas.height);
                break;
              case 'advanced':
                shouldProcess = isWatermarkPixelAdvanced(data, i, x, y, canvas.width, canvas.height);
                break;
              case 'combined':
                shouldProcess = isWatermarkPixel(data, i, x, y, canvas.width, canvas.height) ||
                              isWatermarkPixelAdvanced(data, i, x, y, canvas.width, canvas.height);
                break;
            }
          }
          
          if (shouldProcess) {
            const repaired = repairPixel(data, x, y, canvas.width, canvas.height, 3);
            if (repaired) {
              data[i] = repaired.r;
              data[i + 1] = repaired.g;
              data[i + 2] = repaired.b;
              data[i + 3] = repaired.a;
              processedPixels++;
            }
          }
        }

        console.log(`处理了 ${processedPixels} 个水印像素`);
        
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法生成处理后的图片'));
          }
        }, 'image/png', 1.0);
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(imageFile);
    });
  };

  const handleRemoveWatermark = async (imageItem: ImageItem) => {
    if (isProcessing) {
      toast.error("请等待当前任务完成", { duration: 2000 });
      return;
    }

    if (!imageItem?.file) {
      toast.error("请先上传图片", { duration: 2000 });
      return;
    }

    setSelectedImageId(imageItem.id);
    setIsProcessing(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 90));
      }, 150);

      const processedBlob = await processImageCanvas(imageItem.file, imageItem.watermarkMarks);
      
      clearInterval(progressInterval);
      setProgress(100);

      const processedUrl = URL.createObjectURL(processedBlob);
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === imageItem.id ? { ...img, processedUrl: processedUrl } : img
        )
      );
      
      toast.success("水印去除完成!", { duration: 2000 });
    } catch (error: any) {
      console.error("Error removing watermark:", error);
      toast.error(`水印去除失败: ${error.message}`, { duration: 3000 });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setSelectedImageId(null);
    }
  };

  const handleDownload = (imageItem: ImageItem) => {
    if (imageItem.processedUrl) {
      const link = document.createElement("a");
      link.href = imageItem.processedUrl;
      link.download = `watermark_removed_${imageItem.file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("图片已开始下载!", { duration: 2000 });
    } else {
      toast.error("请先去除水印", { duration: 2000 });
    }
  };

  const handleImageListClick = (imageId: string) => {
    setSelectedImageId(imageId);
  };

  const handleRemoveImage = (imageId: string) => {
    setImages(prevImages => {
      const newImages = prevImages.filter(img => img.id !== imageId);
      if (selectedImageId === imageId) {
        const newSelectedId = newImages.length > 0 ? newImages[0].id : null;
        setSelectedImageId(newSelectedId);
      }
      return newImages;
    });
  };

  const renderWatermarkMarks = (marks: WatermarkMark[] = [], imageId: string) => {
    return marks.map((mark, index) => (
      <div
        key={index}
        className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 rounded-full pointer-events-none"
        style={{
          left: `${mark.x * 100}%`,
          top: `${mark.y * 100}%`,
          width: `${mark.radius * 200}%`,
          height: `${mark.radius * 200}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />
    ));
  };

  return (
    <div className="h-full flex flex-col">
      {progress > 0 && isProcessing && (
        <div className="flex-shrink-0 px-6 pt-6">
          <Card>
            <CardContent className="p-4">
              <div className="w-full">
                <Progress value={progress} />
                <p className="text-center mt-2 text-sm text-gray-600">处理进度: {progress}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 min-h-0">
        <Card className="flex flex-col">
          <CardContent className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold">图片列表</h2>
              <div>
                <input
                  type="file"
                  id="upload"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button asChild disabled={isProcessing} size="sm">
                  <label htmlFor="upload" className="flex items-center space-x-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>上传图片</span>
                  </label>
                </Button>
              </div>
            </div>

            <div className="flex flex-col space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">处理算法:</span>
                <select
                  value={processingAlgorithm}
                  onChange={(e) => setProcessingAlgorithm(e.target.value as 'basic' | 'advanced' | 'combined')}
                  className="text-xs border rounded px-2 py-1"
                  disabled={isProcessing}
                >
                  <option value="basic">基础检测</option>
                  <option value="advanced">高级检测</option>
                  <option value="combined">组合算法</option>
                </select>
              </div>
              
              <Button
                variant={isMarkingMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsMarkingMode(!isMarkingMode)}
                disabled={isProcessing}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {isMarkingMode ? '退出标记模式' : '手动标记水印'}
              </Button>
            </div>
            
            <div className="flex flex-col space-y-2 flex-1 overflow-y-auto">
              {images.map(image => (
                <div
                  key={image.id}
                  className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors flex-shrink-0 ${
                    selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleImageListClick(image.id)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block" title={image.file.name}>
                      {image.file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {image.processedUrl ? '已处理' : '未处理'}
                      {image.watermarkMarks && image.watermarkMarks.length > 0 && 
                        ` • ${image.watermarkMarks.length}个标记`
                      }
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveWatermark(image);
                    }}
                    disabled={isProcessing}
                    className="ml-2 flex-shrink-0"
                  >
                    {isProcessing && selectedImageId === image.id ? '处理中...' : '去水印'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col">
          <CardContent className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold whitespace-nowrap">图片处理结果</h2>
              {isMarkingMode && (
                <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded">
                  点击图片标记水印位置
                </div>
              )}
            </div>
            
            {images.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-6">
                  {images.map(image => (
                    <div
                      key={image.id}
                      className="bg-white rounded-lg border p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm truncate" title={image.file.name}>
                          {image.file.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {image.watermarkMarks && image.watermarkMarks.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearWatermarkMarks(image.id)}
                              className="text-xs"
                            >
                              清除标记
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveWatermark(image)}
                            disabled={isProcessing}
                            className="text-xs"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {isProcessing && selectedImageId === image.id ? '处理中...' : '重新处理'}
                          </Button>
                          {image.processedUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(image)}
                              className="text-xs"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              下载
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveImage(image.id)}
                            className="text-xs"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">原图</span>
                            {isMarkingMode && (
                              <span className="text-xs text-gray-500">点击标记水印</span>
                            )}
                          </div>
                          <div className="relative bg-gray-50 rounded-lg overflow-hidden aspect-video">
                            <img
                              src={image.url}
                              alt="原图"
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={(e) => handleImageClick(e, image.id)}
                            />
                            {renderWatermarkMarks(image.watermarkMarks, image.id)}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">处理后</span>
                          </div>
                          <div className="relative bg-gray-50 rounded-lg overflow-hidden aspect-video">
                            {image.processedUrl ? (
                              <img
                                src={image.processedUrl}
                                alt="处理后"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                {isProcessing && selectedImageId === image.id ? (
                                  <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                    <div className="text-xs">正在处理...</div>
                                  </div>
                                ) : (
                                  '等待处理'
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <div className="text-center">
                  <p className="text-lg mb-2">请上传图片</p>
                  <p className="text-sm text-gray-400">上传后将在此处看到图片对比列表</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WatermarkRemover;
