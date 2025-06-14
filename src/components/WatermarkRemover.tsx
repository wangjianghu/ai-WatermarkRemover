import React, { useState, useCallback } from 'react';
import { NeuralWatermarkRemover } from './NeuralWatermarkRemover';
import { SDInpaintingProcessor } from './SDInpaintingProcessor';

interface ProcessedImage {
  id: string;
  originalName: string;
  processedUrl: string;
  processingMode: string;
  timestamp: Date;
  originalSize: number;
  processedSize: number;
}

const WatermarkRemover: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMode, setProcessingMode] = useState<'enhanced' | 'conservative' | 'aggressive' | 'neural' | 'sd-inpainting'>('enhanced');
  const [useWebWorker, setUseWebWorker] = useState(true);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleWatermarkRemoval = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      let result: Blob;
      
      if (processingMode === 'sd-inpainting') {
        // 使用 SD Inpainting 处理
        const sdProcessor = new SDInpaintingProcessor();
        result = await sdProcessor.processWatermark(selectedFile);
        setProgress(100);
      } else if (processingMode === 'neural') {
        // 使用神经网络模型处理
        const remover = new NeuralWatermarkRemover();
        result = await remover.removeWatermark(selectedFile);
        setProgress(100);
      } else if (useWebWorker && processingMode !== 'neural') {
        // 使用 Web Worker 处理
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageDataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const imageData = ctx?.getImageData(0, 0, img.width, img.height);

            if (!imageData) {
              setIsProcessing(false);
              setProgress(0);
              alert('无法读取图片数据');
              return;
            }

            const worker = new Worker('/watermark-worker.js');

            worker.onmessage = (e) => {
              if (e.data.type === 'progress') {
                setProgress(e.data.progress);
              } else if (e.data.type === 'completed') {
                const processedImageData = e.data.result;
                const canvas = document.createElement('canvas');
                canvas.width = processedImageData.width;
                canvas.height = processedImageData.height;
                const ctx = canvas.getContext('2d');
                const uint8ClampedArray = new Uint8ClampedArray(processedImageData.data);
                const data = new ImageData(uint8ClampedArray, processedImageData.width, processedImageData.height);
                ctx?.putImageData(data, 0, 0);

                canvas.toBlob((blob) => {
                  if (blob) {
                    const processedUrl = URL.createObjectURL(blob);
                    const newProcessedImage: ProcessedImage = {
                      id: Date.now().toString(),
                      originalName: selectedFile.name,
                      processedUrl,
                      processingMode,
                      timestamp: new Date(),
                      originalSize: selectedFile.size,
                      processedSize: blob.size
                    };

                    setProcessedImages(prev => [newProcessedImage, ...prev]);
                    setIsProcessing(false);
                    setProgress(0);
                    console.log(`${processingMode} 处理完成:`, newProcessedImage);
                  } else {
                    setIsProcessing(false);
                    setProgress(0);
                    alert('图片处理失败');
                  }
                }, selectedFile.type, 0.95);

                worker.terminate();
              } else if (e.data.type === 'error') {
                setIsProcessing(false);
                setProgress(0);
                alert(`处理失败: ${e.data.error}`);
                worker.terminate();
              } else if (e.data.type === 'started') {
                console.log('Web Worker 开始处理');
              }
            };

            worker.postMessage({
              type: 'process',
              imageData: imageData.data,
              width: imageData.width,
              height: imageData.height,
              processingMode
            });
          };
          img.src = imageDataUrl;
        };
        reader.readAsDataURL(selectedFile);
      } else {
        // 传统方式处理
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageDataUrl = event.target?.result as string;
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const imageData = ctx?.getImageData(0, 0, img.width, img.height);

            if (!imageData) {
              setIsProcessing(false);
              setProgress(0);
              alert('无法读取图片数据');
              return;
            }

            const processedImageData = await processImage(imageData.data, img.width, img.height, processingMode);
            const newImageData = new ImageData(processedImageData, img.width, img.height);
            ctx?.putImageData(newImageData, 0, 0);

            canvas.toBlob((blob) => {
              if (blob) {
                const processedUrl = URL.createObjectURL(blob);
                const newProcessedImage: ProcessedImage = {
                  id: Date.now().toString(),
                  originalName: selectedFile.name,
                  processedUrl,
                  processingMode,
                  timestamp: new Date(),
                  originalSize: selectedFile.size,
                  processedSize: blob.size
                };

                setProcessedImages(prev => [newProcessedImage, ...prev]);
                setIsProcessing(false);
                setProgress(0);
                console.log(`${processingMode === 'sd-inpainting' ? 'SD Inpainting' : processingMode} 处理完成:`, newProcessedImage);
              } else {
                setIsProcessing(false);
                setProgress(0);
                alert('图片处理失败');
              }
            }, selectedFile.type, 0.95);
          };
          img.src = imageDataUrl;
        };
        reader.readAsDataURL(selectedFile);
      }

      const processedUrl = URL.createObjectURL(result);
      const newProcessedImage: ProcessedImage = {
        id: Date.now().toString(),
        originalName: selectedFile.name,
        processedUrl,
        processingMode,
        timestamp: new Date(),
        originalSize: selectedFile.size,
        processedSize: result.size
      };

      setProcessedImages(prev => [newProcessedImage, ...prev]);
      setIsProcessing(false);
      setProgress(0);
      
      console.log(`${processingMode === 'sd-inpainting' ? 'SD Inpainting' : processingMode} 处理完成:`, newProcessedImage);
    } catch (error) {
      console.error('处理失败:', error);
      setIsProcessing(false);
      setProgress(0);
      
      // 显示错误提示
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`处理失败: ${errorMessage}`);
    }
  };

  const processImage = async (data: Uint8ClampedArray, width: number, height: number, mode: string): Promise<Uint8ClampedArray> => {
    return new Promise((resolve) => {
      // 模拟处理过程，这里可以替换为实际的图像处理算法
      setTimeout(() => {
        const processedData = new Uint8ClampedArray(data);
        for (let i = 0; i < processedData.length; i += 4) {
          // 根据处理模式调整像素值
          if (mode === 'conservative') {
            // 保守模式：轻微调整
            processedData[i] = Math.max(0, Math.min(255, processedData[i] + Math.random() * 20 - 10));
            processedData[i + 1] = Math.max(0, Math.min(255, processedData[i + 1] + Math.random() * 20 - 10));
            processedData[i + 2] = Math.max(0, Math.min(255, processedData[i + 2] + Math.random() * 20 - 10));
          } else if (mode === 'aggressive') {
            // 激进模式：大幅调整
            processedData[i] = Math.max(0, Math.min(255, processedData[i] + Math.random() * 50 - 25));
            processedData[i + 1] = Math.max(0, Math.min(255, processedData[i + 1] + Math.random() * 50 - 25));
            processedData[i + 2] = Math.max(0, Math.min(255, processedData[i + 2] + Math.random() * 50 - 25));
          } else {
            // 增强模式：适度调整
            processedData[i] = Math.max(0, Math.min(255, processedData[i] + Math.random() * 30 - 15));
            processedData[i + 1] = Math.max(0, Math.min(255, processedData[i + 1] + Math.random() * 30 - 15));
            processedData[i + 2] = Math.max(0, Math.min(255, processedData[i + 2] + Math.random() * 30 - 15));
          }
        }
        resolve(processedData);
      }, 100); // 模拟处理时间
    });
  };

  const handleImageDownload = (url: string, originalName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed_${originalName}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const clearHistory = useCallback(() => {
    setProcessedImages([]);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">智能水印去除器</h1>

      {/* 文件选择 */}
      <div className="mb-4">
        <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
          选择图片文件:
        </label>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>

      {/* 处理模式选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">处理模式:</label>
        
        {/* 按钮组 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setProcessingMode('enhanced')}
            className={`p-2 rounded text-xs transition-colors ${
              processingMode === 'enhanced'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            增强模式
          </button>
          <button
            onClick={() => setProcessingMode('conservative')}
            className={`p-2 rounded text-xs transition-colors ${
              processingMode === 'conservative'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            保守模式
          </button>
          <button
            onClick={() => setProcessingMode('aggressive')}
            className={`p-2 rounded text-xs transition-colors ${
              processingMode === 'aggressive'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            激进模式
          </button>
          <button
            onClick={() => setProcessingMode('sd-inpainting')}
            className={`p-2 rounded text-xs transition-colors ${
              processingMode === 'sd-inpainting'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            AI智能填充
          </button>
        </div>

        {/* Web Worker 开关 */}
        <label className="inline-flex items-center mt-2">
          <input
            type="checkbox"
            className="form-checkbox h-5 w-5 text-blue-600"
            checked={useWebWorker}
            onChange={(e) => setUseWebWorker(e.target.checked)}
          />
          <span className="ml-2 text-gray-700 text-xs">使用Web Worker (后台处理)</span>
        </label>
      </div>

      {/* 算法描述 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">算法特点:</h3>
        
        <div className="grid grid-cols-2 gap-3 text-left">
          <div>
            <h4 className="font-medium text-green-600 mb-1 text-xs">增强模式</h4>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>• 📊 基于多特征检测算法</li>
              <li>• 🔍 智能水印置信度分析</li>
              <li>• 🎯 加权像素修复技术</li>
              <li>• ⚖️ 平衡质量与效果</li>
              <li>• 💎 适合大部分水印类型</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-orange-600 mb-1 text-xs">保守模式</h4>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>• 🛡️ 高阈值检测算法</li>
              <li>• 🎨 温和梯度修复技术</li>
              <li>• 🔒 严格边缘保护机制</li>
              <li>• 📐 精确纹理保持算法</li>
              <li>• 🎯 适合精细图像处理</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-red-600 mb-1 text-xs">激进模式</h4>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>• ⚡ 低阈值检测算法</li>
              <li>• 🔥 强力像素替换技术</li>
              <li>• 💪 多轮迭代修复机制</li>
              <li>• 🎯 高强度水印去除</li>
              <li>• ⚠️ 可能影响图像细节</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-purple-600 mb-1 text-xs">AI智能填充</h4>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>• 🤖 Stable Diffusion Inpainting</li>
              <li>• 🧠 深度学习语义理解</li>
              <li>• ✨ 智能纹理重建技术</li>
              <li>• 🎨 高清细节创造算法</li>
              <li>• 🔥 最佳质量但处理较慢</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 处理按钮 */}
      <button
        onClick={handleWatermarkRemoval}
        disabled={!selectedFile || isProcessing}
        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
      >
        {isProcessing ? `处理中... ${progress}%` : '去除水印'}
      </button>

      {/* 历史记录 */}
      {processedImages.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">处理历史:</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    图片
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    文件名
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    处理模式
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    时间
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    原始大小
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    处理后大小
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedImages.map((image) => (
                  <tr key={image.id}>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <img src={image.processedUrl} alt="Processed" className="w-20 h-20 object-cover rounded" />
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">{image.originalName}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">{image.processingMode}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">
                        {image.timestamp.toLocaleDateString()} {image.timestamp.toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">{formatBytes(image.originalSize)}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <p className="text-gray-900 whitespace-no-wrap">{formatBytes(image.processedSize)}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <button
                        onClick={() => handleImageDownload(image.processedUrl, image.originalName)}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-xs"
                      >
                        下载
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={clearHistory}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4"
          >
            清空历史
          </button>
        </div>
      )}
    </div>
  );
};

export default WatermarkRemover;
