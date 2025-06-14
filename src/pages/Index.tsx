
import WatermarkRemover from "../components/WatermarkRemover";

const Index = () => {
  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="text-center py-6 flex-shrink-0">
          <h1 className="text-4xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI智能水印去除工具
          </h1>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <WatermarkRemover />
        </div>
      </div>
    </div>
  );
};

export default Index;
