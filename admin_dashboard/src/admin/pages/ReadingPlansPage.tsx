import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createAdminReadingPlan,
  deleteAdminReadingPlan,
  listAdminReadingPlans,
  type ReadingPlan,
  type ReadingPlanDay,
  type ReadingPlanPayload,
  updateAdminReadingPlan
} from "../api/adminReadingPlansApi";
import { uploadMedia, type UploadedMedia } from "../api/adminMediaApi";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import { hasMinLength, isValidAssetReference } from "../lib/validation";

const emptyDay = (): ReadingPlanDay => ({
  dayNumber: 1,
  title: "",
  reference: "",
  description: "",
  prayerPrompt: ""
});

const emptyForm: ReadingPlanPayload = {
  title: "",
  description: "",
  imageUrl: "",
  durationDays: 1,
  isActive: true,
  days: [emptyDay()]
};

function mediaProviderLabel(media: UploadedMedia) {
  switch ((media.provider || "").toLowerCase()) {
    case "r2":
      return "Cloudflare R2";
    case "cloudinary":
      return "Cloudinary";
    case "local":
      return "Local storage";
    default:
      return "Cloud storage";
  }
}

function mediaSafetyLabel(media: UploadedMedia) {
  const ref = media.url || media.path || "";
  if (media.provider === "r2" || ref.includes(".r2.dev") || ref.includes(".r2.cloudflarestorage.com")) {
    return "Safe for APK";
  }
  if (media.provider === "cloudinary" || ref.includes("res.cloudinary.com")) {
    return "Safe for APK";
  }
  if (media.provider === "local" || ref.includes("/uploads/media/")) {
    return "Development storage";
  }
  return "Saved media URL";
}

export function ReadingPlansPage() {
  const { confirm, showToast } = useAdminFeedback();
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [form, setForm] = useState<ReadingPlanPayload>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCover, setUploadedCover] = useState<UploadedMedia | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = plans.filter(plan =>
      !q || [plan.title, plan.description].join(" ").toLowerCase().includes(q)
    );
    return next.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [plans, query, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(filtered, 6, [
    plans.length,
    query,
    sortBy
  ]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await listAdminReadingPlans();
      setPlans(response.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reading plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof ReadingPlanPayload>(key: K, value: ReadingPlanPayload[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function updateDay(index: number, patch: Partial<ReadingPlanDay>) {
    setForm(current => ({
      ...current,
      days: current.days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day))
    }));
  }

  function addDay() {
    setForm(current => ({
      ...current,
      durationDays: current.days.length + 1,
      days: [...current.days, { ...emptyDay(), dayNumber: current.days.length + 1 }]
    }));
  }

  function removeDay(index: number) {
    setForm(current => ({
      ...current,
      days: current.days
        .filter((_, dayIndex) => dayIndex !== index)
        .map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 })),
      durationDays: Math.max(1, current.days.length - 1)
    }));
  }

  function resetForm() {
    setEditingId(null);
    setUploadedCover(null);
    setForm({ ...emptyForm, days: [emptyDay()] });
  }

  function startEdit(plan: ReadingPlan) {
    setEditingId(plan.id);
    setUploadedCover(null);
    setForm({
      title: plan.title,
      description: plan.description,
      imageUrl: plan.imageUrl,
      durationDays: plan.days.length || plan.durationDays,
      isActive: plan.isActive,
      days: plan.days.length
        ? plan.days.map(day => ({
            dayNumber: day.dayNumber,
            title: day.title,
            reference: day.reference,
            description: day.description,
            prayerPrompt: day.prayerPrompt
          }))
        : [emptyDay()]
    });
  }

  async function uploadImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const response = await uploadMedia("image", file);
      setUploadedCover(response.media);
      updateField("imageUrl", response.media.url || response.media.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload reading plan cover");
    } finally {
      setUploading(false);
    }
  }

  function validate() {
    if (!form.title.trim()) return "Title is required.";
    if (!hasMinLength(form.description, 20)) return "Description should be at least 20 characters.";
    if (form.imageUrl.trim() && !isValidAssetReference(form.imageUrl)) {
      return "Cover image must be an uploaded cloud URL or a valid http(s) URL.";
    }
    if (form.durationDays <= 0) return "Duration must be greater than zero.";
    if (form.days.length === 0) return "Add at least one day.";
    for (const day of form.days) {
      if (!day.title.trim() || !day.reference.trim()) {
        return "Every reading plan day needs a title and scripture reference.";
      }
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
      const payload = {
        ...form,
        durationDays: form.days.length,
        days: form.days.map((day, index) => ({ ...day, dayNumber: index + 1 }))
      };

      if (editingId) {
        await updateAdminReadingPlan(editingId, payload);
      } else {
        await createAdminReadingPlan(payload);
      }
      await load();
      resetForm();
      showToast({
        title: editingId ? "Reading plan updated" : "Reading plan created",
        message: `${form.title.trim()} is ready for members.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reading plan");
    } finally {
      setSaving(false);
    }
  }

  async function remove(plan: ReadingPlan) {
    const confirmed = await confirm({
      title: `Delete "${plan.title}"?`,
      message: "This removes the reading plan and all plan days from the app.",
      confirmLabel: "Delete Plan",
      tone: "danger"
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      await deleteAdminReadingPlan(plan.id);
      await load();
      if (editingId === plan.id) resetForm();
      showToast({
        title: "Reading plan deleted",
        message: `${plan.title} was removed from the reading plan library.`,
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete reading plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Discipleship</p>
          <h1>Reading Plans</h1>
          <p className="muted">
            Build multi-day Bible plans with scripture references, reflections, and prayer prompts.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Reading plans could not be updated" message={error} /> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <div className="section-title-row">
            <h2>{editingId ? "Edit Reading Plan" : "Create Reading Plan"}</h2>
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

          <label>
            Description
            <textarea value={form.description} rows={4} onChange={event => updateField("description", event.target.value)} />
          </label>

          <div className="two-col">
            <label>
              Duration (days, auto-synced)
              <input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={event => updateField("durationDays", Number(event.target.value) || 0)}
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={event => updateField("isActive", event.target.checked)}
              />
              Plan is active
            </label>
          </div>

          <label>
            Cover URL
            <input
              value={form.imageUrl}
              onChange={event => updateField("imageUrl", event.target.value)}
              placeholder="Upload a cover image or paste a valid https:// image URL"
            />
          </label>

          <label>
            Upload Cover
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={async event => {
                await uploadImage(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </label>

          {uploadedCover ? (
            <div className="batch-media-result session-result">
              <span className="status-chip success">{mediaProviderLabel(uploadedCover)}</span>
              <span>{mediaSafetyLabel(uploadedCover)}</span>
              <a href={uploadedCover.url || uploadedCover.path} target="_blank" rel="noreferrer">
                Open uploaded cover
              </a>
            </div>
          ) : null}

          {form.imageUrl ? (
            <div className="media-preview-card">
              <div className="section-title-row compact">
                <h3>Cover Preview</h3>
                <a href={form.imageUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
              <img className="asset-preview-image" src={form.imageUrl} alt="Reading plan cover preview" />
            </div>
          ) : null}

          <div className="section-title-row">
            <h3>Plan Days</h3>
            <button type="button" className="secondary compact" onClick={addDay}>
              Add Day
            </button>
          </div>

          <div className="stacked-group">
            {form.days.map((day, index) => (
              <div key={`${day.dayNumber}-${index}`} className="subeditor-card">
                <div className="section-title-row compact">
                  <h3>Day {index + 1}</h3>
                  {form.days.length > 1 ? (
                    <button type="button" className="danger compact" onClick={() => removeDay(index)}>
                      Remove
                    </button>
                  ) : null}
                </div>

                <label>
                  Title
                  <input value={day.title} onChange={event => updateDay(index, { title: event.target.value })} />
                </label>

                <label>
                  Scripture Reference
                  <input
                    value={day.reference}
                    onChange={event => updateDay(index, { reference: event.target.value })}
                    placeholder="Matthew 6:6"
                  />
                </label>

                <label>
                  Reflection
                  <textarea
                    value={day.description}
                    rows={3}
                    onChange={event => updateDay(index, { description: event.target.value })}
                  />
                </label>

                <label>
                  Prayer Prompt
                  <textarea
                    value={day.prayerPrompt}
                    rows={2}
                    onChange={event => updateDay(index, { prayerPrompt: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Reading Plan" : "Create Reading Plan"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Reading Plans</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <div className="list-controls">
            <input
              className="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search title or description..."
            />
            <div className="inline-filters">
              <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "title")}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="muted">Loading reading plans...</p>
          ) : pagedItems.length === 0 ? (
            <p className="muted">No reading plans match the current filters.</p>
          ) : (
            <>
              <div className="item-list">
                {pagedItems.map(plan => (
                  <article key={plan.id} className="item-row">
                    <div>
                      <div className="item-row-heading">
                        <h3>{plan.title}</h3>
                        <span className={plan.isActive ? "status-chip success" : "status-chip neutral"}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="muted">{plan.durationDays} days · {plan.days.length} entries</p>
                      <p className="muted">{plan.description}</p>
                    </div>

                    <div className="row-actions">
                      <button type="button" className="secondary compact" onClick={() => startEdit(plan)}>
                        Edit
                      </button>
                      <button type="button" className="danger compact" onClick={() => remove(plan)}>
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
                itemLabel="plans"
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      </section>
    </main>
  );
}
