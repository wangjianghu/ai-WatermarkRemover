
import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, Settings } from 'lucide-react';
import { ProcessingAlgorithm } from './types';
import ApiConfigDialog from './ApiConfigDialog';

interface AlgorithmSelectorProps {
  processingAlgorithm: ProcessingAlgorithm;
  sdApiKey: string;
  isApiConfigOpen: boolean;
  onAlgorithmChange: (value: ProcessingAlgorithm) => void;
  setSdApiKey: (key: string) => void;
  setIsApiConfigOpen: (isOpen: boolean) => void;
}

const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
  processingAlgorithm,
  sdApiKey,
  isApiConfigOpen,
  onAlgorithmChange,
  setSdApiKey,
  setIsApiConfigOpen,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">处理算法</label>
      <div className="flex items-center gap-2">
        <select 
          value={processingAlgorithm} 
          onChange={e => onAlgorithmChange(e.target.value as ProcessingAlgorithm)} 
          className="flex-1 p-2 border rounded-md text-xs lg:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
        >
          <option value="lama">LaMa算法</option>
          <option value="sd-inpainting">AI智能填充</option>
          <option value="enhanced">增强模式</option>
          <option value="conservative">保守模式</option>
          <option value="aggressive">激进模式</option>
        </select>
        
        {/* 算法信息 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 lg:w-80" side="bottom" align="center">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">处理算法说明</h4>
                <p className="text-xs text-gray-600 mb-3">不同算法的特点和适用场景</p>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                <div><h4 className="font-medium text-purple-600 mb-1 text-xs">AI智能填充 (最新)</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 🧠 基于Stable Diffusion技术</li><li>• 🎨 智能理解图像语义内容</li><li>• ✨ 重新生成符合逻辑的细节</li><li>• 🔍 高清纹理修复和填充</li><li>• 🚀 适合复杂背景和精细修复</li></ul></div>
                <div><h4 className="font-medium text-blue-600 mb-1 text-xs">LaMa算法 (推荐)</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 🎯 专业大遮罩修复技术</li><li>• 🧠 AI智能纹理分析</li><li>• ✨ 多尺度语义修复</li><li>• 🎨 保持图像自然性</li><li>• 🚀 针对标记区域优化</li></ul></div>
                <div><h4 className="font-medium text-green-600 mb-1 text-xs">增强模式</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 📊 基于多特征检测算法</li><li>• 🔍 智能水印置信度分析</li><li>• 🎯 加权像素修复技术</li><li>• ⚖️ 平衡质量与效果</li><li>• 💎 适合大部分水印类型</li></ul></div>
                <div><h4 className="font-medium text-orange-600 mb-1 text-xs">保守模式</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 🛡️ 高阈值检测算法</li><li>• 🎨 温和梯度修复技术</li><li>• 🔒 严格边缘保护机制</li><li>• 📐 精确纹理保持算法</li><li>• 🎯 适合精细图像处理</li></ul></div>
                <div><h4 className="font-medium text-red-600 mb-1 text-xs">激进模式</h4><ul className="text-xs space-y-1 text-gray-700"><li>• ⚡ 低阈值检测算法</li><li>• 🔥 强力像素替换技术</li><li>• 💪 多轮迭代修复机制</li><li>• 🎯 高强度水印去除</li><li>• ⚠️ 可能影响图像细节</li></ul></div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* API配置 */}
        {processingAlgorithm === 'sd-inpainting' && (
          <ApiConfigDialog
            isOpen={isApiConfigOpen}
            onOpenChange={setIsApiConfigOpen}
            sdApiKey={sdApiKey}
            setSdApiKey={setSdApiKey}
          />
        )}
      </div>
    </div>
  );
};

export default AlgorithmSelector;
