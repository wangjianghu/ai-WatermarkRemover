
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { ImageItem, WatermarkMark, DragState, ResizeState, ResizeHandle } from './types';

interface ImageGridProps {
  selectedImage: ImageItem;
  isProcessing: boolean;
  progress: number;
  zoom: number;
  setZoom: (update: React.SetStateAction<number>) => void;
  syncScroll: (source: 'original' | 'processed', scrollLeft: number, scrollTop: number) => void;
  isMarkingMode: boolean;
  handleMouseDown: (e: React.MouseEvent<HTMLImageElement>, id: string) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLImageElement>, id: string) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLImageElement>, id: string) => void;
  selectedMark: boolean;
  dragState: DragState;
}

const ImageGrid: React.FC<ImageGridProps> = ({
  selectedImage,
  isProcessing,
  progress,
  zoom,
  setZoom,
  syncScroll,
  isMarkingMode,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  selectedMark,
  dragState,
}) => {
  const originalScrollRef = useRef<HTMLDivElement>(null);
  const processedScrollRef = useRef<HTMLDivElement>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'original' | 'processed'>('original');

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1));
  const resetZoom = () => setZoom(1);

  const renderWatermarkMark = (mark?: WatermarkMark) => {
    if (!mark) return null;
    return (
      <div className="absolute pointer-events-none transition-all duration-150 ease-out" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.width * 100}%`, height: `${mark.height * 100}%` }}>
        <div className={`absolute inset-0 ${isMarkingMode ? 'bg-transparent' : 'bg-blue-500 bg-opacity-10'} transition-colors duration-200`} />
        <div className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-sm opacity-90 transition-all duration-200" style={{ borderWidth: `${Math.max(1, 2 / zoom)}px` }} />
        {selectedMark && isMarkingMode && (
          <>
            {[{ pos: 'nw', style: { top: -1, left: -1 }, cursor: 'nw-resize' }, { pos: 'ne', style: { top: -1, right: -1 }, cursor: 'ne-resize' }, { pos: 'sw', style: { bottom: -1, left: -1 }, cursor: 'sw-resize' }, { pos: 'se', style: { bottom: -1, right: -1 }, cursor: 'se-resize' }, { pos: 'n', style: { top: -0.5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' }, { pos: 'e', style: { right: -0.5, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' }, { pos: 's', style: { bottom: -0.5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' }, { pos: 'w', style: { left: -0.5, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' }].map(({ pos, style, cursor }) => (
              <div key={pos} className="absolute bg-blue-600 border-2 border-white rounded-full pointer-events-auto hover:bg-blue-700 hover:scale-110 transition-all duration-150 shadow-lg" style={{ ...style, width: `${Math.max(8, 12 / zoom)}px`, height: `${Math.max(8, 12 / zoom)}px`, cursor }} />
            ))}
          </>
        )}
      </div>
    );
  };

  const renderDragPreview = () => {
    if (!isMarkingMode || !dragState.isDragging || selectedMark) return null;
    const { startX, startY, currentX, currentY } = dragState;
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    return <div className="absolute border-2 border-dashed border-blue-500 bg-transparent pointer-events-none transition-all duration-75 rounded-sm" style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`, borderWidth: `${Math.max(1, 2 / zoom)}px` }} />;
  };

  const renderImageContainer = (
    type: 'original' | 'processed',
    url: string,
    title: string,
    allowInteraction: boolean = false
  ) => (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-600">{title}</span>
          {isProcessing && type === 'original' && (
            <div className="flex items-center space-x-2">
              <Progress value={progress} className="w-16 sm:w-20 h-2" />
              <span className="text-xs text-gray-500 hidden sm:inline">{progress}%</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-6 w-6 p-0" disabled={type === 'processed' && !selectedImage.processedUrl}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom} className="h-6 px-2 text-xs" disabled={type === 'processed' && !selectedImage.processedUrl}>
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-6 w-6 p-0" disabled={type === 'processed' && !selectedImage.processedUrl}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div 
        ref={type === 'original' ? originalScrollRef : processedScrollRef}
        className="flex-1 relative bg-white rounded-lg border overflow-auto min-h-0" 
        onScroll={e => { 
          const target = e.target as HTMLDivElement; 
          syncScroll(type, target.scrollLeft, target.scrollTop); 
        }}
      >
        <div className="p-2 sm:p-4 flex items-center justify-center min-h-full">
          <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
            <img 
              src={url} 
              alt={title} 
              className={`block object-contain transition-transform duration-200 ease-out max-w-none ${allowInteraction && isMarkingMode ? 'cursor-crosshair' : ''}`} 
              onMouseDown={allowInteraction ? e => handleMouseDown(e, selectedImage.id) : undefined}
              onMouseMove={allowInteraction ? e => handleMouseMove(e, selectedImage.id) : undefined}
              onMouseUp={allowInteraction ? e => handleMouseUp(e, selectedImage.id) : undefined}
              draggable={false} 
            />
            {allowInteraction && renderWatermarkMark(selectedImage.watermarkMark)}
            {allowInteraction && renderDragPreview()}
          </div>
        </div>
      </div>
    </div>
  );

  // 桌面端双栏布局
  const renderDesktopLayout = () => (
    <div className="hidden lg:grid lg:grid-cols-2 gap-4 h-full">
      {renderImageContainer('original', selectedImage.url, '原图', true)}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-sm font-medium text-gray-600">处理后</span>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-6 w-6 p-0" disabled={!selectedImage.processedUrl}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetZoom} className="h-6 px-2 text-xs" disabled={!selectedImage.processedUrl}>
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-6 w-6 p-0" disabled={!selectedImage.processedUrl}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <span className="text-xs text-gray-500 ml-2">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
        <div 
          ref={processedScrollRef}
          className="flex-1 relative bg-white rounded-lg border overflow-auto min-h-0" 
          onScroll={e => { 
            const target = e.target as HTMLDivElement; 
            syncScroll('processed', target.scrollLeft, target.scrollTop); 
          }}
        >
          {selectedImage.processedUrl ? (
            <div className="p-4 flex items-center justify-center min-h-full">
              <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                <img src={selectedImage.processedUrl} alt="处理后" className="block object-contain max-w-none" draggable={false} />
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
    </div>
  );

  // 移动端单栏布局
  const renderMobileLayout = () => (
    <div className="lg:hidden flex flex-col h-full">
      {/* 移动端切换按钮 */}
      <div className="flex items-center justify-center mb-3 flex-shrink-0">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <Button
            variant={mobileViewMode === 'original' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMobileViewMode('original')}
            className="text-xs px-3 py-1.5"
          >
            <Eye className="h-3 w-3 mr-1" />
            原图
          </Button>
          <Button
            variant={mobileViewMode === 'processed' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMobileViewMode('processed')}
            disabled={!selectedImage.processedUrl}
            className="text-xs px-3 py-1.5"
          >
            <EyeOff className="h-3 w-3 mr-1" />
            处理后
          </Button>
        </div>
      </div>

      {/* 当前显示的图片 */}
      {mobileViewMode === 'original' ? 
        renderImageContainer('original', selectedImage.url, '原图', true) : 
        (selectedImage.processedUrl ? 
          renderImageContainer('processed', selectedImage.processedUrl, '处理后', false) :
          <div className="flex-1 flex items-center justify-center bg-white rounded-lg border">
            <div className="text-center text-gray-400">
              {isProcessing ? (
                <div>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <div className="text-sm">正在处理...</div>
                  <Progress value={progress} className="w-32 h-2 mx-auto mt-2" />
                  <div className="text-xs mt-1">{progress}%</div>
                </div>
              ) : (
                <div className="text-sm">等待处理</div>
              )}
            </div>
          </div>
        )
      }
    </div>
  );

  return (
    <div className="flex-1 p-2 sm:p-4 min-h-0 overflow-hidden">
      {renderDesktopLayout()}
      {renderMobileLayout()}
    </div>
  );
};

export default ImageGrid;
