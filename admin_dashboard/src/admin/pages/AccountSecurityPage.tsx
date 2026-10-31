import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { ShieldCheck } from "lucide-react";

type Status = { enabled: boolean; required: boolean };
type Setup = { secret: string; otpauthUrl: string; qrPng?: string };

// Two-step sign-in for the signed-in staff member.
export function AccountSecurityPage() {
  const token = getToken();
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = () => apiRequest<Status>("/api/v1/auth/mfa", { token }).then(setStatus).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  const start = () => run(async () => { setSetup(await apiRequest<Setup>("/api/v1/auth/mfa/setup", { method: "POST", token })); setCode(""); });
  const enable = () => run(async () => { const r = await apiRequest<{ message: string }>("/api/v1/auth/mfa/enable", { method: "POST", token, body: { code } }); setMessage(r.message); setSetup(null); setCode(""); await load(); });
  const disable = () => run(async () => { const r = await apiRequest<{ message: string }>("/api/v1/auth/mfa/disable", { method: "POST", token, body: { code } }); setMessage(r.message); setCode(""); await load(); });
  const codeInput = <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" style={{ maxWidth: 180 }} />;
  return (<div className="admin-page">
    <div className="page-header"><h1><ShieldCheck size={20} style={{ marginRight: 8 }} />Account security</h1></div>
    <div className="card" style={{ maxWidth: 640 }}>
      <h3>Two-step sign-in</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>After your password, you also enter a code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy). Someone who learns your password still cannot get in.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      {status?.required && !status.enabled && <div className="alert alert-error" style={{ marginBottom: 12 }}>The church requires two-step sign-in for staff. Turn it on to use the staff tools.</div>}
      {!status ? <div className="loading-spinner" /> : status.enabled ? (<>
        <p><span className="badge success">On</span> Your account asks for a code at every sign-in.</p>
        {!status.required && (<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {codeInput}<button className="btn danger" onClick={disable} disabled={busy || code.length !== 6}>Turn off</button>
        </div>)}
      </>) : setup ? (<div style={{ display: "grid", gap: 12 }}>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>
          <li>In your authenticator app, add an account and scan this code.</li>
          <li>Can't scan? Choose "Enter a setup key" and type: <code style={{ userSelect: "all", letterSpacing: 1 }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code></li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>
        {setup.qrPng && <img src={setup.qrPng} alt="QR code for your authenticator app" width={220} height={220} style={{ background: "#fff", padding: 8, borderRadius: 12 }} />}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {codeInput}<button className="btn primary" onClick={enable} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Turn on"}</button>
          <button className="btn" onClick={() => setSetup(null)}>Cancel</button>
        </div>
      </div>) : (<button className="btn primary" onClick={start} disabled={busy}>Set up two-step sign-in</button>)}
    </div>
  </div>);
}
