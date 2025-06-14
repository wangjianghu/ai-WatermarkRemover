import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Upload, Download, Trash2, MapPin, RefreshCw, Settings, ZoomIn, ZoomOut, RotateCcw, Undo2, Sparkles, Info, Copy, Play, Ban } from 'lucide-react';
import { toast } from 'sonner';
import BatchDownloadDialog from './BatchDownloadDialog';
import { processWithSDInpainting } from './SDInpaintingProcessor';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  processedUrl: string | null;
  rotation: number;
  dimensions?: {
    width: number;
    height: number;
  };
  watermarkMark?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  processCount: number;
  isMarkingCompleted: boolean; // 新增：标记是否已完成
}
interface WatermarkMark {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}
interface ResizeState {
  isResizing: boolean;
  resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w' | null;
  startX: number;
  startY: number;
}
const WatermarkRemover = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [processingAlgorithm, setProcessingAlgorithm] = useState<'enhanced' | 'conservative' | 'aggressive' | 'lama' | 'sd-inpainting'>('lama');
  const [markRadius, setMarkRadius] = useState(0.05);
  const [zoom, setZoom] = useState<number>(1);
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    resizeHandle: null,
    startX: 0,
    startY: 0
  });
  const [selectedMark, setSelectedMark] = useState<boolean>(false);
  const [isBatchDownloadOpen, setIsBatchDownloadOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{[key: string]: number}>({});
  const [sdApiKey, setSdApiKey] = useState<string>('');
  const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalScrollRef = useRef<HTMLDivElement>(null);
  const processedScrollRef = useRef<HTMLDivElement>(null);

  // Auto-select first image when images change and no image is selected
  useEffect(() => {
    if (images.length > 0 && !selectedImageId) {
      setSelectedImageId(images[0].id);
    }
  }, [images, selectedImageId]);
  const loadImageDimensions = (file: File): Promise<{
    width: number;
    height: number;
  }> => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.src = URL.createObjectURL(file);
    });
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newImages = await Promise.all(Array.from(files).map(async file => {
        const dimensions = await loadImageDimensions(file);
        return {
          id: crypto.randomUUID(),
          file: file,
          url: URL.createObjectURL(file),
          processedUrl: null,
          rotation: 0,
          dimensions,
          watermarkMark: undefined,
          processCount: 0,
          isMarkingCompleted: false // 初始化为未完成标记
        };
      }));
      setImages(prevImages => [...prevImages, ...newImages]);
      event.target.value = '';
    }
  };
  const syncScroll = useCallback((source: 'original' | 'processed', scrollLeft: number, scrollTop: number) => {
    const targetRef = source === 'original' ? processedScrollRef : originalScrollRef;
    if (targetRef.current) {
      targetRef.current.scrollLeft = scrollLeft;
      targetRef.current.scrollTop = scrollTop;
    }
    setScrollPosition({
      x: scrollLeft,
      y: scrollTop
    });
  }, []);
  const getImageCoordinates = (event: React.MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return {
      x,
      y
    };
  };
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    event.preventDefault();
    event.stopPropagation();
    const selectedImage = images.find(img => img.id === imageId);
    if (!selectedImage) return;
    const {
      x,
      y
    } = getImageCoordinates(event);
    if (selectedImage.watermarkMark) {
      const mark = selectedImage.watermarkMark;
      const handle = getResizeHandle(x, y, mark);
      if (handle) {
        setResizeState({
          isResizing: true,
          resizeHandle: handle,
          startX: x,
          startY: y
        });
        setSelectedMark(true);
        return;
      }
      if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
        setSelectedMark(true);
        setDragState({
          isDragging: true,
          startX: x - mark.x,
          startY: y - mark.y,
          currentX: x,
          currentY: y
        });
        return;
      }
    }
    setSelectedMark(false);
    setImages(prevImages => prevImages.map(img => img.id === imageId ? {
      ...img,
      watermarkMark: undefined
    } : img));
    setDragState({
      isDragging: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });
  }, [isMarkingMode, images]);
  const getResizeHandle = (x: number, y: number, mark: WatermarkMark): 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w' | null => {
    // 根据缩放级别调整控制点的检测区域
    const handleSize = Math.max(0.01, 0.02 / zoom);
    const handles = {
      'nw': {
        x: mark.x,
        y: mark.y
      },
      'ne': {
        x: mark.x + mark.width,
        y: mark.y
      },
      'sw': {
        x: mark.x,
        y: mark.y + mark.height
      },
      'se': {
        x: mark.x + mark.width,
        y: mark.y + mark.height
      },
      'n': {
        x: mark.x + mark.width / 2,
        y: mark.y
      },
      'e': {
        x: mark.x + mark.width,
        y: mark.y + mark.height / 2
      },
      's': {
        x: mark.x + mark.width / 2,
        y: mark.y + mark.height
      },
      'w': {
        x: mark.x,
        y: mark.y + mark.height / 2
      }
    } as const;
    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
        return handle as 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w';
      }
    }
    return null;
  };
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    
    const {
      x,
      y
    } = getImageCoordinates(event);
    
    // 如果不在拖拽或调整大小状态，只更新光标样式
    if (!dragState.isDragging && !resizeState.isResizing) {
      const selectedImage = images.find(img => img.id === imageId);
      if (selectedImage?.watermarkMark) {
        const mark = selectedImage.watermarkMark;
        const handle = getResizeHandle(x, y, mark);
        
        // 设置光标样式
        const target = event.currentTarget;
        if (handle) {
          // 调整大小光标
          const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize', 
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'ns-resize',
            's': 'ns-resize',
            'e': 'ew-resize',
            'w': 'ew-resize'
          };
          target.style.cursor = cursors[handle];
        } else if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
          // 在矩形内，使用移动光标
          target.style.cursor = 'move';
        } else {
          // 默认十字光标
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
      const selectedImage = images.find(img => img.id === imageId);
      if (selectedImage?.watermarkMark) {
        const mark = selectedImage.watermarkMark;
        let newMark = {
          ...mark
        };

        // 根据缩放级别调整最小尺寸
        const minSize = Math.max(0.01, 0.015 / zoom);
        switch (resizeState.resizeHandle) {
          case 'se':
            newMark.width = Math.max(minSize, x - mark.x);
            newMark.height = Math.max(minSize, y - mark.y);
            break;
          case 'nw':
            const newWidth = mark.width + (mark.x - x);
            const newHeight = mark.height + (mark.y - y);
            if (newWidth > minSize && newHeight > minSize) {
              newMark.x = x;
              newMark.y = y;
              newMark.width = newWidth;
              newMark.height = newHeight;
            }
            break;
          case 'ne':
            const neWidth = Math.max(minSize, x - mark.x);
            const neHeight = mark.height + (mark.y - y);
            if (neHeight > minSize) {
              newMark.y = y;
              newMark.width = neWidth;
              newMark.height = neHeight;
            }
            break;
          case 'sw':
            const swWidth = mark.width + (mark.x - x);
            const swHeight = Math.max(minSize, y - mark.y);
            if (swWidth > minSize) {
              newMark.x = x;
              newMark.width = swWidth;
              newMark.height = swHeight;
            }
            break;
          case 'n':
            const nHeight = mark.height + (mark.y - y);
            if (nHeight > minSize) {
              newMark.y = y;
              newMark.height = nHeight;
            }
            break;
          case 's':
            newMark.height = Math.max(minSize, y - mark.y);
            break;
          case 'e':
            newMark.width = Math.max(minSize, x - mark.x);
            break;
          case 'w':
            const wWidth = mark.width + (mark.x - x);
            if (wWidth > minSize) {
              newMark.x = x;
              newMark.width = wWidth;
            }
            break;
        }
        setImages(prevImages => prevImages.map(img => img.id === imageId ? {
          ...img,
          watermarkMark: newMark
        } : img));
      }
    } else if (dragState.isDragging) {
      if (selectedMark) {
        const selectedImage = images.find(img => img.id === imageId);
        if (selectedImage?.watermarkMark) {
          const mark = selectedImage.watermarkMark;
          const newX = Math.max(0, Math.min(1 - mark.width, x - dragState.startX));
          const newY = Math.max(0, Math.min(1 - mark.height, y - dragState.startY));
          setImages(prevImages => prevImages.map(img => img.id === imageId ? {
            ...img,
            watermarkMark: {
              ...mark,
              x: newX,
              y: newY
            }
          } : img));
        }
      } else {
        setDragState(prev => ({
          ...prev,
          currentX: x,
          currentY: y
        }));
      }
    }
  }, [isMarkingMode, dragState, resizeState, selectedMark, images, zoom]);
  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;
    event.preventDefault();
    event.stopPropagation();
    
    // 重置光标样式
    event.currentTarget.style.cursor = 'crosshair';
    
    if (resizeState.isResizing) {
      setResizeState({
        isResizing: false,
        resizeHandle: null,
        startX: 0,
        startY: 0
      });
      return;
    }
    if (dragState.isDragging && !selectedMark) {
      const {
        startX,
        startY,
        currentX,
        currentY
      } = dragState;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      // 根据缩放级别调整最小尺寸
      const minSize = Math.max(0.01, 0.015 / zoom);
      if (width > minSize && height > minSize) {
        setImages(prevImages => prevImages.map(img => img.id === imageId ? {
          ...img,
          watermarkMark: {
            x: left,
            y: top,
            width,
            height
          }
        } : img));
        setSelectedMark(true);
      }
    }
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    });
  }, [isMarkingMode, dragState, selectedMark, zoom]);
  const clearWatermarkMark = (imageId: string) => {
    setImages(prevImages => prevImages.map(img => img.id === imageId ? {
      ...img,
      watermarkMark: undefined,
      isMarkingCompleted: false // 清除标记时重置完成状态
    } : img));
    setSelectedMark(false);
  };
  const restoreToOriginal = (imageId: string) => {
    setImages(prevImages => prevImages.map(img => img.id === imageId ? {
      ...img,
      processedUrl: null,
      processCount: 0,
      watermarkMark: undefined,
      isMarkingCompleted: false // 还原时重置完成状态
    } : img));
    setSelectedMark(false);
    toast.success("已还原到原图状态", {
      duration: 800
    });
  };

  // 完成标记的处理函数
  const handleCompleteMarking = (imageId: string) => {
    const selectedImage = images.find(img => img.id === imageId);
    if (!selectedImage?.watermarkMark) {
      toast.error("请先标记水印位置", {
        duration: 1000
      });
      return;
    }

    setImages(prevImages => prevImages.map(img => img.id === imageId ? {
      ...img,
      isMarkingCompleted: true
    } : img));
    
    setIsMarkingMode(false);
    setSelectedMark(false);
    toast.success("水印标记已完成，现在可以开始处理", {
      duration: 1000
    });
  };

  // LaMa算法实现
  const applyLamaInpainting = async (canvas: HTMLCanvasElement, maskRegion: WatermarkMark): Promise<void> => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const maskLeft = Math.floor(maskRegion.x * canvas.width);
    const maskTop = Math.floor(maskRegion.y * canvas.height);
    const maskRight = Math.floor((maskRegion.x + maskRegion.width) * canvas.width);
    const maskBottom = Math.floor((maskRegion.y + maskRegion.height) * canvas.height);

    // LaMa inspired multi-scale inpainting
    for (let scale = 0; scale < 3; scale++) {
      const radius = Math.pow(2, scale + 1);
      for (let y = maskTop; y < maskBottom; y++) {
        for (let x = maskLeft; x < maskRight; x++) {
          const repaired = lamaInpaint(data, x, y, canvas.width, canvas.height, radius);
          if (repaired) {
            const index = (y * canvas.width + x) * 4;
            data[index] = repaired.r;
            data[index + 1] = repaired.g;
            data[index + 2] = repaired.b;
            data[index + 3] = repaired.a;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };
  const lamaInpaint = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number, radius: number) => {
    const validPixels: Array<{
      r: number;
      g: number;
      b: number;
      a: number;
      distance: number;
      weight: number;
    }> = [];

    // 使用更智能的采样策略
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
      for (let r = radius; r <= radius * 3; r += 2) {
        const nx = Math.round(x + Math.cos(angle) * r);
        const ny = Math.round(y + Math.sin(angle) * r);
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const distance = Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y));

          // 纹理一致性检查
          const textureScore = calculateTextureConsistency(data, nx, ny, width, height);
          const weight = 1 / (distance + 1) * (1 + textureScore);
          validPixels.push({
            r: data[nIndex],
            g: data[nIndex + 1],
            b: data[nIndex + 2],
            a: data[nIndex + 3],
            distance: distance,
            weight: weight
          });
        }
      }
    }
    if (validPixels.length === 0) return null;

    // 基于权重的高级混合
    validPixels.sort((a, b) => b.weight - a.weight);
    const topPixels = validPixels.slice(0, Math.min(12, validPixels.length));
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      totalA = 0,
      totalWeight = 0;
    topPixels.forEach(pixel => {
      totalR += pixel.r * pixel.weight;
      totalG += pixel.g * pixel.weight;
      totalB += pixel.b * pixel.weight;
      totalA += pixel.a * pixel.weight;
      totalWeight += pixel.weight;
    });
    return {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
      a: Math.round(totalA / totalWeight)
    };
  };
  const calculateTextureConsistency = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    let consistency = 0;
    let count = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const index = (y * width + x) * 4;
        const nIndex = (ny * width + nx) * 4;
        const colorDiff = Math.abs(data[index] - data[nIndex]) + Math.abs(data[index + 1] - data[nIndex + 1]) + Math.abs(data[index + 2] - data[nIndex + 2]);
        consistency += Math.max(0, 255 - colorDiff) / 255;
        count++;
      }
    }
    return count > 0 ? consistency / count : 0;
  };
  const detectWatermark = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    let confidence = 0;
    const isWhiteish = r > 200 && g > 200 && b > 200;
    const isSemiTransparent = a > 50 && a < 250;
    const brightness = (r + g + b) / 3;
    if (isWhiteish && isSemiTransparent) {
      confidence += 0.8;
    }
    if (brightness > 220 && isSemiTransparent) {
      confidence += 0.7;
    }
    if (r > 150 && g < 100 && b < 100) {
      confidence += 0.6;
    }
    if (r > 180 && g > 100 && g < 200 && b < 100) {
      confidence += 0.5;
    }
    if (a < 245) {
      confidence += 0.4;
    }
    const edgeStrength = calculateEdgeStrength(data, x, y, width, height);
    if (edgeStrength > 30) {
      confidence += 0.3;
    }
    const colorUniformity = checkColorUniformity(data, x, y, width, height);
    if (colorUniformity > 0.7) {
      confidence += 0.2;
    }
    return Math.min(confidence, 1.0);
  };
  const calculateEdgeStrength = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    let maxDiff = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const neighborBrightness = (data[neighborIndex] + data[neighborIndex + 1] + data[neighborIndex + 2]) / 3;
          maxDiff = Math.max(maxDiff, Math.abs(centerBrightness - neighborBrightness));
        }
      }
    }
    return maxDiff;
  };
  const checkColorUniformity = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const centerIndex = (y * width + x) * 4;
    const centerR = data[centerIndex];
    const centerG = data[centerIndex + 1];
    const centerB = data[centerIndex + 2];
    let uniformCount = 0;
    let totalCount = 0;
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const colorDiff = Math.abs(data[nIndex] - centerR) + Math.abs(data[nIndex + 1] - centerG) + Math.abs(data[nIndex + 2] - centerB);
          if (colorDiff < 40) uniformCount++;
          totalCount++;
        }
      }
    }
    return totalCount > 0 ? uniformCount / totalCount : 0;
  };
  const getPositionWeight = (x: number, y: number, width: number, height: number): number => {
    const normalizedX = x / width;
    const normalizedY = y / height;

    // Bottom right corner (most common for watermarks)
    if (normalizedX > 0.7 && normalizedY > 0.7) return 1.5;
    // Other corners
    if ((normalizedX < 0.3 || normalizedX > 0.7) && (normalizedY < 0.3 || normalizedY > 0.7)) return 1.2;
    return 0.8;
  };
  const isInMarkedWatermarkArea = (x: number, y: number, mark?: WatermarkMark): boolean => {
    if (!mark) return false;
    return x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height;
  };
  const smoothEdges = (data: Uint8ClampedArray, width: number, height: number, region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const regionLeft = Math.floor(region.x * width);
    const regionTop = Math.floor(region.y * height);
    const regionRight = Math.floor((region.x + region.width) * width);
    const regionBottom = Math.floor((region.y + region.height) * height);

    // Apply Gaussian blur to edge pixels
    const edgeWidth = 3; // pixels

    for (let y = regionTop; y < regionBottom; y++) {
      for (let x = regionLeft; x < regionRight; x++) {
        // Check if pixel is near edge
        const isNearEdge = x - regionLeft < edgeWidth || regionRight - x < edgeWidth || y - regionTop < edgeWidth || regionBottom - y < edgeWidth;
        if (isNearEdge) {
          const smoothed = gaussianBlur(data, width, height, x, y, 1.5);
          if (smoothed) {
            const index = (y * width + x) * 4;
            data[index] = smoothed.r;
            data[index + 1] = smoothed.g;
            data[index + 2] = smoothed.b;
            data[index + 3] = smoothed.a;
          }
        }
      }
    }
  };
  const gaussianBlur = (data: Uint8ClampedArray, width: number, height: number, centerX: number, centerY: number, sigma: number) => {
    const radius = Math.ceil(sigma * 2);
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      totalA = 0,
      totalWeight = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
          const index = (y * width + x) * 4;
          totalR += data[index] * weight;
          totalG += data[index + 1] * weight;
          totalB += data[index + 2] * weight;
          totalA += data[index + 3] * weight;
          totalWeight += weight;
        }
      }
    }
    return totalWeight > 0 ? {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
      a: Math.round(totalA / totalWeight)
    } : null;
  };
  const repairPixel = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number, confidence: number) => {
    const radius = Math.min(12, Math.max(6, Math.floor(confidence * 12)));
    const validPixels: Array<{
      r: number;
      g: number;
      b: number;
      a: number;
      weight: number;
    }> = [];
    for (let ring = 1; ring <= 3; ring++) {
      const ringRadius = radius * ring / 3;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const dx = Math.round(Math.cos(angle) * ringRadius);
        const dy = Math.round(Math.sin(angle) * ringRadius);
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const neighborConfidence = detectWatermark(data, nx, ny, width, height);
          if (neighborConfidence < 0.1) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (distance * distance + 0.1) / ring;
            validPixels.push({
              r: data[neighborIndex],
              g: data[neighborIndex + 1],
              b: data[neighborIndex + 2],
              a: data[neighborIndex + 3],
              weight: weight
            });
          }
        }
      }
    }
    if (validPixels.length === 0) return null;
    validPixels.sort((a, b) => b.weight - a.weight);
    const useCount = Math.min(20, validPixels.length);
    return weightedAverage(validPixels.slice(0, useCount));
  };
  const weightedAverage = (pixels: Array<{
    r: number;
    g: number;
    b: number;
    a: number;
    weight: number;
  }>) => {
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      totalA = 0,
      totalWeight = 0;
    pixels.forEach(pixel => {
      totalR += pixel.r * pixel.weight;
      totalG += pixel.g * pixel.weight;
      totalB += pixel.b * pixel.weight;
      totalA += pixel.a * pixel.weight;
      totalWeight += pixel.weight;
    });
    return {
      r: Math.round(totalR / totalWeight),
      g: Math.round(totalG / totalWeight),
      b: Math.round(totalB / totalWeight),
      a: Math.round(totalA / totalWeight)
    };
  };
  const processImageCanvas = async (imageFile: File, mark?: WatermarkMark, existingProcessedUrl?: string): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Use SD Inpainting algorithm if selected
        if (processingAlgorithm === 'sd-inpainting' && mark) {
          console.log('使用Stable Diffusion Inpainting算法处理');
          const processedBlob = await processWithSDInpainting(imageFile, mark);
          resolve(processedBlob);
          return;
        }

        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法获取Canvas上下文'));
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          try {
            if (processingAlgorithm === 'lama' && mark) {
              console.log('使用LaMa算法处理水印区域');
              await applyLamaInpainting(canvas, mark);
            } else {
              // 传统算法处理
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              for (let pass = 0; pass < 3; pass++) {
                let processedPixels = 0;
                const watermarkPixels: Array<{
                  x: number;
                  y: number;
                  confidence: number;
                }> = [];
                for (let y = 0; y < canvas.height; y++) {
                  for (let x = 0; x < canvas.width; x++) {
                    const normalizedX = x / canvas.width;
                    const normalizedY = y / canvas.height;
                    let confidence = 0;
                    if (mark) {
                      if (isInMarkedWatermarkArea(normalizedX, normalizedY, mark)) {
                        confidence = 0.98;
                      }
                    } else {
                      confidence = detectWatermark(data, x, y, canvas.width, canvas.height);
                    }
                    let threshold = 0.2;
                    if (processingAlgorithm === 'conservative') threshold = 0.35;else if (processingAlgorithm === 'aggressive') threshold = 0.12;
                    if (confidence > threshold) {
                      watermarkPixels.push({
                        x,
                        y,
                        confidence
                      });
                    }
                  }
                }
                watermarkPixels.forEach(({
                  x,
                  y,
                  confidence
                }) => {
                  const repaired = repairPixel(data, x, y, canvas.width, canvas.height, confidence);
                  if (repaired) {
                    const index = (y * canvas.width + x) * 4;
                    const blendFactor = Math.min(0.98, confidence + 0.3);
                    data[index] = Math.round(data[index] * (1 - blendFactor) + repaired.r * blendFactor);
                    data[index + 1] = Math.round(data[index + 1] * (1 - blendFactor) + repaired.g * blendFactor);
                    data[index + 2] = Math.round(data[index + 2] * (1 - blendFactor) + repaired.b * blendFactor);
                    data[index + 3] = Math.round(data[index + 3] * (1 - blendFactor) + repaired.a * blendFactor);
                    processedPixels++;
                  }
                });
                console.log(`Pass ${pass + 1}: 修复了 ${processedPixels} 个水印像素`);
              }
              ctx.putImageData(imageData, 0, 0);
            }
            canvas.toBlob(blob => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('无法生成处理后的图片'));
              }
            }, 'image/png', 1.0);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = existingProcessedUrl || URL.createObjectURL(imageFile);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Add batch processing function
  const handleBatchProcess = async () => {
    if (isProcessing || isBatchProcessing) {
      toast.error("请等待当前任务完成", {
        duration: 800
      });
      return;
    }

    // 只处理已完成标记的图片
    const imagesToProcess = images.filter(img => img.watermarkMark && img.isMarkingCompleted);

    if (imagesToProcess.length === 0) {
      toast.error("请先为图片标记水印并完成标记", {
        duration: 1000
      });
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({});
    
    try {
      toast.info(`开始批量处理 ${imagesToProcess.length} 张已完成标记的图片`, {
        duration: 1000
      });

      for (let i = 0; i < imagesToProcess.length; i++) {
        const imageItem = imagesToProcess[i];
        
        // Update progress for current image
        setBatchProgress(prev => ({
          ...prev,
          [imageItem.id]: 0
        }));

        try {
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            setBatchProgress(prev => ({
              ...prev,
              [imageItem.id]: Math.min((prev[imageItem.id] || 0) + 10, 85)
            }));
          }, 100);

          const processedBlob = await processImageCanvas(
            imageItem.file, 
            imageItem.watermarkMark, 
            imageItem.processedUrl || undefined
          );
          
          clearInterval(progressInterval);
          
          setBatchProgress(prev => ({
            ...prev,
            [imageItem.id]: 100
          }));

          const processedUrl = URL.createObjectURL(processedBlob);
          setImages(prevImages => prevImages.map(img => img.id === imageItem.id ? {
            ...img,
            processedUrl: processedUrl,
            processCount: img.processCount + 1
          } : img));

          console.log(`批量处理进度: ${i + 1}/${imagesToProcess.length} - ${imageItem.file.name}`);
          
        } catch (error: any) {
          console.error(`处理图片 ${imageItem.file.name} 失败:`, error);
          setBatchProgress(prev => ({
            ...prev,
            [imageItem.id]: -1 // 标记为失败
          }));
        }
      }

      const successCount = Object.values(batchProgress).filter(p => p === 100).length;
      const failedCount = Object.values(batchProgress).filter(p => p === -1).length;
      
      if (successCount > 0) {
        toast.success(`批量处理完成！成功处理 ${successCount} 张图片${failedCount > 0 ? `，失败 ${failedCount} 张` : ''}`, {
          duration: 2000
        });
      } else {
        toast.error("批量处理失败，请检查图片格式", {
          duration: 1500
        });
      }

    } catch (error: any) {
      console.error("批量处理错误:", error);
      toast.error(`批量处理失败: ${error.message}`, {
        duration: 1500
      });
    } finally {
      setIsBatchProcessing(false);
      setBatchProgress({});
    }
  };

  // Add batch apply watermark marks function
  const handleBatchApplyWatermark = () => {
    if (!selectedImage?.watermarkMark) {
      toast.error("当前图片没有标记水印", {
        duration: 800
      });
      return;
    }

    const currentMark = selectedImage.watermarkMark;
    
    // Apply the watermark mark to all other images, but reset their completion status
    setImages(prevImages => prevImages.map(img => 
      img.id === selectedImageId ? img : {
        ...img,
        watermarkMark: { ...currentMark },
        isMarkingCompleted: false // 批量应用后需要重新确认
      }
    ));

    const appliedCount = images.filter(img => img.id !== selectedImageId).length;
    toast.success(`已将水印标记应用到 ${appliedCount} 张图片，请分别确认完成标记`, {
      duration: 1500
    });
  };

  const handleBatchDownload = () => {
    const processedImages = images.filter(img => img.processedUrl);
    if (processedImages.length === 0) {
      toast.error("暂无已处理的图片", { duration: 800 });
      return;
    }
    setIsBatchDownloadOpen(true);
  };

  const handleImageListClick = (imageId: string) => {
    setSelectedImageId(imageId);
    setSelectedMark(false);
  };
  const handleRemoveImage = (imageId: string) => {
    setImages(prevImages => {
      const newImages = prevImages.filter(img => img.id !== imageId);
      if (selectedImageId === imageId) {
        const newSelectedId = newImages.length > 0 ? newImages[0].id : null;
        setSelectedImageId(newSelectedId);
      }
      return newImages;
    });
    setSelectedMark(false);
  };
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };
  const resetZoom = () => {
    setZoom(1);
  };
  const renderWatermarkMark = (mark?: WatermarkMark, showInProcessed: boolean = true) => {
    if (!mark || !showInProcessed) return null;
    return (
      <div className="absolute pointer-events-none transition-all duration-150 ease-out" style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        width: `${mark.width * 100}%`,
        height: `${mark.height * 100}%`,
      }}>
        {/* 透明矩形背景 - 标记模式时完全透明 */}
        <div className={`absolute inset-0 ${isMarkingMode ? 'bg-transparent' : 'bg-blue-500 bg-opacity-10'} transition-colors duration-200`} />
        
        {/* 蓝色虚线边框 */}
        <div className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-sm opacity-90 transition-all duration-200" style={{
          borderWidth: `${Math.max(1, 2 / zoom)}px`
        }} />

        {selectedMark && isMarkingMode && showInProcessed && (
          <>
            {/* 控制点 */}
            {[{
              pos: 'nw',
              style: {
                top: -1,
                left: -1
              },
              cursor: 'nw-resize'
            }, {
              pos: 'ne',
              style: {
                top: -1,
                right: -1
              },
              cursor: 'ne-resize'
            }, {
              pos: 'sw',
              style: {
                bottom: -1,
                left: -1
              },
              cursor: 'sw-resize'
            }, {
              pos: 'se',
              style: {
                bottom: -1,
                right: -1
              },
              cursor: 'se-resize'
            }, {
              pos: 'n',
              style: {
                top: -0.5,
                left: '50%',
                transform: 'translateX(-50%)'
              },
              cursor: 'ns-resize'
            }, {
              pos: 'e',
              style: {
                right: -0.5,
                top: '50%',
                transform: 'translateY(-50%)'
              },
              cursor: 'ew-resize'
            }, {
              pos: 's',
              style: {
                bottom: -0.5,
                left: '50%',
                transform: 'translateX(-50%)'
              },
              cursor: 'ns-resize'
            }, {
              pos: 'w',
              style: {
                left: -0.5,
                top: '50%',
                transform: 'translateY(-50%)'
              },
              cursor: 'ew-resize'
            }].map(({
              pos,
              style,
              cursor
            }) => (
              <div 
                key={pos} 
                className="absolute bg-blue-600 border-2 border-white rounded-full pointer-events-auto hover:bg-blue-700 hover:scale-110 transition-all duration-150 shadow-lg" 
                style={{
                  ...style,
                  width: `${Math.max(8, 12 / zoom)}px`,
                  height: `${Math.max(8, 12 / zoom)}px`,
                  cursor
                }} 
              />
            ))}
          </>
        )}
      </div>
    );
  };

  const renderDragPreview = () => {
    if (!isMarkingMode || !dragState.isDragging || selectedMark) return null;
    const {
      startX,
      startY,
      currentX,
      currentY
    } = dragState;
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    return <div className="absolute border-2 border-dashed border-blue-500 bg-transparent pointer-events-none transition-all duration-75 rounded-sm" style={{
      left: `${left * 100}%`,
      top: `${top * 100}%`,
      width: `${width * 100}%`,
      height: `${height * 100}%`,
      borderWidth: `${Math.max(1, 2 / zoom)}px`
    }} />;
  };

  const selectedImage = images.find(img => img.id === selectedImageId);
  
  const handleDownload = (imageItem: ImageItem) => {
    if (imageItem.processedUrl) {
      const link = document.createElement("a");
      link.href = imageItem.processedUrl;
      link.download = `watermark_removed_${imageItem.file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("图片已开始下载!", {
        duration: 800
      });
    } else {
      toast.error("请先去除水印", {
        duration: 800
      });
    }
  };

  const handleRemoveWatermark = async (imageItem: ImageItem) => {
    // 检查是否已完成标记
    if (!imageItem.isMarkingCompleted) {
      toast.error("请先完成水印标记", {
        duration: 1000
      });
      return;
    }

    if (!imageItem.watermarkMark) {
      toast.error("请先标记水印位置", {
        duration: 1000
      });
      return;
    }

    if (isProcessing || isBatchProcessing) {
      toast.error("请等待当前任务完成", {
        duration: 800
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      toast.info("开始处理图片...", {
        duration: 800
      });

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 100);

      const processedBlob = await processImageCanvas(
        imageItem.file,
        imageItem.watermarkMark,
        imageItem.processedUrl || undefined
      );

      clearInterval(progressInterval);
      setProgress(100);

      const processedUrl = URL.createObjectURL(processedBlob);
      setImages(prevImages => prevImages.map(img => 
        img.id === imageItem.id ? {
          ...img,
          processedUrl: processedUrl,
          processCount: img.processCount + 1
        } : img
      ));

      toast.success(`图片处理完成！${imageItem.processCount > 0 ? '继续优化' : '水印已去除'}`, {
        duration: 1500
      });

    } catch (error: any) {
      console.error("处理图片时出错:", error);
      toast.error(`处理失败: ${error.message}`, {
        duration: 1500
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // 渲染处理按钮的函数，带有禁用状态和提示
  const renderProcessButton = (imageItem: ImageItem, isListItem: boolean = false) => {
    const isDisabled = isProcessing || isBatchProcessing || !imageItem.watermarkMark || !imageItem.isMarkingCompleted;
    const needsMarking = !imageItem.watermarkMark;
    const needsCompletion = imageItem.watermarkMark && !imageItem.isMarkingCompleted;
    
    let tooltipText = "";
    if (needsMarking) {
      tooltipText = "请先标记水印位置";
    } else if (needsCompletion) {
      tooltipText = "请先确认完成水印标记";
    }

    const buttonContent = (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={e => {
          if (isListItem) e.stopPropagation();
          handleRemoveWatermark(imageItem);
        }} 
        disabled={isDisabled}
        className={`text-xs ${isDisabled ? 'cursor-not-allowed' : ''}`}
      >
        {(isProcessing || isBatchProcessing) && selectedImageId === imageItem.id ? '处理中...' : 
         imageItem.processCount > 0 ? '继续处理' : '去水印'}
      </Button>
    );

    // 只在需要标记或需要完成标记时显示提示
    if (tooltipText && (needsMarking || needsCompletion)) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return buttonContent;
  };

  return (
    <TooltipProvider>
      <div className="h-full flex">
        {/* Left Sidebar */}
        <div className="w-80 flex-shrink-0 border-r bg-white">
          <div className="h-full flex flex-col p-4">
            {/* Upload Section */}
            <div className="space-y-3 flex-shrink-0">
              <div className="text-center">
                <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" id="file-upload" />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="w-full" asChild>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      上传图片
                    </span>
                  </Button>
                </label>
              </div>

              {/* Batch Process Button */}
              {images.length > 0 && (
                <Button 
                  onClick={handleBatchProcess} 
                  disabled={isProcessing || isBatchProcessing || images.filter(img => img.watermarkMark && img.isMarkingCompleted).length === 0}
                  className="w-full"
                  variant="default"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isBatchProcessing ? '批量处理中...' : `批量处理已完成标记图片 (${images.filter(img => img.watermarkMark && img.isMarkingCompleted).length})`}
                </Button>
              )}

              {/* Algorithm Selection */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium whitespace-nowrap">处理算法</label>
                <div className="flex items-center space-x-2 flex-1">
                  <select value={processingAlgorithm} onChange={e => setProcessingAlgorithm(e.target.value as any)} className="flex-1 p-2 border rounded-md text-sm" style={{
                    maxWidth: '120px'
                  }}>
                    <option value="lama">LaMa算法</option>
                    <option value="sd-inpainting">AI智能填充</option>
                    <option value="enhanced">增强模式</option>
                    <option value="conservative">保守模式</option>
                    <option value="aggressive">激进模式</option>
                  </select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <Info className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="bottom" align="center">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-sm mb-2">处理算法说明</h4>
                          <p className="text-xs text-gray-600 mb-3">不同算法的特点和适用场景</p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-purple-600 mb-1 text-xs">AI智能填充 (最新)</h4>
                            <ul className="text-xs space-y-1 text-gray-700">
                              <li>• 🧠 基于Stable Diffusion技术</li>
                              <li>• 🎨 智能理解图像语义内容</li>
                              <li>• ✨ 重新生成符合逻辑的细节</li>
                              <li>• 🔍 高清纹理修复和填充</li>
                              <li>• 🚀 适合复杂背景和精细修复</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium text-blue-600 mb-1 text-xs">LaMa算法 (推荐)</h4>
                            <ul className="text-xs space-y-1 text-gray-700">
                              <li>• 🎯 专业大遮罩修复技术</li>
                              <li>• 🧠 AI智能纹理分析</li>
                              <li>• ✨ 多尺度语义修复</li>
                              <li>• 🎨 保持图像自然性</li>
                              <li>• 🚀 针对标记区域优化</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium text-green-600 mb-1 text-xs">增强模式</h4>
                            <ul className="text-xs space-y-1 text-gray-700">
                              <li>• 📊 基于多特征检测算法</li>
                              <li>• 🔍 智能水印置信度分析</li>
                              <li>• 🎯 加权像素修复技术</li>
                              <li>• ⚖️ 平衡质量与效果</li>
                              <li>• 💎 适合大部分水印类型</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium text-orange-600 mb-1 text-xs">保守模式</h4>
                            <ul className="text-xs space-y-1 text-gray-700">
                              <li>• 🛡️ 高阈值检测算法</li>
                              <li>• 🎨 温和梯度修复技术</li>
                              <li>• 🔒 严格边缘保护机制</li>
                              <li>• 📐 精确纹理保持算法</li>
                              <li>• 🎯 适合精细图像处理</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium text-red-600 mb-1 text-xs">激进模式</h4>
                            <ul className="text-xs space-y-1 text-gray-700">
                              <li>• ⚡ 低阈值检测算法</li>
                              <li>• 🔥 强力像素替换技术</li>
                              <li>• 💪 多轮迭代修复机制</li>
                              <li>• 🎯 高强度水印去除</li>
                              <li>• ⚠️ 可能影响图像细节</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {/* API 配置按钮 - 仅在选择AI智能填充时显示 */}
                  {processingAlgorithm === 'sd-inpainting' && (
                    <Dialog open={isApiConfigOpen} onOpenChange={setIsApiConfigOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>配置 AI 智能填充 API</DialogTitle>
                          <DialogDescription>
                            请输入您的 Stable Diffusion API 密钥以使用 AI 智能填充功能
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="api-key" className="text-right text-sm font-medium">
                              API 密钥
                            </label>
                            <input
                              id="api-key"
                              type="password"
                              value={sdApiKey}
                              onChange={(e) => setSdApiKey(e.target.value)}
                              className="col-span-3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="输入您的 API 密钥"
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            <p>• API 密钥将保存在本地存储中</p>
                            <p>• 如需获取 API 密钥，请访问相关服务提供商</p>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setIsApiConfigOpen(false)}>
                            取消
                          </Button>
                          <Button onClick={() => {
                            localStorage.setItem('sd-api-key', sdApiKey);
                            setIsApiConfigOpen(false);
                            toast.success('API 密钥已保存', { duration: 1000 });
                          }}>
                            保存
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </div>
            
            {/* 图片列表 */}
            <ScrollArea className="flex-1 pt-3">
              <div className="space-y-2">
                {images.map(image => (
                  <div key={image.id} className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`} onClick={() => handleImageListClick(image.id)}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block" title={image.file.name}>
                        {image.file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {image.processedUrl ? `已处理${image.processCount}次` : '未处理'}
                        {image.watermarkMark ? (image.isMarkingCompleted ? ' • 已完成标记' : ' • 已标记未确认') : ' • 未标记'}
                        {isBatchProcessing && batchProgress[image.id] !== undefined && (
                          <>
                            {batchProgress[image.id] === -1 ? ' • 处理失败' : 
                             batchProgress[image.id] === 100 ? ' • 处理完成' : 
                             ` • 处理中 ${batchProgress[image.id]}%`}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                      {renderProcessButton(image, true)}
                      <Button variant="outline" size="sm" onClick={e => {
                        e.stopPropagation();
                        handleRemoveImage(image.id);
                      }} className="text-xs" disabled={isBatchProcessing}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          <div className="p-4 bg-white border-b flex-shrink-0">
            <div className="flex flex-col space-y-3">
              {/* Smart Layout: Title and Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold whitespace-nowrap">图片处理结果</h2>
                
                <div className="flex items-center gap-2">
                  {isBatchProcessing && (
                    <div className="flex items-center space-x-2 whitespace-nowrap">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span className="text-sm text-gray-600">批量处理中...</span>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  {selectedImage && (
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Button variant={isMarkingMode ? "default" : "outline"} size="sm" onClick={() => {
                        if (isMarkingMode) {
                          // 如果当前在标记模式，点击相当于完成标记
                          if (selectedImage.watermarkMark) {
                            handleCompleteMarking(selectedImage.id);
                          } else {
                            setIsMarkingMode(false);
                            setSelectedMark(false);
                          }
                        } else {
                          // 如果不在标记模式，开始标记
                          setIsMarkingMode(true);
                          setSelectedMark(false);
                          // 如果开始新的标记，重置完成状态
                          if (selectedImage.isMarkingCompleted) {
                            setImages(prevImages => prevImages.map(img => 
                              img.id === selectedImage.id ? { ...img, isMarkingCompleted: false } : img
                            ));
                          }
                        }
                      }} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                        <MapPin className="h-3 w-3 mr-1" />
                        {isMarkingMode ? '完成标记' : (selectedImage.isMarkingCompleted ? '重新标记' : '标记水印')}
                      </Button>
                      {selectedImage.watermarkMark && (
                        <Button variant="outline" size="sm" onClick={() => clearWatermarkMark(selectedImage.id)} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                          清除标记
                        </Button>
                      )}
                      {selectedImage.watermarkMark && selectedImage.isMarkingCompleted && (
                        <Button variant="outline" size="sm" onClick={handleBatchApplyWatermark} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                          <Copy className="h-3 w-3 mr-1" />
                          批量应用
                        </Button>
                      )}
                      {selectedImage.processedUrl && (
                        <Button variant="outline" size="sm" onClick={() => restoreToOriginal(selectedImage.id)} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                          <Undo2 className="h-3 w-3 mr-1" />
                          还原原图
                        </Button>
                      )}
                      {renderProcessButton(selectedImage)}
                      <Button variant="outline" size="sm" onClick={() => handleDownload(selectedImage)} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                        <Download className="h-3 w-3 mr-1" />
                        下载
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBatchDownload} className="text-xs whitespace-nowrap" disabled={isBatchProcessing}>
                        <Download className="h-3 w-3 mr-1" />
                        批量下载
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {selectedImage ? <div className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
              {/* Original Image */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600">原图</span>
                    {isProcessing && <div className="flex items-center space-x-2">
                        <Progress value={progress} className="w-20 h-2" />
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-6 w-6 p-0">
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetZoom} className="h-6 px-2 text-xs">
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-6 w-6 p-0">
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-gray-500 ml-2">{Math.round(zoom * 100)}%</span>
                  </div>
                </div>
                <div ref={originalScrollRef} className="flex-1 relative bg-white rounded-lg border overflow-auto min-h-0" onScroll={e => {
                  const target = e.target as HTMLDivElement;
                  syncScroll('original', target.scrollLeft, target.scrollTop);
                }}>
                  <div className="p-4 flex items-center justify-center min-h-full">
                    <div className="relative" style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center center'
                    }}>
                      <img src={selectedImage.url} alt="原图" className={`block object-contain transition-transform duration-200 ease-out ${isMarkingMode ? 'cursor-crosshair' : ''}`} onMouseDown={e => handleMouseDown(e, selectedImage.id)} onMouseMove={e => handleMouseMove(e, selectedImage.id)} onMouseUp={e => handleMouseUp(e, selectedImage.id)} draggable={false} />
                      {renderWatermarkMark(selectedImage.watermarkMark, true)}
                      {renderDragPreview()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Processed Image */}
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
                <div ref={processedScrollRef} className="flex-1 relative bg-white rounded-lg border overflow-auto min-h-0" onScroll={e => {
                  const target = e.target as HTMLDivElement;
                  syncScroll('processed', target.scrollLeft, target.scrollTop);
                }}>
                  {selectedImage.processedUrl ? <div className="p-4 flex items-center justify-center min-h-full">
                      <div className="relative" style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'center center'
                      }}>
                        <img src={selectedImage.processedUrl} alt="处理后" className="block object-contain" draggable={false} />
                      </div>
                    </div> : <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                      {isProcessing ? <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                          <div className="text-xs">正在处理...</div>
                        </div> : '等待处理'}
                    </div>}
                </div>
              </div>
            </div> : <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">请从左侧列表中选择一张图片进行处理</p>
                <p className="text-sm text-gray-400">上传后将在此处看到图片对比</p>
              </div>
            </div>
          </div>
          
          {/* Batch Download Dialog */}
          <BatchDownloadDialog
            isOpen={isBatchDownloadOpen}
            onClose={() => setIsBatchDownloadOpen(false)}
            images={images}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WatermarkRemover;
