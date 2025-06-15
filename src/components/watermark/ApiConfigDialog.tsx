
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { validateApiKey, sanitizeInput } from '@/utils/apiSecurity';
import { secureApiClient } from '@/utils/secureApiClient';

interface ApiConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  sdApiKey: string;
  setSdApiKey: (key: string) => void;
}

const ApiConfigDialog: React.FC<ApiConfigDialogProps> = ({
  isOpen,
  onOpenChange,
  sdApiKey,
  setSdApiKey,
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
    onOpenChange(false);
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSaveApiKey} disabled={validationStatus !== 'success'}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiConfigDialog;
