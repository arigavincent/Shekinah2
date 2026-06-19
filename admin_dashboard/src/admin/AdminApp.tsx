import { Component, useEffect, useLayoutEffect, useState, startTransition, type ReactNode } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";

import App from "./App";
import { AdminFeedbackProvider } from "./feedback/AdminFeedback";
import { AdminThemeProvider } from "./theme";
import "./style.css";

type AdminErrorBoundaryState = {
  hasError: boolean;
};

class AdminErrorBoundary extends Component<{ children: ReactNode }, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Admin app render failed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-page">
          <section className="auth-card">
            <p className="eyebrow">Shekinah Admin</p>
            <h1>This page didn't load</h1>
            <p className="muted">
              The dashboard hit a runtime error after sign-in. Refresh and try again.
            </p>
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  window.location.reload();
                });
              }}
            >
              Refresh
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function AdminRouteEffects() {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  return <App />;
}

/**
 * Client-only wrapper for the admin dashboard.
 * The dashboard uses BrowserRouter + window/localStorage at init,
 * so it cannot be rendered during SSR.
 */
export default function AdminApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">Shekinah Admin</p>
          <h1>Loading dashboard</h1>
          <p className="muted">
            Preparing the admin console.
          </p>
        </section>
      </main>
    );
  }

  return (
    <AdminThemeProvider>
      <AdminFeedbackProvider>
        <AdminErrorBoundary>
          <BrowserRouter>
            <AdminRouteEffects />
          </BrowserRouter>
        </AdminErrorBoundary>
      </AdminFeedbackProvider>
    </AdminThemeProvider>
  );
}
