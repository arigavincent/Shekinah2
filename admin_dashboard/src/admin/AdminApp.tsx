import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AdminFeedbackProvider } from "./feedback/AdminFeedback";
import { AdminThemeProvider } from "./theme";
import "./style.css";

/**
 * Client-only wrapper for the admin dashboard.
 * The dashboard uses BrowserRouter + window/localStorage at init,
 * so it cannot be rendered during SSR.
 */
export default function AdminApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <AdminThemeProvider>
      <AdminFeedbackProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AdminFeedbackProvider>
    </AdminThemeProvider>
  );
}
