import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { BadgeCheck } from "lucide-react";

type Role = { id: string; name: string; description: string; permissions: string[]; holders: number };
export const PERMISSION_LABELS: Record<string, string> = {
  "sermons:manage": "Manage sermons", "events:manage": "Manage events", "content:manage": "Devotions, updates & reading plans",
  "finance:manage": "Payments & giving", "checkin:scan": "Gate check-in", "books:publish": "Publish books",
  "community:moderate": "Moderate community", "live:broadcast": "Go live", "live:moderate": "Moderate live chat",
};
const empty = { id: "", name: "", description: "", permissions: [] as string[] };

// Role designer: named permission sets given to people (e.g. "Media team").
export function RolesPage() {
  const token = getToken();
  const { confirm, showToast } = useAdminFeedback();
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = () => apiRequest<{ roles: Role[] }>("/api/v1/admin/sa/roles", { token }).then((r) => setRoles(r.roles || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const toggle = (p: string) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));
  async function save() {
    setError("");
    try { const r = await apiRequest<{ message: string }>("/api/v1/admin/sa/roles", { method: "PUT", token, body: form }); showToast({ title: form.name, message: r.message, tone: "success" }); setForm(empty); void load(); }
    catch (e: any) { setError(e.message); }
  }
  async function duplicate(r: Role) {
    try { await apiRequest(`/api/v1/admin/sa/roles/${r.id}/duplicate`, { method: "POST", token }); void load(); } catch (e: any) { setError(e.message); }
  }
  async function remove(r: Role) {
    const ok = await confirm({ title: `Delete ${r.name}?`, message: `${r.holders} ${r.holders === 1 ? "person keeps" : "people keep"} only their individually granted permissions.`, confirmLabel: "Delete role", tone: "danger" });
    if (!ok) return;
    try { await apiRequest(`/api/v1/admin/sa/roles/${r.id}`, { method: "DELETE", token }); if (form.id === r.id) setForm(empty); void load(); } catch (e: any) { setError(e.message); }
  }
  return (<div className="admin-page">
    <div className="page-header"><h1><BadgeCheck size={20} style={{ marginRight: 8 }} />Roles</h1></div>
    <p style={{ color: "var(--text-secondary)", margin: 0 }}>Design roles like "Media team" or "Finance officer", then give them to people from Members. Editing a role updates everyone who has it.</p>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="card">
      <h3>{form.id ? `Edit ${form.name || "role"}` : "New role"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <label>Name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Media team" /></label>
        <label>Description<input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this role is for" /></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6, marginTop: 12 }}>
        {Object.entries(PERMISSION_LABELS).map(([p, label]) => (
          <label key={p} style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text)", fontWeight: 500 }}>
            <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => toggle(p)} /> {label}
          </label>))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn primary" onClick={save} disabled={!form.name.trim()}>{form.id ? "Save changes" : "Create role"}</button>
        {form.id && <button className="btn" onClick={() => setForm(empty)}>Cancel</button>}
      </div>
    </div>
    <div className="card">
      {loading ? <div className="loading-spinner" /> : roles.length === 0 ? <p style={{ margin: 0 }}>No roles yet.</p> : (
        <table className="data-table"><thead><tr><th>Role</th><th>Permissions</th><th>People</th><th></th></tr></thead><tbody>
          {roles.map((r) => (<tr key={r.id}>
            <td><strong>{r.name}</strong>{r.description && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.description}</div>}</td>
            <td style={{ fontSize: 13 }}>{r.permissions.map((p) => PERMISSION_LABELS[p] || p).join(", ") || "—"}</td>
            <td>{r.holders}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button className="btn compact" onClick={() => setForm({ id: r.id, name: r.name, description: r.description, permissions: r.permissions })}>Edit</button>{" "}
              <button className="btn compact" onClick={() => duplicate(r)}>Duplicate</button>{" "}
              <button className="btn compact danger" onClick={() => remove(r)}>Delete</button>
            </td>
          </tr>))}
        </tbody></table>)}
    </div>
  </div>);
}
