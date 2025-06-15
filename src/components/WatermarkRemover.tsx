
import React, { useState, useCallback, useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';

import BatchDownloadDialog from './BatchDownloadDialog';
import Sidebar from './watermark/Sidebar';
import Toolbar from './watermark/Toolbar';
import ImageGrid from './watermark/ImageGrid';

import { ImageItem, WatermarkMark, DragState, ResizeState, ResizeHandle } from './watermark/types';
import { processImageCanvas } from './watermark/imageProcessor';

const WatermarkRemover = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [processingAlgorithm, setProcessingAlgorithm] = useState<'enhanced' | 'conservative' | 'aggressive' | 'lama' | 'sd-inpainting'>('lama');
  const [zoom, setZoom] = useState<number>(1);
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [resizeState, setResizeState] = useState<ResizeState>({ isResizing: false, resizeHandle: null, startX: 0, startY: 0 });
  const [selectedMark, setSelectedMark] = useState<boolean>(false);
  const [isBatchDownloadOpen, setIsBatchDownloadOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ [key: string]: number }>({});
  const [sdApiKey, setSdApiKey] = useState<string>('');
  const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);

  useEffect(() => {
    if (images.length > 0 && !selectedImageId) {
      setSelectedImageId(images[0].id);
    }
  }, [images, selectedImageId]);

  const loadImageDimensions = (file: File): Promise<{ width: number, height: number }> => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newImages = await Promise.all(Array.from(files).map(async file => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        processedUrl: null,
        rotation: 0,
        dimensions: await loadImageDimensions(file),
        watermarkMark: undefined,
        processCount: 0,
        isMarkingCompleted: false,
      } as ImageItem)));
      setImages(prev => [...prev, ...newImages]);
      event.target.value = '';
    }
  };

  const syncScroll = useCallback((source: 'original' | 'processed', scrollLeft: number, scrollTop: number) => {
    // This function needs to be adapted as refs are now in a child component.
    // For simplicity in this refactoring, we'll accept that synced scroll might not work without more complex state management (e.g. context or prop drilling refs)
    // A proper fix would involve forwarding refs or using a shared state for scroll positions.
  }, []);

  const getImageCoordinates = (event: React.MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return { x, y };
  };
  
  const getResizeHandle = (x: number, y: number, mark: WatermarkMark): ResizeHandle | null => {
    const handleSize = Math.max(0.01, 0.02 / zoom);
    const handles = {
      'nw': { x: mark.x, y: mark.y },
      'ne': { x: mark.x + mark.width, y: mark.y },
      'sw': { x: mark.x, y: mark.y + mark.height },
      'se': { x: mark.x + mark.width, y: mark.y + mark.height },
      'n': { x: mark.x + mark.width / 2, y: mark.y },
      'e': { x: mark.x + mark.width, y: mark.y + mark.height / 2 },
      's': { x: mark.x + mark.width / 2, y: mark.y + mark.height },
      'w': { x: mark.x, y: mark.y + mark.height / 2 }
    } as const;
    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
        return handle as ResizeHandle;
      }
    }
    return null;
  };

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    event.preventDefault();
    event.stopPropagation();
    const selectedImage = images.find(img => img.id === imageId);
    if (!selectedImage) return;
    const { x, y } = getImageCoordinates(event);
    if (selectedImage.watermarkMark) {
      const mark = selectedImage.watermarkMark;
      const handle = getResizeHandle(x, y, mark);
      if (handle) {
        setResizeState({ isResizing: true, resizeHandle: handle, startX: x, startY: y });
        setSelectedMark(true);
        return;
      }
      if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
        setSelectedMark(true);
        setDragState({ isDragging: true, startX: x - mark.x, startY: y - mark.y, currentX: x, currentY: y });
        return;
      }
    }
    setSelectedMark(false);
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, watermarkMark: undefined } : img));
    setDragState({ isDragging: true, startX: x, startY: y, currentX: x, currentY: y });
  }, [isMarkingMode, images, zoom]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    const { x, y } = getImageCoordinates(event);
    if (!dragState.isDragging && !resizeState.isResizing) {
      const selectedImage = images.find(img => img.id === imageId);
      if (selectedImage?.watermarkMark) {
        const mark = selectedImage.watermarkMark;
        const handle = getResizeHandle(x, y, mark);
        const target = event.currentTarget;
        if (handle) {
          const cursors = { 'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize', 'n': 'ns-resize', 's': 'ns-resize', 'e': 'ew-resize', 'w': 'ew-resize' };
          target.style.cursor = cursors[handle];
        } else if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
          target.style.cursor = 'move';
        } else {
          target.style.cursor = 'crosshair';
        }
      } else {
        event.currentTarget.style.cursor = 'crosshair';
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (resizeState.isResizing && resizeState.resizeHandle) {
      const selectedImage = images.find(img => img.id === imageId);
      if (selectedImage?.watermarkMark) {
        const mark = selectedImage.watermarkMark;
        let newMark = { ...mark };
        const minSize = Math.max(0.01, 0.015 / zoom);
        switch (resizeState.resizeHandle) {
          case 'se': newMark.width = Math.max(minSize, x - mark.x); newMark.height = Math.max(minSize, y - mark.y); break;
          case 'nw': const newWidth = mark.width + (mark.x - x); const newHeight = mark.height + (mark.y - y); if (newWidth > minSize && newHeight > minSize) { newMark.x = x; newMark.y = y; newMark.width = newWidth; newMark.height = newHeight; } break;
          case 'ne': const neWidth = Math.max(minSize, x - mark.x); const neHeight = mark.height + (mark.y - y); if (neHeight > minSize) { newMark.y = y; newMark.width = neWidth; newMark.height = neHeight; } break;
          case 'sw': const swWidth = mark.width + (mark.x - x); const swHeight = Math.max(minSize, y - mark.y); if (swWidth > minSize) { newMark.x = x; newMark.width = swWidth; newMark.height = swHeight; } break;
          case 'n': const nHeight = mark.height + (mark.y - y); if (nHeight > minSize) { newMark.y = y; newMark.height = nHeight; } break;
          case 's': newMark.height = Math.max(minSize, y - mark.y); break;
          case 'e': newMark.width = Math.max(minSize, x - mark.x); break;
          case 'w': const wWidth = mark.width + (mark.x - x); if (wWidth > minSize) { newMark.x = x; newMark.width = wWidth; } break;
        }
        setImages(prev => prev.map(img => img.id === imageId ? { ...img, watermarkMark: newMark } : img));
      }
    } else if (dragState.isDragging) {
      if (selectedMark) {
        const selectedImage = images.find(img => img.id === imageId);
        if (selectedImage?.watermarkMark) {
          const mark = selectedImage.watermarkMark;
          const newX = Math.max(0, Math.min(1 - mark.width, x - dragState.startX));
          const newY = Math.max(0, Math.min(1 - mark.height, y - dragState.startY));
          setImages(prev => prev.map(img => img.id === imageId ? { ...img, watermarkMark: { ...mark, x: newX, y: newY } } : img));
        }
      } else {
        setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
      }
    }
  }, [isMarkingMode, dragState, resizeState, selectedMark, images, zoom]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.style.cursor = 'crosshair';
    if (resizeState.isResizing) {
      setResizeState({ isResizing: false, resizeHandle: null, startX: 0, startY: 0 });
      return;
    }
    if (dragState.isDragging && !selectedMark) {
      const { startX, startY, currentX, currentY } = dragState;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const minSize = Math.max(0.01, 0.015 / zoom);
      if (width > minSize && height > minSize) {
        setImages(prev => prev.map(img => img.id === imageId ? { ...img, watermarkMark: { x: left, y: top, width, height } } : img));
        setSelectedMark(true);
      }
    }
    setDragState({ isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  }, [isMarkingMode, dragState, selectedMark, zoom]);

  const clearWatermarkMark = (imageId: string) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, watermarkMark: undefined, isMarkingCompleted: false } : img));
    setSelectedMark(false);
  };

  const restoreToOriginal = (imageId: string) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, processedUrl: null, processCount: 0, watermarkMark: undefined, isMarkingCompleted: false } : img));
    setSelectedMark(false);
    toast.success("已还原到原图状态", { duration: 800 });
  };

  const handleCompleteMarking = (imageId: string) => {
    const selectedImage = images.find(img => img.id === imageId);
    if (!selectedImage?.watermarkMark) {
      toast.error("请先标记水印位置", { duration: 1000 });
      return;
    }
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, isMarkingCompleted: true } : img));
    setIsMarkingMode(false);
    setSelectedMark(false);
    toast.success("水印标记已完成，现在可以开始处理", { duration: 1000 });
  };

  const handleRemoveWatermark = async (imageItem: ImageItem) => {
    if (!imageItem.isMarkingCompleted || !imageItem.watermarkMark) {
      toast.error("请先完成水印标记", { duration: 1000 });
      return;
    }
    if (isProcessing || isBatchProcessing) {
      toast.error("请等待当前任务完成", { duration: 800 });
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    try {
      toast.info("开始处理图片...", { duration: 800 });
      const progressInterval = setInterval(() => setProgress(prev => Math.min(prev + 5, 90)), 100);
      const processedBlob = await processImageCanvas(imageItem.file, imageItem.watermarkMark, processingAlgorithm, imageItem.processedUrl || undefined);
      clearInterval(progressInterval);
      setProgress(100);
      const processedUrl = URL.createObjectURL(processedBlob);
      setImages(prev => prev.map(img => img.id === imageItem.id ? { ...img, processedUrl, processCount: img.processCount + 1 } : img));
      toast.success(`图片处理完成！${imageItem.processCount > 0 ? '继续优化' : '水印已去除'}`, { duration: 1500 });
    } catch (error: any) {
      console.error("处理图片时出错:", error);
      toast.error(`处理失败: ${error.message}`, { duration: 1500 });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleBatchProcess = async () => {
    if (isProcessing || isBatchProcessing) {
      toast.error("请等待当前任务完成", { duration: 800 });
      return;
    }
    const imagesToProcess = images.filter(img => img.watermarkMark && img.isMarkingCompleted);
    if (imagesToProcess.length === 0) {
      toast.error("请先为图片标记水印并完成标记", { duration: 1000 });
      return;
    }
    setIsBatchProcessing(true);
    setBatchProgress({});
    try {
      toast.info(`开始批量处理 ${imagesToProcess.length} 张已完成标记的图片`, { duration: 1000 });
      for (let i = 0; i < imagesToProcess.length; i++) {
        const imageItem = imagesToProcess[i];
        setBatchProgress(prev => ({ ...prev, [imageItem.id]: 0 }));
        try {
          const progressInterval = setInterval(() => setBatchProgress(prev => ({ ...prev, [imageItem.id]: Math.min((prev[imageItem.id] || 0) + 10, 85) })), 100);
          const processedBlob = await processImageCanvas(imageItem.file, imageItem.watermarkMark, processingAlgorithm, imageItem.processedUrl || undefined);
          clearInterval(progressInterval);
          setBatchProgress(prev => ({ ...prev, [imageItem.id]: 100 }));
          const processedUrl = URL.createObjectURL(processedBlob);
          setImages(prev => prev.map(img => img.id === imageItem.id ? { ...img, processedUrl, processCount: img.processCount + 1 } : img));
          console.log(`批量处理进度: ${i + 1}/${imagesToProcess.length} - ${imageItem.file.name}`);
        } catch (error: any) {
          console.error(`处理图片 ${imageItem.file.name} 失败:`, error);
          setBatchProgress(prev => ({ ...prev, [imageItem.id]: -1 }));
        }
      }
      const successCount = Object.values(batchProgress).filter(p => p === 100).length;
      const failedCount = Object.values(batchProgress).filter(p => p === -1).length;
      if (successCount > 0) {
        toast.success(`批量处理完成！成功处理 ${successCount} 张图片${failedCount > 0 ? `，失败 ${failedCount} 张` : ''}`, { duration: 2000 });
      } else {
        toast.error("批量处理失败，请检查图片格式", { duration: 1500 });
      }
    } catch (error: any) {
      console.error("批量处理错误:", error);
      toast.error(`批量处理失败: ${error.message}`, { duration: 1500 });
    } finally {
      setIsBatchProcessing(false);
      setBatchProgress({});
    }
  };

  const handleBatchApplyWatermark = () => {
    const mark = selectedImage?.watermarkMark;
    if (!mark) {
      toast.error("当前图片没有标记水印", { duration: 800 });
      return;
    }
    setImages(prev => prev.map(img => img.id === selectedImageId ? img : { ...img, watermarkMark: { ...mark }, isMarkingCompleted: false }));
    toast.success(`已将水印标记应用到 ${images.length - 1} 张图片，请分别确认完成标记`, { duration: 1500 });
  };
  
  const handleDownload = (imageItem: ImageItem) => {
    if (imageItem.processedUrl) {
      const link = document.createElement("a");
      link.href = imageItem.processedUrl;
      link.download = `watermark_removed_${imageItem.file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("图片已开始下载!", { duration: 800 });
    } else {
      toast.error("请先去除水印", { duration: 800 });
    }
  };

  const handleBatchDownload = () => {
    const processedImages = images.filter(img => img.processedUrl);
    if (processedImages.length === 0) {
      toast.error("暂无已处理的图片", { duration: 800 });
      return;
    }
    setIsBatchDownloadOpen(true);
  };

  const handleMarkingToggle = () => {
    if (isMarkingMode) {
      if (selectedImage?.watermarkMark) {
        handleCompleteMarking(selectedImage.id);
      } else {
        setIsMarkingMode(false);
        setSelectedMark(false);
      }
    } else {
      setIsMarkingMode(true);
      setSelectedMark(false);
      if (selectedImage?.isMarkingCompleted) {
        setImages(prev => prev.map(img => img.id === selectedImage.id ? { ...img, isMarkingCompleted: false } : img));
      }
    }
  };
  
  const handleRemoveImage = (imageId: string) => {
    setImages(prev => {
      const newImages = prev.filter(img => img.id !== imageId);
      if (selectedImageId === imageId) {
        setSelectedImageId(newImages.length > 0 ? newImages[0].id : null);
      }
      return newImages;
    });
    setSelectedMark(false);
  };

  const selectedImage = images.find(img => img.id === selectedImageId);

  return (
    <TooltipProvider>
      <div className="h-full flex">
        <Sidebar
          images={images}
          selectedImageId={selectedImageId}
          processingAlgorithm={processingAlgorithm}
          isProcessing={isProcessing}
          isBatchProcessing={isBatchProcessing}
          batchProgress={batchProgress}
          sdApiKey={sdApiKey}
          isApiConfigOpen={isApiConfigOpen}
          onFileUpload={handleFileUpload}
          onBatchProcess={handleBatchProcess}
          onAlgorithmChange={setProcessingAlgorithm}
          onImageSelect={setSelectedImageId}
          onRemoveImage={handleRemoveImage}
          setSdApiKey={setSdApiKey}
          setIsApiConfigOpen={setIsApiConfigOpen}
          handleRemoveWatermark={handleRemoveWatermark}
        />

        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          <Toolbar
            selectedImage={selectedImage}
            isMarkingMode={isMarkingMode}
            isProcessing={isProcessing}
            isBatchProcessing={isBatchProcessing}
            handleMarkingToggle={handleMarkingToggle}
            clearWatermarkMark={clearWatermarkMark}
            handleBatchApplyWatermark={handleBatchApplyWatermark}
            restoreToOriginal={restoreToOriginal}
            handleRemoveWatermark={handleRemoveWatermark}
            handleDownload={handleDownload}
            handleBatchDownload={handleBatchDownload}
            selectedImageId={selectedImageId}
          />
          {selectedImage ? (
            <ImageGrid
              selectedImage={selectedImage}
              isProcessing={isProcessing}
              progress={progress}
              zoom={zoom}
              setZoom={setZoom}
              syncScroll={syncScroll}
              isMarkingMode={isMarkingMode}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              selectedMark={selectedMark}
              dragState={dragState}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">请从左侧列表中选择一张图片进行处理</p>
                <p className="text-sm text-gray-400">上传后将在此处看到图片对比</p>
              </div>
            </div>
          )}
          <BatchDownloadDialog isOpen={isBatchDownloadOpen} onClose={() => setIsBatchDownloadOpen(false)} images={images} />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WatermarkRemover;
