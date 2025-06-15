
// Memory management utilities for image processing
class MemoryManager {
  private static instance: MemoryManager;
  private blobUrls: Set<string> = new Set();
  private canvasElements: WeakSet<HTMLCanvasElement> = new WeakSet();
  
  private constructor() {
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }
  
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }
  
  trackBlobUrl(url: string): void {
    this.blobUrls.add(url);
  }
  
  releaseBlobUrl(url: string): void {
    if (this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
    }
  }
  
  trackCanvas(canvas: HTMLCanvasElement): void {
    this.canvasElements.add(canvas);
  }
  
  cleanup(): void {
    // Revoke all blob URLs
    this.blobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
  }
  
  getMemoryInfo(): { blobUrls: number } {
    return {
      blobUrls: this.blobUrls.size,
    };
  }
}

export const memoryManager = MemoryManager.getInstance();

// Higher-order component for automatic memory cleanup
export const withMemoryCleanup = <T extends object>(component: T): T => {
  const originalComponentDidUpdate = (component as any).componentDidUpdate;
  const originalComponentWillUnmount = (component as any).componentWillUnmount;
  
  (component as any).componentDidUpdate = function(...args: any[]) {
    if (originalComponentDidUpdate) {
      originalComponentDidUpdate.apply(this, args);
    }
    // Cleanup old blob URLs periodically
    memoryManager.cleanup();
  };
  
  (component as any).componentWillUnmount = function(...args: any[]) {
    if (originalComponentWillUnmount) {
      originalComponentWillUnmount.apply(this, args);
    }
    memoryManager.cleanup();
  };
  
  return component;
};
