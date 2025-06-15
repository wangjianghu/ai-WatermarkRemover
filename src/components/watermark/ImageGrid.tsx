
import React, { useRef, useState } from 'react';
import { ImageItem, DragState } from './types';
import ImageContainer from './ImageContainer';
import MobileViewToggle from './MobileViewToggle';
import ProcessingPlaceholder from './ProcessingPlaceholder';

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

  return (
    <div className="flex-1 p-2 sm:p-4 overflow-hidden flex flex-col">
      {/* 桌面端双栏布局 */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4 h-full">
        <ImageContainer
          type="original"
          selectedImage={selectedImage}
          isProcessing={isProcessing}
          progress={progress}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={resetZoom}
          onScroll={(scrollLeft, scrollTop) => syncScroll('original', scrollLeft, scrollTop)}
          scrollRef={originalScrollRef}
          allowInteraction={true}
          isMarkingMode={isMarkingMode}
          selectedMark={selectedMark}
          dragState={dragState}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        <ImageContainer
          type="processed"
          selectedImage={selectedImage}
          isProcessing={isProcessing}
          progress={progress}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={resetZoom}
          onScroll={(scrollLeft, scrollTop) => syncScroll('processed', scrollLeft, scrollTop)}
          scrollRef={processedScrollRef}
          allowInteraction={false}
          isMarkingMode={isMarkingMode}
          selectedMark={selectedMark}
          dragState={dragState}
        />
      </div>

      {/* 移动端单栏布局 */}
      <div className="lg:hidden flex flex-col h-full">
        <MobileViewToggle
          viewMode={mobileViewMode}
          onViewModeChange={setMobileViewMode}
          hasProcessedImage={Boolean(selectedImage.processedUrl)}
          isProcessing={isProcessing}
        />

        {/* 当前显示的图片容器 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mobileViewMode === 'original' ? (
            <ImageContainer
              type="original"
              selectedImage={selectedImage}
              isProcessing={isProcessing}
              progress={progress}
              zoom={zoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={resetZoom}
              onScroll={(scrollLeft, scrollTop) => syncScroll('original', scrollLeft, scrollTop)}
              scrollRef={originalScrollRef}
              allowInteraction={true}
              isMarkingMode={isMarkingMode}
              selectedMark={selectedMark}
              dragState={dragState}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          ) : selectedImage.processedUrl ? (
            <ImageContainer
              type="processed"
              selectedImage={selectedImage}
              isProcessing={isProcessing}
              progress={progress}
              zoom={zoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={resetZoom}
              onScroll={(scrollLeft, scrollTop) => syncScroll('processed', scrollLeft, scrollTop)}
              scrollRef={processedScrollRef}
              allowInteraction={false}
              isMarkingMode={isMarkingMode}
              selectedMark={selectedMark}
              dragState={dragState}
            />
          ) : (
            <ProcessingPlaceholder
              isProcessing={isProcessing}
              progress={progress}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageGrid;
