import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createDevotion,
  deleteDevotion,
  importDevotions,
  listDevotions,
  previewDevotionImport,
  type DevotionImportPreview,
  type Devotion,
  type DevotionPayload,
  updateDevotion
} from "../api/adminDevotionsApi";
import { uploadMedia } from "../api/adminMediaApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import { isValidAssetReference, isValidDateString, isValidDateTimeString, hasMinLength } from "../lib/validation";

const emptyForm: DevotionPayload = {
  externalId: "",
  title: "",
  excerpt: "",
  devotionDate: "2026-06-11",
  publishedAt: "2026-06-11T05:00",
  imageUrl: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=600",
  body: ""
};

export function DevotionsPage() {
  const { confirm, showToast } = useAdminFeedback();
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [form, setForm] = useState<DevotionPayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [csvImport, setCsvImport] = useState("");
  const [importPreview, setImportPreview] = useState<DevotionImportPreview | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = devotions.filter(devotion =>
      !q ||
      [devotion.title, devotion.excerpt, devotion.body]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    return next.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "oldest") return a.devotionDate.localeCompare(b.devotionDate);
      return b.devotionDate.localeCompare(a.devotionDate);
    });
  }, [devotions, query, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(
    filtered,
    6,
    [query, sortBy, devotions.length]
  );

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
      externalId: devotion.externalId || "",
      title: devotion.title,
      excerpt: devotion.excerpt,
      devotionDate: devotion.devotionDate,
      publishedAt: devotion.publishedAt.slice(0, 16),
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

  async function loadCsvFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setCsvImport(text);
    setImportPreview(null);
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.excerpt.trim()) return "Excerpt is required.";
    if (!isValidDateString(form.devotionDate)) {
      return "Date must be a real YYYY-MM-DD date.";
    }
    if (!isValidDateTimeString(form.publishedAt)) {
      return "Publish time must be a valid date-time.";
    }
    if (!isValidAssetReference(form.imageUrl)) {
      return "Cover image must be an uploaded file path or a valid http(s) URL.";
    }
    if (!hasMinLength(form.body, 40)) return "Body must be at least 40 characters.";

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
      setError("Paste devotion CSV before importing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await importDevotions(csvImport);
      await load();
      setCsvImport("");
      setImportPreview(null);
      showToast({
        title: "Devotion import applied",
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
      setError(err instanceof Error ? err.message : "Failed to import devotions");
    } finally {
      setSaving(false);
    }
  }

  async function previewImport() {
    if (!csvImport.trim()) {
      setError("Paste or load devotion CSV before previewing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await previewDevotionImport(csvImport);
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
        title: "Devotion import preview ready",
        message: `${response.preview.creates} create, ${response.preview.updates} update, ${response.preview.rejected} reject.`,
        tone: response.preview.rejected ? "info" : "success"
      });
    } catch (err) {
      setImportPreview(null);
      setError(err instanceof Error ? err.message : "Failed to preview devotions");
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
        await updateDevotion(editingId, form);
      } else {
        await createDevotion(form);
      }

      resetForm();
      await load();
      showToast({
        title: editingId ? "Devotion updated" : "Devotion created",
        message: `${form.title.trim()} is ready for members.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save devotion");
    } finally {
      setSaving(false);
    }
  }

  async function remove(devotion: Devotion) {
    const confirmed = await confirm({
      title: `Delete "${devotion.title}"?`,
      message: "This removes the devotion from the app feed and favourites source list.",
      confirmLabel: "Delete Devotion",
      tone: "danger"
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteDevotion(devotion.id);
      await load();

      if (editingId === devotion.id) {
        resetForm();
      }

      showToast({
        title: "Devotion deleted",
        message: `${devotion.title} was removed from the mobile feed.`,
        tone: "success"
      });
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

      {error ? <InlineAlert title="Devotions could not be updated" message={error} /> : null}

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
            External ID
            <input
              value={form.externalId || ""}
              onChange={event => updateField("externalId", event.target.value)}
              placeholder="shekinah-dev-2026-07-01"
            />
          </label>

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
            Publish At
            <input
              type="datetime-local"
              value={form.publishedAt}
              onChange={event => updateField("publishedAt", event.target.value)}
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

          {isValidAssetReference(form.imageUrl) ? (
            <div className="media-preview-card">
              <div className="section-title-row compact">
                <h3>Cover Preview</h3>
                <a href={form.imageUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
              <img className="asset-preview-image" src={form.imageUrl} alt="Devotion cover preview" />
            </div>
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
              Columns: externalId,title,excerpt,devotionDate,publishedAt,imageUrl,body
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
              placeholder="Paste devotion CSV here"
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
            <h2>Existing Devotions</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <div className="list-controls">
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search devotions..."
            />
            <div className="filters-row">
              <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "title")}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
              </select>
              {(query || sortBy !== "newest") ? (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => {
                    setQuery("");
                    setSortBy("newest");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading devotions...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No devotions found.</p>
          ) : (
            <div className="sermon-list">
              {pagedItems.map(devotion => (
                <article key={devotion.id} className="sermon-row">
                  <div>
                    <h3>{devotion.title}</h3>
                    <p>{devotion.devotionDate}</p>
                    <p className="small-muted">{devotion.excerpt}</p>
                  </div>

                  <div className="row-actions">
                    <button type="button" className="secondary compact" onClick={() => startEdit(devotion)}>
                      Edit
                    </button>

                    <button type="button" className="danger compact" onClick={() => remove(devotion)}>
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
            itemLabel="devotions"
            onPageChange={setPage}
          />
        </section>
      </section>
    </main>
  );
}
