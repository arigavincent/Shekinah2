import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
export type StudioOptions = {
  quality: "360p" | "720p" | "1080p";
  facing: string;
  camera: boolean;
  mic: boolean;
  shareAudio: boolean;
  pip: boolean;
  zoom: number;
  filter: string;
  banner: boolean;
  name: string;
  title: string;
  logo: boolean;
  mode: "camera" | "slides" | "verse" | "break";
  verseReference: string;
  verseText: string;
};
export const studioDefaults: StudioOptions = {
  quality: "720p",
  facing: "user",
  camera: true,
  mic: true,
  shareAudio: true,
  pip: true,
  zoom: 1,
  filter: "none",
  banner: false,
  name: "Shekinah Sons Global",
  title: "Live Service",
  logo: true,
  mode: "camera",
  verseReference: "",
  verseText: "",
};
type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
};
export class StudioMedia {
  readonly canvas = document.createElement("canvas");
  options: StudioOptions = { ...studioDefaults };
  output: MediaStream | null = null;
  cameraStream: MediaStream | null = null;
  displayStream: MediaStream | null = null;
  private cameraVideo = document.createElement("video");
  private displayVideo = document.createElement("video");
  private audio: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private micGain: GainNode | null = null;
  private screenGain: GainNode | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private slide: ImageBitmap | HTMLCanvasElement | null = null;
  private logoImage: ImageBitmap | null = null;
  private imageFiles: File[] = [];
  private pdf: PDFDocumentProxy | null = null;
  private pdfTask: PDFDocumentLoadingTask | null = null;
  private slideVersion = 0;
  slideIndex = 0;
  slideCount = 0;
  torch = false;
  onChange = () => {};
  get sharing() {
    return !!this.displayStream;
  }
  get torchSupported() {
    return !!(
      this.cameraStream?.getVideoTracks()[0]?.getCapabilities() as CameraCapabilities | undefined
    )?.torch;
  }
  async open(options: StudioOptions) {
    this.options = { ...options };
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error(
        "Camera capture needs HTTPS or localhost. Use the Android app when this browser cannot capture media.",
      );
    const heights = { "360p": 360, "720p": 720, "1080p": 1080 },
      height = heights[options.quality];
    this.canvas.width = Math.round((height * 16) / 9);
    this.canvas.height = height;
    this.audio = new AudioContext();
    await this.audio.resume();
    this.destination = this.audio.createMediaStreamDestination();
    try {
      await this.changeCamera(options.facing);
      if (this.closed) throw Error("Studio closed");
      this.draw();
      this.output = this.canvas.captureStream(30);
      this.destination.stream.getAudioTracks().forEach((t) => this.output!.addTrack(t));
      this.tick = setInterval(() => this.draw(), 33);
      void fetch("/favicon.png")
        .then((r) => r.blob())
        .then((b) => createImageBitmap(b))
        .then((image) => {
          if (this.closed) image.close();
          else {
            this.logoImage = image;
            this.draw();
          }
        })
        .catch(() => {});
      return this.output;
    } catch (e) {
      this.close();
      throw e;
    }
  }
  async changeCamera(facing: string) {
    const height = { "360p": 360, "720p": 720, "1080p": 1080 }[this.options.quality];
    const media = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: (height * 16) / 9 },
        height: { ideal: height },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (this.closed) {
      media.getTracks().forEach((t) => t.stop());
      throw Error("Studio closed");
    }
    const old = this.cameraStream;
    this.cameraStream = media;
    this.options.facing = facing;
    this.cameraVideo.srcObject = media;
    this.cameraVideo.muted = true;
    this.cameraVideo.playsInline = true;
    await this.cameraVideo.play();
    this.micGain?.disconnect();
    if (this.audio && this.destination && media.getAudioTracks().length) {
      this.micGain = this.audio.createGain();
      this.audio
        .createMediaStreamSource(new MediaStream(media.getAudioTracks()))
        .connect(this.micGain)
        .connect(this.destination);
    }
    old?.getTracks().forEach((t) => t.stop());
    this.torch = false;
    this.apply(this.options);
    this.onChange();
  }
  apply(options: StudioOptions) {
    this.options = { ...options };
    this.cameraStream?.getAudioTracks().forEach((t) => (t.enabled = options.mic));
    this.cameraStream?.getVideoTracks().forEach((t) => (t.enabled = options.camera));
    if (this.micGain) this.micGain.gain.value = options.mic ? 1 : 0;
    if (this.screenGain) this.screenGain.gain.value = options.shareAudio ? 1 : 0;
    this.draw();
  }
  async share(media: MediaStream) {
    this.stopShare();
    if (this.closed) {
      media.getTracks().forEach((t) => t.stop());
      throw Error("Studio closed");
    }
    this.displayStream = media;
    this.displayVideo.srcObject = media;
    this.displayVideo.muted = true;
    this.displayVideo.playsInline = true;
    await this.displayVideo.play();
    if (media.getAudioTracks().length && this.audio && this.destination) {
      this.screenGain = this.audio.createGain();
      this.screenGain.gain.value = this.options.shareAudio ? 1 : 0;
      this.audio
        .createMediaStreamSource(new MediaStream(media.getAudioTracks()))
        .connect(this.screenGain)
        .connect(this.destination);
    }
    media.getVideoTracks()[0].onended = () => this.stopShare();
    this.options.mode = "camera";
    this.onChange();
  }
  stopShare() {
    const stream = this.displayStream;
    this.displayStream = null;
    stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.screenGain?.disconnect();
    this.screenGain = null;
    this.displayVideo.srcObject = null;
    this.onChange();
  }
  async setTorch(enabled: boolean) {
    const track = this.cameraStream?.getVideoTracks()[0];
    if (!track || !this.torchSupported) throw Error("Torch is unavailable on this camera");
    await track.applyConstraints({ advanced: [{ torch: enabled } as MediaTrackConstraintSet] });
    this.torch = enabled;
    this.onChange();
  }
  async setLogo(file: File) {
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      throw Error("Choose a PNG, JPG or WebP logo up to 5 MB");
    const image = await createImageBitmap(file);
    if (this.closed) {
      image.close();
      return;
    }
    this.logoImage?.close();
    this.logoImage = image;
    this.draw();
  }
  async loadSlides(files: File[]) {
    if (!files.length) return;
    if (files.length > 100) throw Error("Choose up to 100 slide images, or one PDF");
    this.slideVersion++;
    void this.pdfTask?.destroy().catch(() => {});
    this.pdf = null;
    this.imageFiles = [];
    this.slideCount = 0;
    this.slideIndex = 0;
    this.onChange();
    if (
      files.length === 1 &&
      (files[0].type === "application/pdf" || files[0].name.toLowerCase().endsWith(".pdf"))
    ) {
      if (files[0].size > 50 * 1024 * 1024) throw Error("Choose a presentation PDF up to 50 MB");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
      const task = pdfjs.getDocument({
        data: new Uint8Array(await files[0].arrayBuffer()),
        useWasm: false,
      });
      this.pdfTask = task;
      const pdf = await task.promise;
      if (this.closed) {
        await task.destroy();
        return;
      }
      if (pdf.numPages > 300) {
        await task.destroy();
        throw Error("Use a presentation with up to 300 pages");
      }
      this.pdf = pdf;
      this.slideCount = pdf.numPages;
    } else {
      if (
        files.some(
          (f) =>
            f.size > 10 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(f.type),
        )
      )
        throw Error("Use JPG, PNG or WebP slide images up to 10 MB each");
      this.imageFiles = files;
      this.slideCount = files.length;
    }
    this.slideIndex = 0;
    await this.showSlide(0);
    this.onChange();
  }
  async showSlide(index: number) {
    if (index < 0 || index >= this.slideCount) return;
    const version = ++this.slideVersion;
    let slide: HTMLCanvasElement | ImageBitmap;
    if (this.pdf) {
      const page = await this.pdf.getPage(index + 1),
        base = page.getViewport({ scale: 1 }),
        scale = Math.min(1920 / base.width, 1080 / base.height, 3),
        viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      slide = canvas;
    } else slide = await createImageBitmap(this.imageFiles[index]);
    if (this.closed || version !== this.slideVersion) {
      if (slide instanceof ImageBitmap) slide.close();
      return;
    }
    if (this.slide instanceof ImageBitmap) this.slide.close();
    this.slide = slide;
    this.slideIndex = index;
    this.options.mode = "slides";
    this.draw();
    this.onChange();
  }
  private fitted(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    w: number,
    h: number,
    x: number,
    y: number,
    width: number,
    height: number,
    cover = false,
    zoom = 1,
  ) {
    if (!w || !h) return;
    const factor =
      (cover ? Math.max(width / w, height / h) : Math.min(width / w, height / h)) * zoom;
    const dw = w * factor,
      dh = h * factor;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(source, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
    ctx.restore();
  }
  private text(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    size: number,
    maxLines = 8,
  ) {
    ctx.font = `500 ${size}px Inter, Arial, sans-serif`;
    const words = text.split(/\s+/);
    let line = "",
      row = 0;
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > width && line) {
        ctx.fillText(line, x, y + row * size * 1.4, width);
        row++;
        if (row >= maxLines) return;
        line = word;
      } else line = next;
    }
    if (row < maxLines) ctx.fillText(line, x, y + row * size * 1.4, width);
  }
  draw() {
    if (this.closed) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const w = this.canvas.width,
      h = this.canvas.height,
      o = this.options;
    ctx.fillStyle = "#060606";
    ctx.fillRect(0, 0, w, h);
    const present = o.mode === "slides" && this.slide;
    if (o.mode === "verse" || o.mode === "break") {
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(w * 0.08, h * 0.18, w * 0.12, 4);
      ctx.fillStyle = "#fff";
      if (o.mode === "break") {
        ctx.font = `700 ${h * 0.07}px Inter, Arial, sans-serif`;
        ctx.fillText("Be right back", w * 0.08, h * 0.4, w * 0.84);
        this.text(
          ctx,
          "The service will continue shortly.",
          w * 0.08,
          h * 0.51,
          w * 0.8,
          h * 0.035,
        );
      } else {
        ctx.font = `600 ${h * 0.05}px Inter, Arial, sans-serif`;
        ctx.fillText(o.verseReference || "Scripture", w * 0.08, h * 0.29, w * 0.84);
        this.text(ctx, o.verseText, w * 0.08, h * 0.4, w * 0.84, h * 0.043, 7);
      }
    } else if (present) {
      const s = this.slide!;
      this.fitted(ctx, s, s.width, s.height, 0, 0, w, h);
    } else if (this.displayStream) {
      this.fitted(
        ctx,
        this.displayVideo,
        this.displayVideo.videoWidth,
        this.displayVideo.videoHeight,
        0,
        0,
        w,
        h,
      );
    } else if (o.camera) {
      ctx.filter = o.filter;
      this.fitted(
        ctx,
        this.cameraVideo,
        this.cameraVideo.videoWidth,
        this.cameraVideo.videoHeight,
        0,
        0,
        w,
        h,
        true,
        o.zoom,
      );
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#b8b8bd";
      ctx.font = `500 ${h * 0.04}px Inter,Arial,sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Camera off", w / 2, h / 2);
      ctx.textAlign = "start";
    }
    if ((present || this.displayStream || o.mode === "verse") && o.pip && o.camera) {
      const pw = w * 0.24,
        ph = (pw * 9) / 16,
        x = w - pw - w * 0.025,
        y = h - ph - h * 0.035 - (o.banner ? h * 0.14 : 0);
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.filter = o.filter;
      this.fitted(
        ctx,
        this.cameraVideo,
        this.cameraVideo.videoWidth,
        this.cameraVideo.videoHeight,
        x,
        y,
        pw,
        ph,
        true,
        o.zoom,
      );
      ctx.filter = "none";
      ctx.strokeRect(x, y, pw, ph);
    }
    if (o.logo && this.logoImage) {
      const size = h * 0.115;
      ctx.fillStyle = "#0009";
      ctx.fillRect(w - size - w * 0.025 - 8, h * 0.025 - 8, size + 16, size + 16);
      this.fitted(
        ctx,
        this.logoImage,
        this.logoImage.width,
        this.logoImage.height,
        w - size - w * 0.025,
        h * 0.025,
        size,
        size,
      );
    }
    if (o.banner) {
      const bh = h * 0.15;
      ctx.fillStyle = "#050505e8";
      ctx.fillRect(0, h - bh, w, bh);
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(0, h - bh, 5, bh);
      ctx.font = `700 ${h * 0.035}px Inter,Arial,sans-serif`;
      ctx.fillText(o.name || "Shekinah Sons Global", w * 0.035, h - bh + h * 0.055, w * 0.9);
      ctx.fillStyle = "#fff";
      ctx.font = `500 ${h * 0.027}px Inter,Arial,sans-serif`;
      ctx.fillText(o.title, w * 0.035, h - h * 0.035, w * 0.9);
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.slideVersion++;
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    this.cameraStream?.getTracks().forEach((t) => t.stop());
    this.stopShare();
    this.output?.getTracks().forEach((t) => t.stop());
    this.cameraVideo.srcObject = null;
    this.audio?.close().catch(() => {});
    this.micGain?.disconnect();
    void this.pdfTask?.destroy().catch(() => {});
    if (this.slide instanceof ImageBitmap) this.slide.close();
    this.logoImage?.close();
    this.output = null;
    this.cameraStream = null;
  }
}
