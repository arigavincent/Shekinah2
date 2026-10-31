import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { Send } from "lucide-react";

type Option = { id: string; name: string };
type Logged = { id: string; title: string; body: string; audience: string; channels: string[]; pushDevices: number; pushDelivered: number; emailsSent: number; sentBy: string; createdAt: string };
type Template = { id: string; name: string; channel: string; subject: string; body: string; isActive: boolean };
const STATUSES = ["member", "visitor", "leader", "pastor", "staff", "transferred"];

// Message the whole church or part of it, by push (and the app's feed) or email.
export function MessagesPage() {
  const token = getToken();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all"); const [targetId, setTargetId] = useState("");
  const [push, setPush] = useState(true); const [email, setEmail] = useState(false);
  const [groups, setGroups] = useState<Option[]>([]); const [roles, setRoles] = useState<Option[]>([]); const [templates, setTemplates] = useState<Template[]>([]);
  const [log, setLog] = useState<Logged[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const loadLog = () => apiRequest<{ messages: Logged[] }>("/api/v1/admin/sa/messages", { token }).then((r) => setLog(r.messages || [])).catch(() => {});
  useEffect(() => {
    void loadLog();
    apiRequest<{ groups: Option[] }>("/api/v1/admin/sa/groups", { token }).then((r) => setGroups(r.groups || [])).catch(() => {});
    apiRequest<{ roles: Option[] }>("/api/v1/admin/sa/roles", { token }).then((r) => setRoles(r.roles || [])).catch(() => {});
    apiRequest<{ templates: Template[] }>("/api/v1/admin/sa/comm/templates", { token }).then((r) => setTemplates((r.templates || []).filter((t) => t.isActive && (t.channel === "push" || t.channel === "email")))).catch(() => {});
  }, []);
  const targets = audience === "group" ? groups : audience === "role" ? roles : audience === "status" ? STATUSES.map((s) => ({ id: s, name: s[0].toUpperCase() + s.slice(1) + "s" })) : [];
  async function send() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await apiRequest<{ message: string; recipients: number }>("/api/v1/admin/sa/messages", { method: "POST", token, body: { title, body, audience, targetId, channels: [...(push ? ["push"] : []), ...(email ? ["email"] : [])] } });
      setMessage(r.message); setTitle(""); setBody(""); void loadLog();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  return (<div className="admin-page">
    <div className="page-header"><h1><Send size={20} style={{ marginRight: 8 }} />Messages</h1></div>
    <div className="card">
      <h3>New message</h3>
      {templates.length > 0 && <label>Start from a template<select className="input" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setTitle(t.subject || t.name); setBody(t.body); } }}>
        <option value="">Choose…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>)}</select></label>}
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <label>Title<input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Message<textarea className="input" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <label>Send to<select className="input" value={audience} onChange={(e) => { setAudience(e.target.value); setTargetId(""); }}>
            <option value="all">Everyone</option><option value="group">A ministry or group</option><option value="role">A staff role</option>
            <option value="status">A membership status</option><option value="staff">All staff</option></select></label>
          {targets.length > 0 && <label>Which<select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Choose…</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text)" }}><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} /> Push and app notifications</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text)" }}><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email</label>
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ marginTop: 10 }}>{message}</div>}
      <button className="btn primary" style={{ marginTop: 12 }} onClick={send} disabled={busy || !title.trim() || !body.trim() || (!push && !email) || (["group", "role", "status"].includes(audience) && !targetId)}>{busy ? "Sending…" : "Send"}</button>
    </div>
    <div className="card">
      <h3>Sent</h3>
      {log.length === 0 ? <p style={{ margin: 0 }}>Nothing sent yet.</p> : (
        <table className="data-table"><thead><tr><th>When</th><th>Message</th><th>To</th><th>Delivered</th><th>By</th></tr></thead><tbody>
          {log.map((m) => (<tr key={m.id}>
            <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{new Date(m.createdAt).toLocaleString()}</td>
            <td><strong>{m.title}</strong><div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.body}</div></td>
            <td>{m.audience}</td>
            <td style={{ fontSize: 12 }}>{m.channels.includes("push") && <div>Push: {m.pushDelivered}/{m.pushDevices} phones</div>}{m.channels.includes("email") && <div>Email: {m.emailsSent}</div>}</td>
            <td style={{ fontSize: 12 }}>{m.sentBy || "—"}</td>
          </tr>))}
        </tbody></table>)}
    </div>
  </div>);
}
