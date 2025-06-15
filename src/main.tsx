
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize comprehensive security systems
import { securityHeaders } from "./utils/securityHeaders";
import { runtimeProtection } from "./utils/runtimeProtection";
import { securityMonitor } from "./utils/securityMonitor";
import { memoryManager } from "./utils/memoryManager";

// Apply enhanced security configuration
securityHeaders.updateConfig({
  enableCSP: true,
  enableSecurityHeaders: true,
  reportViolations: true,
});

// Initialize comprehensive runtime protection
runtimeProtection.updateConfig({
  enableIntegrityCheck: true,
  enableDOMProtection: true,
  enableConsoleProtection: false, // Keep disabled for development
  enableDebuggerProtection: false, // Keep disabled for development
});

// Configure memory management limits
memoryManager.updateResourceLimits({
  maxCanvasSize: 16777216, // 4096 * 4096
  maxFileSize: 25 * 1024 * 1024, // 25MB
  maxConcurrentOperations: 3,
  memoryThreshold: 0.8
});

// Log application start with enhanced security context
securityMonitor.logEvent('api_call', 'low', {
  operation: 'application_start',
  timestamp: Date.now(),
  userAgent: navigator.userAgent,
  securityLevel: 'enhanced',
  memoryAvailable: memoryManager.getMemoryStats().total,
  protectionActive: true
});

// Initialize emergency handlers
window.addEventListener('error', (event) => {
  securityMonitor.logEvent('api_call', 'medium', {
    operation: 'javascript_error',
    error: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  securityMonitor.logEvent('api_call', 'medium', {
    operation: 'unhandled_promise_rejection',
    reason: event.reason?.toString() || 'Unknown rejection'
  });
});

console.info('[Security] Enhanced security systems initialized');
console.info('[Security] CSP, runtime protection, and memory management active');

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
