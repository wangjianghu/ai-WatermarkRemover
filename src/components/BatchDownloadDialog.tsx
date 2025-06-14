
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface ImageItem {
  id: string;
  file: File;
  processedUrl: string | null;
  processCount: number;
}

interface BatchDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
}

const BatchDownloadDialog: React.FC<BatchDownloadDialogProps> = ({ isOpen, onClose, images }) => {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  // 只显示已处理的图片
  const processedImages = images.filter(img => img.processedUrl);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedImages(new Set(processedImages.map(img => img.id)));
    } else {
      setSelectedImages(new Set());
    }
  };

  const handleSelectImage = (imageId: string, checked: boolean) => {
    const newSelected = new Set(selectedImages);
    if (checked) {
      newSelected.add(imageId);
    } else {
      newSelected.delete(imageId);
    }
    setSelectedImages(newSelected);
  };

  const handleBatchDownload = async () => {
    if (selectedImages.size === 0) {
      toast.error("请选择要下载的图片", { duration: 800 });
      return;
    }

    const selectedImageData = processedImages.filter(img => selectedImages.has(img.id));
    
    try {
      // 批量下载
      for (const image of selectedImageData) {
        if (image.processedUrl) {
          const link = document.createElement("a");
          link.href = image.processedUrl;
          link.download = `watermark_removed_${image.file.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // 添加小延迟避免浏览器阻止多个下载
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      toast.success(`成功下载 ${selectedImages.size} 张图片!`, { duration: 1000 });
      onClose();
      setSelectedImages(new Set());
    } catch (error) {
      toast.error("下载失败，请重试", { duration: 800 });
    }
  };

  const isAllSelected = processedImages.length > 0 && selectedImages.size === processedImages.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量下载已处理图片</DialogTitle>
          <DialogDescription>
            选择要下载的已处理图片 ({processedImages.length} 张可用)
          </DialogDescription>
        </DialogHeader>
        
        {processedImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无已处理的图片
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b pb-3">
              <Checkbox
                id="select-all"
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                全选 ({processedImages.length} 张)
              </label>
            </div>
            
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {processedImages.map(image => (
                  <div key={image.id} className="flex items-center space-x-3 p-2 rounded border hover:bg-gray-50">
                    <Checkbox
                      id={`image-${image.id}`}
                      checked={selectedImages.has(image.id)}
                      onCheckedChange={(checked) => handleSelectImage(image.id, !!checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block" title={image.file.name}>
                        {image.file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        已处理 {image.processCount} 次
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-sm text-gray-600">
                已选择 {selectedImages.size} 张图片
              </span>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={onClose}>
                  取消
                </Button>
                <Button onClick={handleBatchDownload} disabled={selectedImages.size === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  下载选中图片
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BatchDownloadDialog;
