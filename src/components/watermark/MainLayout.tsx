
import React from 'react';
import { ImageItem } from './types';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import ImageGrid from './ImageGrid';
import EmptyState from './EmptyState';
import BatchDownloadDialog from '../BatchDownloadDialog';

interface MainLayoutProps {
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  onToggleSidebar: () => void;
  // Sidebar props
  images: ImageItem[];
  selectedImageId: string | null;
  processingAlgorithm: any;
  isProcessing: boolean;
  isBatchProcessing: boolean;
  batchProgress: { [key: string]: number };
  sdApiKey: string;
  isApiConfigOpen: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBatchProcess: () => void;
  onAlgorithmChange: (value: any) => void;
  onImageSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  setSdApiKey: (key: string) => void;
  setIsApiConfigOpen: (isOpen: boolean) => void;
  handleRemoveWatermark: (item: ImageItem) => void;
  // Toolbar props
  selectedImage: ImageItem | undefined;
  isMarkingMode: boolean;
  handleMarkingToggle: () => void;
  clearWatermarkMark: (id: string) => void;
  handleBatchApplyWatermark: () => void;
  restoreToOriginal: (id: string) => void;
  handleDownload: (item: ImageItem) => void;
  handleBatchDownload: () => void;
  processingSelectedImageId: string | null;
  // ImageGrid props
  progress: number;
  zoom: number;
  setZoom: (zoom: number) => void;
  syncScroll: (source: 'original' | 'processed', scrollLeft: number, scrollTop: number) => void;
  handleMouseDown: (event: React.MouseEvent<HTMLImageElement>, imageId: string) => void;
  handleMouseMove: (event: React.MouseEvent<HTMLImageElement>, imageId: string) => void;
  handleMouseUp: (event: React.MouseEvent<HTMLImageElement>, imageId: string) => void;
  selectedMark: boolean;
  dragState: any;
  // Batch download
  isBatchDownloadOpen: boolean;
  setIsBatchDownloadOpen: (isOpen: boolean) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  isSidebarOpen,
  onCloseSidebar,
  onToggleSidebar,
  selectedImage,
  images,
  selectedImageId,
  processingAlgorithm,
  isProcessing,
  isBatchProcessing,
  batchProgress,
  sdApiKey,
  isApiConfigOpen,
  onFileUpload,
  onBatchProcess,
  onAlgorithmChange,
  onImageSelect,
  onRemoveImage,
  setSdApiKey,
  setIsApiConfigOpen,
  handleRemoveWatermark,
  isMarkingMode,
  handleMarkingToggle,
  clearWatermarkMark,
  handleBatchApplyWatermark,
  restoreToOriginal,
  handleDownload,
  handleBatchDownload,
  processingSelectedImageId,
  progress,
  zoom,
  setZoom,
  syncScroll,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  selectedMark,
  dragState,
  isBatchDownloadOpen,
  setIsBatchDownloadOpen,
}) => {
  return (
    <div className="h-full flex flex-col lg:flex-row relative">
      {/* 移动端侧边栏遮罩 */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={onCloseSidebar}
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
          onFileUpload={onFileUpload}
          onBatchProcess={onBatchProcess}
          onAlgorithmChange={onAlgorithmChange}
          onImageSelect={onImageSelect}
          onRemoveImage={onRemoveImage}
          setSdApiKey={setSdApiKey}
          setIsApiConfigOpen={setIsApiConfigOpen}
          handleRemoveWatermark={handleRemoveWatermark}
          onCloseSidebar={onCloseSidebar}
        />
      </div>

      {/* 主内容区域 - 响应式布局 */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0 h-full">
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
          selectedImageId={processingSelectedImageId}
          onToggleSidebar={onToggleSidebar}
        />
        
        {/* 图片展示区域 */}
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
          <EmptyState onToggleSidebar={onToggleSidebar} />
        )}
        
        <BatchDownloadDialog 
          isOpen={isBatchDownloadOpen} 
          onClose={() => setIsBatchDownloadOpen(false)} 
          images={images} 
        />
      </div>
    </div>
  );
};

export default MainLayout;
