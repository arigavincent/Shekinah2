import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  broadcastNotification,
  listNotificationMessages,
  type NotificationMessage
} from "../api/adminNotificationsApi";
import { hasMinLength } from "../lib/validation";

const categories = [
  "general",
  "sermons",
  "devotions",
  "live",
  "events",
  "prayer"
];

const emptyForm = {
  title: "",
  body: "",
  category: "general",
  screen: ""
};

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export function NotificationsPage() {
  const [messages, setMessages] = useState<NotificationMessage[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;

    return messages.filter(message =>
      [
        message.title,
        message.body,
        message.category,
        message.id
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [messages, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listNotificationMessages();
      setMessages(response.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(key: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!hasMinLength(form.title, 4)) {
      setError("Title is required.");
      return;
    }

    if (!hasMinLength(form.body, 10)) {
      setError("Message body must be at least 10 characters.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const data = form.screen.trim() ? { screen: form.screen.trim() } : {};

      const response = await broadcastNotification({
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        data
      });

      setNotice(
        `Sent to ${response.message.targetCount} device(s): ${response.message.successCount} successful, ${response.message.failureCount} failed.`
      );
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to broadcast notification");
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Engagement</p>
          <h1>Notifications</h1>
          <p className="muted">
            Send push notifications to members who opted in from the mobile app.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="success">{notice}</div> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <h2>Broadcast Message</h2>

          <label>
            Category
            <select
              value={form.category}
              onChange={event => updateField("category", event.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label>
            Title
            <input
              value={form.title}
              onChange={event => updateField("title", event.target.value)}
              placeholder="Sunday service is live"
            />
          </label>

          <label>
            Body
            <textarea
              value={form.body}
              onChange={event => updateField("body", event.target.value)}
              placeholder="Join the live service now."
              rows={5}
            />
          </label>

          <label>
            Target screen data
            <input
              value={form.screen}
              onChange={event => updateField("screen", event.target.value)}
              placeholder="Live, Sermons, Devotions, Events"
            />
          </label>

          <button disabled={sending}>
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Recent Broadcasts</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search notifications..."
          />

          {loading ? (
            <p className="muted">Loading notifications...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No notification broadcasts found.</p>
          ) : (
            <div className="stack-list">
              {filtered.map(message => (
                <article key={message.id} className="stack-item">
                  <div>
                    <strong>{message.title}</strong>
                    <p>{message.body}</p>
                    <small>
                      {message.category} · {formatDate(message.createdAt)}
                    </small>
                  </div>

                  <span className="count-pill">
                    {message.successCount}/{message.targetCount}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
