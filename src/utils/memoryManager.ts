// Enhanced memory management and resource monitoring
interface MemoryStats {
  used: number;
  total: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
}

interface ResourceLimits {
  maxCanvasSize: number;
  maxFileSize: number;
  maxConcurrentOperations: number;
  memoryThreshold: number;
}

class EnhancedMemoryManager {
  private static instance: EnhancedMemoryManager;
  private activeOperations: Set<string> = new Set();
  private resourceLimits: ResourceLimits;
  private memoryCheckInterval: number | null = null;
  private cleanupHandlers: (() => void)[] = [];
  private trackedBlobUrls: Set<string> = new Set();
  private trackedCanvases: Set<HTMLCanvasElement> = new Set();
  
  private constructor() {
    this.resourceLimits = {
      maxCanvasSize: 16777216, // 4096 * 4096
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxConcurrentOperations: 3,
      memoryThreshold: 0.8 // 80%
    };
    
    this.startMemoryMonitoring();
    this.setupEmergencyCleanup();
  }
  
  static getInstance(): EnhancedMemoryManager {
    if (!EnhancedMemoryManager.instance) {
      EnhancedMemoryManager.instance = new EnhancedMemoryManager();
    }
    return EnhancedMemoryManager.instance;
  }
  
  getMemoryStats(): MemoryStats {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.jsHeapSizeLimit;
      const percentage = used / total;
      
      return {
        used,
        total,
        percentage: Math.round(percentage * 100),
        warning: percentage > 0.7,
        critical: percentage > this.resourceLimits.memoryThreshold
      };
    }
    
    return {
      used: 0,
      total: 0,
      percentage: 0,
      warning: false,
      critical: false
    };
  }
  
  canStartOperation(operationId: string, estimatedMemory: number = 0): boolean {
    // Check concurrent operation limits
    if (this.activeOperations.size >= this.resourceLimits.maxConcurrentOperations) {
      console.warn('[Memory] Too many concurrent operations');
      return false;
    }
    
    // Check memory availability
    const memStats = this.getMemoryStats();
    if (memStats.critical) {
      console.warn('[Memory] Critical memory usage, blocking new operations');
      this.performEmergencyCleanup();
      return false;
    }
    
    // Estimate if operation would exceed memory limits
    if (estimatedMemory > 0 && memStats.used + estimatedMemory > memStats.total * 0.9) {
      console.warn('[Memory] Estimated memory usage would exceed safe limits');
      return false;
    }
    
    this.activeOperations.add(operationId);
    return true;
  }
  
  completeOperation(operationId: string): void {
    this.activeOperations.delete(operationId);
    
    // Trigger garbage collection hint if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
  
  validateResourceUsage(width: number, height: number, operation: string): boolean {
    const canvasSize = width * height;
    
    if (canvasSize > this.resourceLimits.maxCanvasSize) {
      console.error('[Memory] Canvas size exceeds limits:', { width, height, size: canvasSize });
      return false;
    }
    
    // Estimate memory usage for canvas operations
    const estimatedMemory = canvasSize * 4; // 4 bytes per pixel (RGBA)
    const memStats = this.getMemoryStats();
    
    if (memStats.used + estimatedMemory > memStats.total * 0.8) {
      console.error('[Memory] Operation would exceed memory limits');
      return false;
    }
    
    return true;
  }
  
  trackBlobUrl(url: string): void {
    this.trackedBlobUrls.add(url);
    console.log('[Memory] Tracking blob URL:', url);
  }
  
  releaseBlobUrl(url: string): void {
    if (this.trackedBlobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.trackedBlobUrls.delete(url);
      console.log('[Memory] Released blob URL:', url);
    }
  }
  
  trackCanvas(canvas: HTMLCanvasElement): void {
    this.trackedCanvases.add(canvas);
    console.log('[Memory] Tracking canvas:', canvas.width, 'x', canvas.height);
  }
  
  releaseCanvas(canvas: HTMLCanvasElement): void {
    if (this.trackedCanvases.has(canvas)) {
      // Clear the canvas
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
      }
      this.trackedCanvases.delete(canvas);
      console.log('[Memory] Released canvas');
    }
  }
  
  cleanup(): void {
    console.info('[Memory] Performing general cleanup');
    
    // Release all tracked blob URLs
    this.trackedBlobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.trackedBlobUrls.clear();
    
    // Release all tracked canvases
    this.trackedCanvases.forEach(canvas => {
      this.releaseCanvas(canvas);
    });
    
    // Run registered cleanup handlers
    this.cleanupHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('[Memory] Cleanup handler failed:', error);
      }
    });
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
  
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = window.setInterval(() => {
      const stats = this.getMemoryStats();
      
      if (stats.critical) {
        console.warn('[Memory] Critical memory usage detected:', stats);
        this.performEmergencyCleanup();
        
        // Report to security monitor
        import('./securityMonitor').then(({ securityMonitor }) => {
          securityMonitor.logEvent('suspicious_activity', 'high', {
            type: 'memory_exhaustion',
            memoryUsage: stats.percentage,
            activeOperations: this.activeOperations.size
          });
        });
      } else if (stats.warning) {
        console.warn('[Memory] High memory usage:', stats);
        this.performPartialCleanup();
      }
    }, 5000); // Check every 5 seconds
  }
  
  private setupEmergencyCleanup(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performPartialCleanup();
      }
    });
    
    // Handle memory pressure events (if supported)
    if ('memory' in navigator) {
      (navigator as any).memory?.addEventListener?.('memorypressure', () => {
        this.performEmergencyCleanup();
      });
    }
    
    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
      this.performEmergencyCleanup();
    });
  }
  
  private performPartialCleanup(): void {
    console.info('[Memory] Performing partial cleanup');
    
    // Clean up blob URLs that might be lingering
    this.cleanupBlobUrls();
    
    // Clear some caches
    this.clearTemporaryCaches();
    
    // Run registered cleanup handlers
    this.cleanupHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('[Memory] Cleanup handler failed:', error);
      }
    });
  }
  
  private performEmergencyCleanup(): void {
    console.warn('[Memory] Performing emergency cleanup');
    
    // Cancel all active operations
    this.activeOperations.clear();
    
    // Perform aggressive cleanup
    this.performPartialCleanup();
    
    // Clear all temporary storage
    try {
      sessionStorage.removeItem('processed-images-cache');
      sessionStorage.removeItem('temp-canvas-data');
    } catch (error) {
      console.error('[Memory] Failed to clear session storage:', error);
    }
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      setTimeout(() => (window as any).gc(), 100);
    }
  }
  
  private cleanupBlobUrls(): void {
    // Clean up tracked blob URLs
    this.trackedBlobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.trackedBlobUrls.clear();
    console.info('[Memory] Cleaned up blob URLs');
  }
  
  private clearTemporaryCaches(): void {
    try {
      // Clear temporary image processing caches
      const cacheKeys = Object.keys(sessionStorage).filter(key => 
        key.startsWith('temp-') || 
        key.startsWith('cache-') ||
        key.includes('processed-')
      );
      
      cacheKeys.forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      console.info(`[Memory] Cleared ${cacheKeys.length} temporary cache entries`);
    } catch (error) {
      console.error('[Memory] Failed to clear temporary caches:', error);
    }
  }
  
  registerCleanupHandler(handler: () => void): void {
    this.cleanupHandlers.push(handler);
  }
  
  unregisterCleanupHandler(handler: () => void): void {
    const index = this.cleanupHandlers.indexOf(handler);
    if (index > -1) {
      this.cleanupHandlers.splice(index, 1);
    }
  }
  
  updateResourceLimits(limits: Partial<ResourceLimits>): void {
    this.resourceLimits = { ...this.resourceLimits, ...limits };
    console.info('[Memory] Resource limits updated:', this.resourceLimits);
  }
  
  getActiveOperations(): string[] {
    return Array.from(this.activeOperations);
  }
  
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    this.performEmergencyCleanup();
    this.cleanupHandlers = [];
    this.activeOperations.clear();
  }
}

export const memoryManager = EnhancedMemoryManager.getInstance();

// Utility functions for memory-safe operations
export const createSecureCanvas = (width: number, height: number): HTMLCanvasElement | null => {
  if (!memoryManager.validateResourceUsage(width, height, 'canvas-creation')) {
    return null;
  }
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Track the canvas for cleanup
    memoryManager.trackCanvas(canvas);
    
    return canvas;
  } catch (error) {
    console.error('[Memory] Failed to create canvas:', error);
    return null;
  }
};

export const estimateImageMemoryUsage = (width: number, height: number): number => {
  return width * height * 4; // 4 bytes per pixel (RGBA)
};

export const isMemorySafeOperation = (estimatedBytes: number): boolean => {
  const stats = memoryManager.getMemoryStats();
  return stats.used + estimatedBytes < stats.total * 0.8;
};
