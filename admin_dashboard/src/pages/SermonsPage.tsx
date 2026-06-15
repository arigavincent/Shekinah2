import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createSermon,
  deleteSermon,
  importSermons,
  listSermons,
  previewSermonImport,
  type SermonImportPreview,
  type Sermon,
  type SermonPayload,
  updateSermon
} from "../api/adminSermonsApi";
import { uploadMedia, type MediaKind } from "../api/adminMediaApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import { isValidAssetReference, isValidDateString, isValidDateTimeString } from "../lib/validation";

const categories = [
  { id: "cat-1", name: "Faith" },
  { id: "cat-2", name: "Prayer" },
  { id: "cat-3", name: "Grace" },
  { id: "cat-4", name: "Revival" }
];

const emptyForm: SermonPayload = {
  externalId: "",
  type: "video",
  title: "",
  speaker: "Shekinah Sons Global",
  sermonDate: "2026-06-10",
  publishedAt: "2026-06-10T06:00",
  categoryId: "cat-1",
  isLive: false,
  thumbnailUrl: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900",
  duration: "",
  description: "",
  mediaUrl: ""
};

export function SermonsPage() {
  const { confirm, showToast } = useAdminFeedback();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [form, setForm] = useState<SermonPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "audio">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<MediaKind | "">("");
  const [csvImport, setCsvImport] = useState("");
  const [importPreview, setImportPreview] = useState<SermonImportPreview | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = sermons.filter(sermon => {
      const matchesQuery =
        !q ||
        [sermon.title, sermon.speaker, sermon.category, sermon.type]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesType = typeFilter === "all" || sermon.type === typeFilter;
      return matchesQuery && matchesType;
    });

    return next.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "oldest") return a.sermonDate.localeCompare(b.sermonDate);
      return b.sermonDate.localeCompare(a.sermonDate);
    });
  }, [query, sermons, sortBy, typeFilter]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(
    filtered,
    6,
    [query, sortBy, typeFilter, sermons.length]
  );

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
      externalId: sermon.externalId || "",
      title: sermon.title,
      speaker: sermon.speaker,
      sermonDate: sermon.sermonDate,
      publishedAt: sermon.publishedAt.slice(0, 16),
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

  async function loadCsvFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvImport(text);
    setImportPreview(null);
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.speaker.trim()) return "Speaker is required.";
    if (!isValidDateString(form.sermonDate)) return "Date must be a real YYYY-MM-DD date.";
    if (!isValidDateTimeString(form.publishedAt)) return "Publish time must be a valid date-time.";
    if (!isValidAssetReference(form.thumbnailUrl)) {
      return "Thumbnail must be an uploaded file path or a valid http(s) URL.";
    }
    if (!form.description.trim()) return "Description is required.";

    const mediaUrl = form.mediaUrl.trim().toLowerCase();
    if (!mediaUrl) return "Media URL is required. Upload audio/video or paste a YouTube/direct media URL.";
    if (["none", "null", "undefined"].includes(mediaUrl)) return "Media URL is invalid.";
    if (!isValidAssetReference(form.mediaUrl)) {
      return "Media URL must be an uploaded file path or a valid http(s) URL.";
    }
    if (form.duration.trim() && !/^\d{1,3}:\d{2}(:\d{2})?$/.test(form.duration.trim())) {
      return "Duration must look like 54:20 or 1:04:20.";
    }

    return "";
  }

  async function submitImport() {
    if (!importPreview) {
      setError("Run import preview before applying the batch.");
      return;
    }

    if (importPreview.creates === 0 && importPreview.updates === 0) {
      setError("There are no valid create or update rows to apply.");
      return;
    }

    if (!csvImport.trim()) {
      setError("Paste sermon CSV before importing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await importSermons(csvImport);
      await load();
      setCsvImport("");
      setImportPreview(null);
      showToast({
        title: "Sermon import applied",
        message: `${response.result.created.length} created, ${response.result.updated.length} updated, ${response.result.rejected.length} rejected.`,
        tone: response.result.rejected.length ? "info" : "success"
      });
      if (response.result.rejected.length) {
        setError(
          response.result.rejected
            .map(item => `Row ${item.rowNumber}: ${item.error}`)
            .slice(0, 8)
            .join(" | ")
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import sermons");
    } finally {
      setSaving(false);
    }
  }

  async function previewImport() {
    if (!csvImport.trim()) {
      setError("Paste or load sermon CSV before previewing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await previewSermonImport(csvImport);
      setImportPreview(response.preview);
      if (response.preview.rejected > 0) {
        const rejected = response.preview.rows
          .filter(item => item.action === "reject")
          .slice(0, 8)
          .map(item => `Row ${item.rowNumber}: ${(item.errors || []).join(", ")}`)
          .join(" | ");
        setError(rejected);
      }
      showToast({
        title: "Sermon import preview ready",
        message: `${response.preview.creates} create, ${response.preview.updates} update, ${response.preview.rejected} reject.`,
        tone: response.preview.rejected ? "info" : "success"
      });
    } catch (err) {
      setImportPreview(null);
      setError(err instanceof Error ? err.message : "Failed to preview sermons");
    } finally {
      setSaving(false);
    }
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
      showToast({
        title: editingId ? "Sermon updated" : "Sermon created",
        message: `${form.title.trim()} is ready in the content library.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sermon");
    } finally {
      setSaving(false);
    }
  }

  async function remove(sermon: Sermon) {
    const confirmed = await confirm({
      title: `Delete "${sermon.title}"?`,
      message: "This removes the sermon from the admin library and the mobile app.",
      confirmLabel: "Delete Sermon",
      tone: "danger"
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteSermon(sermon.id);
      await load();

      if (editingId === sermon.id) {
        resetForm();
      }

      showToast({
        title: "Sermon deleted",
        message: `${sermon.title} was removed from the content library.`,
        tone: "success"
      });
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

      {error ? <InlineAlert title="Sermons could not be updated" message={error} /> : null}

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
            External ID
            <input
              value={form.externalId || ""}
              onChange={event => updateField("externalId", event.target.value)}
              placeholder="shekinah-yt-asQFM1unI8Q"
            />
          </label>

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
            Publish At
            <input
              type="datetime-local"
              value={form.publishedAt}
              onChange={event => updateField("publishedAt", event.target.value)}
            />
          </label>

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

          {isValidAssetReference(form.thumbnailUrl) ? (
            <div className="media-preview-card">
              <div className="section-title-row compact">
                <h3>Thumbnail Preview</h3>
                <a href={form.thumbnailUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
              <img className="asset-preview-image" src={form.thumbnailUrl} alt="Sermon thumbnail preview" />
            </div>
          ) : null}

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

          {isValidAssetReference(form.mediaUrl) ? (
            <div className="media-preview-card">
              <div className="section-title-row compact">
                <h3>{form.type === "audio" ? "Audio Asset" : "Video Asset"}</h3>
                <a href={form.mediaUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
              <p className="small-muted asset-meta">
                {form.type === "audio"
                  ? "Use this to verify the uploaded audio before publishing."
                  : "Use this to verify the video file or external stream link before publishing."}
              </p>
              <code>{form.mediaUrl}</code>
            </div>
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

          <div className="subeditor-card">
            <div className="section-title-row compact">
              <h3>Batch Import</h3>
              <div className="row-actions">
                <button type="button" className="secondary compact" onClick={previewImport} disabled={saving}>
                  Preview CSV
                </button>
                <button type="button" className="secondary compact" onClick={submitImport} disabled={saving || !importPreview}>
                  Apply Import
                </button>
              </div>
            </div>
            <p className="muted">
              Columns: externalId,type,title,speaker,sermonDate,publishedAt,categoryId,isLive,thumbnailUrl,duration,description,mediaUrl
            </p>
            <label>
              Load CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async event => {
                  await loadCsvFile(event.target.files?.[0] || null);
                  event.target.value = "";
                }}
              />
            </label>
            <textarea
              value={csvImport}
              onChange={event => {
                setCsvImport(event.target.value);
                setImportPreview(null);
              }}
              rows={8}
              placeholder="Paste sermon CSV here"
            />
            {importPreview ? (
              <div className="import-preview-card">
                <div className="stats-grid compact">
                  <article className="stat-card">
                    <span>Create</span>
                    <strong>{importPreview.creates}</strong>
                  </article>
                  <article className="stat-card">
                    <span>Update</span>
                    <strong>{importPreview.updates}</strong>
                  </article>
                  <article className="stat-card">
                    <span>Reject</span>
                    <strong>{importPreview.rejected}</strong>
                  </article>
                </div>
                <div className="preview-list">
                  {importPreview.rows.slice(0, 12).map(row => (
                    <article key={`${row.rowNumber}-${row.externalId}`} className="preview-row">
                      <div>
                        <strong>Row {row.rowNumber}</strong>
                        <p className="small-muted">{row.externalId || "missing externalId"}</p>
                        <p>{row.title || "Untitled row"}</p>
                      </div>
                      <div className="preview-row-meta">
                        <span className={`status-chip ${row.action === "reject" ? "danger" : row.action === "update" ? "warning" : "success"}`}>
                          {row.action}
                        </span>
                        {row.errors?.length ? <p className="small-muted">{row.errors.join(", ")}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Sermons</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <div className="list-controls">
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search sermons..."
            />

            <div className="filters-row">
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as "all" | "video" | "audio")}>
                <option value="all">All Types</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>

              <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "title")}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
              </select>

              {(query || typeFilter !== "all" || sortBy !== "newest") ? (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("all");
                    setSortBy("newest");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading sermons...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No sermons found.</p>
          ) : (
            <div className="sermon-list">
              {pagedItems.map(sermon => (
                <article key={sermon.id} className="sermon-row">
                  <div>
                    <h3>{sermon.title}</h3>
                    <p>
                      {sermon.type} · {sermon.sermonDate} · {sermon.category || "No category"}
                    </p>
                    <p className="small-muted">{sermon.description}</p>
                  </div>

                  <div className="row-actions">
                    <button type="button" className="secondary compact" onClick={() => startEdit(sermon)}>
                      Edit
                    </button>
                    <button type="button" className="danger compact" onClick={() => remove(sermon)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            pageSize={6}
            totalItems={filtered.length}
            itemLabel="sermons"
            onPageChange={setPage}
          />
        </section>
      </section>
    </main>
  );
}
