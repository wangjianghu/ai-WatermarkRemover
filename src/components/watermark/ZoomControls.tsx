
import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  disabled?: boolean;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  disabled = false
}) => {
  return (
    <div className="flex items-center space-x-1">
      <Button variant="ghost" size="sm" onClick={onZoomOut} className="h-6 w-6 p-0" disabled={disabled}>
        <ZoomOut className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onResetZoom} className="h-6 px-2 text-xs" disabled={disabled}>
        <RotateCcw className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onZoomIn} className="h-6 w-6 p-0" disabled={disabled}>
        <ZoomIn className="h-3 w-3" />
      </Button>
      <span className="text-xs text-gray-500 ml-1 hidden sm:inline">{Math.round(zoom * 100)}%</span>
    </div>
  );
};

export default ZoomControls;
