import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import {
  listPrayers,
  updatePrayer,
  type AdminPrayer
} from "../api/adminPrayersApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "prayed_for", label: "Prayed For" },
  { value: "contacted", label: "Contacted" }
];

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label || status;
}

function statusStyle(status: string) {
  if (status === "prayed_for" || status === "contacted") {
    return {
      color: "var(--success)",
      background: "var(--success-wash)",
      border: "1px solid var(--success-border)"
    };
  }

  if (status === "reviewed") {
    return {
      color: "var(--gold)",
      background: "var(--accent-wash)",
      border: "1px solid color-mix(in srgb, var(--gold) 45%, transparent)"
    };
  }

  return {
    color: "var(--muted)",
    background: "var(--surface-2)",
    border: "1px solid var(--line)"
  };
}

function visibilityStyle(isPublic: boolean) {
  if (isPublic) {
    return {
      color: "var(--gold)",
      background: "var(--accent-wash)",
      border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)"
    };
  }

  return {
    color: "var(--danger)",
    background: "var(--danger-wash)",
    border: "1px solid var(--danger-border)"
  };
}

function summaryText(prayer: AdminPrayer) {
  const text = (prayer.text || "").trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

export function PrayersPage() {
  const { showToast } = useAdminFeedback();
  const [prayers, setPrayers] = useState<AdminPrayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("private");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status">("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState("new");
  const [draftAdminNote, setDraftAdminNote] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return prayers.filter(prayer => {
      const matchesScope =
        scope === "all" ||
        (scope === "private" ? !prayer.isPublic : prayer.isPublic);
      const matchesStatus = statusFilter === "all" || prayer.status === statusFilter;

      const searchable = [
        prayer.name,
        prayer.text,
        prayer.category,
        prayer.ownerEmail,
        prayer.status
      ]
        .join(" ")
        .toLowerCase();

      return matchesScope && matchesStatus && (!q || searchable.includes(q));
    }).sort((a, b) => {
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [prayers, query, scope, statusFilter, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(
    filtered,
    8,
    [query, scope, statusFilter, sortBy, prayers.length]
  );

  const selectedPrayer = useMemo(
    () => prayers.find(prayer => prayer.id === selectedId) || null,
    [prayers, selectedId]
  );

  useEffect(() => {
    if (!selectedPrayer) {
      setDraftStatus("new");
      setDraftAdminNote("");
      return;
    }

    setDraftStatus(selectedPrayer.status || "new");
    setDraftAdminNote(selectedPrayer.adminNote || "");
  }, [selectedPrayer]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listPrayers();
      const items = response.prayers || [];
      setPrayers(items);

      setSelectedId(current => {
        if (current && items.some(item => item.id === current)) {
          return current;
        }

        return items[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prayer requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSelect(event: ChangeEvent<HTMLSelectElement>) {
    setScope(event.target.value);
  }

  async function submit() {
    if (!selectedPrayer) return;

    setSaving(true);
    setError("");

    try {
      const response = await updatePrayer(selectedPrayer.id, {
        status: draftStatus,
        adminNote: draftAdminNote
      });

      const nextPrayer = response.prayer;
      setPrayers(current =>
        current.map(item => (item.id === nextPrayer.id ? nextPrayer : item))
      );
      showToast({
        title: "Prayer request updated",
        message: `Status set to ${statusLabel(nextPrayer.status)}.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update prayer request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Care</p>
          <h1>Prayer Requests</h1>
          <p className="muted">
            Review public and private requests, track follow-up status, and leave internal notes for the prayer team.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Prayer queue could not be updated" message={error} /> : null}

      <section className="content-grid">
        <section className="list-card">
          <div className="section-title-row">
            <h2>Prayer Queue</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <div className="list-controls">
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search prayer text, member email, category..."
            />

            <div className="filters-row">
              <select value={scope} onChange={handleSelect}>
                <option value="private">Private only</option>
                <option value="public">Public only</option>
                <option value="all">All requests</option>
              </select>

              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "status")}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="status">Status A-Z</option>
              </select>

              {(query || scope !== "private" || statusFilter !== "all" || sortBy !== "newest") ? (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => {
                    setQuery("");
                    setScope("private");
                    setStatusFilter("all");
                    setSortBy("newest");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading prayer requests...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No prayer requests found.</p>
          ) : (
            <div className="sermon-list">
              {pagedItems.map(prayer => {
                const active = prayer.id === selectedId;

                return (
                  <button
                    key={prayer.id}
                    type="button"
                    className="sermon-row"
                    onClick={() => setSelectedId(prayer.id)}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: active ? "var(--gold)" : "var(--line)",
                      boxShadow: active
                        ? "0 0 0 1px color-mix(in srgb, var(--gold) 25%, transparent)"
                        : "none"
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap"
                        }}
                      >
                        <h3 style={{ margin: 0 }}>{prayer.name || "Anonymous"}</h3>
                        <span className="status-pill" style={visibilityStyle(prayer.isPublic)}>
                          {prayer.isPublic ? "Public" : "Private"}
                        </span>
                        <span className="status-pill" style={statusStyle(prayer.status)}>
                          {statusLabel(prayer.status)}
                        </span>
                      </div>

                      <p style={{ marginTop: 8 }}>{summaryText(prayer)}</p>
                      <p className="small-muted">
                        {prayer.category} · {prayer.ownerEmail || "No email"} · {formatDate(prayer.createdAt)}
                      </p>
                    </div>

                    <div className="row-actions">
                      <span className="count-pill">{prayer.count}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            pageSize={8}
            totalItems={filtered.length}
            itemLabel="prayer requests"
            onPageChange={setPage}
          />
        </section>

        <section className="editor-card">
          <div className="section-title-row">
            <h2>Prayer Detail</h2>
            {selectedPrayer ? (
              <span className="status-pill" style={statusStyle(selectedPrayer.status)}>
                {statusLabel(selectedPrayer.status)}
              </span>
            ) : null}
          </div>

          {!selectedPrayer ? (
            <p className="muted">Select a prayer request to review it.</p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 16,
                  borderRadius: 18,
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedPrayer.name || "Anonymous"}</h3>
                    <p className="small-muted" style={{ marginTop: 6 }}>
                      {selectedPrayer.ownerEmail || "No member email"}
                    </p>
                  </div>

                  <span className="status-pill" style={visibilityStyle(selectedPrayer.isPublic)}>
                    {selectedPrayer.isPublic ? "Public Request" : "Private Request"}
                  </span>
                </div>

                <p style={{ margin: 0, lineHeight: 1.7 }}>{selectedPrayer.text}</p>

                <div className="two-col" style={{ marginTop: 4 }}>
                  <div>
                    <p className="small-muted">Category</p>
                    <strong>{selectedPrayer.category}</strong>
                  </div>

                  <div>
                    <p className="small-muted">Praying Count</p>
                    <strong>{selectedPrayer.count}</strong>
                  </div>

                  <div>
                    <p className="small-muted">Created</p>
                    <strong>{formatDate(selectedPrayer.createdAt)}</strong>
                  </div>

                  <div>
                    <p className="small-muted">Last Reviewed</p>
                    <strong>{formatDate(selectedPrayer.reviewedAt)}</strong>
                  </div>
                </div>
              </div>

              <label>
                Status
                <select value={draftStatus} onChange={event => setDraftStatus(event.target.value)}>
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Internal Note
                <textarea
                  rows={6}
                  value={draftAdminNote}
                  onChange={event => setDraftAdminNote(event.target.value)}
                  placeholder="Add a private follow-up note for the prayer team or pastor."
                />
              </label>

              <button onClick={submit} disabled={saving}>
                {saving ? "Saving..." : "Save Prayer Update"}
              </button>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
