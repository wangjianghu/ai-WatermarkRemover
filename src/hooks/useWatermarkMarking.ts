
import { useState, useCallback } from 'react';
import { ImageItem, WatermarkMark, DragState, ResizeState, ResizeHandle } from '@/components/watermark/types';
import { toast } from 'sonner';
import { validateWatermarkMark } from '@/utils/apiSecurity';
import { handleSecureError } from '@/utils/secureErrorHandler';

export const useWatermarkMarking = (
  updateImage: (imageId: string, updates: Partial<ImageItem>) => void,
  updateImages: (updater: (prev: ImageItem[]) => ImageItem[]) => void
) => {
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [dragState, setDragState] = useState<DragState>({ 
    isDragging: false, startX: 0, startY: 0, currentX: 0, currentY: 0 
  });
  const [resizeState, setResizeState] = useState<ResizeState>({ 
    isResizing: false, resizeHandle: null, startX: 0, startY: 0 
  });
  const [selectedMark, setSelectedMark] = useState<boolean>(false);

  const getImageCoordinates = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return { x, y };
  }, []);
  
  const getResizeHandle = useCallback((x: number, y: number, mark: WatermarkMark): ResizeHandle | null => {
    const handleSize = Math.max(0.01, 0.02 / zoom);
    const handles = {
      'nw': { x: mark.x, y: mark.y },
      'ne': { x: mark.x + mark.width, y: mark.y },
      'sw': { x: mark.x, y: mark.y + mark.height },
      'se': { x: mark.x + mark.width, y: mark.y + mark.height },
      'n': { x: mark.x + mark.width / 2, y: mark.y },
      'e': { x: mark.x + mark.width, y: mark.y + mark.height / 2 },
      's': { x: mark.x + mark.width / 2, y: mark.y + mark.height },
      'w': { x: mark.x, y: mark.y + mark.height / 2 }
    } as const;
    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
        return handle as ResizeHandle;
      }
    }
    return null;
  }, [zoom]);

  const clearWatermarkMark = useCallback((imageId: string) => {
    try {
      updateImage(imageId, { 
        watermarkMark: undefined, 
        isMarkingCompleted: false 
      });
      setSelectedMark(false);
    } catch (error: any) {
      const errorMessage = handleSecureError(error, 'watermark-clear', 'low');
      toast.error(errorMessage, { duration: 1000 });
    }
  }, [updateImage]);

  const handleCompleteMarking = useCallback((imageId: string, selectedImage?: ImageItem) => {
    try {
      if (!selectedImage?.watermarkMark) {
        toast.error("请先标记水印位置", { duration: 1000 });
        return;
      }

      // Validate watermark mark
      const validation = validateWatermarkMark(selectedImage.watermarkMark);
      if (!validation.isValid) {
        toast.error(validation.error, { duration: 1000 });
        return;
      }

      updateImage(imageId, { isMarkingCompleted: true });
      setIsMarkingMode(false);
      setSelectedMark(false);
      toast.success("水印标记已完成，现在可以开始处理", { duration: 1000 });
    } catch (error: any) {
      const errorMessage = handleSecureError(error, 'marking-completion', 'medium');
      toast.error(errorMessage, { duration: 1000 });
    }
  }, [updateImage]);

  const handleMarkingToggle = useCallback((selectedImage?: ImageItem) => {
    if (isMarkingMode) {
      if (selectedImage?.watermarkMark) {
        handleCompleteMarking(selectedImage.id, selectedImage);
      } else {
        setIsMarkingMode(false);
        setSelectedMark(false);
      }
    } else {
      setIsMarkingMode(true);
      setSelectedMark(false);
      if (selectedImage?.isMarkingCompleted) {
        updateImage(selectedImage.id, { isMarkingCompleted: false });
      }
    }
  }, [isMarkingMode, handleCompleteMarking, updateImage]);

  const handleBatchApplyWatermark = useCallback((selectedImage?: ImageItem, selectedImageId?: string) => {
    const mark = selectedImage?.watermarkMark;
    if (!mark) {
      toast.error("当前图片没有标记水印", { duration: 800 });
      return;
    }
    updateImages(prev => prev.map(img => 
      img.id === selectedImageId ? img : { 
        ...img, 
        watermarkMark: { ...mark }, 
        isMarkingCompleted: false 
      }
    ));
    toast.success(`已将水印标记应用到其他图片，请分别确认完成标记`, { duration: 1500 });
  }, [updateImages]);

  return {
    isMarkingMode,
    zoom,
    setZoom,
    dragState,
    setDragState,
    resizeState,
    setResizeState,
    selectedMark,
    setSelectedMark,
    getImageCoordinates,
    getResizeHandle,
    clearWatermarkMark,
    handleMarkingToggle,
    handleBatchApplyWatermark
  };
};
