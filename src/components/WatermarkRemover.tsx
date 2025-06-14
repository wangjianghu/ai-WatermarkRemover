import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  processedUrl: string | null;
  rotation: number;
  dimensions?: { width: number; height: number };
}

type ZoomLevel = number;

const WatermarkRemover = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
          };
        })
      );
      setImages(prevImages => [...prevImages, ...newImages]);
      if (newImages.length > 0) {
        setSelectedImageId(newImages[0].id);
      }
      event.target.value = '';
    }
  };

  const isWatermarkPixel = (data: Uint8ClampedArray, index: number, x: number, y: number, width: number, height: number): boolean => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    const brightness = (r + g + b) / 3;
    
    const isTransparent = a < 200;
    const isExtremeBright = brightness > 220 || brightness < 40;
    const contrast = calculateLocalContrast(data, x, y, width, height);
    const hasHighContrast = contrast > 60;
    const isTextLike = detectTextFeatures(data, x, y, width, height);
    const isMonochrome = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
    
    let suspicionScore = 0;
    if (isTransparent) suspicionScore += 0.4;
    if (isExtremeBright) suspicionScore += 0.3;
    if (hasHighContrast) suspicionScore += 0.2;
    if (isTextLike) suspicionScore += 0.4;
    if (isMonochrome && brightness > 180) suspicionScore += 0.3;
    
    return suspicionScore > 0.6;
  };

  const calculateLocalContrast = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let maxDiff = 0;
    const radius = 3;
    
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
    const radius = 2;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const edgeStrength = calculateEdgeStrength(data, nx, ny, width, height);
          if (edgeStrength > 30) edgeCount++;
          totalPixels++;
        }
      }
    }
    
    return totalPixels > 0 && (edgeCount / totalPixels) > 0.4;
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
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          
          if (!isWatermarkPixel(data, neighborIndex, nx, ny, width, height)) {
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
    }
    
    if (validPixels.length === 0) return null;
    
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
    
    validPixels.forEach(pixel => {
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

  const applyPostProcessing = (data: Uint8ClampedArray, width: number, height: number) => {
    const tempData = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = (y * width + x) * 4;
        
        if (needsSmoothing(tempData, x, y, width, height)) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            let count = 0;
            
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                const nIndex = (ny * width + nx) * 4;
                sum += tempData[nIndex + c];
                count++;
              }
            }
            
            data[index + c] = Math.round(sum / count);
          }
        }
      }
    }
  };

  const needsSmoothing = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean => {
    const centerIndex = (y * width + x) * 4;
    let variance = 0;
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const diff = Math.abs(data[centerIndex] - data[nIndex]) + 
                      Math.abs(data[centerIndex + 1] - data[nIndex + 1]) + 
                      Math.abs(data[centerIndex + 2] - data[nIndex + 2]);
          variance += diff;
          count++;
        }
      }
    }
    
    return count > 0 && (variance / count) > 30;
  };

  const processImageCanvas = async (imageFile: File): Promise<Blob> => {
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

        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % canvas.width;
          const y = Math.floor((i / 4) / canvas.width);
          
          if (isWatermarkPixel(data, i, x, y, canvas.width, canvas.height)) {
            const repaired = repairPixel(data, x, y, canvas.width, canvas.height, 8);
            if (repaired) {
              data[i] = repaired.r;
              data[i + 1] = repaired.g;
              data[i + 2] = repaired.b;
              data[i + 3] = repaired.a;
            }
          }
        }

        applyPostProcessing(data, canvas.width, canvas.height);
        
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法生成处理后的图片'));
          }
        }, 'image/jpeg', 0.95);
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(imageFile);
    });
  };

  const handleRemoveWatermark = async (imageItem: ImageItem) => {
    if (isProcessing) {
      toast.error("请等待当前任务完成");
      return;
    }

    if (!imageItem?.file) {
      toast.error("请先上传图片");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const processedBlob = await processImageCanvas(imageItem.file);
      
      clearInterval(progressInterval);
      setProgress(100);

      const processedUrl = URL.createObjectURL(processedBlob);
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === imageItem.id ? { ...img, processedUrl: processedUrl } : img
        )
      );
      toast.success("水印去除完成!");
    } catch (error: any) {
      console.error("Error removing watermark:", error);
      toast.error(`水印去除失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prevLevel => Math.min(prevLevel + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prevLevel => Math.max(prevLevel - 0.2, 0.4));
  };

  const handleRotate = (imageId: string) => {
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId ? { ...img, rotation: img.rotation + 90 } : img
      )
    );
  };

  const handleDownload = (imageItem: ImageItem) => {
    if (imageItem.processedUrl) {
      const link = document.createElement("a");
      link.href = imageItem.processedUrl;
      link.download = `watermark_removed_${imageItem.file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("图片已开始下载!");
    } else {
      toast.error("请先去除水印");
    }
  };

  const handleImageClick = (imageId: string) => {
    setSelectedImageId(imageId);
  };

  const selectedImage = images.find(img => img.id === selectedImageId);

  const calculateDisplaySize = (dimensions?: { width: number; height: number }) => {
    if (!dimensions) return { width: 400, height: 300 };
    
    const maxWidth = 500;
    const maxHeight = 400;
    const { width, height } = dimensions;
    
    const aspectRatio = width / height;
    
    let displayWidth = maxWidth;
    let displayHeight = maxWidth / aspectRatio;
    
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = maxHeight * aspectRatio;
    }
    
    return {
      width: displayWidth,
      height: displayHeight
    };
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {progress > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="w-full">
              <Progress value={progress} />
              <p className="text-center mt-2 text-sm text-gray-600">处理进度: {progress}%</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
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
            <div className="flex flex-col space-y-2">
              {images.map(image => (
                <div
                  key={image.id}
                  className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleImageClick(image.id)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block" title={image.file.name}>
                      {image.file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {image.processedUrl ? '已处理' : '未处理'}
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
                    className="ml-2"
                  >
                    {isProcessing && selectedImageId === image.id ? '处理中...' : '去水印'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">图片对比</h2>
              {selectedImage && (
                <div className="flex items-center justify-between w-full ml-8">
                  <div className="flex items-center justify-center space-x-2">
                    <Button variant="outline" size="icon" onClick={handleZoomIn}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomOut}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleRotate(selectedImageId!)}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                  </div>
                  {selectedImage.processedUrl && (
                    <Button 
                      onClick={() => handleDownload(selectedImage)}
                      className="flex items-center space-x-2 ml-4"
                    >
                      <Download className="h-4 w-4" />
                      <span>下载处理后的图片</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {selectedImage ? (
              <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col items-center space-y-3">
                    <h3 className="text-md font-semibold">原始图片</h3>
                    <div 
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      style={{
                        ...calculateDisplaySize(selectedImage.dimensions),
                        minHeight: '300px'
                      }}
                    >
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.file.name}
                        className="object-contain"
                        style={{
                          transform: `rotate(${selectedImage.rotation}deg) scale(${zoomLevel})`,
                          maxWidth: '100%',
                          maxHeight: '100%',
                          transformOrigin: 'center center'
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center space-y-3">
                    <h3 className="text-md font-semibold">处理结果</h3>
                    <div 
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      style={{
                        ...calculateDisplaySize(selectedImage.dimensions),
                        minHeight: '300px'
                      }}
                    >
                      {selectedImage.processedUrl ? (
                        <img
                          src={selectedImage.processedUrl}
                          alt={`处理后的 ${selectedImage.file.name}`}
                          className="object-contain"
                          style={{
                            transform: `rotate(${selectedImage.rotation}deg) scale(${zoomLevel})`,
                            maxWidth: '100%',
                            maxHeight: '100%',
                            transformOrigin: 'center center'
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500 space-y-3 p-4">
                          <p className="text-center text-sm">请先处理图片以查看结果</p>
                          <Button 
                            onClick={() => handleRemoveWatermark(selectedImage)}
                            disabled={isProcessing}
                            size="sm"
                          >
                            {isProcessing ? '处理中...' : '开始去水印'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <div className="text-center">
                  <p className="text-lg mb-2">请上传并选择一张图片</p>
                  <p className="text-sm text-gray-400">从左侧列表选择图片进行查看和处理</p>
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
