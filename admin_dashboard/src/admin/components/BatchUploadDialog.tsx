import { useEffect, useMemo, useRef, useState } from "react";

import { uploadMedia, type MediaKind } from "../api/adminMediaApi";
import {
  getPublishVisibility,
  nextSundayMorningValue,
  publishNowValue,
  tomorrowMorningValue
} from "../lib/publish";

export type BatchFieldType = "text" | "textarea" | "select" | "datetime";

export type BatchField = {
  key: string;
  label: string;
  type: BatchFieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  default?: string;
  rows?: number;
  fullWidth?: boolean;
};

export type BatchSubmitContext = {
  file: File | null;
  values: Record<string, string>;
  publishAt: string;
  /** Resolved media reference returned by uploadMedia (path or URL). Empty when no file. */
  mediaUrl: string;
  /** Resolved size from the uploaded media. */
  mediaSizeBytes: number;
};

export type BatchUploadDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** localStorage key to remember mode preference */
  storageKey: string;
  /** file input accept attribute. Can depend on values via acceptFor. */
  accept?: string;
  acceptFor?: (values: Record<string, string>) => string;
  /** If provided, the matching MediaKind is uploaded via uploadMedia before submit. */
  mediaKind?: MediaKind | ((values: Record<string, string>) => MediaKind);
  /** If true, file is required for each item. Defaults to true. */
  fileRequired?: boolean;
  fileLabel?: string;
  /** Field schema rendered above the file picker. */
  fields: BatchField[];
  /** Submit a single item using existing per-section endpoints. */
  submitOne: (ctx: BatchSubmitContext) => Promise<void>;
  /** Called after at least one item succeeds so the parent list can refresh. */
  onCompleted: () => void | Promise<void>;
};

type QueueItem = {
  id: string;
  file: File | null;
  values: Record<string, string>;
  publishAt: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number; // 0-100, -1 unknown
  error?: string;
};

type Mode = "queue" | "wizard";

const uid = () => Math.random().toString(36).slice(2, 10);

function defaultPublishAt() {
  return publishNowValue();
}

function buildDefaults(fields: BatchField[]) {
  const out: Record<string, string> = {};
  for (const f of fields) {
    out[f.key] =
      f.default ??
      (f.type === "select" ? f.options?.[0]?.value ?? "" : "");
  }
  return out;
}

export function BatchUploadDialog(props: BatchUploadDialogProps) {
  const {
    open,
    onClose,
    title,
    subtitle,
    storageKey,
    accept,
    acceptFor,
    mediaKind,
    fileRequired = true,
    fileLabel = "Media file",
    fields,
    submitOne,
    onCompleted
  } = props;

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "queue";
    return (localStorage.getItem(storageKey) as Mode) || "queue";
  });

  const [items, setItems] = useState<QueueItem[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() => buildDefaults(fields));
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPublishAt, setDraftPublishAt] = useState<string>(defaultPublishAt);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const completedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, mode);
  }, [mode, storageKey]);

  useEffect(() => {
    if (!open) {
      // reset when closing
      setItems([]);
      setDraftValues(buildDefaults(fields));
      setDraftFile(null);
      setDraftPublishAt(defaultPublishAt());
      setError("");
      setSavedCount(0);
      if (completedRef.current) {
        completedRef.current = false;
        void Promise.resolve(onCompleted());
      }
    }
  }, [open, fields, onCompleted]);

  const resolvedAccept = useMemo(
    () => (acceptFor ? acceptFor(draftValues) : accept) || undefined,
    [accept, acceptFor, draftValues]
  );

  function validateDraft(): string {
    if (fileRequired && !draftFile) return `${fileLabel} is required.`;
    for (const f of fields) {
      if (f.required && !(draftValues[f.key] || "").trim()) {
        return `${f.label} is required.`;
      }
    }
    if (!draftPublishAt) return "Publish date is required.";
    return "";
  }

  function resetDraft() {
    setDraftValues(buildDefaults(fields));
    setDraftFile(null);
    setDraftPublishAt(defaultPublishAt());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addToQueue() {
    const v = validateDraft();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setItems(current => [
      ...current,
      {
        id: uid(),
        file: draftFile,
        values: { ...draftValues },
        publishAt: draftPublishAt,
        status: "pending",
        progress: 0
      }
    ]);
    resetDraft();
  }

  function removeQueueItem(id: string) {
    setItems(current => current.filter(i => i.id !== id));
  }

  async function uploadOne(item: QueueItem, onProgress?: (percent: number) => void) {
    let mediaUrl = "";
    let mediaSizeBytes = 0;

    if (item.file) {
      const kind: MediaKind =
        typeof mediaKind === "function"
          ? mediaKind(item.values)
          : (mediaKind ?? "document");
      const response = await uploadMedia(kind, item.file, p => {
        if (onProgress) onProgress(p.percent);
      });
      mediaUrl = response.media.path || response.media.url;
      mediaSizeBytes = response.media.size || item.file.size || 0;
    } else if (onProgress) {
      onProgress(100);
    }

    await submitOne({
      file: item.file,
      values: item.values,
      publishAt: item.publishAt,
      mediaUrl,
      mediaSizeBytes
    });
  }

  function setItemProgress(id: string, percent: number) {
    setItems(current => current.map(i => (i.id === id ? { ...i, progress: percent } : i)));
  }

  async function runQueue() {
    if (!items.length) {
      setError("Add at least one item before uploading.");
      return;
    }
    setError("");
    setRunning(true);
    try {
      for (const item of items) {
        if (item.status === "done") continue;
        setItems(current =>
          current.map(i => (i.id === item.id ? { ...i, status: "uploading", progress: 0, error: undefined } : i))
        );
        try {
          await uploadOne(item, p => setItemProgress(item.id, p));
          completedRef.current = true;
          setItems(current => current.map(i => (i.id === item.id ? { ...i, status: "done", progress: 100 } : i)));
        } catch (err) {
          setItems(current =>
            current.map(i =>
              i.id === item.id
                ? { ...i, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
                : i
            )
          );
        }
      }
    } finally {
      setRunning(false);
      if (completedRef.current) {
        completedRef.current = false;
        await onCompleted();
      }
    }
  }

  async function retry(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setItems(current =>
      current.map(i => (i.id === id ? { ...i, status: "uploading", progress: 0, error: undefined } : i))
    );
    try {
      await uploadOne(item, p => setItemProgress(id, p));
      completedRef.current = true;
      setItems(current => current.map(i => (i.id === id ? { ...i, status: "done", progress: 100 } : i)));
    } catch (err) {
      setItems(current =>
        current.map(i =>
          i.id === id ? { ...i, status: "error", error: err instanceof Error ? err.message : "Upload failed" } : i
        )
      );
    }
  }

  // Wizard mode visible progress for the in-flight item
  const [wizardProgress, setWizardProgress] = useState(0);

  async function saveAndNext() {
    const v = validateDraft();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setRunning(true);
    setWizardProgress(0);
    try {
      await uploadOne(
        {
          id: uid(),
          file: draftFile,
          values: { ...draftValues },
          publishAt: draftPublishAt,
          status: "pending",
          progress: 0
        },
        p => setWizardProgress(p < 0 ? 0 : p)
      );
      completedRef.current = true;
      setSavedCount(c => c + 1);
      resetDraft();
      setWizardProgress(0);
      completedRef.current = false;
      await onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  const pendingCount = items.filter(i => i.status !== "done").length;
  const doneCount = items.filter(i => i.status === "done").length;
  const publishVisibility = getPublishVisibility(draftPublishAt);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="wizard-dialog batch-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-upload-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Batch Upload</p>
            <h2 id="batch-upload-title">{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="secondary compact" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="batch-mode-toggle" role="tablist" aria-label="Batch upload mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "queue"}
            className={mode === "queue" ? "active" : ""}
            onClick={() => setMode("queue")}
          >
            Queue
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "wizard"}
            className={mode === "wizard" ? "active" : ""}
            onClick={() => setMode("wizard")}
          >
            Save &amp; add another
          </button>
        </div>

        {error ? <p className="batch-error">{error}</p> : null}

        <div className="batch-grid">
          <div className="batch-form-pane">
            <h3 className="batch-form-title">
              {mode === "queue" ? "Add an item" : `Item ${savedCount + 1}`}
            </h3>

            <label className="batch-field">
              <span>{fileLabel}{fileRequired ? " *" : ""}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept={resolvedAccept}
                onChange={event => setDraftFile(event.target.files?.[0] || null)}
              />
              {draftFile ? (
                <span className="batch-file-meta">
                  {draftFile.name} · {(draftFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              ) : null}
            </label>

            <div className="batch-fields">
              {fields.map(f => {
                const value = draftValues[f.key] ?? "";
                const onChange = (next: string) =>
                  setDraftValues(current => ({ ...current, [f.key]: next }));
                return (
                  <label
                    key={f.key}
                    className={`batch-field ${f.fullWidth || f.type === "textarea" ? "full" : ""}`}
                  >
                    <span>
                      {f.label}
                      {f.required ? " *" : ""}
                    </span>
                    {f.type === "textarea" ? (
                      <textarea
                        rows={f.rows ?? 3}
                        value={value}
                        placeholder={f.placeholder}
                        onChange={e => onChange(e.target.value)}
                      />
                    ) : f.type === "select" ? (
                      <select value={value} onChange={e => onChange(e.target.value)}>
                        {(f.options || []).map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        placeholder={f.placeholder}
                        onChange={e => onChange(e.target.value)}
                      />
                    )}
                  </label>
                );
              })}

              <label className="batch-field full">
                <span>Publish on *</span>
                <input
                  type="datetime-local"
                  value={draftPublishAt}
                  onChange={e => setDraftPublishAt(e.target.value)}
                />
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() => setDraftPublishAt(publishNowValue())}
                    disabled={running}
                  >
                    Publish now
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() => setDraftPublishAt(tomorrowMorningValue())}
                    disabled={running}
                  >
                    Tomorrow 5 AM UTC
                  </button>
                  <button
                    type="button"
                    className="secondary compact"
                    onClick={() => setDraftPublishAt(nextSundayMorningValue())}
                    disabled={running}
                  >
                    Next Sunday 8 AM UTC
                  </button>
                </div>
                <span className={`status-chip ${publishVisibility.tone}`}>
                  {publishVisibility.label}
                </span>
                <span className="batch-file-meta">
                  Content appears in the mobile app only when this UTC time is reached.
                </span>
              </label>
            </div>

            <div className="confirm-actions">
              {mode === "queue" ? (
                <>
                  <button type="button" className="secondary" onClick={resetDraft} disabled={running}>
                    Clear form
                  </button>
                  <button type="button" onClick={addToQueue} disabled={running}>
                    Add to queue
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="secondary" onClick={onClose} disabled={running}>
                    Finish
                  </button>
                  <button type="button" onClick={saveAndNext} disabled={running}>
                    {running ? "Saving..." : "Save & add another"}
                  </button>
                </>
              )}
            </div>
          </div>

          {mode === "queue" ? (
            <div className="batch-queue-pane">
              <div className="section-title-row compact">
                <h3>Queue</h3>
                <span className="count-pill">
                  {doneCount}/{items.length} uploaded
                </span>
              </div>

              {items.length === 0 ? (
                <p className="muted">No items yet. Fill the form on the left and click "Add to queue".</p>
              ) : (
                <ul className="batch-queue-list">
                  {items.map((it, idx) => {
                    const titleVal =
                      it.values.title || it.values.name || it.file?.name || `Item ${idx + 1}`;
                    return (
                      <li key={it.id} className={`batch-queue-row status-${it.status}`}>
                        <div className="batch-queue-main">
                          <strong>{titleVal}</strong>
                          <span className="batch-file-meta">
                            {it.file ? `${it.file.name} · ` : ""}
                            Publishes {new Date(it.publishAt).toLocaleString()}
                          </span>
                          {it.status === "uploading" || (it.status === "done" && it.progress > 0) ? (
                            <div className="batch-progress" aria-label={`Upload ${it.progress}%`}>
                              <div
                                className="batch-progress-bar"
                                style={{ width: `${Math.max(0, Math.min(100, it.progress))}%` }}
                              />
                              <span className="batch-progress-label">
                                {it.progress < 0 ? "Uploading…" : `${Math.round(it.progress)}%`}
                              </span>
                            </div>
                          ) : null}
                          {it.error ? <span className="batch-error inline">{it.error}</span> : null}
                        </div>
                        <div className="batch-queue-actions">
                          <span className={`status-chip ${
                            it.status === "done"
                              ? "success"
                              : it.status === "error"
                                ? "danger"
                                : it.status === "uploading"
                                  ? "warning"
                                  : "neutral"
                          }`}>
                            {it.status}
                          </span>
                          {it.status === "error" ? (
                            <button type="button" className="secondary compact" onClick={() => retry(it.id)}>
                              Retry
                            </button>
                          ) : null}
                          {it.status !== "uploading" && it.status !== "done" ? (
                            <button
                              type="button"
                              className="danger compact"
                              onClick={() => removeQueueItem(it.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="confirm-actions">
                <button type="button" className="secondary" onClick={onClose} disabled={running}>
                  {doneCount > 0 ? "Done" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={runQueue}
                  disabled={running || pendingCount === 0}
                >
                  {running ? "Uploading..." : `Upload ${pendingCount || "all"}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="batch-queue-pane">
              <div className="section-title-row compact">
                <h3>Session</h3>
                <span className="count-pill">{savedCount} saved</span>
              </div>
              <p className="muted">
                Each "Save &amp; add another" submits the form immediately, then resets it for the next item.
                Click Finish when you're done.
              </p>
              {running ? (
                <div className="batch-progress" aria-label={`Upload ${wizardProgress}%`}>
                  <div
                    className="batch-progress-bar"
                    style={{ width: `${Math.max(0, Math.min(100, wizardProgress))}%` }}
                  />
                  <span className="batch-progress-label">
                    Uploading… {Math.round(wizardProgress)}%
                  </span>
                </div>
              ) : null}
              {savedCount > 0 ? (
                <p className="batch-file-meta">
                  {savedCount} item{savedCount === 1 ? "" : "s"} uploaded this session.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
