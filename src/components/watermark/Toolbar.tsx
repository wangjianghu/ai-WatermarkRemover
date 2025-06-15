
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, MapPin, Undo2, Copy, Menu } from 'lucide-react';
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
  onToggleSidebar?: () => void;
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
  onToggleSidebar,
}) => {
  return (
    <div className="p-3 lg:p-4 bg-white border-b flex-shrink-0">
      <div className="flex flex-col space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* 左侧标题和菜单按钮 */}
          <div className="flex items-center gap-2">
            {onToggleSidebar && (
              <Button 
                variant="outline" 
                size="sm" 
                className="lg:hidden"
                onClick={onToggleSidebar}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-base lg:text-lg font-semibold whitespace-nowrap">图片处理结果</h2>
          </div>
          
          {/* 右侧状态指示器 */}
          {isBatchProcessing && (
            <div className="flex items-center space-x-2 whitespace-nowrap">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-600 hidden sm:inline">批量处理中...</span>
            </div>
          )}
        </div>

        {/* 操作按钮区域 - 响应式布局 */}
        {selectedImage && (
          <div className="flex flex-wrap items-center gap-1 lg:gap-2 min-w-0">
            {/* 第一排按钮 */}
            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
              <Button 
                variant={isMarkingMode ? "default" : "outline"} 
                size="sm" 
                onClick={handleMarkingToggle} 
                className="text-xs whitespace-nowrap" 
                disabled={isBatchProcessing}
              >
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">
                  {isMarkingMode ? '完成标记' : (selectedImage.isMarkingCompleted ? '重新标记' : '标记水印')}
                </span>
                <span className="sm:hidden">
                  {isMarkingMode ? '完成' : '标记'}
                </span>
              </Button>
              
              {selectedImage.watermarkMark && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => clearWatermarkMark(selectedImage.id)} 
                  className="text-xs whitespace-nowrap" 
                  disabled={isBatchProcessing}
                >
                  <span className="hidden sm:inline">清除标记</span>
                  <span className="sm:hidden">清除</span>
                </Button>
              )}
              
              {selectedImage.watermarkMark && selectedImage.isMarkingCompleted && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBatchApplyWatermark} 
                  className="text-xs whitespace-nowrap" 
                  disabled={isBatchProcessing}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">批量应用</span>
                  <span className="sm:hidden">应用</span>
                </Button>
              )}
            </div>

            {/* 第二排按钮 */}
            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
              {selectedImage.processedUrl && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => restoreToOriginal(selectedImage.id)} 
                  className="text-xs whitespace-nowrap" 
                  disabled={isBatchProcessing}
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">还原原图</span>
                  <span className="sm:hidden">还原</span>
                </Button>
              )}
              
              <ProcessButton 
                imageItem={selectedImage} 
                onClick={handleRemoveWatermark} 
                isProcessing={isProcessing} 
                isBatchProcessing={isBatchProcessing} 
                selectedImageId={selectedImageId} 
              />
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDownload(selectedImage)} 
                className="text-xs whitespace-nowrap" 
                disabled={isBatchProcessing}
              >
                <Download className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">下载</span>
                <span className="sm:hidden">下载</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBatchDownload} 
                className="text-xs whitespace-nowrap" 
                disabled={isBatchProcessing}
              >
                <Download className="h-3 w-3 mr-1" />
                <span className="hidden lg:inline">批量下载</span>
                <span className="lg:hidden">批量</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
