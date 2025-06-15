
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, MapPin, Undo2, Copy } from 'lucide-react';
import { ImageItem } from './types';
import ProcessButton from './ProcessButton';

interface ToolbarProps {
  selectedImage: ImageItem | undefined;
  isMarkingMode: boolean;
  isProcessing: boolean;
  isBatchProcessing: boolean;
  handleMarkingToggle: () => void;
  clearWatermarkMark: (id: string) => void;
  handleBatchApplyWatermark: () => void;
  restoreToOriginal: (id: string) => void;
  handleRemoveWatermark: (item: ImageItem) => void;
  handleDownload: (item: ImageItem) => void;
  handleBatchDownload: () => void;
  selectedImageId: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedImage,
  isMarkingMode,
  isProcessing,
  isBatchProcessing,
  handleMarkingToggle,
  clearWatermarkMark,
  handleBatchApplyWatermark,
  restoreToOriginal,
  handleRemoveWatermark,
  handleDownload,
  handleBatchDownload,
  selectedImageId,
}) => {
  return (
    <div className="p-4 bg-white border-b flex-shrink-0">
      <div className="flex flex-col space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold whitespace-nowrap">图片处理结果</h2>
          <div className="flex items-center gap-2">
            {isBatchProcessing && (
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-600">批量处理中...</span>
              </div>
            )}
            {selectedImage && (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Button variant={isMarkingMode ? "default" : "outline"} size="sm" onClick={handleMarkingToggle} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                  <MapPin className="h-3 w-3 mr-1" />
                  {isMarkingMode ? '完成标记' : (selectedImage.isMarkingCompleted ? '重新标记' : '标记水印')}
                </Button>
                {selectedImage.watermarkMark && (
                  <Button variant="outline" size="sm" onClick={() => clearWatermarkMark(selectedImage.id)} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>清除标记</Button>
                )}
                {selectedImage.watermarkMark && selectedImage.isMarkingCompleted && (
                  <Button variant="outline" size="sm" onClick={handleBatchApplyWatermark} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}><Copy className="h-3 w-3 mr-1" />批量应用</Button>
                )}
                {selectedImage.processedUrl && (
                  <Button variant="outline" size="sm" onClick={() => restoreToOriginal(selectedImage.id)} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}><Undo2 className="h-3 w-3 mr-1" />还原原图</Button>
                )}
                <ProcessButton imageItem={selectedImage} onClick={handleRemoveWatermark} isProcessing={isProcessing} isBatchProcessing={isBatchProcessing} selectedImageId={selectedImageId} />
                <Button variant="outline" size="sm" onClick={() => handleDownload(selectedImage)} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}><Download className="h-3 w-3 mr-1" />下载</Button>
                <Button variant="outline" size="sm" onClick={handleBatchDownload} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}><Download className="h-3 w-3 mr-1" />批量下载</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
