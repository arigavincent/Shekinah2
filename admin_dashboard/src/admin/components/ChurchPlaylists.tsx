import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";

type Playlist = { id: string; name: string; description: string; items: string[] };
type SermonLite = { id: string; title: string; speaker: string; sermonDate: string; type: string };

// Official playlists (e.g. a sermon series). Members see them in the app under
// Sermons → Playlists → "From the church".
export function ChurchPlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sermons, setSermons] = useState<SermonLite[]>([]);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [p, s] = await Promise.all([
        apiRequest<{ playlists: Playlist[] }>("/api/v1/admin/playlists", { token: getToken() }),
        apiRequest<{ sermons: SermonLite[] }>("/api/v1/admin/sermons", { token: getToken() })
      ]);
      setPlaylists(p.playlists || []);
      setSermons(s.sermons || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load playlists");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const titles = useMemo(() => Object.fromEntries(sermons.map(s => [s.id, s.title])), [sermons]);
  const matches = sermons
    .filter(s => !query || `${s.title} ${s.speaker}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);

  function move(i: number, to: number) {
    if (!editing || to < 0 || to >= editing.items.length) return;
    const items = [...editing.items];
    items.splice(to, 0, items.splice(i, 1)[0]);
    setEditing({ ...editing, items });
  }
  function toggle(id: string) {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.includes(id) ? editing.items.filter(x => x !== id) : [...editing.items, id] });
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const body = { name: editing.name.trim(), description: editing.description.trim(), items: editing.items };
      if (editing.id) await apiRequest(`/api/v1/admin/playlists/${editing.id}`, { method: "PATCH", token: getToken(), body });
      else await apiRequest("/api/v1/admin/playlists", { method: "POST", token: getToken(), body });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the playlist");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing?.id || !window.confirm(`Delete "${editing.name}"? Members will no longer see it. The sermons stay.`)) return;
    try {
      await apiRequest(`/api/v1/admin/playlists/${editing.id}`, { method: "DELETE", token: getToken() });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the playlist");
    }
  }

  return (
    <section className="list-card" style={{ marginTop: 18 }}>
      <div className="section-title-row">
        <h2>Church playlists</h2>
        {!editing ? (
          <button type="button" className="secondary compact" onClick={() => { setEditing({ id: "", name: "", description: "", items: [] }); setQuery(""); }}>
            + New playlist
          </button>
        ) : null}
      </div>
      <p className="muted">Members see these in the app under Sermons → Playlists, "From the church". Good for a sermon series. Members can also make their own playlists.</p>
      {error ? <p role="alert" className="error-text">{error}</p> : null}

      {!editing ? (
        playlists.length === 0 ? (
          <p className="muted">No church playlists yet.</p>
        ) : (
          <div className="sermon-list">
            {playlists.map(p => (
              <button key={p.id} type="button" className="sermon-row" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => { setEditing({ ...p }); setQuery(""); }}>
                <div>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <p className="small-muted">{p.items.length} sermon{p.items.length === 1 ? "" : "s"}{p.description ? ` · ${p.description}` : ""}</p>
                </div>
                <span className="count-pill">Edit</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <label>
            Name
            <input value={editing.name} maxLength={80} placeholder="e.g. Sons of God series" onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <label>
            Description
            <textarea rows={2} value={editing.description} placeholder="Optional" onChange={e => setEditing({ ...editing, description: e.target.value })} />
          </label>
          <div>
            <p className="small-muted">In this playlist ({editing.items.length}), in play order</p>
            {editing.items.length === 0 ? <p className="muted">Add sermons below.</p> : null}
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {editing.items.map((id, i) => (
                <li key={id} style={{ marginBottom: 6 }}>
                  {titles[id] || id}{" "}
                  <button type="button" className="secondary compact" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">↑</button>{" "}
                  <button type="button" className="secondary compact" disabled={i === editing.items.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">↓</button>{" "}
                  <button type="button" className="secondary compact" onClick={() => toggle(id)}>Remove</button>
                </li>
              ))}
            </ol>
          </div>
          <label>
            Add sermons
            <input className="search" value={query} placeholder="Search by title or speaker" onChange={e => setQuery(e.target.value)} />
          </label>
          <div className="sermon-list" style={{ maxHeight: 320, overflow: "auto" }}>
            {matches.map(s => (
              <label key={s.id} className="sermon-row" style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={editing.items.includes(s.id)} onChange={() => toggle(s.id)} style={{ width: "auto" }} />
                <span>
                  <strong>{s.title}</strong>
                  <span className="small-muted" style={{ display: "block" }}>{[s.speaker, s.sermonDate, s.type].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={save} disabled={busy || !editing.name.trim()}>{busy ? "Saving..." : "Save playlist"}</button>
            <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
            {editing.id ? <button type="button" className="secondary" onClick={remove}>Delete playlist</button> : null}
          </div>
        </div>
      )}
    </section>
  );
}
