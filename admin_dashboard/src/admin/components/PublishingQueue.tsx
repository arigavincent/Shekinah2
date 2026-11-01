import { DateField, TimeField, PublicationTiming } from "./DateTimeFields";
import { useEffect, useState } from "react";
import { getUser } from "../auth/session";
import { listSermonCategories, type SermonCategory } from "../api/adminSermonsApi";
import {
  cancelJob,
  jobs,
  nairobiNow,
  pauseJob,
  recoverJobs,
  releaseISO,
  saveJob,
  startJob,
  updateJob,
  type UploadJob,
} from "../publishing/queue";
import { AccessPrice } from "./AccessPrice";
import { TierEditor } from "./EventAccessEditor";
import {
  RegistrationFields,
  emptyRegistration,
  type RegistrationSetup,
} from "./RegistrationFields";
export function localRelease(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Date(d.getTime() + 10800000).toISOString().slice(0, 16)
    : value;
}
function CoverPreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img className="cover-preview" src={url} alt="Selected cover" /> : null;
}
export function PublishingQueue({
  section,
  onCompleted,
}: {
  section: "sermons" | "book" | "event";
  onCompleted?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [uploadMode, setUploadMode] = useState<"single" | "batch">("single"),
    [items, setItems] = useState<UploadJob[]>([]),
    [error, setError] = useState(""),
    [savingEdits, setSavingEdits] = useState(0),
    [categories, setCategories] = useState<SermonCategory[]>([]),
    [eventCount, setEventCount] = useState(1);
  const [kind, setKind] = useState<UploadJob["kind"]>(section === "sermons" ? "video" : section),
    [speaker, setSpeaker] = useState("Shekinah Sons Global"),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState(""),
    [materialKind, setMaterialKind] = useState("book"),
    [serviceDate, setDate] = useState(nairobiNow().slice(0, 10)),
    [release, setRelease] = useState(nairobiNow()),
    [publishNow, setPublishNow] = useState(true),
    [spacing, setSpacing] = useState(0),
    [price, setPrice] = useState(0),
    [location, setLocation] = useState(""),
    [eventTime, setTime] = useState("10:00"),
    [published, setPublished] = useState(true),
    [notify, setNotify] = useState(false),
    [registration, setRegistration] = useState<RegistrationSetup>({ ...emptyRegistration });
  useEffect(() => {
    let active = true,
      lastComplete: string | null = null;
    async function load() {
      const owner = getUser()?.id;
      const list = (await jobs()).filter(
        (j) =>
          j.account === owner &&
          (section === "sermons" ? ["audio", "video"].includes(j.kind) : j.kind === section),
      );
      if (!active) return;
      setItems(list);
      const complete = list
        .filter((j) => j.state === "Complete")
        .map((j) => j.id)
        .join();
      if (lastComplete !== null && complete !== lastComplete) onCompleted?.();
      lastComplete = complete;
    }
    void recoverJobs()
      .then(load)
      .catch((e) => setError(String(e)));
    if (section === "sermons")
      void listSermonCategories()
        .then((r) => {
          if (active) setCategories(r.categories || []);
        })
        .catch((e) => setError(String(e)));
    const timer = setInterval(() => void load().catch((e) => setError(String(e))), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [section, onCompleted]);
  async function reload() {
    const owner = getUser()?.id;
    setItems(
      (await jobs()).filter(
        (j) =>
          j.account === owner &&
          (section === "sermons" ? ["audio", "video"].includes(j.kind) : j.kind === section),
      ),
    );
  }
  async function edit(j: UploadJob, fields: Partial<UploadJob>) {
    setSavingEdits((n) => n + 1);
    setItems((list) => list.map((x) => (x.id === j.id ? { ...x, ...fields } : x)));
    try {
      await updateJob(j.id, fields);
    } catch (e) {
      setError(String(e));
      await reload();
    } finally {
      setSavingEdits((n) => n - 1);
    }
  }
  async function add(files: (File | null)[]) {
    try {
      const account = getUser()?.id;
      if (!account) throw Error("Sign in first");
      if (files.length > 100 || files.length < 1) throw Error("Choose 1–100 files");
      if (uploadMode === "single" && files.length !== 1)
        throw Error("Select one file, or switch to Batch upload");
      if (spacing < 0 || spacing > 365 || !Number.isInteger(spacing))
        throw Error("Use 0–365 days between releases");
      const first = publishNow ? new Date() : new Date(releaseISO(release)),
        existing = await jobs();
      const additions: UploadJob[] = [];
      const queuedAt = Math.max(Date.now(), ...existing.map((j) => j.queuedAt || 0)) + 1;
      for (let i = 0; i < files.length; i++) {
        const file = files[i],
          fingerprint = file ? `${file.name}:${file.size}:${file.lastModified}:${serviceDate}` : "";
        if (
          file &&
          [...existing, ...additions].some(
            (j) =>
              j.account === account && j.fingerprint === fingerprint && j.state !== "Cancelled",
          )
        )
          throw Error(`${file.name} is already queued`);
        additions.push({
          queuedAt: queuedAt + i,
          id: crypto.randomUUID(),
          coverId: crypto.randomUUID(),
          fingerprint,
          account,
          kind,
          file,
          cover: null,
          materialKind,
          publishNow,
          title:
            file?.name.replace(/\.[^.]+$/, "").replaceAll("_", " ") ||
            (files.length === 1 ? "New event" : `New event ${i + 1}`),
          speaker,
          description,
          category: section === "sermons" ? category || categories[0]?.id || "" : category,
          serviceDate,
          publishAt: new Date(
            first.getTime() + (uploadMode === "batch" && !publishNow ? i * spacing : 0) * 86400000,
          ).toISOString(),
          isPublished: published,
          notify,
          price,
          location,
          eventTime,
          registration: section === "event" ? { ...registration, price } : undefined,
          state: "Draft",
          progress: 0,
          error: "",
        });
      }
      for (const j of additions) await saveJob(j);
      setError("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function start() {
    try {
      const pending = (await jobs()).filter(
        (j) =>
          j.account === getUser()?.id &&
          j.state === "Draft" &&
          (section === "sermons" ? ["audio", "video"].includes(j.kind) : j.kind === section),
      );
      for (const j of pending) {
        if (!j.title.trim()) throw Error("Every item needs a title");
        if (j.kind !== "book" && !j.description.trim())
          throw Error("Add a description to each sermon or event");
        if (j.kind === "event" && (!j.location || !j.eventTime))
          throw Error("Add event location and time");
        if (!Number.isInteger(j.price) || j.price < 0 || j.price > 1000000)
          throw Error("Use a whole-shilling price between 0 and 1,000,000");
        releaseISO(j.publishAt);
      }
      for (const j of pending) await startJob(j);
      await reload();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const categoryField = (value: string, change: (v: string) => void) =>
    section === "sermons" ? (
      <label>
        Category
        <select value={value || categories[0]?.id || ""} onChange={(e) => change(e.target.value)}>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    ) : (
      <label>
        Category
        <input
          value={value}
          onChange={(e) => change(e.target.value)}
          placeholder="e.g. Bible study"
        />
      </label>
    );
  return (
    <section className="list-card publishing-workbench" aria-label="Publishing">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Publishing</p>
          <h2>
            {section === "book"
              ? "Upload books & materials"
              : section === "event"
                ? "Create events"
                : "Upload sermons"}
          </h2>
        </div>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Close publisher" : "New upload"}
        </button>
      </div>
      <p className="muted">
        {section === "book"
          ? "Free and paid PDFs, protected in the member library."
          : section === "event"
            ? "Custom registration, free or paid tickets, and scheduled releases."
            : "Audio and video sermons, with historical dates and scheduled releases."}
      </p>
      {items.some((j) => !["Complete", "Cancelled"].includes(j.state)) && !open && (
        <p role="status">
          {items.filter((j) => !["Complete", "Cancelled"].includes(j.state)).length} items in your
          queue · open to review or resume.
        </p>
      )}
      {open && (
        <>
          <div className="segmented-control" aria-label="Upload mode">
            <button aria-pressed={uploadMode === "single"} onClick={() => setUploadMode("single")}>
              Single upload
            </button>
            <button aria-pressed={uploadMode === "batch"} onClick={() => setUploadMode("batch")}>
              Batch upload
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
          <p className="small-muted">
            {uploadMode === "single"
              ? "Set the details, choose one file, then review and publish."
              : "Set shared defaults, select up to 100 files, then adjust each item before publishing."}{" "}
            Dates and times use Africa/Nairobi.
          </p>
          <div className="editor-card">
            <div className="two-col">
              {section === "sermons" && (
                <label>
                  Media type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as UploadJob["kind"])}
                  >
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </label>
              )}
              {section !== "event" && (
                <label>
                  Author / speaker
                  <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
                </label>
              )}
              {section !== "event" && categoryField(category, setCategory)}
              {section === "book" && (
                <label>
                  Material type
                  <select value={materialKind} onChange={(e) => setMaterialKind(e.target.value)}>
                    {["book", "journal", "devotional", "study", "magazine"].map((k) => (
                      <option key={k} value={k}>
                        {k[0].toUpperCase() + k.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {section !== "book" && (
                <DateField
                  label={section === "event" ? "Event date" : "Service date (past dates allowed)"}
                  value={serviceDate}
                  onChange={setDate}
                />
              )}
              <PublicationTiming
                publishNow={publishNow}
                onMode={setPublishNow}
                value={release}
                onChange={setRelease}
              />
              {uploadMode === "batch" && !publishNow && (
                <label>
                  Days between releases
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={spacing}
                    onChange={(e) => setSpacing(Number(e.target.value))}
                  />
                  <small>0: same time · 1: daily · 7: weekly</small>
                </label>
              )}
              {section === "event" && (
                <>
                  <label>
                    Location
                    <input value={location} onChange={(e) => setLocation(e.target.value)} />
                  </label>
                  <TimeField label="Event time" value={eventTime} onChange={setTime} />
                </>
              )}
            </div>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </label>
            {section !== "sermons" && <AccessPrice label="Free or paid?" price={price} onChange={setPrice} />}
            {section === "event" && price > 0 && (
              <TierEditor tiers={registration.tiers || []} onChange={(tiers) => setRegistration({ ...registration, tiers })} />
            )}
            {section === "event" && (
              <RegistrationFields value={registration} onChange={setRegistration} />
            )}
            <div className="two-col">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Publish at release time (off saves a draft)
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                />
                Notify members (leave off for backlog)
              </label>
            </div>
            <label className="upload-drop">
              {section === "book"
                ? "Choose PDF materials"
                : section === "event"
                  ? "Choose event posters (optional)"
                  : "Choose media"}
              <input
                type="file"
                multiple={uploadMode === "batch"}
                accept={
                  section === "book"
                    ? "application/pdf"
                    : section === "event"
                      ? "image/jpeg,image/png,image/webp"
                      : kind === "audio"
                        ? "audio/*"
                        : "video/*"
                }
                onChange={(e) => {
                  if (e.target.files?.length) void add(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />
            </label>
            {section === "book" && (
              <p className="small-muted">
                The first page becomes the cover automatically. Add a cover in the review to
                override it. PDFs remain encrypted; only the cover image is public.
              </p>
            )}
            {section === "event" && (
              <div className="row-actions">
                {uploadMode === "batch" && (
                  <label>
                    Number of events
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={eventCount}
                      onChange={(e) => setEventCount(Number(e.target.value))}
                    />
                  </label>
                )}
                <button
                  className="secondary"
                  onClick={() => {
                    const n = uploadMode === "single" ? 1 : eventCount;
                    if (Number.isInteger(n) && n >= 1 && n <= 100)
                      void add(Array.from({ length: n }, () => null));
                    else setError("Choose 1–100 events");
                  }}
                >
                  Add {uploadMode === "single" ? "event" : "events"} without posters
                </button>
              </div>
            )}
          </div>
          <h3>Review & upload</h3>
          <p className="small-muted">
            Your queue is saved in this browser. Leave it open to upload; reopen to resume after an
            interruption. Once uploaded, scheduled publication runs on the server.
          </p>
          {items.some((j) => j.state === "Draft") && (
            <button disabled={savingEdits > 0} onClick={() => void start()}>
              {items.filter((j) => j.state === "Draft").every((j) => j.publishNow)
                ? "Upload & publish now"
                : items.filter((j) => j.state === "Draft").every((j) => !j.publishNow)
                  ? "Upload & schedule"
                  : "Upload reviewed items"}
              {" · "}
              {items.filter((j) => j.state === "Draft").length === 1 ? "upload" : "uploads"}
            </button>
          )}
          {items
            .filter((j) => j.state !== "Cancelled")
            .map((j) => (
              <article className="queue-item" key={j.id}>
                <details open={j.state === "Draft"}>
                  <summary>
                    <strong>{j.title}</strong>
                    <span className="status-chip">{j.state}</span>
                    <span>{Math.round(j.progress * 100)}%</span>
                  </summary>
                  <progress value={j.progress} max="1" aria-label={`${j.title} upload progress`} />
                  <p className="small-muted">
                    {j.publishNow
                      ? "Publishes when upload finishes"
                      : `Release ${localRelease(j.publishAt).replace("T", " ")} · Nairobi`}
                  </p>
                  {j.error && <p role="alert">{j.error}</p>}
                  {["Draft", "Failed", "Paused"].includes(j.state) && (
                    <>
                      <div className="two-col">
                        <label>
                          Title
                          <input
                            value={j.title}
                            maxLength={160}
                            onChange={(e) => void edit(j, { title: e.target.value })}
                          />
                        </label>
                        {j.kind !== "event" && (
                          <label>
                            Author / speaker
                            <input
                              value={j.speaker}
                              onChange={(e) => void edit(j, { speaker: e.target.value })}
                            />
                          </label>
                        )}
                        {j.kind !== "event" &&
                          categoryField(j.category, (value) => void edit(j, { category: value }))}
                        {j.kind !== "book" && (
                          <DateField
                            label="Service / event date"
                            value={j.serviceDate}
                            onChange={(v) => void edit(j, { serviceDate: v })}
                          />
                        )}
                        <PublicationTiming
                          publishNow={j.publishNow ?? false}
                          onMode={(v) => void edit(j, { publishNow: v })}
                          value={j.publishAt}
                          onChange={(v) => void edit(j, { publishAt: releaseISO(v) })}
                        />
                        {j.kind === "event" && (
                          <>
                            <label>
                              Location
                              <input
                                value={j.location}
                                onChange={(e) => void edit(j, { location: e.target.value })}
                              />
                            </label>
                            <TimeField
                              label="Event time"
                              value={j.eventTime}
                              onChange={(v) => void edit(j, { eventTime: v })}
                            />
                          </>
                        )}
                      </div>
                      <label>
                        Description
                        <textarea
                          value={j.description}
                          onChange={(e) => void edit(j, { description: e.target.value })}
                        />
                      </label>
                      {j.kind !== "event" && (
                        <>
                          <label>
                            Cover override (optional)
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) =>
                                void edit(j, {
                                  cover: e.target.files?.[0] || null,
                                  coverId: crypto.randomUUID(),
                                })
                              }
                            />
                          </label>
                          <CoverPreview file={j.cover} />
                          {j.cover && (
                            <button
                              className="secondary compact"
                              onClick={() =>
                                void edit(j, { cover: null, coverId: crypto.randomUUID() })
                              }
                            >
                              Remove override
                            </button>
                          )}
                        </>
                      )}
                      {["book", "event"].includes(j.kind) && (
                        <AccessPrice
                          price={j.price}
                          onChange={(price) =>
                            void edit(j, {
                              price,
                              registration: j.registration
                                ? { ...j.registration, price }
                                : undefined,
                            })
                          }
                        />
                      )}
                      {j.kind === "event" && (
                        <RegistrationFields
                          value={{ ...emptyRegistration, ...j.registration } as RegistrationSetup}
                          onChange={(value) =>
                            void edit(j, { registration: { ...value, price: j.price } })
                          }
                        />
                      )}
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={j.isPublished}
                          onChange={(e) => void edit(j, { isPublished: e.target.checked })}
                        />
                        Publish at release
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={j.notify}
                          onChange={(e) => void edit(j, { notify: e.target.checked })}
                        />
                        Notify members
                      </label>
                    </>
                  )}
                </details>
                <div className="row-actions">
                  {["Queued", "Uploading", "Publishing"].includes(j.state) && (
                    <button className="secondary" onClick={() => void pauseJob(j.id)}>
                      Pause
                    </button>
                  )}
                  {["Paused", "Failed"].includes(j.state) && (
                    <button disabled={savingEdits > 0} onClick={() => void startJob(j)}>
                      Resume / retry
                    </button>
                  )}
                  {j.state !== "Complete" && (
                    <button className="secondary" onClick={() => void cancelJob(j)}>
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            ))}
        </>
      )}
    </section>
  );
}
