
import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface MobileViewToggleProps {
  viewMode: 'original' | 'processed';
  onViewModeChange: (mode: 'original' | 'processed') => void;
  hasProcessedImage: boolean;
  isProcessing: boolean;
}

const MobileViewToggle: React.FC<MobileViewToggleProps> = ({
  viewMode,
  onViewModeChange,
  hasProcessedImage,
  isProcessing
}) => {
  return (
    <div className="flex items-center justify-center mb-3 flex-shrink-0">
      <div className="flex bg-gray-100 rounded-lg p-1">
        <Button
          variant={viewMode === 'original' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('original')}
          className="text-xs px-3 py-1.5"
        >
          <Eye className="h-3 w-3 mr-1" />
          原图
        </Button>
        <Button
          variant={viewMode === 'processed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('processed')}
          disabled={!hasProcessedImage && !isProcessing}
          className="text-xs px-3 py-1.5"
        >
          <EyeOff className="h-3 w-3 mr-1" />
          处理后
        </Button>
      </div>
    </div>
  );
};

export default MobileViewToggle;
