import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Upload, Download, Trash2, MapPin, RefreshCw, Settings, ZoomIn, ZoomOut, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  processedUrl: string | null;
  rotation: number;
  dimensions?: { width: number; height: number };
  watermarkMark?: {x: number, y: number, width: number, height: number};
  processCount: number;
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
  const [processingAlgorithm, setProcessingAlgorithm] = useState<'enhanced' | 'conservative' | 'aggressive'>('enhanced');
  const [markRadius, setMarkRadius] = useState(0.05);
  const [zoom, setZoom] = useState<number>(1);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalScrollRef = useRef<HTMLDivElement>(null);
  const processedScrollRef = useRef<HTMLDivElement>(null);

  // Auto-select first image when images change and no image is selected
  useEffect(() => {
    if (images.length > 0 && !selectedImageId) {
      setSelectedImageId(images[0].id);
    }
  }, [images, selectedImageId]);

  const loadImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
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
          };
        })
      );
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
    setScrollPosition({ x: scrollLeft, y: scrollTop });
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;

    const selectedImage = images.find(img => img.id === imageId);
    if (!selectedImage) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Check if clicking on existing mark for selection/resize
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
        event.preventDefault();
        return;
      }
      
      // Check if clicking inside mark for moving
      if (x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height) {
        setSelectedMark(true);
        setDragState({
          isDragging: true,
          startX: x - mark.x,
          startY: y - mark.y,
          currentX: x,
          currentY: y
        });
        event.preventDefault();
        return;
      }
    }

    // Clear existing mark and create new one
    setSelectedMark(false);
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId ? { ...img, watermarkMark: undefined } : img
      )
    );

    setDragState({
      isDragging: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });

    event.preventDefault();
  }, [isMarkingMode, images]);

  const getResizeHandle = (x: number, y: number, mark: WatermarkMark): string | null => {
    const handleSize = 0.02; // 2% of image size
    const handles = {
      'nw': { x: mark.x, y: mark.y },
      'ne': { x: mark.x + mark.width, y: mark.y },
      'sw': { x: mark.x, y: mark.y + mark.height },
      'se': { x: mark.x + mark.width, y: mark.y + mark.height },
      'n': { x: mark.x + mark.width / 2, y: mark.y },
      'e': { x: mark.x + mark.width, y: mark.y + mark.height / 2 },
      's': { x: mark.x + mark.width / 2, y: mark.y + mark.height },
      'w': { x: mark.x, y: mark.y + mark.height / 2 }
    };

    for (const [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
        return handle;
      }
    }
    return null;
  };

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    if (resizeState.isResizing && resizeState.resizeHandle) {
      const selectedImage = images.find(img => img.id === imageId);
      if (selectedImage?.watermarkMark) {
        const mark = selectedImage.watermarkMark;
        let newMark = { ...mark };

        switch (resizeState.resizeHandle) {
          case 'se':
            newMark.width = Math.max(0.02, x - mark.x);
            newMark.height = Math.max(0.02, y - mark.y);
            break;
          case 'nw':
            const newWidth = mark.width + (mark.x - x);
            const newHeight = mark.height + (mark.y - y);
            if (newWidth > 0.02 && newHeight > 0.02) {
              newMark.x = x;
              newMark.y = y;
              newMark.width = newWidth;
              newMark.height = newHeight;
            }
            break;
          // Add other resize handles as needed
        }

        setImages(prevImages =>
          prevImages.map(img =>
            img.id === imageId ? { ...img, watermarkMark: newMark } : img
          )
        );
      }
    } else if (dragState.isDragging) {
      if (selectedMark) {
        // Moving existing mark
        const selectedImage = images.find(img => img.id === imageId);
        if (selectedImage?.watermarkMark) {
          const mark = selectedImage.watermarkMark;
          const newX = Math.max(0, Math.min(1 - mark.width, x - dragState.startX));
          const newY = Math.max(0, Math.min(1 - mark.height, y - dragState.startY));
          
          setImages(prevImages =>
            prevImages.map(img =>
              img.id === imageId 
                ? { ...img, watermarkMark: { ...mark, x: newX, y: newY } }
                : img
            )
          );
        }
      } else {
        // Creating new mark
        setDragState(prev => ({
          ...prev,
          currentX: x,
          currentY: y
        }));
      }
    }
  }, [isMarkingMode, dragState, resizeState, selectedMark, images]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLImageElement>, imageId: string) => {
    if (!isMarkingMode) return;

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
      const { startX, startY, currentX, currentY } = dragState;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      if (width > 0.02 && height > 0.02) {
        setImages(prevImages =>
          prevImages.map(img =>
            img.id === imageId
              ? { ...img, watermarkMark: { x: left, y: top, width, height } }
              : img
          )
        );
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
  }, [isMarkingMode, dragState, selectedMark]);

  const clearWatermarkMark = (imageId: string) => {
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId ? { ...img, watermarkMark: undefined } : img
      )
    );
    setSelectedMark(false);
  };

  const restoreToOriginal = (imageId: string) => {
    setImages(prevImages =>
      prevImages.map(img =>
        img.id === imageId 
          ? { 
              ...img, 
              processedUrl: null, 
              processCount: 0,
              watermarkMark: undefined 
            } 
          : img
      )
    );
    setSelectedMark(false);
    toast.success("已还原到原图状态", { duration: 800 });
  };

  const detectWatermark = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    let confidence = 0;
    
    if (a < 245) {
      confidence += 0.3;
      if (a < 200) confidence += 0.2;
    }
    
    const brightness = (r + g + b) / 3;
    if (brightness > 220 || brightness < 50) {
      confidence += 0.25;
    }
    
    const colorVariance = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (colorVariance < 20) {
      confidence += 0.2;
    }
    
    const contrast = calculateLocalContrast(data, x, y, width, height);
    if (contrast > 60) {
      confidence += 0.3;
    }
    
    const edgeStrength = calculateEdgeStrength(data, x, y, width, height);
    if (edgeStrength > 40) {
      confidence += 0.25;
    }
    
    if (detectTextPattern(data, x, y, width, height)) {
      confidence += 0.35;
    }
    
    const positionWeight = getPositionWeight(x, y, width, height);
    confidence *= positionWeight;
    
    return Math.min(confidence, 1.0);
  };

  const getPositionWeight = (x: number, y: number, width: number, height: number): number => {
    const normalizedX = x / width;
    const normalizedY = y / height;
    
    if (normalizedX > 0.7 && normalizedY > 0.7) return 1.2;
    if ((normalizedX < 0.3 || normalizedX > 0.7) && (normalizedY < 0.3 || normalizedY > 0.7)) return 1.1;
    if (normalizedX < 0.2 || normalizedX > 0.8 || normalizedY < 0.2 || normalizedY > 0.8) return 1.0;
    return 0.8;
  };

  const detectTextPattern = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean => {
    const patterns = [];
    const radius = 2;
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIndex = (ny * width + nx) * 4;
          const brightness = (data[nIndex] + data[nIndex + 1] + data[nIndex + 2]) / 3;
          patterns.push(brightness);
        }
      }
    }
    
    let edgeCount = 0;
    const centerBrightness = patterns[Math.floor(patterns.length / 2)];
    
    if (centerBrightness !== undefined) {
      patterns.forEach(brightness => {
        if (brightness !== undefined && Math.abs(brightness - centerBrightness) > 50) {
          edgeCount++;
        }
      });
    }
    
    return edgeCount >= 3 && edgeCount <= patterns.length * 0.7;
  };

  const isInMarkedWatermarkArea = (x: number, y: number, mark?: WatermarkMark): boolean => {
    if (!mark) return false;
    return x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height;
  };

  const calculateLocalContrast = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const centerIndex = (y * width + x) * 4;
    const centerBrightness = (data[centerIndex] + data[centerIndex + 1] + data[centerIndex + 2]) / 3;
    
    let maxDiff = 0;
    const radius = 3;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
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

  const calculateEdgeStrength = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number => {
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    let gx = 0, gy = 0;
    
    for (let i = 0; i < 9; i++) {
      const dx = (i % 3) - 1;
      const dy = Math.floor(i / 3) - 1;
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        gx += brightness * sobelX[i];
        gy += brightness * sobelY[i];
      }
    }
    
    return Math.sqrt(gx * gx + gy * gy);
  };

  const repairPixel = (data: Uint8ClampedArray, x: number, y: number, width: number, height: number, confidence: number) => {
    const radius = Math.min(Math.max(4, Math.floor(confidence * 8)), 12);
    const validPixels: Array<{r: number, g: number, b: number, a: number, weight: number, distance: number}> = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborIndex = (ny * width + nx) * 4;
          const neighborConfidence = detectWatermark(data, nx, ny, width, height);
          
          if (neighborConfidence < 0.3) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (distance * distance + 0.1);
            
            validPixels.push({
              r: data[neighborIndex],
              g: data[neighborIndex + 1],
              b: data[neighborIndex + 2],
              a: data[neighborIndex + 3],
              weight: weight,
              distance: distance
            });
          }
        }
      }
    }
    
    if (validPixels.length === 0) return null;
    
    let repairedPixel;
    
    if (processingAlgorithm === 'conservative') {
      validPixels.sort((a, b) => a.distance - b.distance);
      const useCount = Math.min(4, validPixels.length);
      repairedPixel = weightedAverage(validPixels.slice(0, useCount));
    } else if (processingAlgorithm === 'aggressive') {
      repairedPixel = weightedAverage(validPixels);
    } else {
      validPixels.sort((a, b) => b.weight - a.weight);
      const useCount = Math.min(Math.max(6, Math.floor(validPixels.length * 0.6)), validPixels.length);
      repairedPixel = weightedAverage(validPixels.slice(0, useCount));
    }
    
    return repairedPixel;
  };

  const weightedAverage = (pixels: Array<{r: number, g: number, b: number, a: number, weight: number}>) => {
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0, totalWeight = 0;
    
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
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('无法获取Canvas上下文'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let processedPixels = 0;
        const watermarkPixels: Array<{x: number, y: number, confidence: number}> = [];
        
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const normalizedX = x / canvas.width;
            const normalizedY = y / canvas.height;
            
            let confidence = 0;
            
            if (mark) {
              if (isInMarkedWatermarkArea(normalizedX, normalizedY, mark)) {
                confidence = 0.9;
              }
            } else {
              confidence = detectWatermark(data, x, y, canvas.width, canvas.height);
            }
            
            let threshold = 0.4;
            if (processingAlgorithm === 'conservative') threshold = 0.6;
            else if (processingAlgorithm === 'aggressive') threshold = 0.3;
            
            if (confidence > threshold) {
              watermarkPixels.push({x, y, confidence});
            }
          }
        }
        
        console.log(`检测到 ${watermarkPixels.length} 个水印像素`);
        
        watermarkPixels.sort((a, b) => b.confidence - a.confidence);
        
        // Enhanced edge blending for marked areas
        if (mark) {
          const expandedPixels = expandWatermarkRegion(watermarkPixels, canvas.width, canvas.height, mark);
          watermarkPixels.push(...expandedPixels);
        }
        
        watermarkPixels.forEach(({x, y, confidence}) => {
          const index = (y * canvas.width + x) * 4;
          const repaired = repairPixel(data, x, y, canvas.width, canvas.height, confidence);
          
          if (repaired) {
            // Apply gradual blending for edge pixels in marked areas
            if (mark && isEdgePixel(x, y, canvas.width, canvas.height, mark)) {
              const blendFactor = calculateBlendFactor(x, y, canvas.width, canvas.height, mark);
              data[index] = Math.round(data[index] * (1 - blendFactor) + repaired.r * blendFactor);
              data[index + 1] = Math.round(data[index + 1] * (1 - blendFactor) + repaired.g * blendFactor);
              data[index + 2] = Math.round(data[index + 2] * (1 - blendFactor) + repaired.b * blendFactor);
              data[index + 3] = Math.round(data[index + 3] * (1 - blendFactor) + repaired.a * blendFactor);
            } else {
              data[index] = repaired.r;
              data[index + 1] = repaired.g;
              data[index + 2] = repaired.b;
              data[index + 3] = repaired.a;
            }
            processedPixels++;
          }
        });

        console.log(`修复了 ${processedPixels} 个水印像素`);
        
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('无法生成处理后的图片'));
          }
        }, 'image/png', 1.0);
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = existingProcessedUrl || URL.createObjectURL(imageFile);
    });
  };

  // Helper methods for edge blending
  const expandWatermarkRegion = (watermarkPixels: Array<{x: number, y: number, confidence: number}>, width: number, height: number, mark: WatermarkMark) => {
    const expandedPixels: Array<{x: number, y: number, confidence: number}> = [];
    const expandRadius = 3;
    
    watermarkPixels.forEach(pixel => {
      for (let dy = -expandRadius; dy <= expandRadius; dy++) {
        for (let dx = -expandRadius; dx <= expandRadius; dx++) {
          const nx = pixel.x + dx;
          const ny = pixel.y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= expandRadius) {
              expandedPixels.push({
                x: nx,
                y: ny,
                confidence: Math.max(0.2, pixel.confidence * (1 - distance / expandRadius))
              });
            }
          }
        }
      }
    });
    
    return expandedPixels;
  };

  const isEdgePixel = (x: number, y: number, width: number, height: number, mark: WatermarkMark): boolean => {
    const normalizedX = x / width;
    const normalizedY = y / height;
    const edgeThickness = 0.01; // 1% of image size
    
    return (
      (normalizedX >= mark.x - edgeThickness && normalizedX <= mark.x + edgeThickness) ||
      (normalizedX >= mark.x + mark.width - edgeThickness && normalizedX <= mark.x + mark.width + edgeThickness) ||
      (normalizedY >= mark.y - edgeThickness && normalizedY <= mark.y + edgeThickness) ||
      (normalizedY >= mark.y + mark.height - edgeThickness && normalizedY <= mark.y + mark.height + edgeThickness)
    );
  };

  const calculateBlendFactor = (x: number, y: number, width: number, height: number, mark: WatermarkMark): number => {
    const normalizedX = x / width;
    const normalizedY = y / height;
    
    const distanceToEdge = Math.min(
      Math.abs(normalizedX - mark.x),
      Math.abs(normalizedX - (mark.x + mark.width)),
      Math.abs(normalizedY - mark.y),
      Math.abs(normalizedY - (mark.y + mark.height))
    );
    
    const maxBlendDistance = 0.02;
    return Math.min(1, distanceToEdge / maxBlendDistance);
  };

  const handleRemoveWatermark = async (imageItem: ImageItem) => {
    if (isProcessing) {
      toast.error("请等待当前任务完成", { duration: 800 });
      return;
    }

    if (!imageItem?.file) {
      toast.error("请先上传图片", { duration: 800 });
      return;
    }

    setSelectedImageId(imageItem.id);
    setIsProcessing(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 12, 85));
      }, 200);

      const processedBlob = await processImageCanvas(
        imageItem.file, 
        imageItem.watermarkMark,
        imageItem.processedUrl || undefined
      );
      
      clearInterval(progressInterval);
      setProgress(100);

      const processedUrl = URL.createObjectURL(processedBlob);
      setImages(prevImages =>
        prevImages.map(img =>
          img.id === imageItem.id 
            ? { 
                ...img, 
                processedUrl: processedUrl,
                processCount: img.processCount + 1
              } 
            : img
        )
      );
      
      if (imageItem.processCount === 0) {
        toast.success("水印去除完成!", { duration: 800 });
      } else {
        toast.success(`第${imageItem.processCount + 1}次处理完成!`, { duration: 800 });
      }
    } catch (error: any) {
      console.error("Error removing watermark:", error);
      toast.error(`水印去除失败: ${error.message}`, { duration: 1200 });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setSelectedImageId(null);
    }
  };

  const handleDownload = (imageItem: ImageItem) => {
    if (imageItem.processedUrl) {
      const link = document.createElement("a");
      link.href = imageItem.processedUrl;
      link.download = `watermark_removed_${imageItem.file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("图片已开始下载!", { duration: 800 });
    } else {
      toast.error("请先去除水印", { duration: 800 });
    }
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

  const renderWatermarkMark = (mark?: WatermarkMark) => {
    if (!mark) return null;

    return (
      <div
        className={`absolute border-2 pointer-events-none ${
          selectedMark ? 'border-blue-500 bg-blue-500' : 'border-red-500 bg-red-500'
        } bg-opacity-20`}
        style={{
          left: `${mark.x * 100}%`,
          top: `${mark.y * 100}%`,
          width: `${mark.width * 100}%`,
          height: `${mark.height * 100}%`,
        }}
      >
        {selectedMark && isMarkingMode && (
          <>
            {/* Resize handles */}
            <div className="absolute w-2 h-2 bg-blue-500 border border-white -top-1 -left-1 cursor-nw-resize pointer-events-auto" />
            <div className="absolute w-2 h-2 bg-blue-500 border border-white -top-1 -right-1 cursor-ne-resize pointer-events-auto" />
            <div className="absolute w-2 h-2 bg-blue-500 border border-white -bottom-1 -left-1 cursor-sw-resize pointer-events-auto" />
            <div className="absolute w-2 h-2 bg-blue-500 border border-white -bottom-1 -right-1 cursor-se-resize pointer-events-auto" />
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
    
    return (
      <div
        className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
        style={{
          left: `${left * 100}%`,
          top: `${top * 100}%`,
          width: `${width * 100}%`,
          height: `${height * 100}%`,
        }}
      />
    );
  };

  const selectedImage = images.find(img => img.id === selectedImageId);

  return (
    <div className="h-full flex">
      {/* Left Sidebar */}
      <div className="w-80 flex-shrink-0 border-r bg-white">
        <div className="h-full flex flex-col p-4">
          {/* Progress Bar */}
          {isProcessing && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">处理进度</span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Upload Section */}
          <div className="space-y-4 flex-shrink-0">
            <div className="text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="w-full" asChild>
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    上传图片
                  </span>
                </Button>
              </label>
            </div>

            {/* Algorithm Selection */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium whitespace-nowrap">处理算法</label>
              <select
                value={processingAlgorithm}
                onChange={(e) => setProcessingAlgorithm(e.target.value as any)}
                className="flex-1 p-2 border rounded-md text-sm"
              >
                <option value="enhanced">增强模式</option>
                <option value="conservative">保守模式</option>
                <option value="aggressive">激进模式</option>
              </select>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {images.map(image => (
                <div
                  key={image.id}
                  className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleImageListClick(image.id)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block" title={image.file.name}>
                      {image.file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {image.processedUrl ? `已处理${image.processCount}次` : '未处理'}
                      {image.watermarkMark && ' • 已标记'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveWatermark(image);
                    }}
                    disabled={isProcessing}
                    className="ml-2 flex-shrink-0"
                  >
                    {isProcessing && selectedImageId === image.id ? '处理中...' : (image.processCount > 0 ? '继续处理' : '去水印')}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        <div className="flex items-center justify-between p-4 bg-white border-b flex-shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">图片处理结果</h2>
            {selectedImage && (
              <span className="text-sm text-gray-500">
                缩放: {Math.round(zoom * 100)}%
              </span>
            )}
          </div>
          {selectedImage && (
            <div className="flex items-center space-x-2">
              <Button
                variant={isMarkingMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsMarkingMode(!isMarkingMode);
                  setSelectedMark(false);
                }}
                className="text-xs"
              >
                <MapPin className="h-3 w-3 mr-1" />
                {isMarkingMode ? '退出标记' : '标记水印'}
              </Button>
              {selectedImage.watermarkMark && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearWatermarkMark(selectedImage.id)}
                  className="text-xs"
                >
                  清除标记
                </Button>
              )}
              {selectedImage.processedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreToOriginal(selectedImage.id)}
                  className="text-xs"
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  还原原图
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveWatermark(selectedImage)}
                disabled={isProcessing}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {isProcessing && selectedImageId === selectedImage.id ? '处理中...' : (selectedImage.processCount > 0 ? '继续处理' : '去水印')}
              </Button>
              {selectedImage.processedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedImage)}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  下载
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveImage(selectedImage.id)}
                className="text-xs"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        
        {selectedImage ? (
          <div className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
            {/* Original Image */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <span className="text-sm font-medium text-gray-600">原图</span>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-6 w-6 p-0"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetZoom}
                    className="h-6 px-2 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    className="h-6 w-6 p-0"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div 
                ref={originalScrollRef}
                className="flex-1 relative bg-white rounded-lg border overflow-auto min-h-0"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  syncScroll('original', target.scrollLeft, target.scrollTop);
                }}
              >
                <div className="p-4 flex items-center justify-center min-h-full">
                  <div className="relative">
                    <img
                      src={selectedImage.url}
                      alt="原图"
                      className={`block object-contain ${
                        isMarkingMode ? 'cursor-crosshair' : ''
                      }`}
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'center center'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, selectedImage.id)}
                      onMouseMove={(e) => handleMouseMove(e, selectedImage.id)}
                      onMouseUp={(e) => handleMouseUp(e, selectedImage.id)}
                      draggable={false}
                    />
                    {renderWatermarkMark(selectedImage.watermarkMark)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-6 w-6 p-0"
                    disabled={!selectedImage.processedUrl}
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetZoom}
                    className="h-6 px-2 text-xs"
                    disabled={!selectedImage.processedUrl}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    className="h-6 w-6 p-0"
                    disabled={!selectedImage.processedUrl}
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div 
                ref={processedScrollRef}
                className="flex-1 relative bg-white rounded-lg border overflow-auto min-h-0"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  syncScroll('processed', target.scrollLeft, target.scrollTop);
                }}
              >
                {selectedImage.processedUrl ? (
                  <div className="p-4 flex items-center justify-center min-h-full">
                    <div className="relative">
                      <img
                        src={selectedImage.processedUrl}
                        alt="处理后"
                        className={`block object-contain ${
                          isMarkingMode ? 'cursor-crosshair' : ''
                        }`}
                        style={{
                          transform: `scale(${zoom})`,
                          transformOrigin: 'center center'
                        }}
                        onMouseDown={(e) => handleMouseDown(e, selectedImage.id)}
                        onMouseMove={(e) => handleMouseMove(e, selectedImage.id)}
                        onMouseUp={(e) => handleMouseUp(e, selectedImage.id)}
                        draggable={false}
                      />
                      {isMarkingMode && renderWatermarkMark(selectedImage.watermarkMark)}
                      {isMarkingMode && renderDragPreview()}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                    {isProcessing && selectedImageId === selectedImage.id ? (
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
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">请从左侧列表中选择一张图片进行处理</p>
              <p className="text-sm text-gray-400">上传后将在此处看到图片对比</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatermarkRemover;
