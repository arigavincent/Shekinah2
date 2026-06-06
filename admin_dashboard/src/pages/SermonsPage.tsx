import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createSermon,
  deleteSermon,
  listSermons,
  type Sermon,
  type SermonPayload,
  updateSermon
} from "../api/adminSermonsApi";
import { uploadMedia, type MediaKind } from "../api/adminMediaApi";

const categories = [
  { id: "cat-1", name: "Faith" },
  { id: "cat-2", name: "Prayer" },
  { id: "cat-3", name: "Grace" },
  { id: "cat-4", name: "Revival" }
];

const emptyForm: SermonPayload = {
  type: "video",
  title: "",
  speaker: "Shekinah Sons Global",
  sermonDate: "2026-06-10",
  categoryId: "cat-1",
  isLive: false,
  thumbnailUrl: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900",
  duration: "",
  description: "",
  mediaUrl: ""
};

export function SermonsPage() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [form, setForm] = useState<SermonPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<MediaKind | "">("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return sermons;

    return sermons.filter(sermon =>
      [sermon.title, sermon.speaker, sermon.category, sermon.type]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, sermons]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listSermons();
      setSermons(response.sermons || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sermons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof SermonPayload>(key: K, value: SermonPayload[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function startEdit(sermon: Sermon) {
    setEditingId(sermon.id);
    setForm({
      type: sermon.type,
      title: sermon.title,
      speaker: sermon.speaker,
      sermonDate: sermon.sermonDate,
      categoryId: sermon.categoryId || "cat-1",
      isLive: sermon.isLive,
      thumbnailUrl: sermon.thumbnailUrl || "",
      duration: sermon.duration || "",
      description: sermon.description || "",
      mediaUrl: sermon.mediaUrl || ""
    });
  }

  async function uploadFile(kind: MediaKind, file: File | null) {
    if (!file) return;

    setUploading(kind);
    setError("");

    try {
      const response = await uploadMedia(kind, file);
      const storedPath = response.media.path || response.media.url;

      if (kind === "image") {
        updateField("thumbnailUrl", storedPath);
      } else {
        updateField("mediaUrl", storedPath);
        updateField("type", kind === "audio" ? "audio" : "video");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media");
    } finally {
      setUploading("");
    }
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.speaker.trim()) return "Speaker is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.sermonDate)) return "Date must be YYYY-MM-DD.";
    if (!form.description.trim()) return "Description is required.";

    const mediaUrl = form.mediaUrl.trim().toLowerCase();
    if (!mediaUrl) return "Media URL is required. Upload audio/video or paste a YouTube/direct media URL.";
    if (["none", "null", "undefined"].includes(mediaUrl)) return "Media URL is invalid.";

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
        await updateSermon(editingId, form);
      } else {
        await createSermon(form);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sermon");
    } finally {
      setSaving(false);
    }
  }

  async function remove(sermon: Sermon) {
    const confirmed = confirm(`Delete "${sermon.title}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteSermon(sermon.id);
      await load();

      if (editingId === sermon.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete sermon");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Sermons</h1>
          <p className="muted">
            Create, update, and remove sermons shown in the mobile app.
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
            <h2>{editingId ? "Edit Sermon" : "Create Sermon"}</h2>

            {editingId ? (
              <button type="button" className="secondary compact" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <div className="two-col">
            <label>
              Type
              <select
                value={form.type}
                onChange={event => updateField("type", event.target.value as "video" | "audio")}
              >
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </label>

            <label>
              Category
              <select
                value={form.categoryId}
                onChange={event => updateField("categoryId", event.target.value)}
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Title
            <input
              value={form.title}
              onChange={event => updateField("title", event.target.value)}
              placeholder="Sermon title"
            />
          </label>

          <div className="two-col">
            <label>
              Speaker
              <input
                value={form.speaker}
                onChange={event => updateField("speaker", event.target.value)}
              />
            </label>

            <label>
              Date
              <input
                value={form.sermonDate}
                onChange={event => updateField("sermonDate", event.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </label>
          </div>

          <label>
            Thumbnail URL
            <input
              value={form.thumbnailUrl}
              onChange={event => updateField("thumbnailUrl", event.target.value)}
              placeholder="/uploads/media/image.png or https://..."
            />
          </label>

          <label>
            Upload Thumbnail
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={Boolean(uploading)}
              onChange={async event => {
                await uploadFile("image", event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </label>

          <div className="two-col">
            <label>
              Duration
              <input
                value={form.duration}
                onChange={event => updateField("duration", event.target.value)}
                placeholder="54:20"
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isLive}
                onChange={event => updateField("isLive", event.target.checked)}
              />
              Mark as live
            </label>
          </div>

          <label>
            Media URL
            <input
              value={form.mediaUrl}
              onChange={event => updateField("mediaUrl", event.target.value)}
              placeholder="/uploads/media/file.mp4, /uploads/media/file.mp3, or https://..."
            />
          </label>

          <div className="two-col">
            <label>
              Upload Video
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                disabled={Boolean(uploading)}
                onChange={async event => {
                  await uploadFile("video", event.target.files?.[0] || null);
                  event.target.value = "";
                }}
              />
            </label>

            <label>
              Upload Audio
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/wav,audio/ogg"
                disabled={Boolean(uploading)}
                onChange={async event => {
                  await uploadFile("audio", event.target.files?.[0] || null);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {uploading ? (
            <p className="muted">Uploading {uploading}...</p>
          ) : null}

          <label>
            Description
            <textarea
              value={form.description}
              onChange={event => updateField("description", event.target.value)}
              placeholder="Short sermon description"
              rows={5}
            />
          </label>

          <button disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Sermon" : "Create Sermon"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Sermons</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search sermons..."
          />

          {loading ? (
            <p className="muted">Loading sermons...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No sermons found.</p>
          ) : (
            <div className="sermon-list">
              {filtered.map(sermon => (
                <article key={sermon.id} className="sermon-row">
                  <div>
                    <h3>{sermon.title}</h3>
                    <p>
                      {sermon.type} · {sermon.sermonDate} · {sermon.category || "No category"}
                    </p>
                    <p className="small-muted">{sermon.description}</p>
                  </div>

                  <div className="row-actions">
                    <button className="secondary compact" onClick={() => startEdit(sermon)}>
                      Edit
                    </button>
                    <button className="danger compact" onClick={() => remove(sermon)}>
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
