import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { Copy, KeyRound } from "lucide-react";

type ApiKey = { id: string; name: string; prefix: string; permissions: string[]; lastUsedAt: string; expiresAt: string; revoked: boolean };

const ALL_PERMISSIONS = [
  "sermons:manage", "events:manage", "content:manage", "finance:manage",
  "checkin:scan", "live:broadcast", "live:moderate", "books:publish", "community:moderate"
];

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false); const [rawKey, setRawKey] = useState("");
  const [fName, setFName] = useState(""); const [fPerms, setFPerms] = useState<string[]>([]);
  const token = getToken(); const { confirm, showToast } = useAdminFeedback();

  async function load() { setLoading(true); try { const r = await apiRequest<{ keys: ApiKey[] }>("/api/v1/admin/sa/api-keys", { token }); setKeys(r.keys || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);

  async function generate() {
    try {
      const r = await apiRequest<{ key: string }>("/api/v1/admin/sa/api-keys", { method: "POST", token, body: { name: fName, permissions: fPerms } });
      setRawKey(r.key || ""); setShowForm(false); setFName(""); setFPerms([]); void load();
    } catch (e: any) { setError(e.message); }
  }
  async function rotate(k: ApiKey) {
    const ok = await confirm({ title: `Rotate "${k.name}"?`, message: "A new secret is created with the same permissions, and the current one stops working immediately. Update your integration with the new key.", confirmLabel: "Rotate", tone: "danger" });
    if (!ok) return;
    try { const r = await apiRequest<{ key: string }>(`/api/v1/admin/sa/api-keys/${k.id}/rotate`, { method: "POST", token }); setRawKey(r.key || ""); void load(); } catch (e: any) { setError(e.message); }
  }
  async function revoke(k: ApiKey) {
    const ok = await confirm({ title: `Revoke key "${k.name}"?`, message: "Any integrations using this key will stop working.", confirmLabel: "Revoke", tone: "danger" });
    if (!ok) return;
    try { await apiRequest(`/api/v1/admin/sa/api-keys/${k.id}`, { method: "DELETE", token }); showToast({ title: "Revoked", message: "Key revoked", tone: "success" }); void load(); } catch (e: any) { setError(e.message); }
  }
  function togglePerm(p: string) { setFPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]); }
  async function copyKey() { await navigator.clipboard.writeText(rawKey); showToast({ title: "Copied", message: "Key copied to clipboard", tone: "success" }); }

  return (<div className="admin-page">
    <div className="page-header"><h1><KeyRound size={20} style={{ marginRight: 8 }} />API Keys</h1><button className="btn primary" onClick={() => setShowForm(true)}>+ Generate Key</button></div>
    {error && <div className="alert alert-error">{error}</div>}
    {rawKey && <div className="card" style={{ padding: 16, marginBottom: 16, border: "1px solid var(--accent)" }}>
      <h3 style={{ color: "var(--accent)" }}>🔑 New API Key Generated</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 8 }}>Copy this key now — it will <strong>not</strong> be shown again.</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <code style={{ flex: 1, padding: 10, background: "var(--surface-hover)", borderRadius: 8, fontSize: 12, wordBreak: "break-all" }}>{rawKey}</code>
        <button className="btn compact" onClick={copyKey}><Copy size={14} /> Copy</button>
      </div>
      <button className="btn compact" style={{ marginTop: 8 }} onClick={() => setRawKey("")}>Dismiss</button>
    </div>}
    {showForm && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>Generate API Key</h3>
      <label style={{ display: "block", marginTop: 10 }}>Key Name<input className="input" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. n8n Integration" /></label>
      <div style={{ marginTop: 10 }}><strong style={{ fontSize: 13 }}>Permissions</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {ALL_PERMISSIONS.map(p => <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "4px 8px", background: fPerms.includes(p) ? "var(--accent-soft)" : "var(--surface-hover)", borderRadius: 6, cursor: "pointer" }}><input type="checkbox" checked={fPerms.includes(p)} onChange={() => togglePerm(p)} />{p}</label>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn primary" onClick={generate} disabled={!fName}>Generate</button><button className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
    </div>}
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>Name</th><th>Prefix</th><th>Permissions</th><th>Last Used</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>
        {keys.map(k => <tr key={k.id} style={{ opacity: k.revoked ? 0.5 : 1 }}>
          <td>{k.name}</td><td><code>{k.prefix}••••••</code></td>
          <td style={{ maxWidth: 200 }}>{(k.permissions || []).join(", ") || "all"}</td>
          <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
          <td>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "∞"}</td>
          <td>{k.revoked ? <span className="badge danger">Revoked</span> : <span className="badge success">Active</span>}</td>
          <td style={{ whiteSpace: "nowrap" }}>{!k.revoked && <><button className="btn compact" onClick={() => rotate(k)}>Rotate</button> <button className="btn compact danger" onClick={() => revoke(k)}>Revoke</button></>}</td>
        </tr>)}
      </tbody></table></div>
    )}
  </div>);
}
