import { useEffect, useMemo, useState } from "react";

import {
  deleteCommunityMessage,
  listCommunityMessages,
  updateCommunityMessage,
  type AdminCommunityMessage
} from "../api/adminCommunityApi";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function CommunityPage() {
  const [messages, setMessages] = useState<AdminCommunityMessage[]>([]);
  const [channel, setChannel] = useState("global");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "member">("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = messages.filter(item => {
      if (!q) return true;
      return [item.displayName, item.message, item.userEmail].join(" ").toLowerCase().includes(q);
    });

    return next.sort((a, b) => {
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "member") return (a.displayName || "").localeCompare(b.displayName || "");
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [messages, query, sortBy]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listCommunityMessages({
        channel: channel || undefined,
        status: status || undefined
      });
      setMessages(response.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [channel, status]);

  async function update(item: AdminCommunityMessage, nextStatus: string) {
    setError("");
    setSuccess("");
    try {
      const response = await updateCommunityMessage(item.id, {
        status: nextStatus,
        hiddenReason: nextStatus === "hidden" ? "Removed by admin" : ""
      });

      setMessages(current => current.map(row => (row.id === item.id ? response.message : row)));
      setSuccess(`Message marked ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update message");
    }
  }

  async function remove(item: AdminCommunityMessage) {
    const confirmed = confirm(
      `Delete this message from ${item.displayName || "member"}?\n\nThis permanently removes it from the moderation queue.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    try {
      await deleteCommunityMessage(item.id);
      setMessages(current => current.filter(row => row.id !== item.id));
      setSuccess("Message deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Community</p>
          <h1>Chat Moderation</h1>
          <p className="muted">Review global and live chat messages, hide abuse, and keep the feed clean.</p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

      <section className="list-card" style={{ marginBottom: 18 }}>
        <div className="list-controls">
          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search message text or member email..."
          />

          <div className="filters-row">
            <select value={channel} onChange={event => setChannel(event.target.value)}>
              <option value="global">Global chat</option>
              <option value="live">Live chat</option>
              <option value="">All channels</option>
            </select>

            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="hidden">Hidden</option>
            </select>

            <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "member")}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="member">Member A-Z</option>
            </select>

            {(query || channel !== "global" || status || sortBy !== "newest") ? (
              <button
                type="button"
                className="secondary compact"
                onClick={() => {
                  setQuery("");
                  setChannel("global");
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
          <h2>Messages</h2>
          <span className="count-pill">{filtered.length}</span>
        </div>

        {loading ? (
          <p className="muted">Loading messages...</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No messages found.</p>
        ) : (
          <div className="sermon-list">
            {filtered.map(item => (
              <div key={item.id} className="sermon-row">
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 6px" }}>{item.displayName || "Member"}</h3>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    {item.channel} · {item.userEmail || "No email"} · {formatDate(item.createdAt)}
                  </p>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.message}</p>
                </div>

                <div style={{ display: "grid", gap: 8, minWidth: 140 }}>
                  <span className="status-pill">{item.status}</span>
                  <button type="button" className="secondary" onClick={() => update(item, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="secondary" onClick={() => update(item, "hidden")}>
                    Hide
                  </button>
                  <button type="button" className="secondary danger" onClick={() => remove(item)}>
                    Delete
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
