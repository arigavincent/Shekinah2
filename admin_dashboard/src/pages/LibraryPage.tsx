import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createLibraryItem,
  deleteLibraryItem,
  listLibraryItems,
  type LibraryItem,
  type LibraryPayload,
  updateLibraryItem
} from "../api/adminLibraryApi";
import { uploadMedia } from "../api/adminMediaApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import { isValidAssetReference, isValidDateTimeString } from "../lib/validation";

const emptyForm: LibraryPayload = {
  title: "",
  description: "",
  author: "Shekinah Sons Global",
  category: "Study Guides",
  coverUrl: "",
  fileUrl: "",
  fileType: "pdf",
  fileSizeBytes: 0,
  isFeatured: false,
  publishedAt: new Date().toISOString().slice(0, 16)
};

function formatBytes(size: number) {
  if (!size) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function LibraryPage() {
  const { confirm, showToast } = useAdminFeedback();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [form, setForm] = useState<LibraryPayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"" | "cover" | "file">("");
  const [error, setError] = useState("");

  const categories = useMemo(() => {
    const values = new Set(items.map(item => item.category).filter(Boolean));
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = items.filter(item => {
      const matchesQuery =
        !q ||
        [item.title, item.author, item.category, item.description].join(" ").toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });

    return next.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "oldest") return a.publishedAt.localeCompare(b.publishedAt);
      return b.publishedAt.localeCompare(a.publishedAt);
    });
  }, [categoryFilter, items, query, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(filtered, 6, [
    query,
    categoryFilter,
    sortBy,
    items.length
  ]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await listLibraryItems();
      setItems(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library resources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof LibraryPayload>(key: K, value: LibraryPayload[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, publishedAt: new Date().toISOString().slice(0, 16) });
  }

  function startEdit(item: LibraryItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      author: item.author,
      category: item.category,
      coverUrl: item.coverUrl,
      fileUrl: item.fileUrl,
      fileType: item.fileType,
      fileSizeBytes: item.fileSizeBytes,
      isFeatured: item.isFeatured,
      publishedAt: item.publishedAt.slice(0, 16)
    });
  }

  async function uploadCover(file: File | null) {
    if (!file) return;
    setUploading("cover");
    setError("");
    try {
      const response = await uploadMedia("image", file);
      updateField("coverUrl", response.media.path || response.media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload cover image");
    } finally {
      setUploading("");
    }
  }

  async function uploadDocument(file: File | null) {
    if (!file) return;
    setUploading("file");
    setError("");
    try {
      const response = await uploadMedia("document", file);
      updateField("fileUrl", response.media.path || response.media.url);
      updateField("fileSizeBytes", response.media.size || file.size || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload library PDF");
    } finally {
      setUploading("");
    }
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!form.description.trim()) return "Description is required.";
    if (!form.author.trim()) return "Author is required.";
    if (!form.category.trim()) return "Category is required.";
    if (form.coverUrl.trim() && !isValidAssetReference(form.coverUrl)) {
      return "Cover image must be an uploaded file path or a valid http(s) URL.";
    }
    if (!isValidAssetReference(form.fileUrl)) {
      return "PDF file must be uploaded first or use a valid http(s) URL.";
    }
    if (form.fileType !== "pdf") return "This release supports PDF resources only.";
    if (!isValidDateTimeString(form.publishedAt)) {
      return "Publish time must be a valid date-time.";
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
        await updateLibraryItem(editingId, form);
      } else {
        await createLibraryItem(form);
      }
      await load();
      resetForm();
      showToast({
        title: editingId ? "Library item updated" : "Library item created",
        message: `${form.title.trim()} is ready for the church library.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save library item");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: LibraryItem) {
    const confirmed = await confirm({
      title: `Delete "${item.title}"?`,
      message: "This removes the resource from the member library and any download links.",
      confirmLabel: "Delete Resource",
      tone: "danger"
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await deleteLibraryItem(item.id);
      await load();
      if (editingId === item.id) resetForm();
      showToast({
        title: "Library item deleted",
        message: `${item.title} was removed from the library.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete library item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Library</h1>
          <p className="muted">
            Upload books, handouts, and e-learning PDFs for members to read and download.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Library could not be updated" message={error} /> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <div className="section-title-row">
            <h2>{editingId ? "Edit Resource" : "Add Resource"}</h2>
            {editingId ? (
              <button type="button" className="secondary compact" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <label>
            Title
            <input value={form.title} onChange={event => updateField("title", event.target.value)} />
          </label>

          <div className="two-col">
            <label>
              Author / Source
              <input value={form.author} onChange={event => updateField("author", event.target.value)} />
            </label>

            <label>
              Category
              <input value={form.category} onChange={event => updateField("category", event.target.value)} />
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
            Description
            <textarea value={form.description} rows={5} onChange={event => updateField("description", event.target.value)} />
          </label>

          <label>
            Cover URL
            <input
              value={form.coverUrl}
              onChange={event => updateField("coverUrl", event.target.value)}
              placeholder="/uploads/media/cover.png or https://..."
            />
          </label>

          <label>
            Upload Cover
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading === "cover"}
              onChange={async event => {
                await uploadCover(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </label>

          <label>
            PDF URL
            <input
              value={form.fileUrl}
              onChange={event => updateField("fileUrl", event.target.value)}
              placeholder="/uploads/media/file.pdf or https://..."
            />
          </label>

          <label>
            Upload PDF
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading === "file"}
              onChange={async event => {
                await uploadDocument(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={event => updateField("isFeatured", event.target.checked)}
            />
            Feature this item
          </label>

          {form.coverUrl ? (
            <div className="media-preview-card">
              <div className="section-title-row compact">
                <h3>Cover Preview</h3>
                <a href={form.coverUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
              <img className="asset-preview-image" src={form.coverUrl} alt="Library cover preview" />
            </div>
          ) : null}

          {form.fileUrl ? (
            <div className="media-preview-card">
              <div className="section-title-row compact">
                <h3>Document</h3>
                <a href={form.fileUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </div>
              <p className="muted">{formatBytes(form.fileSizeBytes)}</p>
            </div>
          ) : null}

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Resource" : "Add Resource"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Library Resources</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <div className="list-controls">
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search title, author, category..."
            />

            <div className="inline-filters">
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                {categories.map(option => (
                  <option key={option} value={option}>
                    {option === "all" ? "All categories" : option}
                  </option>
                ))}
              </select>

              <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "title")}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading library resources...</p>
          ) : pagedItems.length === 0 ? (
            <p className="muted">No library resources match the current filters.</p>
          ) : (
            <>
              <div className="item-list">
                {pagedItems.map(item => (
                  <article key={item.id} className="item-row">
                    <div>
                      <div className="item-row-heading">
                        <h3>{item.title}</h3>
                        {item.isFeatured ? <span className="status-chip success">Featured</span> : null}
                      </div>
                      <p className="muted">
                        {item.author} · {item.category} · {formatBytes(item.fileSizeBytes)}
                      </p>
                      <p className="muted">Publishes {new Date(item.publishedAt).toLocaleString()}</p>
                    </div>

                    <div className="row-actions">
                      <button type="button" className="secondary compact" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button type="button" className="danger compact" onClick={() => remove(item)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <PaginationBar
                currentPage={page}
                totalPages={totalPages}
                pageSize={6}
                totalItems={filtered.length}
                itemLabel="resources"
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      </section>
    </main>
  );
}
