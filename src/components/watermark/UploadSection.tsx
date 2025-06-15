
import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Play } from 'lucide-react';
import { ImageItem } from './types';

interface UploadSectionProps {
  images: ImageItem[];
  isProcessing: boolean;
  isBatchProcessing: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBatchProcess: () => void;
}

const UploadSection: React.FC<UploadSectionProps> = ({
  images,
  isProcessing,
  isBatchProcessing,
  onFileUpload,
  onBatchProcess,
}) => {
  const markedImages = images.filter(img => img.watermarkMark && img.isMarkingCompleted);

  return (
    <div className="space-y-3 flex-shrink-0">
      <div className="text-center">
        <input 
          type="file" 
          accept="image/*" 
          multiple 
          onChange={onFileUpload} 
          className="hidden" 
          id="file-upload" 
        />
        <label htmlFor="file-upload">
          <Button variant="outline" className="w-full text-sm" asChild>
            <span className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              上传图片
            </span>
          </Button>
        </label>
      </div>

      {images.length > 0 && (
        <Button
          onClick={onBatchProcess}
          disabled={isProcessing || isBatchProcessing || markedImages.length === 0}
          className="w-full text-xs"
          variant="default"
        >
          <Play className="h-4 w-4 mr-2" />
          {isBatchProcessing ? '批量处理中...' : `批量处理已完成标记图片 (${markedImages.length})`}
        </Button>
      )}
    </div>
  );
};

export default UploadSection;
