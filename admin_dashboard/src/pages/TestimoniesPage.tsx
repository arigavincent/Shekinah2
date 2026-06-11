import { useEffect, useMemo, useState } from "react";

import {
  listAdminTestimonies,
  updateAdminTestimony,
  type AdminTestimony
} from "../api/adminTestimoniesApi";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function TestimoniesPage() {
  const [items, setItems] = useState<AdminTestimony[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item => {
      if (!q) return true;
      return [item.title, item.body, item.displayName, item.ownerEmail].join(" ").toLowerCase().includes(q);
    });
  }, [items, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listAdminTestimonies(status);
      setItems(response.testimonies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load testimonies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function update(item: AdminTestimony, nextStatus: string, featured = item.featured) {
    try {
      const response = await updateAdminTestimony(item.id, {
        status: nextStatus,
        featured
      });
      setItems(current => current.map(row => (row.id === item.id ? response.testimony : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update testimony");
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Stories</p>
          <h1>Testimonies</h1>
          <p className="muted">Approve, reject, and feature member testimonies before they appear in the app.</p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="list-card" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 220px" }}>
          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search title, story text, or member email..."
            style={{ marginBottom: 0 }}
          />

          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </section>

      <section className="list-card">
        <div className="section-title-row">
          <h2>Queue</h2>
          <span className="count-pill">{filtered.length}</span>
        </div>

        {loading ? (
          <p className="muted">Loading testimonies...</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No testimonies found.</p>
        ) : (
          <div className="sermon-list">
            {filtered.map(item => (
              <div key={item.id} className="sermon-row">
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 6px" }}>{item.title}</h3>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    {item.displayName} · {item.ownerEmail || "No email"} · {formatDate(item.createdAt)}
                  </p>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.body}</p>
                </div>

                <div style={{ display: "grid", gap: 8, minWidth: 160 }}>
                  <span className="status-pill">{item.status}</span>
                  <button className="secondary" onClick={() => update(item, "approved")}>
                    Approve
                  </button>
                  <button className="secondary" onClick={() => update(item, "rejected", false)}>
                    Reject
                  </button>
                  <button className="secondary" onClick={() => update(item, item.status, !item.featured)}>
                    {item.featured ? "Unfeature" : "Feature"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
