import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./style.css";
import { AdminThemeProvider } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AdminThemeProvider>
  </React.StrictMode>
);
