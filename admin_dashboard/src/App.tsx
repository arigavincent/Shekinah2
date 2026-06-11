import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { getToken, getUser } from "./auth/session";
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
import { NotificationsPage } from "./pages/NotificationsPage";
import { PrayersPage } from "./pages/PrayersPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = getToken();
  const user = getUser();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.passwordResetRequired && location.pathname !== "/reset-password") {
    return <Navigate to="/reset-password" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/reset-password"
        element={
          <ProtectedRoute>
            <ResetPasswordPage />
          </ProtectedRoute>
        }
      />

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
        <Route path="prayers" element={<PrayersPage />} />
        <Route path="giving" element={<GivingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
