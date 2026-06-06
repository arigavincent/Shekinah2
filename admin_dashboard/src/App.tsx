import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { getToken } from "./auth/session";
import { AdminLayout } from "./layout/AdminLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { BranchesPage } from "./pages/BranchesPage";
import { DevotionsPage } from "./pages/DevotionsPage";
import { EventsPage } from "./pages/EventsPage";
import { UpdatesPage } from "./pages/UpdatesPage";
import { LoginPage } from "./pages/LoginPage";
import { LiveConfigPage } from "./pages/LiveConfigPage";
import { SermonsPage } from "./pages/SermonsPage";
import { GivingPage } from "./pages/GivingPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="sermons" element={<SermonsPage />} />

        <Route path="devotions" element={<DevotionsPage />} />

        <Route path="events" element={<EventsPage />} />

        <Route path="updates" element={<UpdatesPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="live" element={<LiveConfigPage />} />
        <Route path="giving" element={<GivingPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
