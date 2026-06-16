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

type WizardDevotionRow = {
  sourceKind: "schedule" | "local";
  externalId: string;
  title: string;
  excerpt: string;
  devotionDate: string;
  publishedAt: string;
  imageUrl: string;
  body: string;
  localImageFile?: File | null;
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardSourceMode, setWizardSourceMode] = useState<"schedule" | "local">("schedule");
  const [wizardStartDate, setWizardStartDate] = useState("2026-06-16");
  const [wizardDays, setWizardDays] = useState("7");
  const [wizardPublishTime, setWizardPublishTime] = useState("05:00");
  const [wizardLocalFiles, setWizardLocalFiles] = useState<File[]>([]);
  const [wizardRows, setWizardRows] = useState<WizardDevotionRow[]>([]);
  const [wizardPreview, setWizardPreview] = useState<DevotionImportPreview | null>(null);
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

  function resetWizard() {
    setWizardOpen(false);
    setWizardStep(1);
    setWizardSourceMode("schedule");
    setWizardStartDate("2026-06-16");
    setWizardDays("7");
    setWizardPublishTime("05:00");
    setWizardLocalFiles([]);
    setWizardRows([]);
    setWizardPreview(null);
  }

  function openWizard() {
    setError("");
    setWizardOpen(true);
    setWizardStep(1);
    setWizardSourceMode("schedule");
    setWizardLocalFiles([]);
    setWizardRows([]);
    setWizardPreview(null);
  }

  function addDays(dateString: string, offset: number) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function defaultWizardRow(dateString: string): WizardDevotionRow {
    return {
      sourceKind: "schedule",
      externalId: `shekinah-dev-${dateString}`,
      title: "",
      excerpt: "",
      devotionDate: dateString,
      publishedAt: `${dateString}T${wizardPublishTime}`,
      imageUrl: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=600",
      body: "",
      localImageFile: null
    };
  }

  function defaultLocalWizardRow(file: File, index: number): WizardDevotionRow {
    const base = file.name.replace(/\.[^.]+$/, "").trim() || `local-devotion-${index + 1}`;
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const dateString = addDays(wizardStartDate, index);
    return {
      sourceKind: "local",
      externalId: `shekinah-dev-local-${slug || index + 1}`,
      title: base,
      excerpt: "",
      devotionDate: dateString,
      publishedAt: `${dateString}T${wizardPublishTime}`,
      imageUrl: "",
      body: "",
      localImageFile: file
    };
  }

  function startWizardMetadataStep() {
    if (!isValidDateString(wizardStartDate)) {
      setError("Choose a valid wizard start date.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(wizardPublishTime)) {
      setError("Choose a valid publish time.");
      return;
    }

    let rows: WizardDevotionRow[] = [];
    if (wizardSourceMode === "schedule") {
      const count = Number.parseInt(wizardDays, 10);
      if (!count || count < 1 || count > 31) {
        setError("Choose between 1 and 31 devotion days.");
        return;
      }

      rows = Array.from({ length: count }, (_, index) =>
        defaultWizardRow(addDays(wizardStartDate, index))
      );
    } else {
      if (!wizardLocalFiles.length) {
        setError("Select at least one local image before continuing.");
        return;
      }

      rows = wizardLocalFiles.map(defaultLocalWizardRow);
    }

    setWizardRows(rows);
    setWizardPreview(null);
    setWizardStep(2);
  }

  function updateWizardRow(index: number, patch: Partial<WizardDevotionRow>) {
    setWizardRows(current =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
    setWizardPreview(null);
  }

  async function uploadWizardImage(index: number, file: File | null) {
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      updateWizardRow(index, {
        localImageFile: file,
        imageUrl: ""
      });
    } finally {
      setUploadingImage(false);
    }
  }

  async function loadWizardLocalFiles(fileList: FileList | null) {
    if (!fileList) return;
    setWizardLocalFiles(Array.from(fileList));
    setWizardRows([]);
    setWizardPreview(null);
  }

  async function ensureWizardImagesUploaded() {
    const nextRows = [...wizardRows];

    for (let index = 0; index < nextRows.length; index += 1) {
      const row = nextRows[index];
      if (!row.localImageFile || row.imageUrl.trim()) continue;
      const response = await uploadMedia("image", row.localImageFile);
      nextRows[index] = {
        ...row,
        imageUrl: response.media.path || response.media.url
      };
    }

    setWizardRows(nextRows);
    return nextRows;
  }

  function buildWizardCsv(rows: WizardDevotionRow[]) {
    const escapeCsv = (value: string) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
    const header = ["externalId", "title", "excerpt", "devotionDate", "publishedAt", "imageUrl", "body"];
    const bodyRows = rows.map(row =>
      [
        row.externalId,
        row.title,
        row.excerpt,
        row.devotionDate,
        row.publishedAt,
        row.imageUrl,
        row.body
      ]
        .map(escapeCsv)
        .join(",")
    );
    return [header.join(","), ...bodyRows].join("\n");
  }

  async function previewWizardImport() {
    if (!wizardRows.length) {
      setError("Generate at least one devotion row before previewing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const uploadedRows = await ensureWizardImagesUploaded();
      const response = await previewDevotionImport(buildWizardCsv(uploadedRows));
      setWizardPreview(response.preview);
      setWizardStep(3);
      if (response.preview.rejected > 0) {
        const rejected = response.preview.rows
          .filter(item => item.action === "reject")
          .slice(0, 8)
          .map(item => `Row ${item.rowNumber}: ${(item.errors || []).join(", ")}`)
          .join(" | ");
        setError(rejected);
      }
    } catch (err) {
      setWizardPreview(null);
      setError(err instanceof Error ? err.message : "Failed to preview devotion wizard import");
    } finally {
      setSaving(false);
    }
  }

  async function applyWizardImport() {
    if (!wizardPreview) {
      setError("Preview the devotion batch before applying it.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const uploadedRows = await ensureWizardImagesUploaded();
      const response = await importDevotions(buildWizardCsv(uploadedRows));
      await load();
      showToast({
        title: "Wizard import applied",
        message: `${response.result.created.length} created, ${response.result.updated.length} updated, ${response.result.rejected.length} rejected.`,
        tone: response.result.rejected.length ? "info" : "success"
      });
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply devotion wizard import");
    } finally {
      setSaving(false);
    }
  }

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

        <div className="row-actions">
          <button type="button" className="secondary" onClick={openWizard}>
            Batch Import Wizard
          </button>
          <button className="secondary" onClick={load}>
            Refresh
          </button>
        </div>
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
              <h3>Advanced CSV Import</h3>
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

      {wizardOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={resetWizard}>
          <section
            className="wizard-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="devotion-import-wizard-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Batch Import Wizard</p>
                <h2 id="devotion-import-wizard-title">Devotion Schedule Builder</h2>
                <p className="muted">
                  Generate a month or week schedule, fill the content row by row, then preview and apply.
                </p>
              </div>
              <button type="button" className="secondary compact" onClick={resetWizard}>
                Close
              </button>
            </div>

            <div className="wizard-steps">
              <span className={`status-chip ${wizardStep === 1 ? "warning" : "neutral"}`}>1. Schedule</span>
              <span className={`status-chip ${wizardStep === 2 ? "warning" : wizardStep > 2 ? "success" : "neutral"}`}>2. Content</span>
              <span className={`status-chip ${wizardStep === 3 ? "warning" : "neutral"}`}>3. Preview</span>
            </div>

            {wizardStep === 1 ? (
              <div className="wizard-pane">
                <div className="filters-row">
                  <button
                    type="button"
                    className={wizardSourceMode === "schedule" ? "" : "secondary"}
                    onClick={() => {
                      setWizardSourceMode("schedule");
                      setWizardLocalFiles([]);
                    }}
                  >
                    Schedule Builder
                  </button>
                  <button
                    type="button"
                    className={wizardSourceMode === "local" ? "" : "secondary"}
                    onClick={() => {
                      setWizardSourceMode("local");
                      setWizardRows([]);
                    }}
                  >
                    Local Files
                  </button>
                </div>

                {wizardSourceMode === "schedule" ? (
                  <>
                    <div className="three-col">
                      <label>
                        Start Date
                        <input
                          value={wizardStartDate}
                          onChange={event => setWizardStartDate(event.target.value)}
                          placeholder="YYYY-MM-DD"
                        />
                      </label>
                      <label>
                        Number of Days
                        <input
                          value={wizardDays}
                          onChange={event => setWizardDays(event.target.value)}
                          placeholder="7"
                        />
                      </label>
                      <label>
                        Publish Time
                        <input
                          type="time"
                          value={wizardPublishTime}
                          onChange={event => setWizardPublishTime(event.target.value)}
                        />
                      </label>
                    </div>
                    <p className="muted">
                      This generates a scheduled devotion batch with stable external IDs such as
                      `shekinah-dev-2026-06-16`.
                    </p>
                  </>
                ) : (
                  <>
                    <label>
                      Select Local Image Files
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={async event => {
                          await loadWizardLocalFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <p className="muted">
                      Choose one cover image per devotion. The wizard will upload them during preview.
                    </p>
                    <div className="wizard-source-list">
                      {wizardLocalFiles.length ? wizardLocalFiles.map((file, index) => (
                        <article key={`${file.name}-${file.size}-${file.lastModified}`} className="wizard-source-card selected">
                          <div />
                          <div className="wizard-local-icon">IMAGE</div>
                          <div>
                            <strong>{file.name}</strong>
                            <p className="small-muted">{Math.round(file.size / 1024 / 1024 * 10) / 10} MB</p>
                            <p className="small-muted">{addDays(wizardStartDate, index)} · {wizardPublishTime}</p>
                          </div>
                        </article>
                      )) : (
                        <p className="muted">No local files selected yet.</p>
                      )}
                    </div>
                  </>
                )}
                <div className="confirm-actions">
                  <button type="button" className="secondary" onClick={resetWizard}>
                    Cancel
                  </button>
                  <button type="button" onClick={startWizardMetadataStep}>
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="wizard-pane">
                <div className="section-title-row compact">
                  <h3>Content Builder</h3>
                  <span className="count-pill">{wizardRows.length} rows</span>
                </div>
                <div className="wizard-metadata-list">
                  {wizardRows.map((row, index) => (
                    <article key={row.externalId} className="wizard-metadata-card">
                      <div className="section-title-row compact">
                        <div>
                          <strong>{row.devotionDate}</strong>
                          <p className="small-muted">{row.externalId}</p>
                          <p className="small-muted">{row.sourceKind === "local" ? "Local file source" : "Scheduled row"}</p>
                        </div>
                        <span className="small-muted">Publishes {row.publishedAt}</span>
                      </div>

                      <div className="two-col">
                        <label>
                          External ID
                          <input
                            value={row.externalId}
                            onChange={event => updateWizardRow(index, { externalId: event.target.value })}
                          />
                        </label>
                        <label>
                          Publish At
                          <input
                            type="datetime-local"
                            value={row.publishedAt}
                            onChange={event => updateWizardRow(index, { publishedAt: event.target.value })}
                          />
                        </label>
                      </div>

                      <label>
                        Title
                        <input
                          value={row.title}
                          onChange={event => updateWizardRow(index, { title: event.target.value })}
                          placeholder="Walking In Obedience"
                        />
                      </label>

                      <label>
                        Excerpt
                        <textarea
                          rows={2}
                          value={row.excerpt}
                          onChange={event => updateWizardRow(index, { excerpt: event.target.value })}
                          placeholder="Short summary shown in the app cards"
                        />
                      </label>

                      <div className="two-col">
                        <label>
                          Cover Image URL
                          <input
                            value={row.imageUrl}
                            onChange={event => updateWizardRow(index, { imageUrl: event.target.value, localImageFile: null })}
                            placeholder="/uploads/media/image.png or https://..."
                          />
                        </label>
                        <label>
                          Upload Cover Image
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={async event => {
                              await uploadWizardImage(index, event.target.files?.[0] || null);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      <label>
                        Body
                        <textarea
                          rows={6}
                          value={row.body}
                          onChange={event => updateWizardRow(index, { body: event.target.value })}
                          placeholder="Full devotion content"
                        />
                      </label>
                    </article>
                  ))}
                </div>
                <div className="confirm-actions">
                  <button type="button" className="secondary" onClick={() => setWizardStep(1)}>
                    Back
                  </button>
                  <button type="button" onClick={previewWizardImport} disabled={saving}>
                    Preview Batch
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="wizard-pane">
                <div className="section-title-row compact">
                  <h3>Import Preview</h3>
                  <span className="count-pill">{wizardRows.length} rows</span>
                </div>
                {wizardPreview ? (
                  <div className="import-preview-card">
                    <div className="stats-grid compact">
                      <article className="stat-card">
                        <span>Create</span>
                        <strong>{wizardPreview.creates}</strong>
                      </article>
                      <article className="stat-card">
                        <span>Update</span>
                        <strong>{wizardPreview.updates}</strong>
                      </article>
                      <article className="stat-card">
                        <span>Reject</span>
                        <strong>{wizardPreview.rejected}</strong>
                      </article>
                    </div>
                    <div className="preview-list">
                      {wizardPreview.rows.map(row => (
                        <article key={`${row.rowNumber}-${row.externalId}`} className="preview-row">
                          <div>
                            <strong>{row.title || "Untitled devotion"}</strong>
                            <p className="small-muted">{row.externalId}</p>
                            {row.publishedAt ? <p className="small-muted">Publishes {row.publishedAt}</p> : null}
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
                ) : (
                  <p className="muted">Preview not ready yet.</p>
                )}
                <div className="confirm-actions">
                  <button type="button" className="secondary" onClick={() => setWizardStep(2)}>
                    Back
                  </button>
                  <button type="button" onClick={applyWizardImport} disabled={saving || !wizardPreview}>
                    Apply Import
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
