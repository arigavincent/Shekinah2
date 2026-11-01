import { useEffect, useState } from "react";
import { MemberSelect } from "../components/MemberSelect";
import { API_BASE_URL, apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { ShieldAlert, Database, Eye, ToggleLeft } from "lucide-react";

type AuditEntry = { id: string; actorEmail: string; method: string; route: string; itemId: string; createdAt: string };
type Modules = Record<string, boolean | number>;

const MODULE_LABELS: Record<string, string> = {
  onlineGiving: "Online Giving", counseling: "Counseling Module", volunteerScheduling: "Volunteer Scheduling",
  livestream: "Livestream", communityChat: "Community Chat", attendanceKiosk: "Attendance Kiosk", taxStatements: "Tax Statements",
};
const SECURITY_FIELDS: { key: string; label: string; type: "toggle" | "number" }[] = [
  { key: "minPasswordLength", label: "Minimum password length (8–64)", type: "number" },
  { key: "mfaRequiredForStaff", label: "Require two-step sign-in for staff (turn it on for your own account first)", type: "toggle" },
  { key: "idleMinutes", label: "Sign staff out after this many idle minutes (0 = never, 5–720)", type: "number" },
];

export function SystemPage() {
  const [tab, setTab] = useState<"modules" | "audit" | "security" | "backup">("modules");
  const token = getToken();
  return (<div className="admin-page">
    <header className="page-header"><div><p className="eyebrow">Super Admin</p><h1>System & Governance</h1><p className="muted">Feature switches, audit trail, security policies and backups.</p></div></header>
    <div className="tabs" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {([["modules", "Modules"], ["audit", "Audit Trail"], ["security", "Security"], ["backup", "Data & Backup"]] as const).map(([k, l]) =>
        <button key={k} className={`btn compact ${tab === k ? "primary" : ""}`} onClick={() => setTab(k)}>{l}</button>
      )}
    </div>
    {tab === "modules" && <ModulesTab token={token} />}
    {tab === "audit" && <AuditTab token={token} />}
    {tab === "security" && <SecurityTab token={token} />}
    {tab === "backup" && <BackupTab token={token} />}
  </div>);
}

function ModulesTab({ token }: { token: string | null }) {
  const [modules, setModules] = useState<Modules>({}); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const { showToast } = useAdminFeedback();
  async function load() { setLoading(true); try { const r = await apiRequest<{ modules: Modules }>("/api/v1/admin/sa/system/modules", { token }); setModules(r.modules || {}); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function save() { setSaving(true); try { await apiRequest("/api/v1/admin/sa/system/modules", { method: "PUT", token, body: { modules } }); showToast({ title: "Saved", message: "Module settings updated", tone: "success" }); } catch (e: any) { setError(e.message); } setSaving(false); }
  if (loading) return <div className="loading-spinner" />;
  return (<div className="card" style={{ padding: 16 }}>
    {error && <div className="alert alert-error">{error}</div>}
    <div style={{ display: "grid", gap: 8 }}>
      {Object.entries(MODULE_LABELS).map(([key, label]) => (
        <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--surface-hover)", borderRadius: 8 }}>
          <span>{label}</span>
          <input type="checkbox" checked={!!modules[key]} onChange={e => setModules(prev => ({ ...prev, [key]: e.target.checked }))} style={{ width: 20, height: 20 }} />
        </label>
      ))}
    </div>
    <button className="btn primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Module Settings"}</button>
  </div>);
}

function AuditTab({ token }: { token: string | null }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [query, setQuery] = useState(""); const [offset, setOffset] = useState(0);
  const { confirm, showToast } = useAdminFeedback();
  async function load(off = 0) { setLoading(true); try { const r = await apiRequest<{ entries: AuditEntry[] }>(`/api/v1/admin/sa/audit-trail?limit=50&offset=${off}`, { token }); setEntries(r.entries || []); setOffset(off); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function purge() {
    const ok = await confirm({ title: "Clean up old entries?", message: "Entries older than 90 days will be permanently deleted. Recent activity is always kept.", confirmLabel: "Delete old entries", tone: "danger" });
    if (!ok) return;
    try { const r = await apiRequest<{ message: string }>("/api/v1/admin/sa/audit-trail", { method: "DELETE", token }); showToast({ title: "Cleaned up", message: r.message, tone: "success" }); void load(); } catch (e: any) { setError(e.message); }
  }
  const filtered = entries.filter(e => !query || e.actorEmail.toLowerCase().includes(query.toLowerCase()) || e.route.toLowerCase().includes(query.toLowerCase()));
  const methodColor = (m: string) => ({ DELETE: "danger", POST: "warning", PUT: "warning", PATCH: "warning" }[m] || "");
  return (<div>
    {error && <div className="alert alert-error">{error}</div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <input className="input" placeholder="Search email or route…" value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1 }} />
      <button className="btn danger" onClick={purge}>Delete entries older than 90 days</button>
    </div>
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>Method</th><th>Actor</th><th>Route</th><th>Item</th><th>Time</th></tr></thead><tbody>
        {filtered.map(e => <tr key={e.id}>
          <td><span className={`badge ${methodColor(e.method)}`}>{e.method}</span></td>
          <td>{e.actorEmail}</td><td style={{ maxWidth: 250 }}><code style={{ fontSize: 12 }}>{e.route}</code></td>
          <td style={{ fontSize: 12 }}>{e.itemId || "—"}</td>
          <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{new Date(e.createdAt).toLocaleString()}</td>
        </tr>)}
      </tbody></table>
      <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
        <button className="btn compact" disabled={offset === 0} onClick={() => load(offset - 50)}>← Prev</button>
        <button className="btn compact" disabled={entries.length < 50} onClick={() => load(offset + 50)}>Next →</button>
      </div></div>
    )}
  </div>);
}

function SecurityTab({ token }: { token: string | null }) {
  const [settings, setSettings] = useState<Modules>({}); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const { showToast } = useAdminFeedback();
  async function load() { setLoading(true); try { const r = await apiRequest<{ policies: Modules }>("/api/v1/admin/sa/system/security", { token }); setSettings(r.policies || {}); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function save() { setSaving(true); setError(""); try { await apiRequest("/api/v1/admin/sa/system/security", { method: "PUT", token, body: { policies: settings } }); showToast({ title: "Saved", message: "Applies to sign-up, password resets and new accounts", tone: "success" }); } catch (e: any) { setError(e.message); } setSaving(false); }
  if (loading) return <div className="loading-spinner" />;
  return (<div className="card" style={{ padding: 16 }}>
    {error && <div className="alert alert-error">{error}</div>}
    <div style={{ display: "grid", gap: 10 }}>
      {SECURITY_FIELDS.map(f => (
        <label key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--surface-hover)", borderRadius: 8 }}>
          <span>{f.label}</span>
          {f.type === "toggle" ? <input type="checkbox" checked={!!settings[f.key]} onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.checked }))} style={{ width: 20, height: 20 }} />
           : <input className="input" type="number" value={(settings[f.key] as number) ?? 0} onChange={e => setSettings(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || 0 }))} style={{ width: 80 }} />}
        </label>
      ))}
    </div>
    <button className="btn primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Security Settings"}</button>
  </div>);
}

function BackupTab({ token }: { token: string | null }) {
  const [backupBusy, setBackupBusy] = useState(false); const [backupResult, setBackupResult] = useState("");
  const [gdprId, setGdprId] = useState(""); const [gdprReason, setGdprReason] = useState(""); const [gdprConfirm, setGdprConfirm] = useState("");
  const [gdprBusy, setGdprBusy] = useState(false); const [gdprResult, setGdprResult] = useState(""); const [error, setError] = useState("");
  const { confirm: confirmDialog, showToast } = useAdminFeedback();

  async function triggerBackup() {
    setBackupBusy(true); setBackupResult("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/sa/system/backup`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Backup failed");
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || "shekinah-backup.tar.gz";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setBackupResult(`Downloaded ${name}. Keep it somewhere safe and private: it contains members' personal data.`);
    } catch (e: any) { setError(e.message); }
    setBackupBusy(false);
  }
  async function gdprPurge() {
    if (gdprConfirm !== "PURGE") return;
    const ok = await confirmDialog({ title: "⚠️ GDPR PURGE — FINAL WARNING", message: `This will permanently erase ALL personal data for this member. Financial transactions will be anonymised. THIS CANNOT BE UNDONE.`, confirmLabel: "Execute Purge", tone: "danger" });
    if (!ok) return;
    setGdprBusy(true); setGdprResult(""); setError("");
    try { await apiRequest(`/api/v1/admin/sa/members/${gdprId.trim()}/purge-gdpr`, { method: "DELETE", token, body: { reason: gdprReason } }); setGdprResult("Member data purged successfully."); setGdprId(""); setGdprReason(""); setGdprConfirm(""); } catch (e: any) { setError(e.message); }
    setGdprBusy(false);
  }

  return (<div style={{ display: "grid", gap: 16 }}>
    <div className="card" style={{ padding: 16 }}>
      <h3><Database size={16} style={{ marginRight: 6 }} />Database Backup</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>Download a complete copy of the database (every table as a spreadsheet file, compressed). Nothing is stored on the server.</p>
      {backupResult && <div className="alert alert-success" style={{ marginTop: 8 }}>{backupResult}</div>}
      <button className="btn primary" style={{ marginTop: 12 }} onClick={triggerBackup} disabled={backupBusy}>{backupBusy ? "Preparing…" : "Download backup"}</button>
    </div>
    <div className="card" style={{ padding: 16, border: "1px solid var(--danger)" }}>
      <h3 style={{ color: "var(--danger)" }}>🔴 GDPR — Right to be Forgotten</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>Permanently purge all personal data for a member. Financial records are anonymised, not deleted, to preserve accounting compliance.</p>
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
      {gdprResult && <div className="alert alert-success" style={{ marginTop: 8 }}>{gdprResult}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <label>Member<MemberSelect token={token} value={gdprId} onChange={setGdprId} /></label>
        <label>Reason / Legal Basis<input className="input" value={gdprReason} onChange={e => setGdprReason(e.target.value)} placeholder="e.g. Subject Access Request" /></label>
        <label style={{ gridColumn: "1/3" }}>Type PURGE to confirm<input className="input" value={gdprConfirm} onChange={e => setGdprConfirm(e.target.value)} placeholder="PURGE" style={{ borderColor: gdprConfirm === "PURGE" ? "var(--danger)" : undefined }} /></label>
      </div>
      <button className="btn danger" style={{ marginTop: 12 }} onClick={gdprPurge} disabled={gdprBusy || gdprConfirm !== "PURGE" || !gdprId || !gdprReason}>{gdprBusy ? "Purging…" : "Execute GDPR Purge"}</button>
    </div>
  </div>);
}
