
import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react';
import { ImageItem } from './types';
import ProcessButton from './ProcessButton';

interface ImageListProps {
  images: ImageItem[];
  selectedImageId: string | null;
  isBatchProcessing: boolean;
  batchProgress: { [key: string]: number };
  isProcessing: boolean;
  onImageSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  handleRemoveWatermark: (imageItem: ImageItem) => void;
  onCloseSidebar?: () => void;
}

const ImageList: React.FC<ImageListProps> = ({
  images,
  selectedImageId,
  isBatchProcessing,
  batchProgress,
  isProcessing,
  onImageSelect,
  onRemoveImage,
  handleRemoveWatermark,
  onCloseSidebar,
}) => {
  const handleImageSelect = (id: string) => {
    onImageSelect(id);
    // 移动端选择图片后自动关闭侧边栏
    if (onCloseSidebar && window.innerWidth < 1024) {
      onCloseSidebar();
    }
  };

  return (
    <ScrollArea className="flex-1 mt-3">
      <div className="space-y-2">
        {images.map(image => (
          <div 
            key={image.id} 
            className={`flex items-center justify-between p-2 lg:p-3 border rounded-md cursor-pointer transition-colors ${
              selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
            }`} 
            onClick={() => handleImageSelect(image.id)}
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm truncate block" title={image.file.name}>
                {image.file.name}
              </span>
              <span className="text-xs text-gray-500">
                {image.processedUrl ? `已处理${image.processCount}次` : '未处理'}
                {image.watermarkMark ? (image.isMarkingCompleted ? ' • 已完成标记' : ' • 已标记未确认') : ' • 未标记'}
                {isBatchProcessing && batchProgress[image.id] !== undefined && (
                  <>
                    {batchProgress[image.id] === -1 ? ' • 处理失败' : batchProgress[image.id] === 100 ? ' • 处理完成' : ` • 处理中 ${batchProgress[image.id]}%`}
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center space-x-1 lg:space-x-2 ml-2 flex-shrink-0">
              <ProcessButton 
                imageItem={image} 
                isListItem={true} 
                onClick={handleRemoveWatermark} 
                isProcessing={isProcessing} 
                isBatchProcessing={isBatchProcessing} 
                selectedImageId={selectedImageId} 
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={e => { 
                  e.stopPropagation(); 
                  onRemoveImage(image.id); 
                }} 
                className="text-xs p-1 lg:p-2" 
                disabled={isBatchProcessing}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default ImageList;
