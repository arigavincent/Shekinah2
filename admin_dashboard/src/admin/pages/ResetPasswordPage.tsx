import type { FormEvent } from "react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { changePassword } from "../api/authApi";
import { getToken, getUser, saveSession } from "../auth/session";
import { InlineAlert } from "../components/InlineAlert";
import { useAdminTheme } from "../theme";

export function ResetPasswordPage() {
  const { mode, toggleTheme } = useAdminTheme();
  const token = getToken();
  const user = getUser();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const authToken = token;

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation must match.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await changePassword(authToken, currentPassword, newPassword);
      saveSession(response.token, response.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <button type="button" className="secondary compact auth-theme-toggle" onClick={toggleTheme}>
        {mode === "light" ? "Dark" : "Light"}
      </button>
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Security</p>
        <h1>Reset Admin Password</h1>
        <p className="muted">
          This account is using an initial password. Set a new password before opening the dashboard.
        </p>

        <label>
          Current Password
          <input
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        <label>
          New Password
          <input
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirm New Password
          <input
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </label>

        {error ? <InlineAlert title="Password reset failed" message={error} /> : null}

        <button disabled={saving}>
          {saving ? "Saving..." : "Save New Password"}
        </button>
      </form>
    </main>
  );
}
