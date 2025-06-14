import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageProcessor } from './ImageProcessor';
import { Wand2, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"

interface ProcessedImage {
  id: string;
  url: string;
  originalFile: File | null;
  processedUrl: string | null;
  isProcessed: boolean;
  watermarkArea: { x: number; y: number; width: number; height: number } | null;
}

const WatermarkRemover = () => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.map((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        const newImage: ProcessedImage = {
          id: file.name + Date.now(),
          url: reader.result as string,
          originalFile: file,
          processedUrl: null,
          isProcessed: false,
          watermarkArea: null,
        };
        setImages((prevImages) => [...prevImages, newImage]);
      };

      reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.png', '.jpg'],
    },
  });

  const handleImageClick = (image: ProcessedImage) => {
    setSelectedImage(image);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedImage) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedImage) return;

    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;

    dragStart.current = { x: e.clientX, y: e.clientY };

    setImages(prevImages => {
      return prevImages.map(img => {
        if (img.id === selectedImage.id) {
          const currentArea = img.watermarkArea || { x: 0, y: 0, width: 100, height: 50 };
          let newX = currentArea.x + deltaX / zoomLevel;
          let newY = currentArea.y + deltaY / zoomLevel;

          // 确保水印区域不超出图像边界
          newX = Math.max(0, Math.min(newX, (img.originalFile ? 800 : 600) - currentArea.width));
          newY = Math.max(0, Math.min(newY, 600 - currentArea.height));

          return {
            ...img,
            watermarkArea: {
              ...currentArea,
              x: newX,
              y: newY
            }
          };
        }
        return img;
      });
    });
    e.stopPropagation();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderMarkingOverlay = (image: ProcessedImage) => {
    if (!image.watermarkArea || (selectedImage?.id === image.id && selectedImage.isProcessed)) {
      return null;
    }

    const { x, y, width, height } = image.watermarkArea;

    return (
      <>
        {/* 半透明遮罩层 */}
        <div
          className="absolute inset-0 bg-black/20 pointer-events-none"
          style={{
            mask: `polygon(0% 0%, 0% 100%, ${x}px 100%, ${x}px ${y}px, ${x + width}px ${y}px, ${x + width}px ${y + height}px, ${x}px ${y + height}px, ${x}px 100%, 100% 100%, 100% 0%)`,
            WebkitMask: `polygon(0% 0%, 0% 100%, ${x}px 100%, ${x}px ${y}px, ${x + width}px ${y}px, ${x + width}px ${y + height}px, ${x}px ${y + height}px, ${x}px 100%, 100% 100%, 100% 0%)`
          }}
        />
        
        {/* 主要选择框 - 使用虚线和柔和颜色 */}
        <div
          className="absolute border-2 border-dashed border-blue-400/80 bg-blue-100/10 backdrop-blur-[0.5px]"
          style={{
            left: x,
            top: y,
            width,
            height,
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.3), inset 0 0 0 1px rgba(59, 130, 246, 0.2)'
          }}
          onMouseDown={handleMouseDown}
        >
          {/* 四个角的控制点 - 更小更精致 */}
          {[
            { position: 'top-left', cursor: 'nw-resize', top: -3, left: -3 },
            { position: 'top-right', cursor: 'ne-resize', top: -3, right: -3 },
            { position: 'bottom-left', cursor: 'sw-resize', bottom: -3, left: -3 },
            { position: 'bottom-right', cursor: 'se-resize', bottom: -3, right: -3 }
          ].map(({ position, cursor, ...style }) => (
            <div
              key={position}
              className="absolute w-2 h-2 bg-white border border-blue-400 rounded-full shadow-sm hover:bg-blue-50 hover:scale-125 transition-all duration-150"
              style={{
                cursor,
                ...style
              }}
              data-resize={position}
            />
          ))}

          {/* 边缘中点控制点 - 更小 */}
          {[
            { position: 'top', cursor: 'n-resize', top: -3, left: '50%', transform: 'translateX(-50%)' },
            { position: 'right', cursor: 'e-resize', right: -3, top: '50%', transform: 'translateY(-50%)' },
            { position: 'bottom', cursor: 's-resize', bottom: -3, left: '50%', transform: 'translateX(-50%)' },
            { position: 'left', cursor: 'w-resize', left: -3, top: '50%', transform: 'translateY(-50%)' }
          ].map(({ position, cursor, ...style }) => (
            <div
              key={position}
              className="absolute w-1.5 h-1.5 bg-white border border-blue-400 rounded-full shadow-sm hover:bg-blue-50 hover:scale-125 transition-all duration-150"
              style={{
                cursor,
                ...style
              }}
              data-resize={position}
            />
          ))}

          {/* 水印标识图标 */}
          <div className="absolute -top-8 left-0 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-700 shadow-sm border border-gray-200">
            <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-sm opacity-80"></div>
            </div>
            <span>水印区域</span>
          </div>
        </div>

        {/* 尺寸提示 */}
        <div 
          className="absolute bg-gray-800/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded pointer-events-none"
          style={{
            left: x + width + 8,
            top: y,
            transform: x + width + 120 > (image.originalFile ? 800 : 600) ? 'translateX(-100%) translateX(-' + (width + 16) + 'px)' : 'none'
          }}
        >
          {Math.round(width)} × {Math.round(height)}
        </div>
      </>
    );
  };

  const processWatermark = async (image: ProcessedImage) => {
    if (!image.originalFile) {
      console.error('No original file found for processing.');
      return;
    }

    setProcessing(true);
    setProcessingProgress(0);

    const worker = new Worker(new URL('../../public/watermark-worker.js', import.meta.url));

    worker.onmessage = (event) => {
      if (event.data.type === 'progress') {
        setProcessingProgress(event.data.progress);
      } else if (event.data.type === 'completed') {
        const processedImageData = event.data.result;

        // Convert the processed image data back to a Blob
        const canvas = document.createElement('canvas');
        canvas.width = processedImageData.width;
        canvas.height = processedImageData.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          const imgData = new ImageData(processedImageData.data, processedImageData.width, processedImageData.height);
          ctx.putImageData(imgData, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              const processedURL = URL.createObjectURL(blob);
              setImages(prevImages =>
                prevImages.map(img =>
                  img.id === image.id ? { ...img, processedUrl: processedURL, isProcessed: true } : img
                )
              );
              setSelectedImage(prevImage => prevImage && prevImage.id === image.id ? { ...prevImage, processedUrl: processedURL, isProcessed: true } : prevImage);
              setProcessing(false);
              setProcessingProgress(100);
              toast({
                title: "处理完成!",
                description: "水印已成功去除🎉",
              })
            } else {
              console.error('Failed to create blob from processed image data.');
              setProcessing(false);
              toast({
                variant: "destructive",
                title: "处理失败",
                description: "无法创建处理后的图片文件",
              })
            }
          }, 'image/png');
        } else {
          console.error('Could not get 2D context from canvas.');
          setProcessing(false);
          toast({
            variant: "destructive",
            title: "处理失败",
            description: "无法获取Canvas 2D上下文",
          })
        }
      } else if (event.data.type === 'error') {
        console.error('Worker error:', event.data.error);
        setProcessing(false);
        toast({
          variant: "destructive",
          title: "处理失败",
          description: `图片处理过程中发生错误: ${event.data.error}`,
        })
      }
    };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0, img.width, img.height);
      const imageData = ctx?.getImageData(0, 0, img.width, img.height);

      if (imageData) {
        worker.postMessage({
          type: 'process',
          imageData: imageData,
          width: img.width,
          height: img.height
        });
      } else {
        console.error('Could not get image data from canvas.');
        setProcessing(false);
        toast({
          variant: "destructive",
          title: "处理失败",
          description: "无法从Canvas获取图像数据",
        })
      }
    };

    img.onerror = () => {
      console.error('Failed to load image for processing.');
      setProcessing(false);
      toast({
        variant: "destructive",
        title: "处理失败",
        description: "无法加载图片进行处理",
      })
    };

    img.src = image.url;
  };

  const handleWatermarkAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (!selectedImage) return;

    setImages(prevImages => {
      return prevImages.map(img => {
        if (img.id === selectedImage.id) {
          const currentArea = img.watermarkArea || { x: 0, y: 0, width: 100, height: 50 };
          return {
            ...img,
            watermarkArea: {
              ...currentArea,
              [name]: Number(value)
            }
          };
        }
        return img;
      });
    });
  };

  return (
    <div className="h-full flex bg-white">
      {/* 左侧图片列表 */}
      <div className="w-80 border-r bg-gray-50 flex-shrink-0 overflow-y-auto">
        <div className="px-4 py-6">
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-lg p-4 bg-white text-center cursor-pointer ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <input {...getInputProps()} />
            <p className="text-sm text-gray-500">
              将图片拖放到此处，或
              <label htmlFor="file-upload" className="text-blue-600 hover:underline cursor-pointer">
                选择文件
              </label>
            </p>
          </div>
        </div>

        <div className="space-y-2 px-4">
          {images.map((image) => (
            <div
              key={image.id}
              className={`relative rounded-lg overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${selectedImage?.id === image.id ? 'shadow-lg border-2 border-blue-500' : 'shadow-sm border border-gray-200'
                }`}
              onClick={() => handleImageClick(image)}
            >
              <img
                src={image.url}
                alt="预览图"
                className="block w-full h-20 object-cover"
              />
              {image.isProcessed && (
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <span className="text-white text-xs font-medium bg-green-600 px-2 py-1 rounded-full shadow-md">已处理</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 flex flex-col h-full">
        {selectedImage ? (
          <div className="flex-1 flex flex-col h-full">
            {/* 顶部工具栏 */}
            <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-medium text-gray-900">
                  {selectedImage.isProcessed ? '处理后' : '原图'}
                </h3>
                
                {/* 进度条移到标题右侧 */}
                {processing && selectedImage && !selectedImage.isProcessed && (
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
                        style={{ width: `${processingProgress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 min-w-[3rem]">{processingProgress}%</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                    disabled={zoomLevel >= 3}
                    className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.25))}
                    disabled={zoomLevel <= 0.25}
                    className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  {/* 缩放比例显示移到放大按钮后 */}
                  <span className="text-sm text-gray-600 min-w-[3rem]">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                </div>

                {!selectedImage.isProcessed && (
                  <button
                    onClick={() => processWatermark(selectedImage)}
                    disabled={processing || !selectedImage.watermarkArea}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        开始处理
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 图片预览区域 */}
            <div className="flex-1 overflow-auto bg-gray-100">
              <div className="p-6">
                <div 
                  className="relative inline-block bg-white rounded-lg shadow-lg overflow-hidden"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top left'
                  }}
                >
                  <img
                    src={selectedImage.isProcessed ? selectedImage.processedUrl : selectedImage.url}
                    alt="预览图片"
                    className="block max-w-none"
                    style={{
                      width: selectedImage.originalFile ? '800px' : '600px',
                      height: 'auto'
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                  
                  {/* 只在未处理的图片上显示标记矩形 */}
                  {!selectedImage.isProcessed && renderMarkingOverlay(selectedImage)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-100">
            <p className="text-gray-500 text-lg">请选择或上传一张图片开始处理</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatermarkRemover;
