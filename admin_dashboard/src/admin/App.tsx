import { MonetizationPage } from "./pages/MonetizationPage";
import { SettingsPage } from "./pages/SettingsPage";
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
import { CommunityPage } from "./pages/CommunityPage";
import { TestimoniesPage } from "./pages/TestimoniesPage";
import { CheckInPage } from "./pages/CheckInPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ReadingPlansPage } from "./pages/ReadingPlansPage";
import { AppearancePage } from "./pages/AppearancePage";
import { ServeSettingsPage } from "./pages/ServeSettingsPage";
import { TeamPage } from "./pages/TeamPage";
// Super Admin pages
import { MembersPage } from "./pages/MembersPage";
import { FinancePage } from "./pages/FinancePage";
import { GroupsPage } from "./pages/GroupsPage";
import { AttendancePage } from "./pages/AttendancePage";
import { CommTemplatesPage } from "./pages/CommTemplatesPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { SystemPage } from "./pages/SystemPage";

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

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const user = getUser();
  if (user?.role !== "super_admin") return <Navigate to="/" replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
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
        <Route path="library" element={<LibraryPage />} />

        <Route path="devotions" element={<DevotionsPage />} />
        <Route path="reading-plans" element={<ReadingPlansPage />} />

        <Route path="events" element={<EventsPage />} />

        <Route path="updates" element={<UpdatesPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="live" element={<LiveConfigPage />} />
        <Route path="prayers" element={<PrayersPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="testimonies" element={<TestimoniesPage />} />
        <Route path="checkins" element={<CheckInPage />} />
        <Route path="giving" element={<GivingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="serve-settings" element={<ServeSettingsPage />} />
        <Route path="users" element={<TeamPage />} />
        <Route path="team" element={<Navigate to="/users" replace />} />
        <Route path="monetization" element={<MonetizationPage />} />
        <Route path="appearance" element={<AppearancePage />} />

        {/* Super Admin routes */}
        <Route path="sa/members" element={<SuperAdminRoute><MembersPage /></SuperAdminRoute>} />
        <Route path="sa/finance" element={<SuperAdminRoute><FinancePage /></SuperAdminRoute>} />
        <Route path="sa/groups" element={<SuperAdminRoute><GroupsPage /></SuperAdminRoute>} />
        <Route path="sa/attendance" element={<SuperAdminRoute><AttendancePage /></SuperAdminRoute>} />
        <Route path="sa/comm-templates" element={<SuperAdminRoute><CommTemplatesPage /></SuperAdminRoute>} />
        <Route path="sa/api-keys" element={<SuperAdminRoute><ApiKeysPage /></SuperAdminRoute>} />
        <Route path="sa/webhooks" element={<SuperAdminRoute><WebhooksPage /></SuperAdminRoute>} />
        <Route path="sa/system" element={<SuperAdminRoute><SystemPage /></SuperAdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
