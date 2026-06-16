import { useEffect, useState } from "react";

import { listEvents } from "../api/adminEventsApi";
import { listRecentCheckins, verifyCheckin, type AdminCheckin } from "../api/adminCheckinsApi";
import { InlineAlert } from "../components/InlineAlert";
import { useAdminFeedback } from "../feedback/AdminFeedback";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function CheckInPage() {
  const { showToast } = useAdminFeedback();
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [checkins, setCheckins] = useState<AdminCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [eventsResponse, checkinsResponse] = await Promise.all([
        listEvents(),
        listRecentCheckins()
      ]);

      setEvents((eventsResponse.events || []).map(item => ({ id: item.id, title: item.title })));
      setEventId(current => current || eventsResponse.events?.[0]?.id || "");
      setCheckins(checkinsResponse.checkins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load check-in data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    if (!eventId || !code.trim()) {
      setError("Select an event and enter a member code first.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await verifyCheckin({
        eventId,
        code: code.trim(),
        notes: notes.trim()
      });

      showToast({
        title: response.alreadyCheckedIn ? "Member already checked in" : "Member checked in",
        message: response.alreadyCheckedIn
          ? `${response.name} was already checked in for ${response.eventTitle}. The record was refreshed.`
          : `${response.name} checked in for ${response.eventTitle}.`,
        tone: response.alreadyCheckedIn ? "info" : "success"
      });
      setCode("");
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify check-in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1>QR Check-In</h1>
          <p className="muted">Verify member codes for church events, prevent duplicate attendance records, and review recent check-ins.</p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Check-in could not be completed" message={error} /> : null}

      <section className="content-grid">
        <section className="list-card">
          <div className="section-title-row">
            <h2>Verify Member</h2>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <select value={eventId} onChange={event => setEventId(event.target.value)}>
              {events.length === 0 ? <option value="">No events available</option> : null}
              {events.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>

            <input
              className="search"
              value={code}
              onChange={event => setCode(event.target.value.toUpperCase())}
              placeholder="Enter or scan member code"
              style={{ marginBottom: 0 }}
            />

            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Optional attendance note"
              rows={4}
            />

            <button className="primary" onClick={submit} disabled={saving || !eventId}>
              {saving ? "Checking In..." : "Verify Check-In"}
            </button>
          </div>
        </section>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Recent Check-Ins</h2>
            <span className="count-pill">{checkins.length}</span>
          </div>

          {loading ? (
            <p className="muted">Loading check-ins...</p>
          ) : checkins.length === 0 ? (
            <p className="muted">No check-ins recorded yet.</p>
          ) : (
            <div className="sermon-list">
              {checkins.map(item => (
                <div key={item.id} className="sermon-row">
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 6px" }}>{item.name}</h3>
                    <p className="muted" style={{ marginBottom: 8 }}>
                      {item.email} · {item.eventTitle}
                    </p>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      First scan: {formatDate(item.createdAt)}
                      {item.updatedAt && item.updatedAt !== item.createdAt ? ` · Last verified: ${formatDate(item.updatedAt)}` : ""}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
