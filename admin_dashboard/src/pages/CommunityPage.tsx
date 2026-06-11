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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter(item => {
      if (!q) return true;
      return [item.displayName, item.message, item.userEmail].join(" ").toLowerCase().includes(q);
    });
  }, [messages, query]);

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
    try {
      const response = await updateCommunityMessage(item.id, {
        status: nextStatus,
        hiddenReason: nextStatus === "hidden" ? "Removed by admin" : ""
      });

      setMessages(current => current.map(row => (row.id === item.id ? response.message : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update message");
    }
  }

  async function remove(item: AdminCommunityMessage) {
    try {
      await deleteCommunityMessage(item.id);
      setMessages(current => current.filter(row => row.id !== item.id));
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

      <section className="list-card" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 180px 180px" }}>
          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search message text or member email..."
            style={{ marginBottom: 0 }}
          />

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
                  <button className="secondary" onClick={() => update(item, "approved")}>
                    Approve
                  </button>
                  <button className="secondary" onClick={() => update(item, "hidden")}>
                    Hide
                  </button>
                  <button className="secondary danger" onClick={() => remove(item)}>
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
