import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { MemberSelect } from "../components/MemberSelect";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";

type Group = { id: string; name: string; type: string; leaderId: string; leaderName: string; location: string; schedule: string; maxCapacity: number; memberCount: number; archived: boolean };
type RosterMember = { userId: string; name: string; email: string; role: string; joinedAt: string };

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<Group | null>(null); const [roster, setRoster] = useState<RosterMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState(""); const [formType, setFormType] = useState("ministry"); const [formLead, setFormLead] = useState("");
  const [formLoc, setFormLoc] = useState(""); const [formSched, setFormSched] = useState(""); const [formCap, setFormCap] = useState("");
  const [addUserId, setAddUserId] = useState(""); const [addRole, setAddRole] = useState("member");
  const token = getToken(); const { confirm, showToast } = useAdminFeedback();

  async function load() { setLoading(true); try { const r = await apiRequest<{ groups: Group[] }>("/api/v1/admin/sa/groups", { token }); setGroups(r.groups || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function loadRoster(id: string) { try { const r = await apiRequest<{ members: RosterMember[] }>(`/api/v1/admin/sa/groups/${id}/roster`, { token }); setRoster(r.members || []); } catch { setRoster([]); } }
  async function selectGroup(g: Group) { setSelected(g); await loadRoster(g.id); }
  async function save() {
    try { await apiRequest("/api/v1/admin/sa/groups", { method: "PUT", token, body: { name: formName, type: formType, leaderId: formLead || undefined, location: formLoc, schedule: formSched, maxCapacity: parseInt(formCap) || 0 } }); showToast({ title: "Saved", message: "Group saved", tone: "success" }); setShowForm(false); void load(); } catch (e: any) { setError(e.message); }
  }
  async function del(g: Group, mode: "soft"|"hard") {
    const ok = await confirm({ title: `${mode === "hard" ? "PERMANENTLY" : "Archive"} group ${g.name}?`, message: mode === "hard" ? "All data, rosters and history will be erased." : "Group will be archived but data preserved.", confirmLabel: mode === "hard" ? "Delete permanently" : "Archive", tone: mode === "hard" ? "danger" : "default" });
    if (!ok) return;
    try { await apiRequest(`/api/v1/admin/sa/groups/${g.id}?mode=${mode}`, { method: "DELETE", token }); setSelected(null); void load(); } catch (e: any) { setError(e.message); }
  }
  async function assignMember() {
    if (!selected || !addUserId) return;
    try { await apiRequest(`/api/v1/admin/sa/groups/${selected.id}/roster`, { method: "POST", token, body: { userId: addUserId, role: addRole } }); setAddUserId(""); await loadRoster(selected.id); void load(); } catch (e: any) { setError(e.message); }
  }
  async function removeMember(userId: string) {
    if (!selected) return;
    try { await apiRequest(`/api/v1/admin/sa/groups/${selected.id}/roster/${userId}`, { method: "DELETE", token }); await loadRoster(selected.id); void load(); } catch (e: any) { setError(e.message); }
  }

  const typeBadge = (t: string) => ({ ministry: "🏛️", department: "🏢", small_group: "👥", sunday_school: "📖", committee: "📋" }[t] || "📌");

  return (<div className="admin-page">
    <div className="page-header"><h1>Groups & Ministries</h1><button className="btn primary" onClick={() => setShowForm(true)}>+ New Group</button></div>
    {error && <div className="alert alert-error">{error}</div>}
    {showForm && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>Create Group</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <label>Name<input className="input" value={formName} onChange={e => setFormName(e.target.value)} /></label>
        <label>Type<select className="input" value={formType} onChange={e => setFormType(e.target.value)}><option value="ministry">Ministry</option><option value="department">Department</option><option value="small_group">Small Group</option><option value="sunday_school">Sunday School</option><option value="committee">Committee</option></select></label>
        <label>Leader<MemberSelect token={token} value={formLead} onChange={setFormLead} /></label>
        <label>Location<input className="input" value={formLoc} onChange={e => setFormLoc(e.target.value)} /></label>
        <label>Schedule<input className="input" value={formSched} onChange={e => setFormSched(e.target.value)} /></label>
        <label>Max Capacity<input className="input" type="number" value={formCap} onChange={e => setFormCap(e.target.value)} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn primary" onClick={save} disabled={!formName}>Save</button><button className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
    </div>}
    {loading ? <div className="loading-spinner" /> : (
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16 }}>
        <div className="card"><table className="data-table"><thead><tr><th></th><th>Name</th><th>Type</th><th>Members</th><th>Actions</th></tr></thead><tbody>
          {groups.map(g => <tr key={g.id} onClick={() => selectGroup(g)} style={{ cursor: "pointer", background: selected?.id === g.id ? "var(--surface-hover)" : undefined, opacity: g.archived ? 0.5 : 1 }}>
            <td>{typeBadge(g.type)}</td><td>{g.name}</td><td><span className="badge">{g.type}</span></td><td>{g.memberCount}</td>
            <td style={{ display: "flex", gap: 4 }}><button className="btn-icon" onClick={e => { e.stopPropagation(); del(g, "soft"); }} title="Archive">📦</button><button className="btn-icon danger" onClick={e => { e.stopPropagation(); del(g, "hard"); }} title="Delete">🗑️</button></td>
          </tr>)}
        </tbody></table></div>
        {selected && <div className="card" style={{ padding: 16 }}>
          <h2>{selected.name}</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>{selected.type} · {selected.leaderName || "No leader"} · {selected.location || "No location"}</p>
          <h3>Roster ({roster.length})</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><MemberSelect token={token} value={addUserId} onChange={setAddUserId} /></div>
            <select className="input" value={addRole} onChange={e => setAddRole(e.target.value)} style={{ width: 120 }}><option value="member">Member</option><option value="leader">Leader</option><option value="assistant">Assistant</option></select>
            <button className="btn primary compact" onClick={assignMember} disabled={!addUserId}>Add</button>
          </div>
          {roster.map(m => <div key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span>{m.name} <small style={{ color: "var(--text-secondary)" }}>({m.email}) · {m.role}</small></span>
            <button className="btn-icon danger" onClick={() => removeMember(m.userId)}>✕</button>
          </div>)}
        </div>}
      </div>
    )}
  </div>);
}
