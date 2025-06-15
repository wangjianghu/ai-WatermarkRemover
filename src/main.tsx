
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize security headers immediately
import { securityHeaders } from "./utils/securityHeaders";

// Apply security configuration
securityHeaders.updateConfig({
  enableCSP: true,
  enableSecurityHeaders: true,
  reportViolations: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
