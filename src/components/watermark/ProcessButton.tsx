
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageItem } from './types';

interface ProcessButtonProps {
  imageItem: ImageItem;
  isListItem?: boolean;
  onClick: (imageItem: ImageItem) => void;
  isProcessing: boolean;
  isBatchProcessing: boolean;
  selectedImageId: string | null;
}

const ProcessButton: React.FC<ProcessButtonProps> = ({
  imageItem,
  isListItem = false,
  onClick,
  isProcessing,
  isBatchProcessing,
  selectedImageId,
}) => {
  const isTaskRunning = isProcessing || isBatchProcessing;
  const needsMarking = !imageItem.watermarkMark;
  const needsCompletion = imageItem.watermarkMark && !imageItem.isMarkingCompleted;
  const isDisabled = isTaskRunning || needsMarking || needsCompletion;

  let tooltipMessage = "";
  if (needsMarking) {
    tooltipMessage = "请先标记水印位置";
  } else if (needsCompletion) {
    tooltipMessage = "请先确认完成水印标记";
  } else if (isTaskRunning) {
    tooltipMessage = "请等待当前任务完成";
  }

  const buttonComponent = (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        if (isListItem) e.stopPropagation();
        onClick(imageItem);
      }}
      disabled={isDisabled}
      className={`text-xs ${isDisabled ? "cursor-not-allowed" : ""}`}
    >
      {isTaskRunning && selectedImageId === imageItem.id
        ? "处理中..."
        : imageItem.processCount > 0
        ? "继续处理"
        : "去水印"}
    </Button>
  );

  if (isDisabled && tooltipMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block">{buttonComponent}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonComponent;
};

export default ProcessButton;

