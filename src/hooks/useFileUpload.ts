
import { useCallback } from 'react';
import { ImageItem } from '@/components/watermark/types';
import { toast } from 'sonner';
import { validateFileUpload, validateImageDimensions } from '@/utils/apiSecurity';
import { validateFileContent } from '@/utils/fileContentValidator';
import { memoryManager } from '@/utils/memoryManager';
import { handleSecureError } from '@/utils/secureErrorHandler';

export const useFileUpload = (
  images: ImageItem[],
  addImages: (newImages: ImageItem[]) => void
) => {
  const loadImageDimensions = useCallback((file: File): Promise<{ width: number, height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const validation = validateImageDimensions(img.naturalWidth, img.naturalHeight);
          if (!validation.isValid) {
            reject(new Error(validation.error));
            return;
          }
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        } catch (error) {
          reject(new Error(handleSecureError(error, 'image-dimension-validation', 'medium')));
        }
      };
      img.onerror = () => reject(new Error('无法加载图片'));
      
      try {
        const url = URL.createObjectURL(file);
        memoryManager.trackBlobUrl(url);
        img.src = url;
      } catch (error) {
        reject(new Error(handleSecureError(error, 'image-url-creation', 'medium')));
      }
    });
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate files with enhanced security
    const validFiles: File[] = [];
    const maxConcurrentValidations = 5; // Prevent DoS
    
    for (let i = 0; i < Math.min(files.length, maxConcurrentValidations); i++) {
      const file = files[i];
      
      try {
        // Basic validation
        const basicValidation = validateFileUpload(file);
        if (!basicValidation.isValid) {
          toast.error(`${file.name}: ${basicValidation.error}`, { duration: 3000 });
          continue;
        }

        // Content validation
        const contentValidation = await validateFileContent(file);
        if (!contentValidation.isValid) {
          toast.error(`${file.name}: ${contentValidation.error}`, { duration: 3000 });
          continue;
        }

        // Show warnings if any
        if (contentValidation.warnings && contentValidation.warnings.length > 0) {
          contentValidation.warnings.forEach(warning => {
            toast.warning(`${file.name}: ${warning}`, { duration: 2000 });
          });
        }

        validFiles.push(file);
      } catch (error: any) {
        const errorMessage = handleSecureError(error, 'file-upload-validation', 'medium');
        toast.error(`${file.name}: ${errorMessage}`, { duration: 3000 });
      }
    }

    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    // Limit total number of images
    const maxImages = 20;
    if (images.length + validFiles.length > maxImages) {
      toast.error(`最多只能上传 ${maxImages} 张图片`, { duration: 2000 });
      event.target.value = '';
      return;
    }

    try {
      const newImages = await Promise.all(validFiles.map(async file => {
        try {
          const dimensions = await loadImageDimensions(file);
          const url = URL.createObjectURL(file);
          memoryManager.trackBlobUrl(url);
          
          return {
            id: crypto.randomUUID(),
            file,
            url,
            processedUrl: null,
            rotation: 0,
            dimensions,
            watermarkMark: undefined,
            processCount: 0,
            isMarkingCompleted: false,
          } as ImageItem;
        } catch (error: any) {
          const errorMessage = handleSecureError(error, 'image-loading', 'medium');
          toast.error(`${file.name}: ${errorMessage}`, { duration: 2000 });
          return null;
        }
      }));

      const validImages = newImages.filter(img => img !== null) as ImageItem[];
      addImages(validImages);
      
      if (validImages.length > 0) {
        toast.success(`成功上传 ${validImages.length} 张图片`, { duration: 1000 });
      }
    } catch (error: any) {
      const errorMessage = handleSecureError(error, 'file-upload-processing', 'high');
      toast.error(errorMessage, { duration: 2000 });
    } finally {
      event.target.value = '';
    }
  }, [images.length, addImages, loadImageDimensions]);

  return {
    handleFileUpload
  };
};
