
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedWatermarkProcessor } from './AdvancedWatermarkProcessor';

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
          };
        })
      );
      setImages(prevImages => [...prevImages, ...newImages]);
      event.target.value = ''; // Reset the input
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
      if (!processorRef.current) {
        processorRef.current = new AdvancedWatermarkProcessor();
      }

      const processedBlob = await processorRef.current.removeWatermark(
        imageItem.file,
        (progress) => setProgress(progress)
      );

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

  // 计算最适合的显示尺寸
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
      width: displayWidth * zoomLevel,
      height: displayHeight * zoomLevel
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
                  className={`flex items-center justify-between p-2 border rounded-md cursor-pointer ${selectedImageId === image.id ? 'bg-gray-100' : ''}`}
                  onClick={() => handleImageClick(image.id)}
                >
                  <span className="text-sm truncate">{image.file.name}</span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveWatermark(image);
                      }}
                      disabled={isProcessing}
                    >
                      处理
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">图片对比</h2>
              {selectedImage && (
                <div className="flex items-center space-x-2">
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
              )}
            </div>
            
            {selectedImage ? (
              <div className="flex justify-center">
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  {/* 原始图片 */}
                  <div className="flex flex-col items-center space-y-2">
                    <h3 className="text-md font-semibold text-center">原始图片</h3>
                    <div 
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      style={calculateDisplaySize(selectedImage.dimensions)}
                    >
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.file.name}
                        className="max-w-full max-h-full object-contain"
                        style={{
                          transform: `rotate(${selectedImage.rotation}deg)`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 处理后图片 */}
                  <div className="flex flex-col items-center space-y-2">
                    <h3 className="text-md font-semibold text-center">处理结果</h3>
                    <div 
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      style={calculateDisplaySize(selectedImage.dimensions)}
                    >
                      {selectedImage.processedUrl ? (
                        <img
                          src={selectedImage.processedUrl}
                          alt={`Processed ${selectedImage.file.name}`}
                          className="max-w-full max-h-full object-contain"
                          style={{
                            transform: `rotate(${selectedImage.rotation}deg)`,
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500 space-y-2">
                          <p className="text-center">请先处理图片</p>
                          <Button 
                            onClick={() => handleRemoveWatermark(selectedImage)}
                            disabled={isProcessing}
                            size="sm"
                          >
                            开始处理
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {selectedImage.processedUrl && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleDownload(selectedImage)}
                        className="mt-2"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <p>请从左侧列表选择一张图片</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WatermarkRemover;
