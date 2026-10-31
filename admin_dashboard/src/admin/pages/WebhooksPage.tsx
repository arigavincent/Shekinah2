import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { Webhook } from "lucide-react";

type WebhookEntry = { id: string; url: string; events: string[]; isActive: boolean; secret: string; lastStatus: number; lastTriggered: string };

const EVENT_OPTIONS = ["member.created", "member.updated", "giving.received", "giving.refunded", "attendance.session.created", "event.registered", "user.suspended", "user.deleted"];

export function WebhooksPage() {
  const [hooks, setHooks] = useState<WebhookEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<WebhookEntry | null>(null);
  const [fUrl, setFUrl] = useState(""); const [fEvents, setFEvents] = useState<string[]>([]); const [fActive, setFActive] = useState(true);
  const [testResult, setTestResult] = useState<{ id: string; msg: string } | null>(null);
  const token = getToken(); const { confirm, showToast } = useAdminFeedback();

  async function load() { setLoading(true); try { const r = await apiRequest<{ webhooks: WebhookEntry[] }>("/api/v1/admin/sa/webhooks", { token }); setHooks(r.webhooks || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);

  function openNew() { setEditing(null); setFUrl(""); setFEvents([]); setFActive(true); setShowForm(true); }
  function openEdit(w: WebhookEntry) { setEditing(w); setFUrl(w.url); setFEvents(w.events || []); setFActive(w.isActive); setShowForm(true); }
  function toggleEvent(e: string) { setFEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]); }

  async function save() {
    try { await apiRequest("/api/v1/admin/sa/webhooks", { method: "PUT", token, body: { ...(editing ? { id: editing.id } : {}), url: fUrl, events: fEvents, isActive: fActive } }); showToast({ title: "Saved", message: "Webhook saved", tone: "success" }); setShowForm(false); void load(); } catch (e: any) { setError(e.message); }
  }
  async function test(w: WebhookEntry) {
    setTestResult(null);
    try { await apiRequest(`/api/v1/admin/sa/webhooks/${w.id}/test`, { method: "POST", token }); setTestResult({ id: w.id, msg: "Test ping sent — check your endpoint." }); } catch (e: any) { setTestResult({ id: w.id, msg: `Failed: ${e.message}` }); }
  }
  async function del(w: WebhookEntry) {
    const ok = await confirm({ title: "Delete webhook?", message: w.url, confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try { await apiRequest(`/api/v1/admin/sa/webhooks/${w.id}`, { method: "DELETE", token }); void load(); } catch (e: any) { setError(e.message); }
  }

  const statusColor = (s: number) => s >= 200 && s < 300 ? "success" : s > 0 ? "danger" : "";

  return (<div className="admin-page">
    <div className="page-header"><h1><Webhook size={20} style={{ marginRight: 8 }} />Webhooks</h1><button className="btn primary" onClick={openNew}>+ New Webhook</button></div>
    {error && <div className="alert alert-error">{error}</div>}
    {showForm && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>{editing ? "Edit" : "New"} Webhook</h3>
      <label style={{ display: "block", marginTop: 10 }}>Endpoint URL<input className="input" value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="https://..." /></label>
      <div style={{ marginTop: 10 }}><strong style={{ fontSize: 13 }}>Events</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {EVENT_OPTIONS.map(ev => <label key={ev} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "4px 8px", background: fEvents.includes(ev) ? "var(--accent-soft)" : "var(--surface-hover)", borderRadius: 6, cursor: "pointer" }}><input type="checkbox" checked={fEvents.includes(ev)} onChange={() => toggleEvent(ev)} />{ev}</label>)}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}><input type="checkbox" checked={fActive} onChange={e => setFActive(e.target.checked)} /> Active</label>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn primary" onClick={save} disabled={!fUrl.startsWith("http")}>Save</button><button className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
    </div>}
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>URL</th><th>Events</th><th>Status</th><th>Last</th><th>Active</th><th>Actions</th></tr></thead><tbody>
        {hooks.map(w => <tr key={w.id}>
          <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>{w.url}</td>
          <td style={{ maxWidth: 200 }}>{(w.events || []).join(", ")}</td>
          <td>{w.lastStatus > 0 && <span className={`badge ${statusColor(w.lastStatus)}`}>HTTP {w.lastStatus}</span>}</td>
          <td>{w.lastTriggered ? new Date(w.lastTriggered).toLocaleDateString() : "—"}</td>
          <td>{w.isActive ? <span className="badge success">On</span> : <span className="badge">Off</span>}</td>
          <td style={{ display: "flex", gap: 4 }}>
            <button className="btn compact" onClick={() => openEdit(w)}>Edit</button>
            <button className="btn compact" onClick={() => test(w)}>Test</button>
            <button className="btn compact danger" onClick={() => del(w)}>Delete</button>
          </td>
        </tr>)}
        {hooks.map(w => testResult?.id === w.id ? <tr key={w.id + "-test"}><td colSpan={6} style={{ color: testResult.msg.startsWith("Failed") ? "var(--danger)" : "var(--success)", fontSize: 13 }}>{testResult.msg}</td></tr> : null)}
      </tbody></table></div>
    )}
  </div>);
}
