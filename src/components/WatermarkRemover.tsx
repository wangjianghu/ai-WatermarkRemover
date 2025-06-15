
import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

import MainLayout from './watermark/MainLayout';

import { useImageState } from '@/hooks/useImageState';
import { useWatermarkMarking } from '@/hooks/useWatermarkMarking';
import { useImageProcessing } from '@/hooks/useImageProcessing';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useImageHandlers } from '@/hooks/useImageHandlers';
import { useMouseEvents } from '@/hooks/useMouseEvents';

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
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useMouseEvents({
    isMarkingMode,
    images,
    zoom,
    selectedMark,
    dragState,
    resizeState,
    getImageCoordinates,
    getResizeHandle,
    setResizeState,
    setSelectedMark,
    setDragState,
    updateImage,
  });

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
      <MainLayout
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        // Sidebar props
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
        // Toolbar props
        selectedImage={selectedImage}
        isMarkingMode={isMarkingMode}
        handleMarkingToggle={handleMarkingToggleWrapper}
        clearWatermarkMark={clearWatermarkMark}
        handleBatchApplyWatermark={handleBatchApplyWatermarkWrapper}
        restoreToOriginal={restoreToOriginal}
        handleDownload={handleDownload}
        handleBatchDownload={handleBatchDownloadWrapper}
        processingSelectedImageId={processingSelectedImageId}
        // ImageGrid props
        progress={progress}
        zoom={zoom}
        setZoom={handleZoomChangeWrapper}
        syncScroll={syncScroll}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        selectedMark={selectedMark}
        dragState={dragState}
        // Batch download
        isBatchDownloadOpen={isBatchDownloadOpen}
        setIsBatchDownloadOpen={setIsBatchDownloadOpen}
      />
    </TooltipProvider>
  );
};

export default WatermarkRemover;
