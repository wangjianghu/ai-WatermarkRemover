
import React, { useState, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';

import BatchDownloadDialog from './BatchDownloadDialog';
import Sidebar from './watermark/Sidebar';
import Toolbar from './watermark/Toolbar';
import ImageGrid from './watermark/ImageGrid';

import { useImageState } from '@/hooks/useImageState';
import { useWatermarkMarking } from '@/hooks/useWatermarkMarking';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useImageHandlers } from '@/hooks/useImageHandlers';

const WatermarkRemover = () => {
  const [sdApiKey, setSdApiKey] = useState<string>('');
  const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);
  const [isBatchDownloadOpen, setIsBatchDownloadOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Use custom hooks
  const {
    images,
    selectedImageId,
    selectedImage,
    setSelectedImageId,
    addImages,
    updateImage,
    updateImages,
    removeImage,
    restoreToOriginal
  } = useImageState();

  const {
    isMarkingMode,
    zoom,
    setZoom,
    dragState,
    setDragState,
    resizeState,
    setResizeState,
    selectedMark,
    setSelectedMark,
    getImageCoordinates,
    getResizeHandle,
    clearWatermarkMark,
    handleMarkingToggle,
    handleBatchApplyWatermark
  } = useWatermarkMarking(updateImage, updateImages);

  const {
    isProcessing,
    progress,
    isBatchProcessing,
    batchProgress,
    processingAlgorithm,
    selectedImageId: processingSelectedImageId,
    setProcessingAlgorithm,
    handleRemoveWatermark,
    handleBatchProcess
  } = useImageProcessing(updateImage);

  const { handleFileUpload } = useFileUpload(images, addImages);
  
  const {
    handleZoomChange,
    syncScroll,
    handleDownload,
    handleBatchDownload
  } = useImageHandlers();

  // Mouse event handlers for watermark marking
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    
    try {
      event.preventDefault();
      event.stopPropagation();
      const selectedImageForEvent = images.find(img => img.id === imageId);
      if (!selectedImageForEvent) return;
      const { x, y } = getImageCoordinates(event);
      
      if (selectedImageForEvent.watermarkMark) {
        const mark = selectedImageForEvent.watermarkMark;
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
      updateImage(imageId, { watermarkMark: undefined });
      setDragState({ isDragging: true, startX: x, startY: y, currentX: x, currentY: y });
    } catch (error: any) {
      console.error('Mouse down handling error:', error);
    }
  }, [isMarkingMode, images, zoom, getImageCoordinates, getResizeHandle, setResizeState, setSelectedMark, setDragState, updateImage]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    const { x, y } = getImageCoordinates(event);
    
    if (!dragState.isDragging && !resizeState.isResizing) {
      const selectedImageForEvent = images.find(img => img.id === imageId);
      if (selectedImageForEvent?.watermarkMark) {
        const mark = selectedImageForEvent.watermarkMark;
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
      const selectedImageForEvent = images.find(img => img.id === imageId);
      if (selectedImageForEvent?.watermarkMark) {
        const mark = selectedImageForEvent.watermarkMark;
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
        updateImage(imageId, { watermarkMark: newMark });
      }
    } else if (dragState.isDragging) {
      if (selectedMark) {
        const selectedImageForEvent = images.find(img => img.id === imageId);
        if (selectedImageForEvent?.watermarkMark) {
          const mark = selectedImageForEvent.watermarkMark;
          const newX = Math.max(0, Math.min(1 - mark.width, x - dragState.startX));
          const newY = Math.max(0, Math.min(1 - mark.height, y - dragState.startY));
          updateImage(imageId, { watermarkMark: { ...mark, x: newX, y: newY } });
        }
      } else {
        setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
      }
    }
  }, [isMarkingMode, dragState, resizeState, selectedMark, images, zoom, getImageCoordinates, getResizeHandle, updateImage, setDragState]);

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
        updateImage(imageId, { watermarkMark: { x: left, y: top, width, height } });
        setSelectedMark(true);
      }
    }
    setDragState({ isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  }, [isMarkingMode, dragState, selectedMark, zoom, resizeState, setResizeState, setDragState, updateImage, setSelectedMark]);

  // Wrapper functions to maintain compatibility
  const handleMarkingToggleWrapper = () => handleMarkingToggle(selectedImage);
  const handleBatchApplyWatermarkWrapper = () => handleBatchApplyWatermark(selectedImage, selectedImageId);
  const handleBatchProcessWrapper = () => handleBatchProcess(images);
  const handleBatchDownloadWrapper = () => {
    if (handleBatchDownload(images)) {
      setIsBatchDownloadOpen(true);
    }
  };
  const handleZoomChangeWrapper = (newZoom: number) => {
    const validatedZoom = handleZoomChange(newZoom);
    if (validatedZoom !== null) {
      setZoom(validatedZoom);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col lg:flex-row relative">
        {/* 移动端侧边栏遮罩 */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* 侧边栏 - 响应式设计 */}
        <div className={`
          fixed lg:relative top-0 left-0 h-full z-50 lg:z-auto
          transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-80 lg:w-80 xl:w-96 flex-shrink-0
        `}>
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
            onBatchProcess={handleBatchProcessWrapper}
            onAlgorithmChange={setProcessingAlgorithm}
            onImageSelect={setSelectedImageId}
            onRemoveImage={removeImage}
            setSdApiKey={setSdApiKey}
            setIsApiConfigOpen={setIsApiConfigOpen}
            handleRemoveWatermark={handleRemoveWatermark}
            onCloseSidebar={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* 主内容区域 - 响应式布局 */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0 h-full">
          <Toolbar
            selectedImage={selectedImage}
            isMarkingMode={isMarkingMode}
            isProcessing={isProcessing}
            isBatchProcessing={isBatchProcessing}
            handleMarkingToggle={handleMarkingToggleWrapper}
            clearWatermarkMark={clearWatermarkMark}
            handleBatchApplyWatermark={handleBatchApplyWatermarkWrapper}
            restoreToOriginal={restoreToOriginal}
            handleRemoveWatermark={handleRemoveWatermark}
            handleDownload={handleDownload}
            handleBatchDownload={handleBatchDownloadWrapper}
            selectedImageId={processingSelectedImageId}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          
          {/* 图片展示区域 */}
          {selectedImage ? (
            <ImageGrid
              selectedImage={selectedImage}
              isProcessing={isProcessing}
              progress={progress}
              zoom={zoom}
              setZoom={handleZoomChangeWrapper}
              syncScroll={syncScroll}
              isMarkingMode={isMarkingMode}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              selectedMark={selectedMark}
              dragState={dragState}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
              <div className="text-center max-w-md">
                <p className="text-base md:text-lg mb-2">请从左侧列表中选择一张图片进行处理</p>
                <p className="text-sm text-gray-400">上传后将在此处看到图片对比</p>
                <button 
                  className="lg:hidden mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  打开图片列表
                </button>
              </div>
            </div>
          )}
          
          <BatchDownloadDialog 
            isOpen={isBatchDownloadOpen} 
            onClose={() => setIsBatchDownloadOpen(false)} 
            images={images} 
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WatermarkRemover;
