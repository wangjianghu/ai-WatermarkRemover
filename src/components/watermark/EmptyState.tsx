
import React from 'react';

interface EmptyStateProps {
  onToggleSidebar: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onToggleSidebar }) => {
  return (
    <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
      <div className="text-center max-w-md">
        <p className="text-base md:text-lg mb-2">请从左侧列表中选择一张图片进行处理</p>
        <p className="text-sm text-gray-400">上传后将在此处看到图片对比</p>
        <button 
          className="lg:hidden mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          onClick={onToggleSidebar}
        >
          打开图片列表
        </button>
      </div>
    </div>
  );
};

export default EmptyState;
