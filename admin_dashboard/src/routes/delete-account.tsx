import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PublicPage } from "../public-pages/PublicPage";

export const Route = createFileRoute("/delete-account")({
  head: () => ({ meta: [{ title: "Delete your account · Shekinah Sons Global" }] }),
  component: DeleteAccount,
});

async function call<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data as T;
}

function DeleteAccount() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const login = await call<{ token?: string; mfaRequired?: boolean }>("/api/v1/auth/login", { email, password });
      if (login.mfaRequired || !login.token) {
        throw new Error("This account uses two-step sign-in. Delete it from the app: Profile → Delete my account.");
      }
      await call("/api/v1/auth/delete-account", { password }, login.token);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicPage title="Delete your account">
      {done ? (
        <p>Your account and personal data have been deleted. Thank you for being part of the Shekinah family.</p>
      ) : (
        <>
          <p>
            You can delete your Shekinah Sons Global account here, or in the app under Profile → <em>Delete my account</em>.
          </p>
          <p><strong>What is deleted:</strong> your profile (name, email, phone), prayer requests, testimonies, chat messages, playlists and saved items. It can't be undone.</p>
          <p><strong>What is kept:</strong> records of gifts and payments stay in the church's accounts, without your name, phone or email, as the law requires.</p>
          <form onSubmit={submit}>
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label style={{ display: "flex", gap: 10, alignItems: "center", margin: "4px 0 18px" }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              I understand my account will be deleted permanently.
            </label>
            {error ? <p role="alert" style={{ color: "#ff8a80" }}>{error}</p> : null}
            <button className="danger" disabled={busy || !confirm || !email || !password}>{busy ? "Deleting…" : "Delete my account"}</button>
          </form>
          <p style={{ marginTop: 28, fontSize: 14, color: "#a8a39a" }}>Forgot your password? Reset it in the app first. See also our <a href="/privacy">privacy policy</a>.</p>
        </>
      )}
    </PublicPage>
  );
}
