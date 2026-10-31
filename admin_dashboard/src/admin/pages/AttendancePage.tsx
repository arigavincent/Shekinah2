import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";

type Session = { id: string; title: string; occasion: string; sessionDate: string; headcount: number; notes: string; kioskLocked: boolean; archived: boolean };

export function AttendancePage() {
  const [sessions, setSessions] = useState<Session[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [fTitle, setFTitle] = useState(""); const [fOccasion, setFOccasion] = useState("Sunday Service");
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10)); const [fHeadcount, setFHeadcount] = useState(""); const [fNotes, setFNotes] = useState("");
  const token = getToken(); const { confirm, showToast } = useAdminFeedback();

  async function load() { setLoading(true); try { const r = await apiRequest<{ sessions: Session[] }>("/api/v1/admin/sa/attendance/sessions", { token }); setSessions(r.sessions || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);

  async function create() {
    try { await apiRequest("/api/v1/admin/sa/attendance/sessions", { method: "POST", token, body: { title: fTitle, occasion: fOccasion, sessionDate: fDate, headcount: parseInt(fHeadcount) || 0, notes: fNotes } }); showToast({ title: "Created", message: "Session recorded", tone: "success" }); setShowForm(false); setFTitle(""); setFHeadcount(""); setFNotes(""); void load(); } catch (e: any) { setError(e.message); }
  }
  async function del(s: Session, mode: "soft" | "hard") {
    const ok = await confirm({ title: `${mode === "hard" ? "Permanently purge" : "Archive"} session?`, message: `"${s.title}" on ${s.sessionDate}`, confirmLabel: mode === "hard" ? "Purge" : "Archive", tone: mode === "hard" ? "danger" : "warning" });
    if (!ok) return;
    try { await apiRequest(`/api/v1/admin/sa/attendance/sessions/${s.id}?mode=${mode}`, { method: "DELETE", token }); void load(); } catch (e: any) { setError(e.message); }
  }
  async function updateHeadcount(s: Session, newCount: string) {
    try { await apiRequest(`/api/v1/admin/sa/attendance/sessions/${s.id}`, { method: "PATCH", token, body: { headcount: parseInt(newCount) || 0 } }); void load(); } catch (e: any) { setError(e.message); }
  }

  return (<div className="admin-page">
    <div className="page-header"><h1>Attendance Sessions</h1><button className="btn primary" onClick={() => setShowForm(true)}>+ New Session</button></div>
    {error && <div className="alert alert-error">{error}</div>}
    {showForm && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>New Attendance Session</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <label>Title<input className="input" value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Morning Glory" /></label>
        <label>Occasion<input className="input" value={fOccasion} onChange={e => setFOccasion(e.target.value)} /></label>
        <label>Date<input className="input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} /></label>
        <label>Headcount<input className="input" type="number" value={fHeadcount} onChange={e => setFHeadcount(e.target.value)} /></label>
        <label style={{ gridColumn: "1/3" }}>Notes<textarea className="input" value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn primary" onClick={create} disabled={!fTitle}>Create</button><button className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
    </div>}
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>Date</th><th>Title</th><th>Occasion</th><th>Headcount</th><th>Kiosk</th><th>Actions</th></tr></thead><tbody>
        {sessions.map(s => <tr key={s.id} style={{ opacity: s.archived ? 0.5 : 1 }}>
          <td>{s.sessionDate?.slice(0, 10)}</td><td>{s.title}</td><td>{s.occasion}</td>
          <td><input className="input" type="number" style={{ width: 70 }} defaultValue={s.headcount} onBlur={e => { if (parseInt(e.target.value) !== s.headcount) updateHeadcount(s, e.target.value); }} /></td>
          <td>{s.kioskLocked ? "🔒" : "🔓"}</td>
          <td style={{ display: "flex", gap: 4 }}><button className="btn compact" onClick={() => del(s, "soft")}>Archive</button><button className="btn compact danger" onClick={() => del(s, "hard")}>Purge</button></td>
        </tr>)}
      </tbody></table></div>
    )}
  </div>);
}
