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
import { uploadMedia } from "../api/adminMediaApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import { isValidAssetReference, isValidDateString } from "../lib/validation";

const emptyForm: UpdatePayload = {
  title: "",
  excerpt: "",
  updateDate: "2026-06-12",
  imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=900"
};

export function UpdatesPage() {
  const { confirm, showToast } = useAdminFeedback();
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [form, setForm] = useState<UpdatePayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = updates.filter(update =>
      !q ||
      [update.title, update.excerpt, update.updateDate]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    return next.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "oldest") return a.updateDate.localeCompare(b.updateDate);
      return b.updateDate.localeCompare(a.updateDate);
    });
  }, [updates, query, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(
    filtered,
    6,
    [query, sortBy, updates.length]
  );

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

  async function uploadImage(file: File | null) {
    if (!file) return;

    setUploadingImage(true);
    setError("");

    try {
      const response = await uploadMedia("image", file);
      updateField("imageUrl", response.media.path || response.media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload update image");
    } finally {
      setUploadingImage(false);
    }
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.excerpt.trim()) return "Excerpt is required.";
    if (!isValidDateString(form.updateDate)) {
      return "Date must be a real YYYY-MM-DD date.";
    }
    if (!isValidAssetReference(form.imageUrl)) {
      return "Update image must be an uploaded file path or a valid http(s) URL.";
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
      showToast({
        title: editingId ? "Announcement updated" : "Announcement created",
        message: `${form.title.trim()} is ready in the updates feed.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save update");
    } finally {
      setSaving(false);
    }
  }

  async function remove(update: UpdateItem) {
    const confirmed = await confirm({
      title: `Delete "${update.title}"?`,
      message: "This removes the announcement from the updates feed in the mobile app.",
      confirmLabel: "Delete Announcement",
      tone: "danger"
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteUpdate(update.id);
      await load();

      if (editingId === update.id) {
        resetForm();
      }

      showToast({
        title: "Announcement deleted",
        message: `${update.title} was removed from the updates feed.`,
        tone: "success"
      });
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

      {error ? <InlineAlert title="Updates could not be updated" message={error} /> : null}

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
                <h3>Update Image Preview</h3>
                <a href={form.imageUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
              <img className="asset-preview-image" src={form.imageUrl} alt="Update image preview" />
            </div>
          ) : null}

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

          <div className="list-controls">
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search updates..."
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
            <p className="muted">Loading updates...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No updates found.</p>
          ) : (
            <div className="sermon-list">
              {pagedItems.map(update => (
                <article key={update.id} className="sermon-row">
                  <div>
                    <h3>{update.title}</h3>
                    <p>{update.updateDate}</p>
                    <p className="small-muted">{update.excerpt}</p>
                  </div>

                  <div className="row-actions">
                    <button type="button" className="secondary compact" onClick={() => startEdit(update)}>
                      Edit
                    </button>

                    <button type="button" className="danger compact" onClick={() => remove(update)}>
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
            itemLabel="announcements"
            onPageChange={setPage}
          />
        </section>
      </section>
    </main>
  );
}
