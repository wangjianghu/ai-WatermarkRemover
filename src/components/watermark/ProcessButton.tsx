
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

  const handleClick = (e: React.MouseEvent) => {
    if (isListItem) e.stopPropagation();
    if (!isDisabled) {
      onClick(imageItem);
    }
  };

  const buttonText = isTaskRunning && selectedImageId === imageItem.id
    ? "处理中..."
    : imageItem.processCount > 0
    ? "继续处理"
    : "去水印";

  // 如果按钮被禁用且有提示信息，使用tooltip包装
  if (isDisabled && tooltipMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={true}
              className="text-xs cursor-not-allowed"
            >
              {buttonText}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // 如果按钮未被禁用，直接返回按钮
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={false}
      className="text-xs"
    >
      {buttonText}
    </Button>
  );
};

export default ProcessButton;
