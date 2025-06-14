
import { WatermarkRemover } from "../components/WatermarkRemover";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI智能水印去除工具
          </h1>
          <p className="text-xl text-blue-200 mb-2">
            专业去除"豆包AI"等文字水印，无痕修复技术
          </p>
          <p className="text-lg text-blue-300">
            支持批量处理 • 智能识别 • 无损画质
          </p>
        </div>
        
        <WatermarkRemover />
        
        <div className="mt-16 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-blue-500 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">智能识别</h3>
              <p className="text-blue-200 text-sm">AI算法自动识别图片中的文字水印位置</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-purple-500 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">无痕修复</h3>
              <p className="text-blue-200 text-sm">先进的图像修复技术，完美还原背景</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-indigo-500 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">批量处理</h3>
              <p className="text-blue-200 text-sm">支持多张图片同时处理，提高工作效率</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
