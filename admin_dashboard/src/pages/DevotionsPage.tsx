import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createDevotion,
  deleteDevotion,
  listDevotions,
  type Devotion,
  type DevotionPayload,
  updateDevotion
} from "../api/adminDevotionsApi";
import { uploadMedia } from "../api/adminMediaApi";

const emptyForm: DevotionPayload = {
  title: "",
  excerpt: "",
  devotionDate: "2026-06-11",
  imageUrl: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=600",
  body: ""
};

export function DevotionsPage() {
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [form, setForm] = useState<DevotionPayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return devotions;

    return devotions.filter(devotion =>
      [devotion.title, devotion.excerpt, devotion.body]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [devotions, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listDevotions();
      setDevotions(response.devotions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devotions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof DevotionPayload>(
    key: K,
    value: DevotionPayload[K]
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

  function startEdit(devotion: Devotion) {
    setEditingId(devotion.id);
    setForm({
      title: devotion.title,
      excerpt: devotion.excerpt,
      devotionDate: devotion.devotionDate,
      imageUrl: devotion.imageUrl || "",
      body: devotion.body
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
      setError(err instanceof Error ? err.message : "Failed to upload devotion image");
    } finally {
      setUploadingImage(false);
    }
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.excerpt.trim()) return "Excerpt is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.devotionDate)) {
      return "Date must be YYYY-MM-DD.";
    }
    if (!form.body.trim()) return "Body is required.";

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
        await updateDevotion(editingId, form);
      } else {
        await createDevotion(form);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save devotion");
    } finally {
      setSaving(false);
    }
  }

  async function remove(devotion: Devotion) {
    const confirmed = confirm(`Delete "${devotion.title}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteDevotion(devotion.id);
      await load();

      if (editingId === devotion.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete devotion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Devotions</h1>
          <p className="muted">
            Create, update, and remove daily devotions shown in the mobile app.
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
            <h2>{editingId ? "Edit Devotion" : "Create Devotion"}</h2>

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
              placeholder="Walking In The Light Of God"
            />
          </label>

          <label>
            Date
            <input
              value={form.devotionDate}
              onChange={event => updateField("devotionDate", event.target.value)}
              placeholder="YYYY-MM-DD"
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
            Excerpt
            <textarea
              value={form.excerpt}
              onChange={event => updateField("excerpt", event.target.value)}
              placeholder="Short summary shown in cards"
              rows={3}
            />
          </label>

          <label>
            Body
            <textarea
              value={form.body}
              onChange={event => updateField("body", event.target.value)}
              placeholder="Full devotion content"
              rows={8}
            />
          </label>

          <button disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Devotion" : "Create Devotion"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Devotions</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search devotions..."
          />

          {loading ? (
            <p className="muted">Loading devotions...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No devotions found.</p>
          ) : (
            <div className="sermon-list">
              {filtered.map(devotion => (
                <article key={devotion.id} className="sermon-row">
                  <div>
                    <h3>{devotion.title}</h3>
                    <p>{devotion.devotionDate}</p>
                    <p className="small-muted">{devotion.excerpt}</p>
                  </div>

                  <div className="row-actions">
                    <button className="secondary compact" onClick={() => startEdit(devotion)}>
                      Edit
                    </button>

                    <button className="danger compact" onClick={() => remove(devotion)}>
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
