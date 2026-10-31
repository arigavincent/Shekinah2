import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { Search, UserX, UserCheck, Trash2, Merge, StickyNote, Download } from "lucide-react";

type Member = {
  id: string; name: string; email: string; role: string;
  membershipStatus?: string; phone?: string; isActive?: boolean;
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
      await apiRequest(`/api/v1/admin/sa/users/${m.id}/suspend`, { method: "POST", token });
      showToast({ title: "Done", message: `${m.name} suspension toggled`, tone: "success" });
      void load();
    } catch (e: any) { setError(e.message); }
  }

  async function deleteUser(m: Member, mode: "soft" | "hard") {
    const ok = await confirm({ title: `${mode === "hard" ? "PERMANENTLY" : "Soft"} delete ${m.name}?`, message: mode === "hard" ? "This CANNOT be undone. All data will be erased." : "The user will be hidden but data preserved.", confirmLabel: mode === "hard" ? "Yes, permanently delete" : "Archive user", tone: mode === "hard" ? "danger" : "warning" });
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
    const ok = await confirm({ title: "Merge profiles?", message: `Merge ${mergeId} INTO ${mergeInto}. This cannot be undone.`, confirmLabel: "Merge", tone: "warning" });
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
      <div className="page-header"><h1>Member Management</h1></div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h3 style={{ marginBottom: 8 }}><Merge size={16} style={{ marginRight: 6 }} />Merge Duplicates</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Source member ID" value={mergeId} onChange={e => setMergeId(e.target.value)} className="input" style={{ flex: 1 }} />
          <input placeholder="Target member ID" value={mergeInto} onChange={e => setMergeInto(e.target.value)} className="input" style={{ flex: 1 }} />
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
                  <td>{m.name}</td><td>{m.email}</td><td><span className="badge">{m.role}</span></td>
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
