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
import { BatchUploadDialog, type BatchField } from "../components/BatchUploadDialog";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { shekinahYoutubeCatalog, type ShekinahYoutubeCatalogItem } from "../data/shekinahYoutubeCatalog";
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

type WizardRow = {
  source: ShekinahYoutubeCatalogItem | null;
  sourceLabel: string;
  sourceKind: "youtube" | "local";
  localFile?: File | null;
  externalId: string;
  type: "video" | "audio";
  title: string;
  speaker: string;
  sermonDate: string;
  publishedAt: string;
  categoryId: string;
  isLive: boolean;
  thumbnailUrl: string;
  duration: string;
  description: string;
  mediaUrl: string;
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
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardSourceMode, setWizardSourceMode] = useState<"youtube" | "local">("youtube");
  const [wizardQuery, setWizardQuery] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<File[]>([]);
  const [wizardRows, setWizardRows] = useState<WizardRow[]>([]);
  const [wizardPreview, setWizardPreview] = useState<SermonImportPreview | null>(null);
  const [error, setError] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);

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

  const filteredCatalog = useMemo(() => {
    const q = wizardQuery.trim().toLowerCase();
    return shekinahYoutubeCatalog.filter(item =>
      !q ||
      [item.title, item.speaker, item.videoId]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [wizardQuery]);

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

  function defaultWizardRow(item: ShekinahYoutubeCatalogItem): WizardRow {
    return {
      source: item,
      sourceLabel: item.title,
      sourceKind: "youtube",
      externalId: `shekinah-yt-${item.videoId}`,
      localFile: null,
      type: "video",
      title: item.title,
      speaker: item.speaker,
      sermonDate: item.suggestedDate,
      publishedAt: item.suggestedPublishAt,
      categoryId: item.suggestedCategoryId,
      isLive: false,
      thumbnailUrl: item.thumbnailUrl,
      duration: item.duration,
      description: item.description,
      mediaUrl: item.mediaUrl
    };
  }

  function inferLocalMediaKind(file: File): "video" | "audio" {
    return file.type.startsWith("audio/") ? "audio" : "video";
  }

  function defaultLocalWizardRow(file: File, index: number): WizardRow {
    const normalizedBase = file.name.replace(/\.[^.]+$/, "").trim() || `local-file-${index + 1}`;
    const safeSlug = normalizedBase.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const type = inferLocalMediaKind(file);
    const defaultDate = "2026-06-15";
    return {
      source: null,
      sourceLabel: file.name,
      sourceKind: "local",
      localFile: file,
      externalId: `shekinah-local-${safeSlug || index + 1}`,
      type,
      title: normalizedBase,
      speaker: "Shekinah Sons Global",
      sermonDate: defaultDate,
      publishedAt: `${defaultDate}T06:00`,
      categoryId: "cat-1",
      isLive: false,
      thumbnailUrl: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900",
      duration: "",
      description: "Local sermon upload prepared through the batch import wizard.",
      mediaUrl: ""
    };
  }

  function resetWizard() {
    setWizardOpen(false);
    setWizardStep(1);
    setWizardSourceMode("youtube");
    setWizardQuery("");
    setSelectedVideoIds([]);
    setSelectedLocalFiles([]);
    setWizardRows([]);
    setWizardPreview(null);
  }

  function openWizard() {
    setError("");
    setWizardOpen(true);
    setWizardStep(1);
    setWizardSourceMode("youtube");
    setSelectedVideoIds([]);
    setSelectedLocalFiles([]);
    setWizardRows([]);
    setWizardPreview(null);
    setWizardQuery("");
  }

  function toggleVideoSelection(videoId: string) {
    setSelectedVideoIds(current =>
      current.includes(videoId)
        ? current.filter(item => item !== videoId)
        : [...current, videoId]
    );
  }

  function startWizardMetadataStep() {
    let selected: WizardRow[] = [];

    if (wizardSourceMode === "youtube") {
      if (!selectedVideoIds.length) {
        setError("Select at least one source video before continuing.");
        return;
      }

      selected = shekinahYoutubeCatalog
        .filter(item => selectedVideoIds.includes(item.videoId))
        .map(defaultWizardRow);
    } else {
      if (!selectedLocalFiles.length) {
        setError("Select at least one local audio or video file before continuing.");
        return;
      }

      selected = selectedLocalFiles.map(defaultLocalWizardRow);
    }

    setWizardRows(selected);
    setWizardPreview(null);
    setWizardStep(2);
  }

  function updateWizardRow(index: number, patch: Partial<WizardRow>) {
    setWizardRows(current =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
    setWizardPreview(null);
  }

  async function loadLocalSourceFiles(fileList: FileList | null) {
    if (!fileList) return;
    setSelectedLocalFiles(Array.from(fileList));
    setSelectedVideoIds([]);
    setWizardPreview(null);
  }

  async function ensureWizardAssetsUploaded() {
    const nextRows = [...wizardRows];

    for (let index = 0; index < nextRows.length; index += 1) {
      const row = nextRows[index];
      if (row.sourceKind !== "local" || !row.localFile || row.mediaUrl.trim()) {
        continue;
      }

      const uploadKind: MediaKind = row.type === "audio" ? "audio" : "video";
      const response = await uploadMedia(uploadKind, row.localFile);
      nextRows[index] = {
        ...row,
        mediaUrl: response.media.path || response.media.url
      };
    }

    setWizardRows(nextRows);
    return nextRows;
  }

  async function previewWizardImport() {
    if (!wizardRows.length) {
      setError("Add at least one configured sermon before previewing.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const uploadedRows = await ensureWizardAssetsUploaded();
      const csv = (() => {
        const currentRows = uploadedRows;
        const escapeCsv = (value: string) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
        const header = [
          "externalId",
          "type",
          "title",
          "speaker",
          "sermonDate",
          "publishedAt",
          "categoryId",
          "isLive",
          "thumbnailUrl",
          "duration",
          "description",
          "mediaUrl"
        ];

        const rows = currentRows.map(row =>
          [
            row.externalId,
            row.type,
            row.title,
            row.speaker,
            row.sermonDate,
            row.publishedAt,
            row.categoryId,
            row.isLive ? "true" : "false",
            row.thumbnailUrl,
            row.duration,
            row.description,
            row.mediaUrl
          ]
            .map(escapeCsv)
            .join(",")
        );
        return [header.join(","), ...rows].join("\n");
      })();
      const response = await previewSermonImport(csv);
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
      setError(err instanceof Error ? err.message : "Failed to preview import wizard batch");
    } finally {
      setSaving(false);
    }
  }

  async function applyWizardImport() {
    if (!wizardPreview) {
      setError("Preview the selected videos before applying the import.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const uploadedRows = await ensureWizardAssetsUploaded();
      const csv = (() => {
        const currentRows = uploadedRows;
        const escapeCsv = (value: string) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
        const header = [
          "externalId",
          "type",
          "title",
          "speaker",
          "sermonDate",
          "publishedAt",
          "categoryId",
          "isLive",
          "thumbnailUrl",
          "duration",
          "description",
          "mediaUrl"
        ];

        const rows = currentRows.map(row =>
          [
            row.externalId,
            row.type,
            row.title,
            row.speaker,
            row.sermonDate,
            row.publishedAt,
            row.categoryId,
            row.isLive ? "true" : "false",
            row.thumbnailUrl,
            row.duration,
            row.description,
            row.mediaUrl
          ]
            .map(escapeCsv)
            .join(",")
        );
        return [header.join(","), ...rows].join("\n");
      })();
      const response = await importSermons(csv);
      await load();
      showToast({
        title: "Wizard import applied",
        message: `${response.result.created.length} created, ${response.result.updated.length} updated, ${response.result.rejected.length} rejected.`,
        tone: response.result.rejected.length ? "info" : "success"
      });
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply wizard import");
    } finally {
      setSaving(false);
    }
  }

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

        <div className="row-actions">
          <button type="button" onClick={() => setBatchOpen(true)}>
            Batch Upload
          </button>
          <button className="secondary" onClick={load}>
            Refresh
          </button>
        </div>
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

      {wizardOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={resetWizard}>
          <section
            className="wizard-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sermon-import-wizard-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Batch Import Wizard</p>
                <h2 id="sermon-import-wizard-title">Sermon Ingestion</h2>
                <p className="muted">
                  Select source videos, enrich the metadata, then preview and apply the batch.
                </p>
              </div>
              <button type="button" className="secondary compact" onClick={resetWizard}>
                Close
              </button>
            </div>

            <div className="wizard-steps">
              <span className={`status-chip ${wizardStep === 1 ? "warning" : "neutral"}`}>1. Source</span>
              <span className={`status-chip ${wizardStep === 2 ? "warning" : wizardStep > 2 ? "success" : "neutral"}`}>2. Metadata</span>
              <span className={`status-chip ${wizardStep === 3 ? "warning" : "neutral"}`}>3. Preview</span>
            </div>

            {wizardStep === 1 ? (
              <div className="wizard-pane">
                <div className="section-title-row compact">
                  <h3>Source Catalog</h3>
                  <span className="count-pill">
                    {wizardSourceMode === "youtube" ? selectedVideoIds.length : selectedLocalFiles.length} selected
                  </span>
                </div>
                <div className="filters-row">
                  <button
                    type="button"
                    className={wizardSourceMode === "youtube" ? "" : "secondary"}
                    onClick={() => {
                      setWizardSourceMode("youtube");
                      setSelectedLocalFiles([]);
                    }}
                  >
                    Shekinah YouTube
                  </button>
                  <button
                    type="button"
                    className={wizardSourceMode === "local" ? "" : "secondary"}
                    onClick={() => {
                      setWizardSourceMode("local");
                      setSelectedVideoIds([]);
                    }}
                  >
                    Local Files
                  </button>
                </div>

                {wizardSourceMode === "youtube" ? (
                  <>
                    <p className="muted">
                      Source: Shekinah Sons Global YouTube channel catalog prepared for guided import.
                    </p>
                    <input
                      className="search"
                      value={wizardQuery}
                      onChange={event => setWizardQuery(event.target.value)}
                      placeholder="Search source videos..."
                    />
                    <div className="wizard-source-list">
                      {filteredCatalog.map(item => {
                        const selected = selectedVideoIds.includes(item.videoId);
                        return (
                          <label key={item.videoId} className={`wizard-source-card ${selected ? "selected" : ""}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleVideoSelection(item.videoId)}
                            />
                            <img src={item.thumbnailUrl} alt={item.title} />
                            <div>
                              <strong>{item.title}</strong>
                              <p className="small-muted">{item.speaker}</p>
                              <p className="small-muted">{item.duration} · {item.videoId}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Choose audio or video files from this machine or phone browser. They will be uploaded during preview.
                    </p>
                    <label>
                      Select Media Files
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/wav,audio/ogg"
                        multiple
                        onChange={async event => {
                          await loadLocalSourceFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <div className="wizard-source-list">
                      {selectedLocalFiles.length ? selectedLocalFiles.map(file => (
                        <article key={`${file.name}-${file.size}-${file.lastModified}`} className="wizard-source-card selected">
                          <div />
                          <div className="wizard-local-icon">{file.type.startsWith("audio/") ? "AUDIO" : "VIDEO"}</div>
                          <div>
                            <strong>{file.name}</strong>
                            <p className="small-muted">{Math.round(file.size / 1024 / 1024 * 10) / 10} MB</p>
                            <p className="small-muted">{file.type || "Unknown file type"}</p>
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
                  <h3>Metadata Builder</h3>
                  <span className="count-pill">{wizardRows.length} rows</span>
                </div>
                <div className="wizard-metadata-list">
                  {wizardRows.map((row, index) => (
                    <article key={row.externalId} className="wizard-metadata-card">
                      <div className="section-title-row compact">
                        <div>
                          <strong>{row.sourceLabel}</strong>
                          <p className="small-muted">
                            {row.sourceKind === "youtube"
                              ? `${row.source?.videoId || ""} · ${row.duration}`
                              : `${row.type.toUpperCase()} · ${row.duration || "duration optional"}`}
                          </p>
                        </div>
                        {row.mediaUrl ? (
                          <a href={row.mediaUrl} target="_blank" rel="noreferrer">
                            Open source
                          </a>
                        ) : row.localFile ? (
                          <span className="small-muted">Will upload on preview</span>
                        ) : null}
                      </div>
                      <div className="three-col">
                        <label>
                          External ID
                          <input
                            value={row.externalId}
                            onChange={event => updateWizardRow(index, { externalId: event.target.value })}
                          />
                        </label>
                        <label>
                          Category
                          <select
                            value={row.categoryId}
                            onChange={event => updateWizardRow(index, { categoryId: event.target.value })}
                          >
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Type
                          <select
                            value={row.type}
                            onChange={event => updateWizardRow(index, { type: event.target.value as "video" | "audio" })}
                          >
                            <option value="video">Video</option>
                            <option value="audio">Audio</option>
                          </select>
                        </label>
                      </div>
                      <div className="two-col">
                        <label>
                          Title
                          <input
                            value={row.title}
                            onChange={event => updateWizardRow(index, { title: event.target.value })}
                          />
                        </label>
                        <label>
                          Speaker
                          <input
                            value={row.speaker}
                            onChange={event => updateWizardRow(index, { speaker: event.target.value })}
                          />
                        </label>
                      </div>
                      <div className="two-col">
                        <label>
                          Sermon Date
                          <input
                            value={row.sermonDate}
                            onChange={event => updateWizardRow(index, { sermonDate: event.target.value })}
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
                        Description
                        <textarea
                          rows={3}
                          value={row.description}
                          onChange={event => updateWizardRow(index, { description: event.target.value })}
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
                            <strong>{row.title}</strong>
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

      <BatchUploadDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onCompleted={load}
        title="Sermons"
        subtitle="Add multiple sermons in one sitting. Each item uses the existing single-sermon create endpoint."
        storageKey="batch-mode:sermons"
        acceptFor={values =>
          values.type === "audio"
            ? "audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/wav,audio/ogg"
            : "video/mp4,video/webm,video/quicktime"
        }
        mediaKind={values => (values.type === "audio" ? "audio" : "video")}
        fileLabel="Sermon media file"
        fields={[
          {
            key: "type",
            label: "Type",
            type: "select",
            options: [
              { value: "video", label: "Video" },
              { value: "audio", label: "Audio" }
            ],
            default: "video"
          },
          {
            key: "categoryId",
            label: "Category",
            type: "select",
            options: categories.map(c => ({ value: c.id, label: c.name })),
            default: "cat-1"
          },
          { key: "title", label: "Title", type: "text", required: true, placeholder: "Sermon title" },
          { key: "speaker", label: "Speaker", type: "text", required: true, default: "Shekinah Sons Global" },
          { key: "sermonDate", label: "Sermon date", type: "datetime" },
          { key: "duration", label: "Duration", type: "text", placeholder: "e.g. 42:15" },
          {
            key: "thumbnailUrl",
            label: "Thumbnail URL (optional)",
            type: "text",
            placeholder: "https://...",
            fullWidth: true
          },
          {
            key: "description",
            label: "Description",
            type: "textarea",
            rows: 3,
            fullWidth: true
          }
        ]}
        submitOne={async ctx => {
          const v = ctx.values;
          await createSermon({
            externalId: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: (v.type as "video" | "audio") || "video",
            title: v.title.trim(),
            speaker: v.speaker.trim() || "Shekinah Sons Global",
            sermonDate: (v.sermonDate || ctx.publishAt).slice(0, 10),
            publishedAt: ctx.publishAt,
            categoryId: v.categoryId || "cat-1",
            isLive: false,
            thumbnailUrl:
              v.thumbnailUrl.trim() ||
              "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=900",
            duration: v.duration.trim(),
            description: v.description.trim(),
            mediaUrl: ctx.mediaUrl
          });
        }}
      />
    </main>
  );
}
