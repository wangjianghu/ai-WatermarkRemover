
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
      // 自动选择第一张上传的图片
      if (newImages.length > 0) {
        setSelectedImageId(newImages[0].id);
      }
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

  // 计算最适合的显示尺寸，确保图片完整显示在容器内
  const calculateDisplaySize = (dimensions?: { width: number; height: number }) => {
    if (!dimensions) return { width: 300, height: 200 };
    
    // 设置最大显示尺寸
    const maxWidth = 450;
    const maxHeight = 350;
    const { width, height } = dimensions;
    
    const aspectRatio = width / height;
    
    let displayWidth = maxWidth;
    let displayHeight = maxWidth / aspectRatio;
    
    // 如果高度超过最大高度，则以高度为准调整宽度
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
              <span>{isProcessing ? "处理中..." : "上传图片"}</span>
            </label>
          </Button>
          {progress > 0 && (
            <div className="w-full mt-4">
              <Progress value={progress} />
              <p className="text-center mt-2 text-sm text-gray-600">{progress}%</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="text-lg font-semibold">图片列表</h2>
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
              <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 原始图片 */}
                  <div className="flex flex-col items-center space-y-3">
                    <h3 className="text-md font-semibold">原始图片</h3>
                    <div 
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      style={{
                        ...calculateDisplaySize(selectedImage.dimensions),
                        minHeight: '200px'
                      }}
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
                  <div className="flex flex-col items-center space-y-3">
                    <h3 className="text-md font-semibold">处理结果</h3>
                    <div 
                      className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center"
                      style={{
                        ...calculateDisplaySize(selectedImage.dimensions),
                        minHeight: '200px'
                      }}
                    >
                      {selectedImage.processedUrl ? (
                        <img
                          src={selectedImage.processedUrl}
                          alt={`处理后的 ${selectedImage.file.name}`}
                          className="max-w-full max-h-full object-contain"
                          style={{
                            transform: `rotate(${selectedImage.rotation}deg)`,
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
                
                {/* 下载按钮 */}
                {selectedImage.processedUrl && (
                  <div className="flex justify-center mt-6">
                    <Button 
                      onClick={() => handleDownload(selectedImage)}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>下载处理后的图片</span>
                    </Button>
                  </div>
                )}
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
