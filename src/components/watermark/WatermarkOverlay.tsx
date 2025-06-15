
import React from 'react';
import { WatermarkMark, DragState } from './types';

interface WatermarkOverlayProps {
  mark?: WatermarkMark;
  isMarkingMode: boolean;
  selectedMark: boolean;
  zoom: number;
  dragState: DragState;
}

const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  mark,
  isMarkingMode,
  selectedMark,
  zoom,
  dragState
}) => {
  const renderWatermarkMark = () => {
    if (!mark) return null;
    return (
      <div className="absolute pointer-events-none transition-all duration-150 ease-out" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.width * 100}%`, height: `${mark.height * 100}%` }}>
        <div className={`absolute inset-0 ${isMarkingMode ? 'bg-transparent' : 'bg-blue-500 bg-opacity-10'} transition-colors duration-200`} />
        <div className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-sm opacity-90 transition-all duration-200" style={{ borderWidth: `${Math.max(1, 2 / zoom)}px` }} />
        {selectedMark && isMarkingMode && (
          <>
            {[{ pos: 'nw', style: { top: -1, left: -1 }, cursor: 'nw-resize' }, { pos: 'ne', style: { top: -1, right: -1 }, cursor: 'ne-resize' }, { pos: 'sw', style: { bottom: -1, left: -1 }, cursor: 'sw-resize' }, { pos: 'se', style: { bottom: -1, right: -1 }, cursor: 'se-resize' }, { pos: 'n', style: { top: -0.5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' }, { pos: 'e', style: { right: -0.5, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' }, { pos: 's', style: { bottom: -0.5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' }, { pos: 'w', style: { left: -0.5, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' }].map(({ pos, style, cursor }) => (
              <div key={pos} className="absolute bg-blue-600 border-2 border-white rounded-full pointer-events-auto hover:bg-blue-700 hover:scale-110 transition-all duration-150 shadow-lg" style={{ ...style, width: `${Math.max(8, 12 / zoom)}px`, height: `${Math.max(8, 12 / zoom)}px`, cursor }} />
            ))}
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
    return <div className="absolute border-2 border-dashed border-blue-500 bg-transparent pointer-events-none transition-all duration-75 rounded-sm" style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`, borderWidth: `${Math.max(1, 2 / zoom)}px` }} />;
  };

  return (
    <>
      {renderWatermarkMark()}
      {renderDragPreview()}
    </>
  );
};

export default WatermarkOverlay;
