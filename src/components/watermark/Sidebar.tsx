import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Play, Info, Settings, Trash2, CheckCircle, XCircle, Loader2, X } from 'lucide-react';
import { ImageItem, ProcessingAlgorithm } from './types';
import ProcessButton from './ProcessButton';
import { toast } from 'sonner';
import { validateApiKey, sanitizeInput } from '@/utils/apiSecurity';
import { secureApiClient } from '@/utils/secureApiClient';

interface SidebarProps {
  images: ImageItem[];
  selectedImageId: string | null;
  processingAlgorithm: ProcessingAlgorithm;
  isProcessing: boolean;
  isBatchProcessing: boolean;
  batchProgress: { [key: string]: number };
  sdApiKey: string;
  isApiConfigOpen: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBatchProcess: () => void;
  onAlgorithmChange: (value: ProcessingAlgorithm) => void;
  onImageSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  setSdApiKey: (key: string) => void;
  setIsApiConfigOpen: (isOpen: boolean) => void;
  handleRemoveWatermark: (imageItem: ImageItem) => void;
  onCloseSidebar?: () => void;
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
  onCloseSidebar,
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const validateApiKey = async () => {
    const sanitizedKey = sanitizeInput(sdApiKey);
    
    if (!sanitizedKey.trim()) {
      toast.error('请先输入API密钥');
      return;
    }

    setIsValidating(true);
    setValidationStatus('idle');

    try {
      secureApiClient.setApiKey(sanitizedKey);
      const result = await secureApiClient.validateApiKey();
      
      if (result.success) {
        setValidationStatus('success');
        toast.success('API密钥验证成功！', { duration: 2000 });
      } else {
        setValidationStatus('error');
        toast.error(result.error || 'API密钥验证失败', { duration: 2000 });
        secureApiClient.clearApiKey();
      }
    } catch (error: any) {
      setValidationStatus('error');
      toast.error('API密钥格式无效', { duration: 2000 });
      secureApiClient.clearApiKey();
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveApiKey = () => {
    if (validationStatus !== 'success') {
      toast.error('请先验证API密钥', { duration: 1000 });
      return;
    }
    
    localStorage.removeItem('sd-api-key');
    setIsApiConfigOpen(false);
    toast.success('API 密钥已安全保存', { duration: 1000 });
  };

  const handleApiKeyChange = (value: string) => {
    const sanitized = sanitizeInput(value);
    setSdApiKey(sanitized);
    
    if (validationStatus !== 'idle') {
      setValidationStatus('idle');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r lg:border-r-gray-200">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">图片处理工具</h3>
        {onCloseSidebar && (
          <button 
            onClick={onCloseSidebar}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-3 lg:p-4 min-h-0">
        {/* 上传区域 - 响应式设计 */}
        <div className="space-y-3 flex-shrink-0">
          <div className="text-center">
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={onFileUpload} 
              className="hidden" 
              id="file-upload" 
            />
            <label htmlFor="file-upload">
              <Button variant="outline" className="w-full text-sm" asChild>
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
              className="w-full text-xs"
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              {isBatchProcessing ? '批量处理中...' : `批量处理已完成标记图片 (${images.filter(img => img.watermarkMark && img.isMarkingCompleted).length})`}
            </Button>
          )}

          {/* 算法选择区域 - 响应式布局 */}
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
                <Dialog open={isApiConfigOpen} onOpenChange={setIsApiConfigOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] mx-4">
                    <DialogHeader>
                      <DialogTitle>配置 AI 智能填充 API</DialogTitle>
                      <DialogDescription>请输入您的 Stable Diffusion API 密钥以使用 AI 智能填充功能</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <label htmlFor="api-key" className="text-sm font-medium">API 密钥</label>
                        <div className="space-y-2">
                          <input 
                            id="api-key" 
                            type="password" 
                            value={sdApiKey} 
                            onChange={(e) => handleApiKeyChange(e.target.value)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            placeholder="输入您的 API 密钥" 
                            maxLength={100}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={validateApiKey}
                            disabled={isValidating || !sdApiKey.trim()}
                            className="w-full"
                          >
                            {isValidating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                验证中...
                              </>
                            ) : validationStatus === 'success' ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                验证成功
                              </>
                            ) : validationStatus === 'error' ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                验证失败，重新验证
                              </>
                            ) : (
                              '验证 API 密钥'
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        <p>• API 密钥将安全加密保存在会话存储中</p>
                        <p>• 如需获取 API 密钥，请访问 Stability AI 官网</p>
                        <p>• 验证成功后即可使用 AI 智能填充功能</p>
                        <p>• 🔒 采用安全传输和存储措施保护您的密钥</p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsApiConfigOpen(false)}>取消</Button>
                      <Button onClick={handleSaveApiKey} disabled={validationStatus !== 'success'}>保存</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* 图片列表 - 响应式滚动区域 */}
        <ScrollArea className="flex-1 mt-3">
          <div className="space-y-2">
            {images.map(image => (
              <div 
                key={image.id} 
                className={`flex items-center justify-between p-2 lg:p-3 border rounded-md cursor-pointer transition-colors ${
                  selectedImageId === image.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`} 
                onClick={() => {
                  onImageSelect(image.id);
                  // 移动端选择图片后自动关闭侧边栏
                  if (onCloseSidebar && window.innerWidth < 1024) {
                    onCloseSidebar();
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block" title={image.file.name}>
                    {image.file.name}
                  </span>
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
                <div className="flex items-center space-x-1 lg:space-x-2 ml-2 flex-shrink-0">
                  <ProcessButton 
                    imageItem={image} 
                    isListItem={true} 
                    onClick={handleRemoveWatermark} 
                    isProcessing={isProcessing} 
                    isBatchProcessing={isBatchProcessing} 
                    selectedImageId={selectedImageId} 
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={e => { 
                      e.stopPropagation(); 
                      onRemoveImage(image.id); 
                    }} 
                    className="text-xs p-1 lg:p-2" 
                    disabled={isBatchProcessing}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
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
