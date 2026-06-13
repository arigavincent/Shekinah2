import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/authApi";
import { saveSession } from "../auth/session";
import { InlineAlert } from "../components/InlineAlert";
import { useAdminTheme } from "../theme";

export function LoginPage() {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useAdminTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await login(email.trim(), password);

      if (!["admin", "super_admin"].includes(response.user.role)) {
        setError("This account does not have admin access.");
        return;
      }

      saveSession(response.token, response.user);
      navigate(response.user.passwordResetRequired ? "/reset-password" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <button type="button" className="secondary compact auth-theme-toggle" onClick={toggleTheme}>
        {mode === "light" ? "Dark" : "Light"}
      </button>
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Shekinah Admin</p>
        <h1>Dashboard Login</h1>
        <p className="muted">
          Sign in with an admin account to manage sermons, devotions, events, and updates.
        </p>

        <label>
          Email
          <input
            value={email}
            onChange={event => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={event => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error ? <InlineAlert title="Sign-in failed" message={error} /> : null}

        <button disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
