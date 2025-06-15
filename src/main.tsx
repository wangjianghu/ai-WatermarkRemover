
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize security systems
import { securityHeaders } from "./utils/securityHeaders";
import { runtimeProtection } from "./utils/runtimeProtection";
import { securityMonitor } from "./utils/securityMonitor";

// Apply security configuration
securityHeaders.updateConfig({
  enableCSP: true,
  enableSecurityHeaders: true,
  reportViolations: true,
});

// Initialize runtime protection
runtimeProtection.updateConfig({
  enableIntegrityCheck: true,
  enableDOMProtection: true,
  enableConsoleProtection: false, // Keep disabled for development
  enableDebuggerProtection: false, // Keep disabled for development
});

// Log application start
securityMonitor.logEvent('api_call', 'low', {
  operation: 'application_start',
  timestamp: Date.now(),
  userAgent: navigator.userAgent
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
