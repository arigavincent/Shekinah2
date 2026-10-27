import type { FormEvent } from "react";
import { useState } from "react";

import {
  createSermonCategory,
  deleteSermonCategory,
  putFileToStorage,
  startDirectUpload,
  updateSermonCategory,
  type SermonCategory
} from "../api/adminSermonsApi";
import { useAdminFeedback } from "../feedback/AdminFeedback";

type Props = {
  categories: SermonCategory[];
  canUploadImages: boolean;
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
};

// Sermon categories shown as cards in the app's Sermons → Categories tab.
export function SermonCategoriesCard({ categories, canUploadImages, onChanged, onError }: Props) {
  const { showToast, confirm } = useAdminFeedback();
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusyId("new");
    try {
      await createSermonCategory(name);
      setNewName("");
      await onChanged();
      showToast({ title: "Category added", message: `${name} is available for sermons.`, tone: "success" });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not add the category");
    } finally {
      setBusyId(null);
    }
  }

  async function saveName(category: SermonCategory) {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name || name === category.name) {
      setEditing(null);
      return;
    }
    setBusyId(category.id);
    try {
      await updateSermonCategory(category.id, { name });
      setEditing(null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not rename the category");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadCover(category: SermonCategory, file: File | null) {
    if (!file) return;
    setBusyId(category.id);
    try {
      const upload = await startDirectUpload("image", file);
      await putFileToStorage(upload, file, () => {});
      await updateSermonCategory(category.id, { imageUrl: upload.publicUrl });
      await onChanged();
      showToast({ title: "Cover updated", message: `${category.name} has a new cover image.`, tone: "success" });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not upload the cover");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(category: SermonCategory) {
    const ok = await confirm({
      title: `Delete "${category.name}"?`,
      message:
        category.sermonCount > 0
          ? `Its ${category.sermonCount} sermon${category.sermonCount === 1 ? "" : "s"} stay in the app without a category.`
          : "No sermons use this category.",
      confirmLabel: "Delete category",
      tone: "danger"
    });
    if (!ok) return;
    setBusyId(category.id);
    try {
      await deleteSermonCategory(category.id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete the category");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="editor-card categories-card">
      <div className="section-title-row">
        <div>
          <h2>Sermon categories</h2>
          <p className="small-muted">Shown as cover cards in the app's Sermons → Categories tab.</p>
        </div>
        <span className="count-pill">{categories.length}</span>
      </div>

      <form className="podcast-row" onSubmit={add}>
        <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="New category, e.g. Kingdom Finance" maxLength={60} />
        <button type="submit" disabled={busyId === "new" || !newName.trim()}>
          {busyId === "new" ? "Adding..." : "Add category"}
        </button>
      </form>

      <div className="category-grid">
        {categories.map(category => (
          <article key={category.id} className="category-tile">
            <div className="category-cover">
              {category.imageUrl ? <img src={category.imageUrl} alt="" /> : <span>No cover</span>}
            </div>
            <div className="category-body">
              {editing?.id === category.id ? (
                <input
                  autoFocus
                  value={editing.name}
                  maxLength={60}
                  onChange={event => setEditing({ id: category.id, name: event.target.value })}
                  onBlur={() => saveName(category)}
                  onKeyDown={event => {
                    if (event.key === "Enter") saveName(category);
                    if (event.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <strong>{category.name}</strong>
              )}
              <span className="small-muted">
                {category.sermonCount} sermon{category.sermonCount === 1 ? "" : "s"}
              </span>
              <div className="row-actions">
                <button type="button" className="secondary compact" onClick={() => setEditing({ id: category.id, name: category.name })} disabled={busyId === category.id}>
                  Rename
                </button>
                <label className={`secondary compact file-button${!canUploadImages ? " disabled" : ""}`}>
                  {busyId === category.id ? "Saving..." : "Cover"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!canUploadImages || busyId === category.id}
                    onChange={async event => {
                      await uploadCover(category, event.target.files?.[0] || null);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button type="button" className="danger compact" onClick={() => remove(category)} disabled={busyId === category.id}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
