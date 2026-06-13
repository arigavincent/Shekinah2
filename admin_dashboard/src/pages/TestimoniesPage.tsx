import { useEffect, useMemo, useState } from "react";

import {
  listAdminTestimonies,
  updateAdminTestimony,
  type AdminTestimony
} from "../api/adminTestimoniesApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function TestimoniesPage() {
  const { showToast } = useAdminFeedback();
  const [items, setItems] = useState<AdminTestimony[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "member">("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = items.filter(item => {
      if (!q) return true;
      return [item.title, item.body, item.displayName, item.ownerEmail].join(" ").toLowerCase().includes(q);
    });
    return next.sort((a, b) => {
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "member") return (a.displayName || "").localeCompare(b.displayName || "");
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items, query, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(
    filtered,
    8,
    [query, status, sortBy, items.length]
  );

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
    setError("");
    try {
      const response = await updateAdminTestimony(item.id, {
        status: nextStatus,
        featured
      });
      setItems(current => current.map(row => (row.id === item.id ? response.testimony : row)));
      showToast({
        title: "Testimony updated",
        message: `${item.title} is now ${nextStatus}${featured ? " and featured" : ""}.`,
        tone: "success"
      });
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

      {error ? <InlineAlert title="Testimonies could not be updated" message={error} /> : null}

      <section className="list-card" style={{ marginBottom: 18 }}>
        <div className="list-controls">
          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search title, story text, or member email..."
          />

          <div className="filters-row">
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "member")}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="member">Member A-Z</option>
            </select>

            {(query || status || sortBy !== "newest") ? (
              <button
                type="button"
                className="secondary compact"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setSortBy("newest");
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
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
            {pagedItems.map(item => (
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
                  <button type="button" className="secondary" onClick={() => update(item, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="secondary" onClick={() => update(item, "rejected", false)}>
                    Reject
                  </button>
                  <button type="button" className="secondary" onClick={() => update(item, item.status, !item.featured)}>
                    {item.featured ? "Unfeature" : "Feature"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          pageSize={8}
          totalItems={filtered.length}
          itemLabel="testimonies"
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}
