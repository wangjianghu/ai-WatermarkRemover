
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Download, Trash2, Eye, EyeOff } from "lucide-react";
import { ImageProcessor } from './ImageProcessor';

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
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
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
    if (!selectedImageId && newImages.length > 0) {
      setSelectedImageId(newImages[0].id);
    }
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
    setImages(prev => prev.map(img => 
      img.id === imageId 
        ? { ...img, isProcessing: true, progress: 0 }
        : img
    ));

    try {
      // 模拟处理进度
      for (let progress = 10; progress <= 90; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setImages(prev => prev.map(img => 
          img.id === imageId 
            ? { ...img, progress }
            : img
        ));
      }

      const image = images.find(img => img.id === imageId);
      if (!image) return;

      // 使用ImageProcessor处理图片
      const processor = new ImageProcessor();
      const processedBlob = await processor.removeWatermark(image.originalFile);
      const processedUrl = URL.createObjectURL(processedBlob);

      setImages(prev => prev.map(img => 
        img.id === imageId 
          ? { 
              ...img, 
              processedUrl,
              isProcessing: false, 
              progress: 100 
            }
          : img
      ));

      toast.success("水印去除完成！");
    } catch (error) {
      console.error("处理失败:", error);
      setImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, isProcessing: false, progress: 0 }
          : img
      ));
      toast.error("处理失败，请重试");
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
    if (selectedImageId === imageId) {
      const remainingImages = images.filter(img => img.id !== imageId);
      setSelectedImageId(remainingImages.length > 0 ? remainingImages[0].id : null);
    }
  };

  const selectedImage = selectedImageId ? images.find(img => img.id === selectedImageId) : null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* 上传区域 */}
      <Card className="mb-8 border-2 border-dashed border-blue-300 bg-white/5 backdrop-blur-lg">
        <div
          className={`p-8 text-center transition-colors ${
            dragActive ? 'bg-blue-500/20' : 'hover:bg-white/5'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            拖拽图片到此处或点击上传
          </h3>
          <p className="text-blue-200 mb-4">
            支持 JPG、PNG、WebP 格式，可同时上传多张图片
          </p>
          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            选择图片
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </Card>

      {images.length > 0 ? (
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：图片列表和控制区域 */}
          <div className="col-span-12 lg:col-span-4">
            {/* 图片列表 */}
            <Card className="mb-4 bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="p-4">
                <h3 className="text-white font-semibold mb-4">图片列表</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedImageId === image.id 
                          ? 'bg-blue-500/30 border border-blue-400' 
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => setSelectedImageId(image.id)}
                    >
                      <img
                        src={image.originalUrl}
                        alt={image.originalFile.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{image.originalFile.name}</p>
                        <p className="text-blue-200 text-xs">
                          {image.processedUrl ? '已处理' : image.isProcessing ? '处理中...' : '待处理'}
                        </p>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(image.id);
                        }}
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* 操作按钮 */}
            {selectedImage && (
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                <div className="p-4 space-y-3">
                  {!selectedImage.processedUrl && !selectedImage.isProcessing && (
                    <Button
                      onClick={() => processImage(selectedImage.id)}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      去除水印
                    </Button>
                  )}
                  
                  {selectedImage.processedUrl && (
                    <Button
                      onClick={() => downloadImage(selectedImage.processedUrl!, selectedImage.originalFile.name)}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载处理后图片
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* 右侧：图片对比显示区域 */}
          <div className="col-span-12 lg:col-span-8">
            {selectedImage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 原图 */}
                <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                  <div className="p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center">
                      <Eye className="w-4 h-4 mr-2" />
                      原图
                    </h4>
                    <div className="aspect-square relative">
                      <img
                        src={selectedImage.originalUrl}
                        alt="原图"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>
                  </div>
                </Card>

                {/* 处理后图片 */}
                <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                  <div className="p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center">
                      <EyeOff className="w-4 h-4 mr-2" />
                      处理后
                    </h4>
                    <div className="aspect-square relative">
                      {selectedImage.isProcessing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <div className="bg-white/90 rounded-lg p-4 text-center min-w-[200px]">
                            <div className="text-sm font-medium text-gray-800 mb-2">
                              正在去除水印...
                            </div>
                            <Progress value={selectedImage.progress} className="w-full" />
                            <div className="text-xs text-gray-600 mt-1">
                              {selectedImage.progress}%
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <img
                        src={selectedImage.processedUrl || selectedImage.originalUrl}
                        alt="处理后"
                        className={`w-full h-full object-contain rounded-lg ${
                          selectedImage.isProcessing ? 'opacity-50' : ''
                        }`}
                      />
                      
                      {!selectedImage.processedUrl && !selectedImage.isProcessing && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                          <div className="text-white text-center">
                            <p className="text-sm">点击"去除水印"开始处理</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🖼️</div>
          <h3 className="text-2xl font-semibold text-white mb-2">
            开始使用AI水印去除工具
          </h3>
          <p className="text-blue-200">
            上传您的图片，让AI智能去除右下角的文字水印
          </p>
        </div>
      )}
    </div>
  );
};
