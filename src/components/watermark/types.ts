
export interface ImageItem {
  id: string;
  file: File;
  url: string;
  processedUrl: string | null;
  rotation: number;
  dimensions?: {
    width: number;
    height: number;
  };
  watermarkMark?: WatermarkMark;
  processCount: number;
  isMarkingCompleted: boolean;
}

export interface WatermarkMark {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w';

export interface ResizeState {
  isResizing: boolean;
  resizeHandle: ResizeHandle | null;
  startX: number;
  startY: number;
}

