
import WatermarkRemover from "../components/WatermarkRemover";
const Index = () => {
  return <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI智能水印去除工具
          </h1>
          
          
        </div>
        
        <WatermarkRemover />
        
        <div className="mt-16 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            
            
            
            
            
          </div>
        </div>
      </div>
    </div>;
};
export default Index;
