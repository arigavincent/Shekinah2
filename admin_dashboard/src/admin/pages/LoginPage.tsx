import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login, verifyCode } from "../api/authApi";
import { apiRequest } from "../api/client";
import { saveSession } from "../auth/session";
import { InlineAlert } from "../components/InlineAlert";
import { useAdminTheme } from "../theme";

export function LoginPage() {
  const { mode, toggleTheme } = useAdminTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Forgot password: ask for a code by email, then choose a new password.
  const [step, setStep] = useState<"login" | "request" | "reset" | "code">("login");
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState("");

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiRequest("/api/v1/auth/password-reset/request", { method: "POST", body: { email: email.trim() } });
      setInfo(`If ${email.trim()} has an account, a 6-digit code is on its way. Check your inbox (and spam).`);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiRequest("/api/v1/auth/password-reset/confirm", { method: "POST", body: { email: email.trim(), code: code.trim(), newPassword } });
      const signedIn = await login(email.trim(), newPassword);
      if (signedIn.mfaRequired) { setMfaToken(signedIn.mfaToken || ""); setCode(""); setStep("code"); return; }
      saveSession(signedIn.token, signedIn.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token, user } = await verifyCode(mfaToken, code.trim());
      saveSession(token, user);
      navigate(user.passwordResetRequired ? "/reset-password" : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is not right");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submitCode}>
          <p className="eyebrow">Shekinah Admin</p>
          <h1>Enter your code</h1>
          <p className="muted">Open your authenticator app and type the 6-digit code for Shekinah Sons Global.</p>
          <label>
            Code
            <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus />
          </label>
          {error ? <InlineAlert title="Sign-in failed" message={error} /> : null}
          <button disabled={loading || code.length !== 6}>{loading ? "Checking..." : "Sign In"}</button>
          <button type="button" className="secondary" onClick={() => { setStep("login"); setError(""); setCode(""); }}>Back</button>
        </form>
      </main>
    );
  }

  if (step !== "login") {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={step === "request" ? requestCode : resetPassword}>
          <p className="eyebrow">Shekinah Admin</p>
          <h1>{step === "request" ? "Reset your password" : "Choose a new password"}</h1>
          <p className="muted">
            {step === "request" ? "Enter your email and we'll send you a code." : info}
          </p>
          <label>
            Email
            <input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" disabled={step === "reset"} />
          </label>
          {step === "reset" ? (
            <>
              <label>
                Code from the email
                <input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" />
              </label>
              <label>
                New password (at least 8 characters)
                <input value={newPassword} onChange={event => setNewPassword(event.target.value)} type="password" autoComplete="new-password" />
              </label>
            </>
          ) : null}
          {error ? <InlineAlert title="Password reset" message={error} /> : null}
          <button disabled={loading || !email.includes("@") || (step === "reset" && (code.trim().length < 6 || newPassword.length < 8))}>
            {loading ? "Please wait..." : step === "request" ? "Send code" : "Save and sign in"}
          </button>
          <button type="button" className="secondary" onClick={() => { setStep("login"); setError(""); }}>
            Back to sign in
          </button>
        </form>
      </main>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const signedIn = await login(email.trim(), password);
      if (signedIn.mfaRequired) { setMfaToken(signedIn.mfaToken || ""); setCode(""); setStep("code"); return; }
      saveSession(signedIn.token, signedIn.user);
      navigate(signedIn.user.passwordResetRequired ? "/reset-password" : "/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      setError(message);
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
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).has("idle") ? (
          <InlineAlert title="Signed out" message="You were signed out after a period without activity. Please sign in again." />
        ) : null}

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
        <button type="button" className="secondary" onClick={() => { setStep("request"); setError(""); }}>
          Forgot password?
        </button>
      </form>
    </main>
  );
}
