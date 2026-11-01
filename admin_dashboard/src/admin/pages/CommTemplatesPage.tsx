import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";

type Template = { id: string; name: string; channel: string; subject: string; body: string; variables: string; isActive: boolean };

const CHANNELS = ["sms", "email", "push", "whatsapp"];
const channelBadge = (ch: string) => ({ sms: "📱 SMS", email: "✉️ Email", push: "🔔 Push", whatsapp: "💬 WhatsApp" }[ch] || ch);

export function CommTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Template | null>(null);
  const [fName, setFName] = useState(""); const [fChannel, setFChannel] = useState("sms"); const [fSubject, setFSubject] = useState("");
  const [fBody, setFBody] = useState(""); const [fVars, setFVars] = useState(""); const [fActive, setFActive] = useState(true);
  const token = getToken(); const { confirm, showToast } = useAdminFeedback();

  async function load() { setLoading(true); try { const r = await apiRequest<{ templates: Template[] }>("/api/v1/admin/sa/comm/templates", { token }); setTemplates(r.templates || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);

  function openEdit(t: Template) { setEditing(t); setFName(t.name); setFChannel(t.channel); setFSubject(t.subject); setFBody(t.body); setFVars(t.variables || ""); setFActive(t.isActive); setShowForm(true); }
  function openNew() { setEditing(null); setFName(""); setFChannel("sms"); setFSubject(""); setFBody(""); setFVars(""); setFActive(true); setShowForm(true); }

  async function save() {
    try { await apiRequest("/api/v1/admin/sa/comm/templates", { method: "PUT", token, body: { ...(editing ? { id: editing.id } : {}), name: fName, channel: fChannel, subject: fSubject, body: fBody, variables: fVars, isActive: fActive } }); showToast({ title: "Saved", message: "Template saved", tone: "success" }); setShowForm(false); void load(); } catch (e: any) { setError(e.message); }
  }
  async function del(t: Template) {
    const ok = await confirm({ title: `Delete template "${t.name}"?`, message: "This cannot be undone.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try { await apiRequest(`/api/v1/admin/sa/comm/templates/${t.id}`, { method: "DELETE", token }); void load(); } catch (e: any) { setError(e.message); }
  }

  const preview = (body: string) => body.replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`);

  return (<div className="admin-page">
    <header className="page-header"><div><p className="eyebrow">Super Admin</p><h1>Communication Templates</h1><p className="muted">Reusable wording for messages and emails.</p></div><button className="btn primary" onClick={openNew}>+ New Template</button></header>
    {error && <div className="alert alert-error">{error}</div>}
    {showForm && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>{editing ? "Edit" : "New"} Template</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <label>Name<input className="input" value={fName} onChange={e => setFName(e.target.value)} /></label>
        <label>Channel<select className="input" value={fChannel} onChange={e => setFChannel(e.target.value)}>{CHANNELS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></label>
        {(fChannel === "email") && <label style={{ gridColumn: "1/3" }}>Subject<input className="input" value={fSubject} onChange={e => setFSubject(e.target.value)} /></label>}
        <label style={{ gridColumn: "1/3" }}>Body (use {"{{variable}}"} for placeholders)<textarea className="input" value={fBody} onChange={e => setFBody(e.target.value)} rows={4} /></label>
        <label>Variables (comma-separated)<input className="input" value={fVars} onChange={e => setFVars(e.target.value)} placeholder="name, amount, date" /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={fActive} onChange={e => setFActive(e.target.checked)} /> Active</label>
      </div>
      {fBody && <div style={{ marginTop: 12, padding: 12, background: "var(--surface-hover)", borderRadius: 8 }}><strong style={{ fontSize: 12 }}>Preview:</strong><p style={{ fontSize: 13, marginTop: 4 }}>{preview(fBody)}</p></div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn primary" onClick={save} disabled={!fName || !fBody}>Save</button><button className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
    </div>}
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>Name</th><th>Channel</th><th>Body</th><th>Active</th><th>Actions</th></tr></thead><tbody>
        {templates.map(t => <tr key={t.id}>
          <td>{t.name}</td><td>{channelBadge(t.channel)}</td>
          <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.body}</td>
          <td>{t.isActive ? <span className="badge success">Active</span> : <span className="badge">Inactive</span>}</td>
          <td style={{ display: "flex", gap: 4 }}><button className="btn compact" onClick={() => openEdit(t)}>Edit</button><button className="btn compact danger" onClick={() => del(t)}>Delete</button></td>
        </tr>)}
      </tbody></table></div>
    )}
  </div>);
}
