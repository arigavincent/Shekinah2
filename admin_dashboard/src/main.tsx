import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./style.css";
import { AdminFeedbackProvider } from "./feedback/AdminFeedback";
import { AdminThemeProvider } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminThemeProvider>
      <AdminFeedbackProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AdminFeedbackProvider>
    </AdminThemeProvider>
  </React.StrictMode>
);
