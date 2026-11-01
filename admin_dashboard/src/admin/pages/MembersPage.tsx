import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { MemberSelect } from "../components/MemberSelect";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { Search, UserX, UserCheck, Trash2, Merge, StickyNote, Download } from "lucide-react";

type Member = {
  id: string; name: string; email: string; role: string;
  membershipStatus?: string; phone?: string; isActive?: boolean; staffRoleId?: string; staffRole?: string;
  permissions?: string[];
};
type PastoralNote = { id: string; note: string; authorEmail: string; createdAt: string };

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [notes, setNotes] = useState<PastoralNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [mergeInto, setMergeInto] = useState("");
  const { confirm, showToast } = useAdminFeedback();
  const token = getToken();

  async function load() {
    setLoading(true);
    try {
      const r = await apiRequest<{ members: Member[] }>("/api/v1/admin/members", { token });
      setMembers(r.members || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function loadNotes(id: string) {
    try {
      const r = await apiRequest<{ notes: PastoralNote[] }>(`/api/v1/admin/sa/members/${id}/pastoral-notes`, { token });
      setNotes(r.notes || []);
    } catch { setNotes([]); }
  }

  async function selectMember(m: Member) {
    setSelected(m);
    await loadNotes(m.id);
  }

  async function suspend(m: Member) {
    try {
      const r = await apiRequest<{ message: string }>(`/api/v1/admin/sa/users/${m.id}/suspend`, { method: "POST", token });
      showToast({ title: m.name, message: r.message, tone: "success" });
      void load();
    } catch (e: any) { setError(e.message); }
  }

  async function deleteUser(m: Member, mode: "soft" | "hard") {
    const ok = await confirm({ title: `${mode === "hard" ? "PERMANENTLY" : "Soft"} delete ${m.name}?`, message: mode === "hard" ? "This CANNOT be undone. All data will be erased." : "The user will be hidden but data preserved.", confirmLabel: mode === "hard" ? "Yes, permanently delete" : "Archive user", tone: mode === "hard" ? "danger" : "default" });
    if (!ok) return;
    try {
      await apiRequest(`/api/v1/admin/sa/users/${m.id}?mode=${mode}`, { method: "DELETE", token });
      showToast({ title: "Deleted", message: `${m.name} ${mode}-deleted`, tone: "success" });
      setSelected(null);
      void load();
    } catch (e: any) { setError(e.message); }
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    try {
      await apiRequest(`/api/v1/admin/sa/members/${selected.id}/pastoral-notes`, { method: "POST", token, body: { note: newNote.trim() } });
      setNewNote("");
      await loadNotes(selected.id);
    } catch (e: any) { setError(e.message); }
  }

  async function doMerge() {
    if (!mergeId || !mergeInto) return;
    const ok = await confirm({ title: "Merge profiles?", message: "The duplicate's giving, notes and groups move to the account you keep, and the duplicate is archived. This cannot be undone.", confirmLabel: "Merge", tone: "default" });
    if (!ok) return;
    try {
      await apiRequest(`/api/v1/admin/sa/members/${mergeId}/merge`, { method: "POST", token, body: { mergeIntoId: mergeInto } });
      showToast({ title: "Merged", message: "Profiles merged successfully", tone: "success" });
      setMergeId(""); setMergeInto(""); void load();
    } catch (e: any) { setError(e.message); }
  }

  const filtered = members.filter(m => !query || m.name.toLowerCase().includes(query.toLowerCase()) || m.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="admin-page">
      <header className="page-header"><div><p className="eyebrow">Super Admin</p><h1>Member Management</h1><p className="muted">Accounts for everyone: create, edit, suspend, merge duplicates and keep pastoral notes.</p></div></header>
      {error && <div className="alert alert-error">{error}</div>}
      <AddAccount token={token} onCreated={() => void load()} />
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h3 style={{ marginBottom: 8 }}><Merge size={16} style={{ marginRight: 6 }} />Merge Duplicates</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><MemberSelect token={token} value={mergeId} onChange={setMergeId} placeholder="Duplicate account (will be archived)" /></div>
          <div style={{ flex: 1 }}><MemberSelect token={token} value={mergeInto} onChange={setMergeInto} placeholder="Account to keep" /></div>
          <button className="btn primary" onClick={doMerge} disabled={!mergeId || !mergeInto}>Merge</button>
        </div>
      </div>
      <div className="search-bar" style={{ marginBottom: 12 }}>
        <Search size={16} />
        <input placeholder="Search members…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      {loading ? <div className="loading-spinner" /> : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16 }}>
          <div className="card" style={{ maxHeight: "70vh", overflow: "auto" }}>
            <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {filtered.map(m => (
                <tr key={m.id} onClick={() => selectMember(m)} style={{ cursor: "pointer", background: selected?.id === m.id ? "var(--surface-hover)" : undefined }}>
                  <td>{m.name}</td><td>{m.email}</td><td><span className="badge">{({ super_admin: "Super admin", admin: "Admin", member: "Member" } as Record<string, string>)[m.role] || m.role}</span></td>
                  <td>{m.isActive === false ? <span className="badge danger">Inactive</span> : <span className="badge success">Active</span>}</td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button className="btn-icon" title="Toggle suspend" onClick={e => { e.stopPropagation(); suspend(m); }}>{m.isActive === false ? <UserCheck size={14} /> : <UserX size={14} />}</button>
                    <button className="btn-icon danger" title="Soft delete" onClick={e => { e.stopPropagation(); deleteUser(m, "soft"); }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
          {selected && (
            <div className="card" style={{ padding: 16 }}>
              <h2>{selected.name}</h2>
              <p style={{ color: "var(--text-secondary)" }}>{selected.email} · {selected.role} · {selected.membershipStatus || "member"}</p>
              <div style={{ margin: "16px 0", display: "flex", gap: 8 }}>
                <button className="btn warning" onClick={() => suspend(selected)}>{selected.isActive === false ? "Reactivate" : "Suspend"}</button>
                <button className="btn danger" onClick={() => deleteUser(selected, "soft")}>Soft Delete</button>
                <button className="btn danger outline" onClick={() => deleteUser(selected, "hard")}>Hard Delete</button>
              </div>
              <EditMember key={selected.id} token={token} member={selected} onSaved={() => void load()} />
              <hr />
              <h3 style={{ marginTop: 12 }}><StickyNote size={14} style={{ marginRight: 4 }} />Pastoral Notes</h3>
              {notes.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No pastoral notes.</p>}
              {notes.map(n => (
                <div key={n.id} className="note-card" style={{ padding: 8, marginBottom: 6, background: "var(--surface-hover)", borderRadius: 8 }}>
                  <p style={{ fontSize: 13 }}>{n.note}</p>
                  <small style={{ color: "var(--text-secondary)" }}>{n.authorEmail} · {new Date(n.createdAt).toLocaleDateString()}</small>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="Add pastoral note…" value={newNote} onChange={e => setNewNote(e.target.value)} className="input" style={{ flex: 1 }} />
                <button className="btn primary compact" onClick={addNote} disabled={!newNote.trim()}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ROLES = [["member", "Member"], ["admin", "Admin"], ["super_admin", "Super admin"]];
const STATUSES = ["member", "visitor", "pastor", "leader", "staff", "transferred"];
function AddAccount({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "member", membershipStatus: "member" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState<{ email: string; temporaryPassword?: string } | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function create() {
    setBusy(true); setError("");
    try {
      const r = await apiRequest<{ email: string; temporaryPassword?: string }>("/api/v1/admin/sa/users", { method: "POST", token, body: form });
      setDone(r); setForm({ name: "", email: "", phone: "", role: "member", membershipStatus: "member" }); onCreated();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  if (!open) return <div style={{ marginBottom: 16 }}><button className="btn primary" onClick={() => { setOpen(true); setDone(null); }}>Add account</button></div>;
  return (<div className="card" style={{ marginBottom: 16, padding: 16 }}>
    <h3 style={{ marginBottom: 8 }}>Add account</h3>
    {error && <div className="alert alert-error">{error}</div>}
    {done ? (<div className="alert alert-success">
      Account created for <strong>{done.email}</strong>.{done.temporaryPassword && <> Temporary password: <code style={{ userSelect: "all" }}>{done.temporaryPassword}</code> — share it privately. They must choose their own password at first sign-in. It will not be shown again.</>}
      <div style={{ marginTop: 8 }}><button className="btn compact" onClick={() => setDone(null)}>Add another</button> <button className="btn compact" onClick={() => setOpen(false)}>Close</button></div>
    </div>) : (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label>Full name<input className="input" value={form.name} onChange={set("name")} /></label>
        <label>Email<input className="input" type="email" value={form.email} onChange={set("email")} /></label>
        <label>Phone<input className="input" value={form.phone} onChange={set("phone")} /></label>
        <label>Role<select className="input" value={form.role} onChange={set("role")}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Membership<select className="input" value={form.membershipStatus} onChange={set("membershipStatus")}>{STATUSES.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn primary" onClick={create} disabled={busy || !form.name.trim() || !form.email.includes("@")}>{busy ? "Creating…" : "Create account"}</button>
        <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </>)}
  </div>);
}

// Edit a member's details and help them back in when they forget a password.
function EditMember({ token, member, onSaved }: { token: string | null; member: Member; onSaved: () => void }) {
  const [form, setForm] = useState({ name: member.name, email: member.email, phone: member.phone || "", role: member.role, membershipStatus: member.membershipStatus || "member" });
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [temporary, setTemporary] = useState("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [staffRole, setStaffRole] = useState(member.staffRoleId || "");
  useEffect(() => { apiRequest<{ roles: { id: string; name: string }[] }>("/api/v1/admin/sa/roles", { token }).then((r) => setRoles(r.roles || [])).catch(() => {}); }, [token]);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function run(kind: string, action: () => Promise<void>) {
    setBusy(kind); setError(""); setMessage(""); setTemporary("");
    try { await action(); } catch (e: any) { setError(e.message); }
    setBusy("");
  }
  const save = () => run("save", async () => {
    await apiRequest(`/api/v1/admin/sa/users/${member.id}`, { method: "PATCH", token, body: form });
    if (staffRole !== (member.staffRoleId || "")) await apiRequest(`/api/v1/admin/sa/users/${member.id}/role`, { method: "PUT", token, body: { roleId: staffRole } });
    setMessage("Details saved."); onSaved();
  });
  const emailCode = () => run("email", async () => { const r = await apiRequest<{ message: string }>(`/api/v1/admin/members/${member.id}/reset-password`, { method: "POST", token }); setMessage(r.message); });
  const tempPassword = () => run("temp", async () => { const r = await apiRequest<{ temporaryPassword: string }>(`/api/v1/admin/sa/users/${member.id}/temporary-password`, { method: "POST", token }); setTemporary(r.temporaryPassword); });
  return (<div style={{ display: "grid", gap: 10, margin: "8px 0 16px" }}>
    <h3 style={{ marginTop: 8 }}>Details</h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
      <label>Full name<input className="input" value={form.name} onChange={set("name")} /></label>
      <label>Email<input className="input" type="email" value={form.email} onChange={set("email")} /></label>
      <label>Phone<input className="input" value={form.phone} onChange={set("phone")} /></label>
      <label>Role<select className="input" value={form.role} onChange={set("role")}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Membership<select className="input" value={form.membershipStatus} onChange={set("membershipStatus")}>{STATUSES.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
      <label>Staff role<select className="input" value={staffRole} onChange={(e) => setStaffRole(e.target.value)}><option value="">No role</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    {message && <div className="alert alert-success">{message}</div>}
    {temporary && <div className="alert alert-success">Temporary password: <code style={{ userSelect: "all" }}>{temporary}</code> — share it privately. They have been signed out everywhere and will choose their own password when they sign in.</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn primary" onClick={save} disabled={!!busy || !form.name.trim() || !form.email.includes("@")}>{busy === "save" ? "Saving…" : "Save details"}</button>
      <button className="btn" onClick={emailCode} disabled={!!busy}>{busy === "email" ? "Sending…" : "Email a reset code"}</button>
      <button className="btn" onClick={tempPassword} disabled={!!busy}>{busy === "temp" ? "Setting…" : "Set a temporary password"}</button>
    </div>
  </div>);
}
