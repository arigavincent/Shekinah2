import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createUpdate,
  deleteUpdate,
  listUpdates,
  type UpdateItem,
  type UpdatePayload,
  updateUpdate
} from "../api/adminUpdatesApi";

const emptyForm: UpdatePayload = {
  title: "",
  excerpt: "",
  updateDate: "2026-06-12",
  imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900"
};

export function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [form, setForm] = useState<UpdatePayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return updates;

    return updates.filter(update =>
      [update.title, update.excerpt, update.updateDate]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [updates, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listUpdates();
      setUpdates(response.updates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load updates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof UpdatePayload>(
    key: K,
    value: UpdatePayload[K]
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

  function startEdit(update: UpdateItem) {
    setEditingId(update.id);
    setForm({
      title: update.title,
      excerpt: update.excerpt,
      updateDate: update.updateDate,
      imageUrl: update.imageUrl || ""
    });
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.excerpt.trim()) return "Excerpt is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.updateDate)) {
      return "Date must be YYYY-MM-DD.";
    }

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
        await updateUpdate(editingId, form);
      } else {
        await createUpdate(form);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save update");
    } finally {
      setSaving(false);
    }
  }

  async function remove(update: UpdateItem) {
    const confirmed = confirm(`Delete "${update.title}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteUpdate(update.id);
      await load();

      if (editingId === update.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Updates</h1>
          <p className="muted">
            Create, update, and remove announcements shown in the mobile app.
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
            <h2>{editingId ? "Edit Update" : "Create Update"}</h2>

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
              placeholder="Midweek Service Update"
            />
          </label>

          <label>
            Date
            <input
              value={form.updateDate}
              onChange={event => updateField("updateDate", event.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </label>

          <label>
            Image URL
            <input
              value={form.imageUrl}
              onChange={event => updateField("imageUrl", event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label>
            Excerpt
            <textarea
              value={form.excerpt}
              onChange={event => updateField("excerpt", event.target.value)}
              placeholder="Short announcement summary"
              rows={5}
            />
          </label>

          <button disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Announcement" : "Create Announcement"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Updates</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search updates..."
          />

          {loading ? (
            <p className="muted">Loading updates...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No updates found.</p>
          ) : (
            <div className="sermon-list">
              {filtered.map(update => (
                <article key={update.id} className="sermon-row">
                  <div>
                    <h3>{update.title}</h3>
                    <p>{update.updateDate}</p>
                    <p className="small-muted">{update.excerpt}</p>
                  </div>

                  <div className="row-actions">
                    <button className="secondary compact" onClick={() => startEdit(update)}>
                      Edit
                    </button>

                    <button className="danger compact" onClick={() => remove(update)}>
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
