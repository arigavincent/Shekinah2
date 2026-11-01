import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { uploadMedia } from "../api/adminMediaApi";

type Replay = {
  id: string;
  title: string;
  description: string;
  date?: string;
  status: string;
  thumbnailUrl: string;
  customCover: boolean;
  seconds: number;
};

const length = (s: number) =>
  s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Recorded live services appear in Sermons automatically. Rename them, add a
// description, change or reset the cover, or delete them.
export function ServiceRecordings() {
  const [items, setItems] = useState<Replay[]>([]),
    [editing, setEditing] = useState<Replay | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    apiRequest<{ items: Replay[] }>("/api/v1/admin/replays", { token: getToken() })
      .then((r) => setItems(r.items || []))
      .catch((e) => setError(String(e)));
  useEffect(() => {
    void load();
  }, []);
  async function save(body: Record<string, unknown>) {
    if (!editing) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await apiRequest<{ message: string; thumbnailUrl: string; customCover: boolean }>(`/api/v1/admin/replays/${editing.id}`, {
        method: "PATCH",
        token: getToken(),
        body,
      });
      setEditing({ ...editing, thumbnailUrl: r.thumbnailUrl, customCover: r.customCover });
      setNotice(r.message);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(r: Replay) {
    if (!window.confirm(`Delete "${r.title}"? It is removed from Sermons and its video files are deleted.`)) return;
    try {
      await apiRequest(`/api/v1/admin/replays/${r.id}`, { method: "DELETE", token: getToken() });
      setEditing(null);
      setNotice("Recording deleted");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function cover(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await uploadMedia("image", file);
      await save({ thumbnailUrl: r.media.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }
  return (
    <section className="editor-card" style={{ marginTop: 24 }}>
      <h2>Service recordings</h2>
      <p className="muted">Recorded live services show in Sermons with a bright Shekinah cover. Edit or delete them here.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {editing ? (
        <div style={{ display: "grid", gap: 10, maxWidth: 640 }}>
          <button className="secondary compact" onClick={() => setEditing(null)}>← All recordings</button>
          {editing.thumbnailUrl && <img src={editing.thumbnailUrl} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12 }} />}
          <p className="small-muted">{editing.customCover ? "Your own cover" : "Automatic Shekinah cover (redrawn when the title changes)"}</p>
          <div className="filters-row" style={{ gap: 8 }}>
            <label className="secondary compact" style={{ cursor: "pointer" }}>
              Change cover
              <input type="file" accept="image/*" hidden onChange={(e) => void cover(e.target.files?.[0])} />
            </label>
            {editing.customCover && <button className="secondary compact" disabled={busy} onClick={() => void save({ resetCover: true })}>Use Shekinah cover</button>}
          </div>
          <label>
            Title
            <input value={editing.title} maxLength={160} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          </label>
          <label>
            Description
            <textarea rows={4} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </label>
          <div className="filters-row" style={{ gap: 8 }}>
            <button disabled={busy || !editing.title.trim()} onClick={() => void save({ title: editing.title, description: editing.description })}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="danger" onClick={() => void remove(editing)}>Delete recording</button>
          </div>
        </div>
      ) : !items.length ? (
        <p className="muted">Recordings of live services show here once a broadcast ends.</p>
      ) : (
        items.map((r) => (
          <article className="item-row" key={r.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt="" style={{ width: 160, aspectRatio: "16/9", objectFit: "cover", borderRadius: 8 }} /> : <div style={{ width: 160 }} className="small-muted">Cover being drawn…</div>}
            <div style={{ flex: 1 }}>
              <strong>{r.title}</strong>
              <p className="small-muted">{[r.date?.slice(0, 10), r.seconds ? length(r.seconds) : "", r.status !== "ready" ? r.status : ""].filter(Boolean).join(" · ")}</p>
            </div>
            <button className="secondary compact" onClick={() => { setNotice(""); setEditing(r); }}>Edit</button>
            <button className="danger compact" onClick={() => void remove(r)}>Delete</button>
          </article>
        ))
      )}
    </section>
  );
}
