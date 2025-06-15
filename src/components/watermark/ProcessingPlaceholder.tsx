
import React from 'react';
import { Progress } from '@/components/ui/progress';

interface ProcessingPlaceholderProps {
  isProcessing: boolean;
  progress: number;
}

const ProcessingPlaceholder: React.FC<ProcessingPlaceholderProps> = ({
  isProcessing,
  progress
}) => {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
        <span className="text-xs font-medium text-gray-600">处理后</span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-white rounded-lg border">
        <div className="text-center text-gray-400">
          {isProcessing ? (
            <div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-sm mb-2">正在处理...</div>
              <Progress value={progress} className="w-32 h-2 mx-auto" />
              <div className="text-xs mt-1">{progress}%</div>
            </div>
          ) : (
            <div className="text-sm">等待处理</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessingPlaceholder;
