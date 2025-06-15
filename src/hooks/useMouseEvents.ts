
import { useCallback } from 'react';
import { ImageItem } from '@/components/watermark/types';

interface UseMouseEventsProps {
  isMarkingMode: boolean;
  images: ImageItem[];
  zoom: number;
  selectedMark: boolean;
  dragState: any;
  resizeState: any;
  getImageCoordinates: (event: React.MouseEvent<HTMLImageElement>) => { x: number; y: number };
  getResizeHandle: (x: number, y: number, mark: any) => string | null;
  setResizeState: (state: any) => void;
  setSelectedMark: (selected: boolean) => void;
  setDragState: (state: any) => void;
  updateImage: (imageId: string, updates: Partial<ImageItem>) => void;
}

export const useMouseEvents = ({
  isMarkingMode,
  images,
  zoom,
  selectedMark,
  dragState,
  resizeState,
  getImageCoordinates,
  getResizeHandle,
  setResizeState,
  setSelectedMark,
  setDragState,
  updateImage,
}: UseMouseEventsProps) => {
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    
    try {
      event.preventDefault();
      event.stopPropagation();
      const selectedImageForEvent = images.find(img => img.id === imageId);
      if (!selectedImageForEvent) return;
      const { x, y } = getImageCoordinates(event);
      
      if (selectedImageForEvent.watermarkMark) {
        const mark = selectedImageForEvent.watermarkMark;
        const handle = getResizeHandle(x, y, mark);
        if (handle) {
          setResizeState({ isResizing: true, resizeHandle: handle, startX: x, startY: y });
          setSelectedMark(true);
          return;
        }
        if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
          setSelectedMark(true);
          setDragState({ isDragging: true, startX: x - mark.x, startY: y - mark.y, currentX: x, currentY: y });
          return;
        }
      }
      setSelectedMark(false);
      updateImage(imageId, { watermarkMark: undefined });
      setDragState({ isDragging: true, startX: x, startY: y, currentX: x, currentY: y });
    } catch (error: any) {
      console.error('Mouse down handling error:', error);
    }
  }, [isMarkingMode, images, zoom, getImageCoordinates, getResizeHandle, setResizeState, setSelectedMark, setDragState, updateImage]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    const { x, y } = getImageCoordinates(event);
    
    if (!dragState.isDragging && !resizeState.isResizing) {
      const selectedImageForEvent = images.find(img => img.id === imageId);
      if (selectedImageForEvent?.watermarkMark) {
        const mark = selectedImageForEvent.watermarkMark;
        const handle = getResizeHandle(x, y, mark);
        const target = event.currentTarget;
        if (handle) {
          const cursors = { 'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize', 'n': 'ns-resize', 's': 'ns-resize', 'e': 'ew-resize', 'w': 'ew-resize' };
          target.style.cursor = cursors[handle];
        } else if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
          target.style.cursor = 'move';
        } else {
          target.style.cursor = 'crosshair';
        }
      } else {
        event.currentTarget.style.cursor = 'crosshair';
      }
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    if (resizeState.isResizing && resizeState.resizeHandle) {
      const selectedImageForEvent = images.find(img => img.id === imageId);
      if (selectedImageForEvent?.watermarkMark) {
        const mark = selectedImageForEvent.watermarkMark;
        let newMark = { ...mark };
        const minSize = Math.max(0.01, 0.015 / zoom);
        
        switch (resizeState.resizeHandle) {
          case 'se': newMark.width = Math.max(minSize, x - mark.x); newMark.height = Math.max(minSize, y - mark.y); break;
          case 'nw': const newWidth = mark.width + (mark.x - x); const newHeight = mark.height + (mark.y - y); if (newWidth > minSize && newHeight > minSize) { newMark.x = x; newMark.y = y; newMark.width = newWidth; newMark.height = newHeight; } break;
          case 'ne': const neWidth = Math.max(minSize, x - mark.x); const neHeight = mark.height + (mark.y - y); if (neHeight > minSize) { newMark.y = y; newMark.width = neWidth; newMark.height = neHeight; } break;
          case 'sw': const swWidth = mark.width + (mark.x - x); const swHeight = Math.max(minSize, y - mark.y); if (swWidth > minSize) { newMark.x = x; newMark.width = swWidth; newMark.height = swHeight; } break;
          case 'n': const nHeight = mark.height + (mark.y - y); if (nHeight > minSize) { newMark.y = y; newMark.height = nHeight; } break;
          case 's': newMark.height = Math.max(minSize, y - mark.y); break;
          case 'e': newMark.width = Math.max(minSize, x - mark.x); break;
          case 'w': const wWidth = mark.width + (mark.x - x); if (wWidth > minSize) { newMark.x = x; newMark.width = wWidth; } break;
        }
        updateImage(imageId, { watermarkMark: newMark });
      }
    } else if (dragState.isDragging) {
      if (selectedMark) {
        const selectedImageForEvent = images.find(img => img.id === imageId);
        if (selectedImageForEvent?.watermarkMark) {
          const mark = selectedImageForEvent.watermarkMark;
          const newX = Math.max(0, Math.min(1 - mark.width, x - dragState.startX));
          const newY = Math.max(0, Math.min(1 - mark.height, y - dragState.startY));
          updateImage(imageId, { watermarkMark: { ...mark, x: newX, y: newY } });
        }
      } else {
        setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
      }
    }
  }, [isMarkingMode, dragState, resizeState, selectedMark, images, zoom, getImageCoordinates, getResizeHandle, updateImage, setDragState]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.style.cursor = 'crosshair';
    
    if (resizeState.isResizing) {
      setResizeState({ isResizing: false, resizeHandle: null, startX: 0, startY: 0 });
      return;
    }
    
    if (dragState.isDragging && !selectedMark) {
      const { startX, startY, currentX, currentY } = dragState;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const minSize = Math.max(0.01, 0.015 / zoom);
      
      if (width > minSize && height > minSize) {
        updateImage(imageId, { watermarkMark: { x: left, y: top, width, height } });
        setSelectedMark(true);
      }
    }
    setDragState({ isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  }, [isMarkingMode, dragState, selectedMark, zoom, resizeState, setResizeState, setDragState, updateImage, setSelectedMark]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
};
