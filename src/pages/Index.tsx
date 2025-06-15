
import WatermarkRemover from "../components/WatermarkRemover";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 overflow-hidden">
      <div className="h-screen flex flex-col">
        {/* Header - 响应式标题 */}
        <div className="text-center py-3 md:py-6 flex-shrink-0 px-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI智能水印去除工具
          </h1>
        </div>
        
        {/* Main Content - 自适应高度 */}
        <div className="flex-1 overflow-hidden min-h-0">
          <WatermarkRemover />
        </div>
      </div>
    </div>
  );
};

export default Index;
