import { apiRequest } from "../api/client";
import { getToken, getUser } from "../auth/session";

type Segment = { id: string; session: string; account: string; sequence: number; duration: number; sha256: string; bytes: Blob };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_PENDING = 64 * 1024 * 1024;
function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shekinah-live-segments", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("segments", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function queue<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openQueue();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("segments", mode), request = action(tx.objectStore("segments"));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || request.error || Error("Could not save recording"));
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function pending() { return queue<Segment[]>("readonly", (store) => store.getAll()); }
let localUpload: Promise<void> | null = null;
export async function resumeDirectUploads(onStatus: (message: string) => void = () => {}) {
  // One uploader per browser, including across tabs. A retry is idempotent.
  const run = async () => {
    const account = getUser()?.id;
    for (const item of (await pending()).filter((s) => s.account === account).sort((a, b) => a.session.localeCompare(b.session) || a.sequence - b.sequence)) {
      const data = await apiRequest<{ ready: boolean; url?: string; headers?: Record<string, string> }>(`/api/v1/live/direct/${item.session}/segments`, {
        method: "POST", token: getToken(), body: { sequence: item.sequence, size: item.bytes.size, duration: item.duration, sha256: item.sha256 },
      });
      if (!data.ready) {
        let uploadError: unknown;
        try {
          const response = await fetch(data.url!, { method: "PUT", headers: data.headers, body: item.bytes });
          if (!response.ok && response.status !== 412) uploadError = Error(`Recording upload interrupted (${response.status})`);
        } catch (e) { uploadError = e; }
        // A lost success response, or a browser hiding the retry's 412 CORS
        // response, must not strand an object that R2 already accepted.
        try {
          await apiRequest(`/api/v1/live/direct/${item.session}/segments/${item.sequence}/commit`, { method: "POST", token: getToken() });
        } catch (e) { throw uploadError || e; }
      }
      await queue("readwrite", (store) => store.delete(item.id));
      if (item.sequence >= 0) onStatus("Broadcast connected · recording saved");
    }
  };
  if (navigator.locks) await navigator.locks.request("shekinah-live-upload", run);
  else { if (!localUpload) localUpload = run().finally(() => { localUpload = null; }); await localUpload; }
}
// ISO-BMFF parsing only: no video conversion occurs on Render. MediaRecorder's
// initialization and complete moof/mdat chunks become native HLS objects.
type Box = { kind: string; start: number; body: number; end: number };
function boxes(b: Uint8Array, start = 0, end = b.length): Box[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), result: Box[] = [];
  for (let p = start; p < end;) {
    if (p + 8 > end) throw Error("Incomplete MP4 header");
    let size = v.getUint32(p), header = 8;
    if (size === 1) { if (p + 16 > end) throw Error("Incomplete MP4 size"); size = Number(v.getBigUint64(p + 8)); header = 16; }
    if (size === 0) size = end - p;
    if (size < header || p + size > end) throw Error("Incomplete MP4 fragment");
    result.push({ kind: String.fromCharCode(...b.subarray(p + 4, p + 8)), start: p, body: p + header, end: p + size }); p += size;
  }
  return result;
}
export class MP4Timing {
  private tracks = new Map<number, number>();
  private video = 0;
  init(b: Uint8Array) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const moov = boxes(b).find((x) => x.kind === "moov"); if (!moov) throw Error("Missing recording initialization");
    for (const trak of boxes(b, moov.body, moov.end).filter((x) => x.kind === "trak")) {
      const children = boxes(b, trak.body, trak.end), tkhd = children.find((x) => x.kind === "tkhd")!, mdia = children.find((x) => x.kind === "mdia")!;
      const md = boxes(b, mdia.body, mdia.end), mdhd = md.find((x) => x.kind === "mdhd")!, hdlr = md.find((x) => x.kind === "hdlr")!;
      const id = v.getUint32(tkhd.body + (b[tkhd.body] === 1 ? 20 : 12));
      const scale = v.getUint32(mdhd.body + (b[mdhd.body] === 1 ? 20 : 12));
      this.tracks.set(id, scale);
      if (String.fromCharCode(...b.subarray(hdlr.body + 8, hdlr.body + 12)) === "vide") this.video = id;
    }
    if (!this.video) throw Error("Recording has no video track");
  }
  duration(b: Uint8Array): number {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength); let first = Infinity, last = 0;
    for (const moof of boxes(b).filter((x) => x.kind === "moof")) {
      for (const traf of boxes(b, moof.body, moof.end).filter((x) => x.kind === "traf")) {
        const children = boxes(b, traf.body, traf.end), tfhd = children.find((x) => x.kind === "tfhd")!, tfdt = children.find((x) => x.kind === "tfdt")!;
        const id = v.getUint32(tfhd.body + 4); if (id !== this.video) continue;
        const flags = v.getUint32(tfhd.body) & 0xffffff; let p = tfhd.body + 8;
        if (flags & 1) p += 8; if (flags & 2) p += 4;
        const defaultDuration = flags & 8 ? v.getUint32(p) : 0;
        const timestamp = b[tfdt.body] === 1 ? Number(v.getBigUint64(tfdt.body + 4)) : v.getUint32(tfdt.body + 4);
        let ticks = 0;
        for (const trun of children.filter((x) => x.kind === "trun")) {
          const f = v.getUint32(trun.body) & 0xffffff, count = v.getUint32(trun.body + 4); let q = trun.body + 8;
          if (f & 1) q += 4; if (f & 4) q += 4;
          if (count > 10000) throw Error("Invalid MP4 samples");
          for (let i = 0; i < count; i++) {
            ticks += f & 0x100 ? v.getUint32(q) : defaultDuration;
            if (f & 0x100) q += 4; if (f & 0x200) q += 4; if (f & 0x400) q += 4; if (f & 0x800) q += 4;
          }
        }
        const scale = this.tracks.get(id)!; first = Math.min(first, timestamp / scale); last = Math.max(last, (timestamp + ticks) / scale);
      }
    }
    const duration = last - first;
    if (!(duration > 0 && duration <= 30)) throw Error("Unsupported video fragment timing");
    return duration;
  }
}
export class DirectPublisher {
  static mimeType() {
    if (typeof MediaRecorder === "undefined") throw Error("This browser cannot broadcast. Use the Android app.");
    const type = ["video/mp4;codecs=avc1.42001f,mp4a.40.2", "video/mp4;codecs=avc1.42001f,opus"].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) throw Error("This browser cannot create compatible MP4 broadcasts. Use Chrome, Edge, Safari or the Android app.");
    return type;
  }
  private recorder: MediaRecorder;
  private serial: Promise<void> = Promise.resolve();
  private timing = new MP4Timing();
  private initialized = false;
  private sequence = 0;
  private timer: ReturnType<typeof setInterval>;
  private savingError: unknown;
  private account = getUser()?.id;
  constructor(stream: MediaStream, private session: string, private key: string, private report: (message: string) => void) {
    this.recorder = new MediaRecorder(stream, { mimeType: DirectPublisher.mimeType(), videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 96_000, videoKeyFrameIntervalDuration: 1000 } as MediaRecorderOptions);
    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      this.serial = this.serial.then(() => this.save(e.data)).catch((e) => { this.savingError = e; report(e instanceof Error ? e.message : "Recording could not be saved"); if (this.recorder.state !== "inactive") this.recorder.stop(); });
    };
    this.recorder.onerror = () => report("Video capture failed. Saved recording segments are retained.");
    this.recorder.start(2000);
    this.timer = setInterval(() => { void resumeDirectUploads(report).catch(() => report("Connection interrupted · saved segments will retry")); }, 1500);
  }
  private async save(blob: Blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()), top = boxes(bytes);
    const split = top.find((b) => b.kind === "moof" || b.kind === "styp")?.start ?? bytes.length;
    if (!this.initialized) {
      const init = bytes.slice(0, split); this.timing.init(init); await this.enqueue(init, -1, 0); this.initialized = true;
    }
    if (split < bytes.length) {
      const data = bytes.slice(split); await this.enqueue(data, this.sequence++, this.timing.duration(data));
    }
    void resumeDirectUploads(this.report).catch(() => this.report("Connection interrupted · recording saved on this device"));
  }
  private async enqueue(bytes: Uint8Array, sequence: number, duration: number) {
    const account = this.account; if (!account || getUser()?.id !== account) throw Error("Sign in to save the broadcast");
    const current = await pending(); if (current.reduce((n, s) => n + s.bytes.size, 0) + bytes.length > MAX_PENDING) throw Error("Broadcast paused: upload backlog is full. Reconnect before broadcasting again.");
    const rawKey = Uint8Array.from(atob(this.key), (c) => c.charCodeAt(0));
    const aes = await crypto.subtle.importKey("raw", rawKey, "AES-CBC", false, ["encrypt"]);
    const iv = new Uint8Array(16); new DataView(iv.buffer).setBigUint64(8, BigInt(sequence + 1));
    bytes = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, aes, bytes as BufferSource));
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    const sha256 = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
    await queue("readwrite", (store) => store.put({ id: `${this.session}:${sequence}`, session: this.session, account, sequence, duration, sha256, bytes: new Blob([bytes as BlobPart], { type: "application/octet-stream" }) } satisfies Segment));
  }
  async stop() {
    clearInterval(this.timer);
    if (this.recorder.state !== "inactive") await new Promise<void>((resolve) => { this.recorder.onstop = () => resolve(); this.recorder.stop(); });
    await this.serial;
    if (this.savingError) throw this.savingError;
    await resumeDirectUploads(this.report);
  }
  abort() {
    clearInterval(this.timer);
    if (this.recorder.state !== "inactive") this.recorder.stop();
    // ondataavailable still persists the last fragment; a later visit retries it.
  }
}
