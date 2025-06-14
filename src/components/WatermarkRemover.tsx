
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Download, Trash2, Eye, EyeOff } from "lucide-react";
import { ImageProcessor } from './ImageProcessor';
import { ProcessedImage } from './ProcessedImage';

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
  const [showOriginal, setShowOriginal] = useState<{[key: string]: boolean}>({});
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

  const processAllImages = async () => {
    const unprocessedImages = images.filter(img => !img.processedUrl && !img.isProcessing);
    
    if (unprocessedImages.length === 0) {
      toast.error("没有需要处理的图片");
      return;
    }

    for (const image of unprocessedImages) {
      await processImage(image.id);
      // 添加小延迟避免同时处理太多图片
      await new Promise(resolve => setTimeout(resolve, 500));
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

  const downloadAllProcessed = () => {
    const processedImages = images.filter(img => img.processedUrl);
    
    if (processedImages.length === 0) {
      toast.error("没有已处理的图片可下载");
      return;
    }

    processedImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImage(image.processedUrl!, image.originalFile.name);
      }, index * 500);
    });

    toast.success(`开始下载 ${processedImages.length} 张图片`);
  };

  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    setShowOriginal(prev => {
      const newState = { ...prev };
      delete newState[imageId];
      return newState;
    });
  };

  const clearAll = () => {
    setImages([]);
    setShowOriginal({});
    toast.success("已清空所有图片");
  };

  const toggleImageView = (imageId: string) => {
    setShowOriginal(prev => ({
      ...prev,
      [imageId]: !prev[imageId]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 上传区域 */}
      <Card className="mb-8 border-2 border-dashed border-blue-300 bg-white/5 backdrop-blur-lg">
        <div
          className={`p-12 text-center transition-colors ${
            dragActive ? 'bg-blue-500/20' : 'hover:bg-white/5'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-16 w-16 text-blue-400 mb-4" />
          <h3 className="text-2xl font-semibold text-white mb-2">
            拖拽图片到此处或点击上传
          </h3>
          <p className="text-blue-200 mb-6">
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

      {/* 操作按钮 */}
      {images.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-4 justify-center">
          <Button 
            onClick={processAllImages}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            disabled={images.every(img => img.isProcessing || img.processedUrl)}
          >
            批量处理全部
          </Button>
          <Button 
            onClick={downloadAllProcessed}
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            disabled={!images.some(img => img.processedUrl)}
          >
            <Download className="w-4 h-4 mr-2" />
            下载全部
          </Button>
          <Button 
            onClick={clearAll}
            variant="outline"
            className="border-red-300 text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空全部
          </Button>
        </div>
      )}

      {/* 图片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((image) => (
          <ProcessedImage
            key={image.id}
            image={image}
            showOriginal={showOriginal[image.id] || false}
            onProcess={() => processImage(image.id)}
            onRemove={() => removeImage(image.id)}
            onDownload={() => downloadImage(image.processedUrl!, image.originalFile.name)}
            onToggleView={() => toggleImageView(image.id)}
          />
        ))}
      </div>

      {images.length === 0 && (
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
