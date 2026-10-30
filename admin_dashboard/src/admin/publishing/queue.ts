import { API_BASE_URL } from "../api/client";
import { getToken, getUser } from "../auth/session";
export type UploadJob = {
  id: string;
  account: string;
  kind: "video" | "audio" | "book" | "event";
  file: File | null;
  cover: File | null;
  coverId: string;
  fingerprint: string;
  materialKind?: string;
  queuedAt?: number;
  title: string;
  speaker: string;
  description: string;
  category: string;
  serviceDate: string;
  publishAt: string;
  publishNow?: boolean;
  isPublished: boolean;
  notify: boolean;
  price: number;
  location: string;
  eventTime: string;
  registration?: Record<string, unknown>;
  state: string;
  progress: number;
  error: string;
};
let opened: Promise<IDBDatabase> | undefined;
function db() {
  return (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("shekinah-publishing", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("jobs", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function saveJob(j: UploadJob) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction("jobs", "readwrite");
    t.objectStore("jobs").put(j);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function jobs() {
  const d = await db();
  return new Promise<UploadJob[]>((resolve, reject) => {
    const r = d.transaction("jobs").objectStore("jobs").getAll();
    r.onsuccess = () =>
      resolve(
        (r.result as UploadJob[]).sort(
          (a, b) => (a.queuedAt || 0) - (b.queuedAt || 0) || a.id.localeCompare(b.id),
        ),
      );
    r.onerror = () => reject(r.error);
  });
}
async function current(id: string) {
  const j = (await jobs()).find((x) => x.id === id);
  if (!j) throw Error("Upload was removed");
  return j;
}
// Read and merge in one transaction so a title/cover edit cannot overwrite another edit.
export async function updateJob(id: string, fields: Partial<UploadJob>) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction("jobs", "readwrite"),
      store = t.objectStore("jobs"),
      r = store.get(id);
    r.onsuccess = () => {
      if (!r.result) {
        t.abort();
        return;
      }
      store.put({ ...r.result, ...fields });
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error || Error("Could not save upload changes"));
    t.onabort = () => reject(t.error || Error("Upload was removed"));
  });
}
const change = updateJob;
const controllers = new Map<string, AbortController>();
let running = false;
const waiting = new Set<string>();
let recovered = false;
export async function recoverJobs() {
  if (recovered) return;
  recovered = true;
  for (const j of await jobs())
    if (["Queued", "Uploading", "Publishing"].includes(j.state))
      await saveJob({ ...j, state: "Paused", error: "Upload recovered. Resume to continue." });
}
async function request(
  method: string,
  path: string,
  body?: BodyInit,
  signal?: AbortSignal,
  headers: Record<string, string> = {},
) {
  const r = await fetch(API_BASE_URL + "/api/v1" + path, {
    method,
    headers: { Authorization: `Bearer ${getToken()}`, ...headers },
    body,
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.message || `Request failed (${r.status})`);
  return data;
}
function json(method: string, path: string, body: unknown, signal?: AbortSignal) {
  return request(method, path, JSON.stringify(body), signal, {
    "Content-Type": "application/json",
  });
}
async function upload(
  j: UploadJob,
  file: File,
  id: string,
  kind: string,
  signal: AbortSignal,
  onProgress: (p: number) => Promise<void>,
) {
  const session = await json(
    "POST",
    "/uploads",
    { id, kind, fileName: file.name, sizeBytes: file.size },
    signal,
  );
  if (session.status === "ready") return session.publicUrl as string;
  let offset = Number(session.offset);
  while (offset < file.size) {
    if (getUser()?.id !== j.account) throw Error("Sign in as the publisher to continue");
    const next = Math.min(file.size, offset + 4 * 1024 * 1024);
    const result = await request("PATCH", `/uploads/${id}`, file.slice(offset, next), signal, {
      "Content-Type": "application/octet-stream",
      "Upload-Offset": String(offset),
    });
    offset = Number(result.offset);
    await onProgress(offset / file.size);
  }
  return (
    await request("POST", `/uploads/${id}/finish`, "{}", signal, {
      "Content-Type": "application/json",
    })
  ).publicUrl as string;
}
async function execute(j: UploadJob, signal: AbortSignal) {
  if (getUser()?.id !== j.account) throw Error("Sign in as the publisher to continue");
  await change(j.id, { state: "Uploading", error: "" });
  const media = j.file
    ? await upload(j, j.file, j.id, j.kind === "event" ? "image" : j.kind, signal, (p) =>
        change(j.id, { progress: p }),
      )
    : "";
  // A second stable UUID for the cover, persisted with the job's base identifier.
  const coverId = j.coverId;
  const cover = j.cover ? await upload(j, j.cover, coverId, "image", signal, async () => {}) : "";
  await change(j.id, { state: "Publishing" });
  const common = {
    title: j.title,
    description: j.description,
    publishedAt: j.publishNow ? new Date().toISOString() : j.publishAt,
    isPublished: j.isPublished,
    notifyOnPublish: j.notify,
  };
  if (j.kind === "book") {
    const form = new FormData();
    Object.entries({
      ...common,
      uploadedFile: j.id,
      author: j.speaker,
      category: j.category,
      kind: j.materialKind || "book",
      price: j.price,
      coverUrl: cover,
    }).forEach(([k, v]) => form.append(k, String(v)));
    await request("POST", "/library", form, signal);
  } else if (j.kind === "event") {
    await json(
      "POST",
      "/admin/events",
      {
        ...common,
        id: `evt-${j.id}`,
        eventDate: j.serviceDate,
        eventTime: j.eventTime,
        location: j.location,
        imageUrl: media,
        registrationSetup: j.registration,
      },
      signal,
    );
  } else
    await json(
      "POST",
      "/admin/sermons",
      {
        ...common,
        id: `ser-${j.id}`,
        externalId: `upload-${j.id}`,
        type: j.kind,
        speaker: j.speaker,
        sermonDate: j.serviceDate,
        categoryId: j.category,
        mediaUrl: media,
        thumbnailUrl: cover,
        source: "manual",
        status: "ready",
        isLive: false,
      },
      signal,
    );
  await change(j.id, { state: "Complete", progress: 1, error: "", file: null, cover: null });
}
async function pump() {
  if (running) return;
  running = true;
  try {
    for (const id of waiting) {
      waiting.delete(id);
      const controller = new AbortController();
      controllers.set(id, controller);
      try {
        await execute(await current(id), controller.signal);
      } catch (e) {
        const j = await current(id);
        if (!["Paused", "Cancelled"].includes(j.state))
          await change(id, {
            state: "Failed",
            error: e instanceof Error ? e.message : "Upload failed",
          });
      } finally {
        controllers.delete(id);
      }
    }
  } finally {
    running = false;
  }
}
export async function startJob(j: UploadJob) {
  const saved = await current(j.id);
  await updateJob(j.id, { state: "Queued", error: "", publishAt: releaseISO(saved.publishAt) });
  waiting.add(j.id);
  void pump();
}
export async function pauseJob(id: string) {
  waiting.delete(id);
  await change(id, { state: "Paused" });
  controllers.get(id)?.abort();
}
export async function cancelJob(j: UploadJob) {
  await pauseJob(j.id);
  await change(j.id, { state: "Cancelled", file: null, cover: null });
  await request("DELETE", `/uploads/${j.id}`).catch(() => {});
  if (j.cover) await request("DELETE", `/uploads/${j.coverId}`).catch(() => {});
}
export function nairobiNow() {
  return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16);
}
export function releaseISO(v: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v + ":00+03:00" : v;
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime())) throw Error("Use a valid release date and time");
  return d.toISOString();
}

// Uses the same owner-bound resumable image endpoint as publication jobs.
export async function uploadCoverImage(file: File) {
  const account = getUser()?.id;
  if (!account) throw Error("Sign in first");
  return upload(
    { account } as UploadJob,
    file,
    crypto.randomUUID(),
    "image",
    new AbortController().signal,
    async () => {},
  );
}
