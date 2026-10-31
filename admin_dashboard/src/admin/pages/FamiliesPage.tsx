import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { MemberSelect } from "../components/MemberSelect";
import { Home } from "lucide-react";

type FamilyMember = { id: string; name: string; email: string; familyRole: string };
type Family = { id: string; name: string; address: string; notes: string; members: FamilyMember[] };
const ROLES = ["head", "spouse", "child", "other"];

// Households: link members as head, spouse, child or other.
export function FamiliesPage() {
  const token = getToken();
  const { confirm } = useAdminFeedback();
  const [families, setFamilies] = useState<Family[]>([]);
  const [form, setForm] = useState({ id: "", name: "", address: "", notes: "" });
  const [adding, setAdding] = useState<Record<string, { userId: string; role: string }>>({});
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = () => apiRequest<{ families: Family[] }>("/api/v1/admin/sa/families", { token }).then((r) => setFamilies(r.families || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  async function run(action: () => Promise<unknown>) { setError(""); try { await action(); void load(); } catch (e: any) { setError(e.message); } }
  const save = () => run(async () => { await apiRequest("/api/v1/admin/sa/families", { method: "PUT", token, body: form }); setForm({ id: "", name: "", address: "", notes: "" }); });
  const link = (familyId: string, userId: string, familyRole: string) => run(() => apiRequest(`/api/v1/admin/sa/users/${userId}/family`, { method: "PUT", token, body: { familyId, familyRole } }));
  async function remove(f: Family) {
    if (!(await confirm({ title: `Remove ${f.name}?`, message: "The household is removed; its members' accounts are kept.", confirmLabel: "Remove", tone: "danger" }))) return;
    void run(() => apiRequest(`/api/v1/admin/sa/families/${f.id}`, { method: "DELETE", token }));
  }
  return (<div className="admin-page">
    <div className="page-header"><h1><Home size={20} style={{ marginRight: 8 }} />Families</h1></div>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="card">
      <h3>{form.id ? "Edit family" : "New family"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label>Family name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="The Otieno family" /></label>
        <label>Address<input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label>Notes<input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn primary" onClick={save} disabled={!form.name.trim()}>{form.id ? "Save" : "Create family"}</button>
        {form.id && <button className="btn" onClick={() => setForm({ id: "", name: "", address: "", notes: "" })}>Cancel</button>}
      </div>
    </div>
    {loading ? <div className="loading-spinner" /> : families.length === 0 ? <div className="card"><p style={{ margin: 0 }}>No families yet.</p></div> : families.map((f) => {
      const add = adding[f.id] || { userId: "", role: "child" };
      return (<div className="card" key={f.id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div><h3 style={{ margin: 0 }}>{f.name}</h3>{f.address && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f.address}</div>}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn compact" onClick={() => setForm({ id: f.id, name: f.name, address: f.address, notes: f.notes })}>Edit</button>
            <button className="btn compact danger" onClick={() => void remove(f)}>Remove</button>
          </div>
        </div>
        {f.members.length > 0 && <table className="data-table" style={{ marginTop: 10 }}><tbody>
          {f.members.map((m) => (<tr key={m.id}>
            <td><strong>{m.name}</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.email}</div></td>
            <td><select className="input" value={m.familyRole} onChange={(e) => void link(f.id, m.id, e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select></td>
            <td style={{ textAlign: "right" }}><button className="btn compact" onClick={() => void link("", m.id, "other")}>Remove from family</button></td>
          </tr>))}
        </tbody></table>}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 220 }}><MemberSelect token={token} value={add.userId} onChange={(userId) => setAdding({ ...adding, [f.id]: { ...add, userId } })} placeholder="Add a member…" /></div>
          <select className="input" style={{ width: 130 }} value={add.role} onChange={(e) => setAdding({ ...adding, [f.id]: { ...add, role: e.target.value } })}>{ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select>
          <button className="btn primary compact" disabled={!add.userId} onClick={() => { void link(f.id, add.userId, add.role); setAdding({ ...adding, [f.id]: { userId: "", role: "child" } }); }}>Add</button>
        </div>
      </div>);
    })}
  </div>);
}
