
import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Play, Info, Settings, Trash2 } from 'lucide-react';
import { ImageItem } from './types';
import ProcessButton from './ProcessButton';
import { toast } from 'sonner';

interface SidebarProps {
  images: ImageItem[];
  selectedImageId: string | null;
  processingAlgorithm: string;
  isProcessing: boolean;
  isBatchProcessing: boolean;
  batchProgress: { [key: string]: number };
  sdApiKey: string;
  isApiConfigOpen: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBatchProcess: () => void;
  onAlgorithmChange: (value: string) => void;
  onImageSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  setSdApiKey: (key: string) => void;
  setIsApiConfigOpen: (isOpen: boolean) => void;
  handleRemoveWatermark: (imageItem: ImageItem) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  images,
  selectedImageId,
  processingAlgorithm,
  isProcessing,
  isBatchProcessing,
  batchProgress,
  sdApiKey,
  isApiConfigOpen,
  onFileUpload,
  onBatchProcess,
  onAlgorithmChange,
  onImageSelect,
  onRemoveImage,
  setSdApiKey,
  setIsApiConfigOpen,
  handleRemoveWatermark,
}) => {
  return (
    <div className="w-80 flex-shrink-0 border-r bg-white">
      <div className="h-full flex flex-col p-4">
        {/* Upload Section */}
        <div className="space-y-3 flex-shrink-0">
          <div className="text-center">
            <input type="file" accept="image/*" multiple onChange={onFileUpload} className="hidden" id="file-upload" />
            <label htmlFor="file-upload">
              <Button variant="outline" className="w-full" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  上传图片
                </span>
              </Button>
            </label>
          </div>

          {images.length > 0 && (
            <Button
              onClick={onBatchProcess}
              disabled={isProcessing || isBatchProcessing || images.filter(img => img.watermarkMark && img.isMarkingCompleted).length === 0}
              className="w-full"
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              {isBatchProcessing ? '批量处理中...' : `批量处理已完成标记图片 (${images.filter(img => img.watermarkMark && img.isMarkingCompleted).length})`}
            </Button>
          )}

          {/* Algorithm Selection */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium whitespace-nowrap">处理算法</label>
            <div className="flex items-center space-x-2 flex-1">
              <select value={processingAlgorithm} onChange={e => onAlgorithmChange(e.target.value)} className="flex-1 p-2 border rounded-md text-sm" style={{ maxWidth: '120px' }}>
                <option value="lama">LaMa算法</option>
                <option value="sd-inpainting">AI智能填充</option>
                <option value="enhanced">增强模式</option>
                <option value="conservative">保守模式</option>
                <option value="aggressive">激进模式</option>
              </select>
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-8 w-8 p-0"><Info className="h-4 w-4" /></Button></PopoverTrigger>
                <PopoverContent className="w-80" side="bottom" align="center">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">处理算法说明</h4>
                      <p className="text-xs text-gray-600 mb-3">不同算法的特点和适用场景</p>
                    </div>
                    <div className="space-y-3">
                      <div><h4 className="font-medium text-purple-600 mb-1 text-xs">AI智能填充 (最新)</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 🧠 基于Stable Diffusion技术</li><li>• 🎨 智能理解图像语义内容</li><li>• ✨ 重新生成符合逻辑的细节</li><li>• 🔍 高清纹理修复和填充</li><li>• 🚀 适合复杂背景和精细修复</li></ul></div>
                      <div><h4 className="font-medium text-blue-600 mb-1 text-xs">LaMa算法 (推荐)</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 🎯 专业大遮罩修复技术</li><li>• 🧠 AI智能纹理分析</li><li>• ✨ 多尺度语义修复</li><li>• 🎨 保持图像自然性</li><li>• 🚀 针对标记区域优化</li></ul></div>
                      <div><h4 className="font-medium text-green-600 mb-1 text-xs">增强模式</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 📊 基于多特征检测算法</li><li>• 🔍 智能水印置信度分析</li><li>• 🎯 加权像素修复技术</li><li>• ⚖️ 平衡质量与效果</li><li>• 💎 适合大部分水印类型</li></ul></div>
                      <div><h4 className="font-medium text-orange-600 mb-1 text-xs">保守模式</h4><ul className="text-xs space-y-1 text-gray-700"><li>• 🛡️ 高阈值检测算法</li><li>• 🎨 温和梯度修复技术</li><li>• 🔒 严格边缘保护机制</li><li>• 📐 精确纹理保持算法</li><li>• 🎯 适合精细图像处理</li></ul></div>
                      <div><h4 className="font-medium text-red-600 mb-1 text-xs">激进模式</h4><ul className="text-xs space-y-1 text-gray-700"><li>• ⚡ 低阈值检测算法</li><li>• 🔥 强力像素替换技术</li><li>• 💪 多轮迭代修复机制</li><li>• 🎯 高强度水印去除</li><li>• ⚠️ 可能影响图像细节</li></ul></div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {processingAlgorithm === 'sd-inpainting' && (
                <Dialog open={isApiConfigOpen} onOpenChange={setIsApiConfigOpen}>
                  <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 w-8 p-0"><Settings className="h-4 w-4" /></Button></DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>配置 AI 智能填充 API</DialogTitle><DialogDescription>请输入您的 Stable Diffusion API 密钥以使用 AI 智能填充功能</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4"><label htmlFor="api-key" className="text-right text-sm font-medium">API 密钥</label><input id="api-key" type="password" value={sdApiKey} onChange={(e) => setSdApiKey(e.target.value)} className="col-span-3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入您的 API 密钥" /></div>
                      <div className="text-xs text-gray-500 mt-2"><p>• API 密钥将保存在本地存储中</p><p>• 如需获取 API 密钥，请访问相关服务提供商</p></div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsApiConfigOpen(false)}>取消</Button>
                      <Button onClick={() => { localStorage.setItem('sd-api-key', sdApiKey); setIsApiConfigOpen(false); toast.success('API 密钥已保存', { duration: 1000 }); }}>保存</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* Image List */}
        <ScrollArea className="flex-1 pt-3">
          <div className="space-y-2">
            {images.map(image => (
              <div key={image.id} className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`} onClick={() => onImageSelect(image.id)}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block" title={image.file.name}>{image.file.name}</span>
                  <span className="text-xs text-gray-500">
                    {image.processedUrl ? `已处理${image.processCount}次` : '未处理'}
                    {image.watermarkMark ? (image.isMarkingCompleted ? ' • 已完成标记' : ' • 已标记未确认') : ' • 未标记'}
                    {isBatchProcessing && batchProgress[image.id] !== undefined && (
                      <>
                        {batchProgress[image.id] === -1 ? ' • 处理失败' : batchProgress[image.id] === 100 ? ' • 处理完成' : ` • 处理中 ${batchProgress[image.id]}%`}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                  <ProcessButton imageItem={image} isListItem={true} onClick={handleRemoveWatermark} isProcessing={isProcessing} isBatchProcessing={isBatchProcessing} selectedImageId={selectedImageId} />
                  <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); onRemoveImage(image.id); }} className="text-xs" disabled={isBatchProcessing}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default Sidebar;
