
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Trash2, Play, Loader2 } from 'lucide-react';
import type { ImageItem } from './WatermarkRemover';

interface ImageComparisonRowProps {
  image: ImageItem;
  isProcessing: boolean;
  onProcess: (image: ImageItem) => void;
  onDownload: (image: ImageItem) => void;
  onRemove: (imageId: string) => void;
}

export const ImageComparisonRow: React.FC<ImageComparisonRowProps> = ({
  image,
  isProcessing,
  onProcess,
  onDownload,
  onRemove,
}) => {
  return (
    <Card className="bg-white/10 backdrop-blur-lg border border-white/20 text-white">
      <CardHeader>
        <CardTitle className="truncate text-base">{image.file.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-center mb-2 text-white/80">原始图片</h3>
            <div className="aspect-video border rounded-lg overflow-hidden bg-black/20 border-white/20">
              <img src={image.url} alt="Original" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-center mb-2 text-white/80">处理结果</h3>
            <div className="aspect-video border rounded-lg overflow-hidden bg-black/20 border-white/20 flex items-center justify-center">
              {image.processedUrl ? (
                <img src={image.processedUrl} alt="Processed" className="w-full h-full object-contain" />
              ) : (
                <div className="text-sm text-white/60">{isProcessing ? "处理中..." : "待处理"}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {!image.processedUrl && (
          <Button onClick={() => onProcess(image)} disabled={isProcessing} size="sm" className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {isProcessing ? '处理中...' : '去除水印'}
          </Button>
        )}
        {image.processedUrl && (
          <Button onClick={() => onDownload(image)} size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10">
            <Download className="w-4 h-4 mr-2" />
            下载
          </Button>
        )}
        <Button onClick={() => onRemove(image.id)} size="sm" variant="outline" className="border-red-300 text-red-300 hover:bg-red-500/10">
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};
