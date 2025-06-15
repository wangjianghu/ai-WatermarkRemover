
import React from 'react';
import { X } from 'lucide-react';
import { ImageItem, ProcessingAlgorithm } from './types';
import UploadSection from './UploadSection';
import AlgorithmSelector from './AlgorithmSelector';
import ImageList from './ImageList';

interface SidebarProps {
  images: ImageItem[];
  selectedImageId: string | null;
  processingAlgorithm: ProcessingAlgorithm;
  isProcessing: boolean;
  isBatchProcessing: boolean;
  batchProgress: { [key: string]: number };
  sdApiKey: string;
  isApiConfigOpen: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBatchProcess: () => void;
  onAlgorithmChange: (value: ProcessingAlgorithm) => void;
  onImageSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  setSdApiKey: (key: string) => void;
  setIsApiConfigOpen: (isOpen: boolean) => void;
  handleRemoveWatermark: (imageItem: ImageItem) => void;
  onCloseSidebar?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
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
  onCloseSidebar,
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-white border-r lg:border-r-gray-200">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">图片处理工具</h3>
        {onCloseSidebar && (
          <button 
            onClick={onCloseSidebar}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-3 lg:p-4 min-h-0">
        {/* 上传区域 - 响应式设计 */}
        <UploadSection
          images={images}
          isProcessing={isProcessing}
          isBatchProcessing={isBatchProcessing}
          onFileUpload={onFileUpload}
          onBatchProcess={onBatchProcess}
        />

        {/* 算法选择区域 - 响应式布局 */}
        <div className="mt-3">
          <AlgorithmSelector
            processingAlgorithm={processingAlgorithm}
            sdApiKey={sdApiKey}
            isApiConfigOpen={isApiConfigOpen}
            onAlgorithmChange={onAlgorithmChange}
            setSdApiKey={setSdApiKey}
            setIsApiConfigOpen={setIsApiConfigOpen}
          />
        </div>

        {/* 图片列表 - 响应式滚动区域 */}
        <ImageList
          images={images}
          selectedImageId={selectedImageId}
          isBatchProcessing={isBatchProcessing}
          batchProgress={batchProgress}
          isProcessing={isProcessing}
          onImageSelect={onImageSelect}
          onRemoveImage={onRemoveImage}
          handleRemoveWatermark={handleRemoveWatermark}
          onCloseSidebar={onCloseSidebar}
        />
      </div>
    </div>
  );
};

export default Sidebar;
