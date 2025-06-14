
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, ZoomIn, ZoomOut, RotateCcw, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedWatermarkProcessor } from './AdvancedWatermarkProcessor';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  processedUrl: string | null;
  rotation: number;
  dimensions?: { width: number; height: number };
  processCount: number;
}

type ZoomLevel = number;

const WatermarkRemover = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(1);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processorRef = useRef<AdvancedWatermarkProcessor | null>(null);

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
            processCount: 0,
          };
        })
      );
      setImages(prevImages => [...prevImages, ...newImages]);
      event.target.value = '';
    }
  };

  const enhancedWatermarkRemoval = async (imageData: ImageData): Promise<ImageData> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      
      ctx.putImageData(imageData, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = data.data;
      
      // 多重去水印算法
      for (let pass = 0; pass < 3; pass++) {
        // 第一轮：检测并移除透明度水印
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // 检测半透明水印
          if (a < 240 && a > 50) {
            const neighbors = this.getNeighborPixels(pixels, i, canvas.width, canvas.height);
            if (neighbors.length > 0) {
              const avgR = neighbors.reduce((sum, p) => sum + p.r, 0) / neighbors.length;
              const avgG = neighbors.reduce((sum, p) => sum + p.g, 0) / neighbors.length;
              const avgB = neighbors.reduce((sum, p) => sum + p.b, 0) / neighbors.length;
              
              pixels[i] = Math.round(avgR);
              pixels[i + 1] = Math.round(avgG);
              pixels[i + 2] = Math.round(avgB);
              pixels[i + 3] = 255;
            }
          }
          
          // 检测文字水印（高对比度边缘）
          const brightness = (r + g + b) / 3;
          if (this.isTextWatermark(pixels, i, canvas.width, canvas.height, brightness)) {
            const repairColor = this.intelligentRepair(pixels, i, canvas.width, canvas.height);
            if (repairColor) {
              pixels[i] = repairColor.r;
              pixels[i + 1] = repairColor.g;
              pixels[i + 2] = repairColor.b;
              pixels[i + 3] = 255;
            }
          }
        }
        
        // 第二轮：平滑处理
        if (pass === 1) {
          this.applyMedianFilter(pixels, canvas.width, canvas.height);
        }
        
        // 第三轮：边缘保持去噪
        if (pass === 2) {
          this.applyEdgePreservingSmooth(pixels, canvas.width, canvas.height);
        }
      }
      
      ctx.putImageData(data, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    });
  };

  const getNeighborPixels = (pixels: Uint8ClampedArray, index: number, width: number, height: number) => {
    const neighbors = [];
    const pixelIndex = Math.floor(index / 4);
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && (dx !== 0 || dy !== 0)) {
          const nIndex = (ny * width + nx) * 4;
          const na = pixels[nIndex + 3];
          
          // 只使用不透明的邻居像素
          if (na > 240) {
            neighbors.push({
              r: pixels[nIndex],
              g: pixels[nIndex + 1],
              b: pixels[nIndex + 2]
            });
          }
        }
      }
    }
    
    return neighbors;
  };

  const isTextWatermark = (pixels: Uint8ClampedArray, index: number, width: number, height: number, brightness: number): boolean => {
    const pixelIndex = Math.floor(index / 4);
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    
    // 检测文字特征：规则边缘和一致颜色
    let edgeCount = 0;
    let totalChecked = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && (dx !== 0 || dy !== 0)) {
          const nIndex = (ny * width + nx) * 4;
          const nBrightness = (pixels[nIndex] + pixels[nIndex + 1] + pixels[nIndex + 2]) / 3;
          const diff = Math.abs(brightness - nBrightness);
          
          if (diff > 30) edgeCount++;
          totalChecked++;
        }
      }
    }
    
    const edgeRatio = totalChecked > 0 ? edgeCount / totalChecked : 0;
    const isExtreme = brightness > 200 || brightness < 60;
    
    return edgeRatio > 0.4 && isExtreme;
  };

  const intelligentRepair = (pixels: Uint8ClampedArray, index: number, width: number, height: number) => {
    const neighbors = this.getNeighborPixels(pixels, index, width, height);
    
    if (neighbors.length === 0) return null;
    
    // 使用中值滤波修复
    neighbors.sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
    const medianIndex = Math.floor(neighbors.length / 2);
    
    return neighbors[medianIndex];
  };

  const applyMedianFilter = (pixels: Uint8ClampedArray, width: number, height: number) => {
    const temp = new Uint8ClampedArray(pixels);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          const values = [];
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const index = ((y + dy) * width + (x + dx)) * 4 + c;
              values.push(temp[index]);
            }
          }
          
          values.sort((a, b) => a - b);
          const median = values[Math.floor(values.length / 2)];
          
          pixels[(y * width + x) * 4 + c] = median;
        }
      }
    }
  };

  const applyEdgePreservingSmooth = (pixels: Uint8ClampedArray, width: number, height: number) => {
    const temp = new Uint8ClampedArray(pixels);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const centerIndex = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let weightSum = 0;
          const centerValue = temp[centerIndex + c];
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIndex = ((y + dy) * width + (x + dx)) * 4 + c;
              const diff = Math.abs(temp[nIndex] - centerValue);
              const weight = Math.exp(-diff * diff / 400); // 边缘保持
              
              sum += temp[nIndex] * weight;
              weightSum += weight;
            }
          }
          
          pixels[centerIndex + c] = Math.round(sum / weightSum);
        }
      }
    }
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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 多轮处理增强效果
        const maxRounds = imageItem.processCount < 2 ? 2 : 1;
        
        for (let round = 0; round < maxRounds; round++) {
          setProgress(Math.floor((round / maxRounds) * 80));
          
          // 使用增强的去水印算法
          imageData = await this.enhancedWatermarkRemoval(imageData);
          
          // 使用原有处理器作为补充
          if (!processorRef.current) {
            processorRef.current = new AdvancedWatermarkProcessor();
          }
          
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          tempCtx.putImageData(imageData, 0, 0);
          
          const blob = await new Promise<Blob>((resolve) => {
            tempCanvas.toBlob(resolve as BlobCallback, 'image/png');
          });
          
          if (blob) {
            const file = new File([blob], 'temp.png', { type: 'image/png' });
            const processedBlob = await processorRef.current.removeWatermark(
              file,
              (progress) => setProgress(Math.floor(80 + (progress * 0.2)))
            );
            
            // 将处理结果转回ImageData
            const processedImg = new Image();
            processedImg.onload = () => {
              tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
              tempCtx.drawImage(processedImg, 0, 0);
              imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            };
            processedImg.src = URL.createObjectURL(processedBlob);
            
            await new Promise(resolve => processedImg.onload = resolve);
          }
        }
        
        // 最终结果
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const processedUrl = URL.createObjectURL(blob);
            setImages(prevImages =>
              prevImages.map(img =>
                img.id === imageItem.id 
                  ? { ...img, processedUrl: processedUrl, processCount: img.processCount + 1 }
                  : img
              )
            );
            toast.success(`水印去除完成! (第${imageItem.processCount + 1}次处理)`);
          }
        }, 'image/png');
      };
      
      img.src = imageItem.processedUrl || imageItem.url;
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

  const getOptimalImageStyle = (image: ImageItem) => {
    if (!image.dimensions) return {};
    
    const containerMaxWidth = 500;
    const containerMaxHeight = 400;
    const { width, height } = image.dimensions;
    
    const widthRatio = containerMaxWidth / width;
    const heightRatio = containerMaxHeight / height;
    const scale = Math.min(widthRatio, heightRatio, 1) * zoomLevel;
    
    return {
      maxWidth: '100%',
      maxHeight: '100%',
      width: 'auto',
      height: 'auto',
      objectFit: 'contain' as const,
      transform: `rotate(${image.rotation}deg) scale(${scale})`,
      transformOrigin: 'center'
    };
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <input
            type="file"
            id="upload"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button asChild disabled={isProcessing}>
            <label htmlFor="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>{isProcessing ? "上传中..." : "上传图片"}</span>
            </label>
          </Button>
          {progress > 0 && (
            <div className="w-full mt-4">
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-lg font-semibold">上传列表</h2>
            <div className="flex flex-col space-y-2">
              {images.map(image => (
                <div
                  key={image.id}
                  className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedImageId(image.id)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{image.file.name}</span>
                    <span className="text-xs text-gray-500">
                      {image.dimensions ? `${image.dimensions.width}×${image.dimensions.height}` : '加载中...'}
                      {image.processCount > 0 && ` (已处理${image.processCount}次)`}
                    </span>
                  </div>
                  <div className="flex space-x-2 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWatermark(image);
                      }}
                      disabled={isProcessing}
                      className="flex items-center space-x-1"
                    >
                      {image.processedUrl ? <RefreshCw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      <span>{image.processedUrl ? '再次处理' : '处理'}</span>
                    </Button>
                    {image.processedUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (image.processedUrl) {
                            const link = document.createElement("a");
                            link.href = image.processedUrl;
                            link.download = `watermark_removed_${image.file.name}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            toast.success("图片已开始下载!");
                          }
                        }}
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>下载</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {images.length === 0 && (
                <p className="text-gray-500 text-center py-4">暂无上传的图片</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">图片对比</h2>
              {selectedImage && (
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.4))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => {
                    setImages(prevImages =>
                      prevImages.map(img =>
                        img.id === selectedImageId ? { ...img, rotation: img.rotation + 90 } : img
                      )
                    );
                  }}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {selectedImage ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 原始图片 */}
                <div className="flex flex-col items-center space-y-2">
                  <h3 className="text-md font-semibold text-gray-700">原始图片</h3>
                  <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center w-full h-[400px]">
                    <img
                      src={selectedImage.url}
                      alt={selectedImage.file.name}
                      style={getOptimalImageStyle(selectedImage)}
                    />
                  </div>
                </div>

                {/* 处理后图片 */}
                <div className="flex flex-col items-center space-y-2">
                  <h3 className="text-md font-semibold text-gray-700">处理结果</h3>
                  <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center w-full h-[400px]">
                    {selectedImage.processedUrl ? (
                      <img
                        src={selectedImage.processedUrl}
                        alt={`处理后的 ${selectedImage.file.name}`}
                        style={getOptimalImageStyle(selectedImage)}
                      />
                    ) : (
                      <div className="text-center text-gray-500 p-8">
                        <p className="mb-4">请先处理图片</p>
                        <Button
                          onClick={() => handleRemoveWatermark(selectedImage)}
                          disabled={isProcessing}
                          className="flex items-center space-x-2"
                        >
                          <Play className="h-4 w-4" />
                          <span>开始处理</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  {selectedImage.processedUrl && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        if (selectedImage.processedUrl) {
                          const link = document.createElement("a");
                          link.href = selectedImage.processedUrl;
                          link.download = `watermark_removed_${selectedImage.file.name}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast.success("图片已开始下载!");
                        }
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>下载处理后的图片</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-16">
                <p>请从左侧列表中选择一张图片进行预览</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {progress > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>处理进度</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WatermarkRemover;
