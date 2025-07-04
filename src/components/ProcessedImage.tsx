
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Trash2, Eye, EyeOff, Play } from "lucide-react";

interface ProcessedImageData {
  id: string;
  originalFile: File;
  originalUrl: string;
  processedUrl: string | null;
  isProcessing: boolean;
  progress: number;
}

interface ProcessedImageProps {
  image: ProcessedImageData;
  showOriginal: boolean;
  onProcess: () => void;
  onRemove: () => void;
  onDownload: () => void;
  onToggleView: () => void;
}

export const ProcessedImage: React.FC<ProcessedImageProps> = ({
  image,
  showOriginal,
  onProcess,
  onRemove,
  onDownload,
  onToggleView
}) => {
  const displayUrl = showOriginal ? image.originalUrl : (image.processedUrl || image.originalUrl);
  const fileName = image.originalFile.name;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square">
        <img
          src={displayUrl}
          alt={fileName}
          className="w-full h-full object-cover"
        />
        
        {/* 图片状态标识 */}
        <div className="absolute top-2 left-2">
          {image.processedUrl && (
            <span className={`px-2 py-1 text-xs rounded-full text-white ${
              showOriginal 
                ? 'bg-gray-500' 
                : 'bg-green-600'
            }`}>
              {showOriginal ? '原图' : '已处理'}
            </span>
          )}
        </div>

        {/* 处理进度 */}
        {image.isProcessing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-background/90 rounded-lg p-4 text-center min-w-[200px]">
              <div className="text-sm font-medium text-foreground mb-2">
                正在去除水印...
              </div>
              <Progress value={image.progress} className="w-full" />
              <div className="text-xs text-muted-foreground mt-1">
                {image.progress}%
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="text-sm text-foreground/80 mb-3 truncate" title={fileName}>
          {fileName}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {!image.processedUrl && !image.isProcessing && (
            <Button
              onClick={onProcess}
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              <Play className="w-3 h-3 mr-1" />
              处理
            </Button>
          )}
          
          {image.processedUrl && (
            <>
              <Button
                onClick={onToggleView}
                size="sm"
                variant="outline"
              >
                {showOriginal ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                {showOriginal ? '看处理后' : '看原图'}
              </Button>
              
              <Button
                onClick={onDownload}
                size="sm"
                variant="outline"
              >
                <Download className="w-3 h-3 mr-1" />
                下载
              </Button>
            </>
          )}
          
          <Button
            onClick={onRemove}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
