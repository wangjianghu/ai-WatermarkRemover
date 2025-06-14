
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Download, Trash2, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
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
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
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
    
    // 自动选择第一张图片
    if (newImages.length > 0 && !selectedImageId) {
      setSelectedImageId(newImages[0].id);
    }
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
      toast.info("🚀 启动优化版AI去水印引擎");

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

      toast.success("✨ 优化版AI去水印完成！处理速度更快");
    } catch (error) {
      console.error("处理失败:", error);
      setImages(prev => prev.map(img => img.id === imageId ? {
        ...img,
        isProcessing: false,
        progress: 0
      } : img));
      
      toast.error(`处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimized_dewatermark_${filename}`;
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

  const selectedImage = images.find(img => img.id === selectedImageId);

  return (
    <div className="max-w-full mx-auto">
      {/* 上传区域 */}
      <Card className="mb-6 border-2 border-dashed border-blue-300 bg-white/5 backdrop-blur-lg">
        <div
          className={`p-6 text-center transition-colors ${
            dragActive ? 'bg-blue-500/10' : 'hover:bg-white/5'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">
            拖拽图片到此处或点击上传
          </h3>
          <p className="text-blue-200 mb-3">
            支持 JPG、PNG、WebP 格式，可批量上传
          </p>
          <p className="text-green-300 text-sm mb-3">
            🔥 优化版算法：Web Worker + 分块处理 + 智能压缩
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
          {/* 左侧：图片列表 */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
              <div className="p-4">
                <h3 className="text-white font-semibold mb-4">
                  图片列表 ({images.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {images.map(image => (
                    <div 
                      key={image.id} 
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageId === image.id 
                          ? 'border-blue-400 ring-2 ring-blue-400/30' 
                          : 'border-white/20 hover:border-white/40'
                      }`}
                      onClick={() => setSelectedImageId(image.id)}
                    >
                      <div className="aspect-video relative bg-white/5">
                        <img
                          src={image.originalUrl}
                          alt={image.originalFile.name}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* 状态标识 */}
                        <div className="absolute top-1 left-1">
                          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                            image.processedUrl 
                              ? 'bg-green-500/80 text-white' 
                              : image.isProcessing 
                                ? 'bg-yellow-500/80 text-white'
                                : 'bg-gray-500/80 text-white'
                          }`}>
                            {image.processedUrl ? '完成' : image.isProcessing ? '处理中' : '待处理'}
                          </span>
                        </div>

                        {/* 处理进度 */}
                        {image.isProcessing && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                            <div className="text-xs text-white mb-1">处理中 {image.progress}%</div>
                            <Progress value={image.progress} className="h-1" />
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="absolute bottom-1 right-1 flex gap-1">
                          {!image.processedUrl && !image.isProcessing && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                processImage(image.id);
                              }}
                              size="sm"
                              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-xs px-2 py-1"
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(image.id);
                            }}
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-300 hover:bg-red-500/10 text-xs px-2 py-1"
                            disabled={image.isProcessing}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-2">
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

          {/* 右侧：图片对比区域 */}
          <div className="col-span-12 lg:col-span-9">
            {selectedImage ? (
              <div className="space-y-4">
                {/* 工具栏 */}
                <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h3 className="text-white font-semibold">
                        {selectedImage.originalFile.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                          size="sm"
                          variant="outline"
                          className="border-white/30 text-white hover:bg-white/10"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-white text-sm min-w-[60px] text-center">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <Button
                          onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                          size="sm"
                          variant="outline"
                          className="border-white/30 text-white hover:bg-white/10"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => setZoomLevel(1)}
                          size="sm"
                          variant="outline"
                          className="border-white/30 text-white hover:bg-white/10"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!selectedImage.processedUrl && !selectedImage.isProcessing && (
                        <Button
                          onClick={() => processImage(selectedImage.id)}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          开始去水印
                        </Button>
                      )}
                      
                      {selectedImage.processedUrl && (
                        <Button
                          onClick={() => downloadImage(selectedImage.processedUrl!, selectedImage.originalFile.name)}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下载处理结果
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* 图片对比区域 - 完整显示，无遮挡 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 原图 */}
                  <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                    <div className="p-4">
                      <h4 className="text-white font-medium mb-3 text-center">原图</h4>
                      <div className="bg-white/5 rounded-lg overflow-hidden">
                        <div className="overflow-auto" style={{ 
                          maxHeight: '70vh',
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgba(255,255,255,0.3) transparent'
                        }}>
                          <img
                            src={selectedImage.originalUrl}
                            alt="原图"
                            className="w-full h-auto object-contain block"
                            style={{ 
                              transform: `scale(${zoomLevel})`,
                              transformOrigin: 'top left',
                              minWidth: zoomLevel > 1 ? `${100 * zoomLevel}%` : '100%'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* 处理后图片 */}
                  <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                    <div className="p-4">
                      <h4 className="text-white font-medium mb-3 text-center">去水印后</h4>
                      <div className="bg-white/5 rounded-lg overflow-hidden">
                        {selectedImage.isProcessing ? (
                          <div className="flex items-center justify-center" style={{ minHeight: '300px' }}>
                            <div className="text-center">
                              <div className="animate-spin w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
                              <div className="text-white font-medium mb-2">优化处理中...</div>
                              <Progress value={selectedImage.progress} className="w-64 mb-2" />
                              <div className="text-blue-200 text-sm">
                                {selectedImage.progress}% - 
                                {selectedImage.progress < 30 ? ' 图像压缩优化' :
                                 selectedImage.progress < 60 ? ' 水印区域检测' :
                                 selectedImage.progress < 90 ? ' 智能修复处理' : ' 最终优化'}
                              </div>
                            </div>
                          </div>
                        ) : selectedImage.processedUrl ? (
                          <div className="overflow-auto" style={{ 
                            maxHeight: '70vh',
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'rgba(255,255,255,0.3) transparent'
                          }}>
                            <img
                              src={selectedImage.processedUrl}
                              alt="处理后"
                              className="w-full h-auto object-contain block"
                              style={{ 
                                transform: `scale(${zoomLevel})`,
                                transformOrigin: 'top left',
                                minWidth: zoomLevel > 1 ? `${100 * zoomLevel}%` : '100%'
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center" style={{ minHeight: '300px' }}>
                            <div className="text-center">
                              <div className="text-4xl mb-4">⚡</div>
                              <div className="text-white/60 mb-2">点击"开始去水印"处理图片</div>
                              <div className="text-blue-400/60 text-sm">
                                优化版算法 - 更快更稳定
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* 处理完成提示 */}
                {selectedImage.processedUrl && (
                  <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/30">
                    <div className="p-4 text-center">
                      <div className="text-2xl mb-2">✨</div>
                      <div className="text-white font-medium mb-1">去水印处理完成！</div>
                      <div className="text-green-200 text-sm">
                        使用优化算法处理，页面响应更流畅，可放大查看细节效果
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">🖼️</div>
                  <div className="text-white font-medium mb-2">选择图片开始处理</div>
                  <div className="text-white/60">
                    从左侧列表选择一张图片进行去水印处理
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-2xl font-semibold text-white mb-2">
            优化版AI去水印工具
          </h3>
          <p className="text-blue-200 mb-4">
            Web Worker + 分块处理 + 智能压缩，解决页面卡顿问题
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm text-white/80">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-lg mb-2">⚡</div>
              <div>Web Worker处理</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-lg mb-2">📊</div>
              <div>实时进度反馈</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-lg mb-2">🚀</div>
              <div>智能压缩优化</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
