import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createEvent,
  deleteEvent,
  listEvents,
  type EventItem,
  type EventPayload,
  updateEvent
} from "../api/adminEventsApi";
import { uploadMedia } from "../api/adminMediaApi";

const emptyForm: EventPayload = {
  title: "",
  eventDate: "2026-06-21",
  eventTime: "10:00 AM",
  location: "Main Sanctuary",
  imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900",
  description: ""
};

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState<EventPayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return events;

    return events.filter(event =>
      [event.title, event.location, event.description, event.eventDate, event.eventTime]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [events, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listEvents();
      setEvents(response.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof EventPayload>(
    key: K,
    value: EventPayload[K]
  ) {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function startEdit(event: EventItem) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      location: event.location,
      imageUrl: event.imageUrl || "",
      description: event.description
    });
  }

  async function uploadImage(file: File | null) {
    if (!file) return;

    setUploadingImage(true);
    setError("");

    try {
      const response = await uploadMedia("image", file);
      updateField("imageUrl", response.media.path || response.media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload event image");
    } finally {
      setUploadingImage(false);
    }
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate)) {
      return "Date must be YYYY-MM-DD.";
    }
    if (!form.eventTime.trim()) return "Event time is required.";
    if (!form.location.trim()) return "Location is required.";
    if (!form.description.trim()) return "Description is required.";

    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await updateEvent(editingId, form);
      } else {
        await createEvent(form);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function remove(event: EventItem) {
    const confirmed = confirm(`Delete "${event.title}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteEvent(event.id);
      await load();

      if (editingId === event.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Events</h1>
          <p className="muted">
            Create, update, and remove church events shown in the mobile app.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <div className="section-title-row">
            <h2>{editingId ? "Edit Event" : "Create Event"}</h2>

            {editingId ? (
              <button type="button" className="secondary compact" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <label>
            Title
            <input
              value={form.title}
              onChange={event => updateField("title", event.target.value)}
              placeholder="Night Of Worship"
            />
          </label>

          <div className="two-col">
            <label>
              Date
              <input
                value={form.eventDate}
                onChange={event => updateField("eventDate", event.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </label>

            <label>
              Time
              <input
                value={form.eventTime}
                onChange={event => updateField("eventTime", event.target.value)}
                placeholder="6:00 PM"
              />
            </label>
          </div>

          <label>
            Location
            <input
              value={form.location}
              onChange={event => updateField("location", event.target.value)}
              placeholder="Main Sanctuary"
            />
          </label>

          <label>
            Image URL
            <input
              value={form.imageUrl}
              onChange={event => updateField("imageUrl", event.target.value)}
              placeholder="/uploads/media/image.png or https://..."
            />
          </label>

          <label>
            Upload Image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploadingImage}
              onChange={async event => {
                await uploadImage(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </label>

          {uploadingImage ? (
            <p className="muted">Uploading image...</p>
          ) : null}

          <label>
            Description
            <textarea
              value={form.description}
              onChange={event => updateField("description", event.target.value)}
              placeholder="Event description"
              rows={6}
            />
          </label>

          <button disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Event" : "Create Event"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Events</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search events..."
          />

          {loading ? (
            <p className="muted">Loading events...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No events found.</p>
          ) : (
            <div className="sermon-list">
              {filtered.map(event => (
                <article key={event.id} className="sermon-row">
                  <div>
                    <h3>{event.title}</h3>
                    <p>
                      {event.eventDate} · {event.eventTime} · {event.location}
                    </p>
                    <p className="small-muted">{event.description}</p>
                  </div>

                  <div className="row-actions">
                    <button className="secondary compact" onClick={() => startEdit(event)}>
                      Edit
                    </button>

                    <button className="danger compact" onClick={() => remove(event)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
