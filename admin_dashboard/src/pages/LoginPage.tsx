import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/authApi";
import { saveSession } from "../auth/session";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("vincent@example.com");
  const [password, setPassword] = useState("password123");
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
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
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

        {error ? <p className="error">{error}</p> : null}

        <button disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
