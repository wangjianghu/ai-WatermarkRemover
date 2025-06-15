
import { useState, useCallback, useEffect } from 'react';
import { ImageItem } from '@/components/watermark/types';
import { toast } from 'sonner';
import { memoryManager } from '@/utils/memoryManager';
import { handleSecureError } from '@/utils/secureErrorHandler';

export const useImageState = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  useEffect(() => {
    if (images.length > 0 && !selectedImageId) {
      setSelectedImageId(images[0].id);
    }
  }, [images, selectedImageId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      memoryManager.cleanup();
    };
  }, []);

  const addImages = useCallback((newImages: ImageItem[]) => {
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const updateImage = useCallback((imageId: string, updates: Partial<ImageItem>) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, ...updates } : img
    ));
  }, []);

  const updateImages = useCallback((updater: (prev: ImageItem[]) => ImageItem[]) => {
    setImages(updater);
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove) {
        // Clean up blob URLs
        if (imageToRemove.url) {
          memoryManager.releaseBlobUrl(imageToRemove.url);
        }
        if (imageToRemove.processedUrl) {
          memoryManager.releaseBlobUrl(imageToRemove.processedUrl);
        }
      }
      
      const newImages = prev.filter(img => img.id !== imageId);
      if (selectedImageId === imageId) {
        setSelectedImageId(newImages.length > 0 ? newImages[0].id : null);
      }
      return newImages;
    });
  }, [selectedImageId]);

  const restoreToOriginal = useCallback((imageId: string) => {
    try {
      const image = images.find(img => img.id === imageId);
      if (image?.processedUrl) {
        memoryManager.releaseBlobUrl(image.processedUrl);
      }
      updateImage(imageId, { 
        processedUrl: null, 
        processCount: 0, 
        watermarkMark: undefined, 
        isMarkingCompleted: false 
      });
      toast.success("已还原到原图状态", { duration: 800 });
    } catch (error: any) {
      const errorMessage = handleSecureError(error, 'image-restore', 'medium');
      toast.error(errorMessage, { duration: 1000 });
    }
  }, [images, updateImage]);

  const selectedImage = images.find(img => img.id === selectedImageId);

  return {
    images,
    selectedImageId,
    selectedImage,
    setSelectedImageId,
    addImages,
    updateImage,
    updateImages,
    removeImage,
    restoreToOriginal
  };
};
