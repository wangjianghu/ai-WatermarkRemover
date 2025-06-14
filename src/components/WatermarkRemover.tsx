import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Download, Trash2, Eye, EyeOff, Play } from "lucide-react";
import { OptimizedWatermarkProcessor } from './OptimizedWatermarkProcessor';

interface ProcessedImageData {
  id: string;
  originalFile: File;
  originalUrl: string;
  processedUrl: string | null;
  isProcessing: boolean;
  progress: number;
}

export const WatermarkRemover = () => {
  const [images, setImages] = useState<ProcessedImageData[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [processor] = useState(() => new OptimizedWatermarkProcessor());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const newImages: ProcessedImageData[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const id = Date.now().toString() + i;
        newImages.push({
          id,
          originalFile: file,
          originalUrl: URL.createObjectURL(file),
          processedUrl: null,
          isProcessing: false,
          progress: 0
        });
      }
    }
    if (newImages.length === 0) {
      toast.error("请选择有效的图片文件");
      return;
    }
    setImages(prev => [...prev, ...newImages]);
    toast.success(`成功添加 ${newImages.length} 张图片`);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const processImage = async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    setImages(prev => prev.map(img => img.id === imageId ? {
      ...img,
      isProcessing: true,
      progress: 0
    } : img));

    try {
      toast.info("开始优化处理，使用高性能算法");

      const processedBlob = await processor.removeWatermark(
        image.originalFile,
        (progress) => {
          setImages(prev => prev.map(img => img.id === imageId ? {
            ...img,
            progress: progress
          } : img));
        }
      );

      const processedUrl = URL.createObjectURL(processedBlob);

      setImages(prev => prev.map(img => img.id === imageId ? {
        ...img,
        processedUrl,
        isProcessing: false,
        progress: 100
      } : img));

      toast.success("高性能水印去除完成！页面响应已优化");
    } catch (error) {
      console.error("处理失败:", error);
      setImages(prev => prev.map(img => img.id === imageId ? {
        ...img,
        isProcessing: false,
        progress: 0
      } : img));
      
      if (error instanceof Error && error.message.includes('正忙')) {
        toast.error("处理器正忙，请稍后再试");
      } else {
        toast.error("处理失败，请重试");
      }
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const processedImages = images.filter(img => img.processedUrl);

  return (
    <div className="max-w-7xl mx-auto">
      {/* 上传区域 */}
      <Card className="mb-8 border-2 border-dashed border-blue-300 bg-white/5 backdrop-blur-lg">
        <div
          className={`p-8 text-center transition-colors ${
            dragActive ? 'bg-blue-500/10' : 'hover:bg-white/5'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            拖拽图片到此处或点击上传
          </h3>
          <p className="text-blue-200 mb-4">
            支持 JPG、PNG、WebP 格式，可批量上传
          </p>
          <p className="text-green-300 text-sm mb-4">
            ✨ 已优化：高性能处理，避免页面卡顿
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Upload className="w-4 h-4 mr-2" />
            选择图片
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </Card>

      {images.length > 0 ? (
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：原图列表 */}
          <div className="col-span-12 lg:col-span-6">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  原图列表 ({images.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {images.map(image => (
                    <div key={image.id} className="relative">
                      <div className="aspect-square relative overflow-hidden rounded-lg bg-white/5">
                        <img
                          src={image.originalUrl}
                          alt={image.originalFile.name}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* 状态标识 */}
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            image.processedUrl 
                              ? 'bg-green-500/80 text-white' 
                              : image.isProcessing 
                                ? 'bg-yellow-500/80 text-white'
                                : 'bg-gray-500/80 text-white'
                          }`}>
                            {image.processedUrl ? '已处理' : image.isProcessing ? '高速处理中' : '待处理'}
                          </span>
                        </div>

                        {/* 处理进度 */}
                        {image.isProcessing && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="bg-white/90 rounded-lg p-3 text-center min-w-[150px]">
                              <div className="text-sm font-medium text-gray-800 mb-2">
                                高性能处理中...
                              </div>
                              <Progress value={image.progress} className="w-full h-2" />
                              <div className="text-xs text-gray-600 mt-1">
                                {image.progress}%
                              </div>
                              <div className="text-xs text-green-600 mt-1">
                                页面保持响应
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          {!image.processedUrl && !image.isProcessing && (
                            <Button
                              onClick={() => processImage(image.id)}
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            onClick={() => removeImage(image.id)}
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-300 hover:bg-red-500/10"
                            disabled={image.isProcessing}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-white text-xs truncate" title={image.originalFile.name}>
                          {image.originalFile.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* 右侧：处理后图片列表 */}
          <div className="col-span-12 lg:col-span-6">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <EyeOff className="w-5 h-5 mr-2" />
                  处理结果 ({processedImages.length})
                </h3>
                
                {processedImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {processedImages.map(image => (
                      <div key={image.id} className="relative">
                        <div className="aspect-square relative overflow-hidden rounded-lg bg-white/5">
                          <img
                            src={image.processedUrl!}
                            alt={`处理后_${image.originalFile.name}`}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* 成功标识 */}
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-green-500/80 text-white">
                              高效完成
                            </span>
                          </div>

                          {/* 下载按钮 */}
                          <div className="absolute bottom-2 right-2">
                            <Button
                              onClick={() => downloadImage(image.processedUrl!, image.originalFile.name)}
                              size="sm"
                              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-white text-xs truncate" title={`处理后_${image.originalFile.name}`}>
                            处理后_{image.originalFile.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">⚡</div>
                    <p className="text-white/60 text-sm">
                      高性能处理完成的图片将显示在这里
                    </p>
                    <p className="text-green-400/60 text-xs mt-1">
                      优化算法，页面不卡顿
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-2xl font-semibold text-white mb-2">
            高性能AI水印去除工具
          </h3>
          <p className="text-blue-200">
            优化算法，快速处理，页面始终保持响应
          </p>
        </div>
      )}
    </div>
  );
};
