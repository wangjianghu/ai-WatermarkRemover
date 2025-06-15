
import { useState } from 'react';
import { ImageItem, ProcessingAlgorithm } from '@/components/watermark/types';
import { toast } from 'sonner';
import { processImageCanvas } from '@/components/watermark/imageProcessor';
import { validateWatermarkMark } from '@/utils/apiSecurity';
import { handleSecureError } from '@/utils/secureErrorHandler';
import { memoryManager } from '@/utils/memoryManager';

export const useImageProcessing = (
  updateImage: (imageId: string, updates: Partial<ImageItem>) => void
) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ [key: string]: number }>({});
  const [processingAlgorithm, setProcessingAlgorithm] = useState<ProcessingAlgorithm>('lama');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const handleRemoveWatermark = async (imageItem: ImageItem) => {
    if (!imageItem.isMarkingCompleted || !imageItem.watermarkMark) {
      toast.error("请先完成水印标记", { duration: 1000 });
      return;
    }
    if (isProcessing || isBatchProcessing) {
      toast.error("请等待当前任务完成", { duration: 800 });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setSelectedImageId(imageItem.id);
    
    try {
      // Validate watermark mark before processing
      const validation = validateWatermarkMark(imageItem.watermarkMark);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      toast.info("开始处理图片...", { duration: 800 });
      const progressInterval = setInterval(() => setProgress(prev => Math.min(prev + 5, 90)), 100);
      
      const processedBlob = await processImageCanvas(
        imageItem.file, 
        imageItem.watermarkMark, 
        processingAlgorithm, 
        imageItem.processedUrl || undefined
      );
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // Clean up old processed URL
      if (imageItem.processedUrl) {
        memoryManager.releaseBlobUrl(imageItem.processedUrl);
      }
      
      const processedUrl = URL.createObjectURL(processedBlob);
      memoryManager.trackBlobUrl(processedUrl);
      
      updateImage(imageItem.id, { 
        processedUrl, 
        processCount: imageItem.processCount + 1 
      });
      toast.success(`图片处理完成！${imageItem.processCount > 0 ? '继续优化' : '水印已去除'}`, { duration: 1500 });
    } catch (error: any) {
      const errorMessage = handleSecureError(error, 'watermark-removal', 'high');
      toast.error(errorMessage, { duration: 1500 });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setSelectedImageId(null);
    }
  };

  const handleBatchProcess = async (images: ImageItem[]) => {
    if (isProcessing || isBatchProcessing) {
      toast.error("请等待当前任务完成", { duration: 800 });
      return;
    }
    const imagesToProcess = images.filter(img => img.watermarkMark && img.isMarkingCompleted);
    if (imagesToProcess.length === 0) {
      toast.error("请先为图片标记水印并完成标记", { duration: 1000 });
      return;
    }
    setIsBatchProcessing(true);
    setBatchProgress({});
    try {
      toast.info(`开始批量处理 ${imagesToProcess.length} 张已完成标记的图片`, { duration: 1000 });
      for (let i = 0; i < imagesToProcess.length; i++) {
        const imageItem = imagesToProcess[i];
        setBatchProgress(prev => ({ ...prev, [imageItem.id]: 0 }));
        try {
          const progressInterval = setInterval(() => setBatchProgress(prev => ({ ...prev, [imageItem.id]: Math.min((prev[imageItem.id] || 0) + 10, 85) })), 100);
          const processedBlob = await processImageCanvas(imageItem.file, imageItem.watermarkMark, processingAlgorithm, imageItem.processedUrl || undefined);
          clearInterval(progressInterval);
          setBatchProgress(prev => ({ ...prev, [imageItem.id]: 100 }));
          
          // Clean up old processed URL
          if (imageItem.processedUrl) {
            memoryManager.releaseBlobUrl(imageItem.processedUrl);
          }
          
          const processedUrl = URL.createObjectURL(processedBlob);
          memoryManager.trackBlobUrl(processedUrl);
          
          updateImage(imageItem.id, { 
            processedUrl, 
            processCount: imageItem.processCount + 1 
          });
          console.log(`批量处理进度: ${i + 1}/${imagesToProcess.length} - ${imageItem.file.name}`);
        } catch (error: any) {
          console.error(`处理图片 ${imageItem.file.name} 失败:`, error);
          setBatchProgress(prev => ({ ...prev, [imageItem.id]: -1 }));
        }
      }
      const successCount = Object.values(batchProgress).filter(p => p === 100).length;
      const failedCount = Object.values(batchProgress).filter(p => p === -1).length;
      if (successCount > 0) {
        toast.success(`批量处理完成！成功处理 ${successCount} 张图片${failedCount > 0 ? `，失败 ${failedCount} 张` : ''}`, { duration: 2000 });
      } else {
        toast.error("批量处理失败，请检查图片格式", { duration: 1500 });
      }
    } catch (error: any) {
      console.error("批量处理错误:", error);
      toast.error(`批量处理失败: ${error.message}`, { duration: 1500 });
    } finally {
      setIsBatchProcessing(false);
      setBatchProgress({});
    }
  };

  return {
    isProcessing,
    progress,
    isBatchProcessing,
    batchProgress,
    processingAlgorithm,
    selectedImageId: selectedImageId,
    setProcessingAlgorithm,
    handleRemoveWatermark,
    handleBatchProcess
  };
};
