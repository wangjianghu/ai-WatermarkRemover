
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { ImageItem, DragState } from './types';
import ZoomControls from './ZoomControls';
import WatermarkOverlay from './WatermarkOverlay';

interface ImageContainerProps {
  type: 'original' | 'processed';
  selectedImage: ImageItem;
  isProcessing: boolean;
  progress: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onScroll: (scrollLeft: number, scrollTop: number) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  allowInteraction?: boolean;
  isMarkingMode: boolean;
  selectedMark: boolean;
  dragState: DragState;
  onMouseDown?: (e: React.MouseEvent<HTMLImageElement>, id: string) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLImageElement>, id: string) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLImageElement>, id: string) => void;
}

const ImageContainer: React.FC<ImageContainerProps> = ({
  type,
  selectedImage,
  isProcessing,
  progress,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onScroll,
  scrollRef,
  allowInteraction = false,
  isMarkingMode,
  selectedMark,
  dragState,
  onMouseDown,
  onMouseMove,
  onMouseUp
}) => {
  const url = type === 'original' ? selectedImage.url : selectedImage.processedUrl;
  const title = type === 'original' ? '原图' : '处理后';
  const hasProcessedUrl = Boolean(selectedImage.processedUrl);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs sm:text-sm font-medium text-gray-600">{title}</span>
          {isProcessing && type === 'original' && (
            <div className="flex items-center space-x-2">
              <Progress value={progress} className="w-12 sm:w-16 h-2" />
              <span className="text-xs text-gray-500 hidden sm:inline">{progress}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <ZoomControls
            zoom={zoom}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onResetZoom={onResetZoom}
            disabled={type === 'processed' && !hasProcessedUrl}
          />
          <span className="text-xs text-gray-500 ml-1 hidden sm:inline">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 relative bg-white rounded-lg border overflow-auto" 
        onScroll={e => { 
          const target = e.target as HTMLDivElement; 
          onScroll(target.scrollLeft, target.scrollTop); 
        }}
      >
        {url ? (
          <div className="p-2 sm:p-4 flex items-center justify-center min-h-full">
            <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
              <img 
                src={url} 
                alt={title} 
                className={`block object-contain transition-transform duration-200 ease-out max-w-none ${allowInteraction && isMarkingMode ? 'cursor-crosshair' : ''}`} 
                onMouseDown={allowInteraction && onMouseDown ? e => onMouseDown(e, selectedImage.id) : undefined}
                onMouseMove={allowInteraction && onMouseMove ? e => onMouseMove(e, selectedImage.id) : undefined}
                onMouseUp={allowInteraction && onMouseUp ? e => onMouseUp(e, selectedImage.id) : undefined}
                draggable={false} 
              />
              {allowInteraction && (
                <WatermarkOverlay
                  mark={selectedImage.watermarkMark}
                  isMarkingMode={isMarkingMode}
                  selectedMark={selectedMark}
                  zoom={zoom}
                  dragState={dragState}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            {isProcessing ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <div className="text-xs">正在处理...</div>
              </div>
            ) : (
              '等待处理'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageContainer;
