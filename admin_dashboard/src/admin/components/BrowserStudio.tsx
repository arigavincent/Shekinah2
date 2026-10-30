import { DirectPublisher, resumeDirectUploads } from "../live/DirectPublisher";
import { useEffect, useRef, useState } from "react";
import { StudioMedia, studioDefaults, type StudioOptions } from "../live/StudioMedia";
export type BroadcastReservation = {
  encryptionKey: string;
  transport?: string;
  directBase?: string;
  publishUrl: string;
  whipUrl: string;
  session: { id: string; title: string; price: number; status: string };
};
export function BrowserStudio({
  reserve,
  stop,
  disabled,
  stopVersion,
}: {
  reserve: (transport?: string) => Promise<BroadcastReservation>;
  stop: (sessionId?: string) => Promise<void>;
  disabled: boolean;
  stopVersion: number;
}) {
  const direct = useRef<DirectPublisher | null>(null);
  const video = useRef<HTMLVideoElement>(null),
    engine = useRef<StudioMedia | null>(null),
    peer = useRef<RTCPeerConnection | null>(null),
    resource = useRef(""),
    reserved = useRef(false),
    sessionID = useRef(""),
    mounted = useRef(true);
  const [options, setOptions] = useState<StudioOptions>({ ...studioDefaults }),
    [preview, setPreview] = useState(false),
    [sending, setSending] = useState(false),
    [busy, setBusy] = useState(false),
    [ending, setEnding] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [, redraw] = useState(0);
  function update(patch: Partial<StudioOptions>) {
    setOptions((old) => {
      const next = { ...old, ...patch };
      engine.current?.apply(next);
      return next;
    });
  }
  function release() {
    direct.current?.abort();
    direct.current = null;
    peer.current?.close();
    peer.current = null;
    const media = engine.current;
    engine.current = null;
    if (media) {
      media.onChange = () => {};
      media.close();
    }
    if (resource.current) {
      void fetch(resource.current, { method: "DELETE", keepalive: true }).catch(() => {});
      resource.current = "";
    }
  }
  useEffect(() => {
    mounted.current = true;
    const retry = () => { void resumeDirectUploads().catch(() => {}); };
    retry();
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("online", retry);
      mounted.current = false;
      release();
      if (reserved.current && sessionID.current) {
        void stop(sessionID.current).catch(() => {});
        reserved.current = false;
      }
    };
  }, []);
  useEffect(() => {
    if (stopVersion > 0) {
      release();
      reserved.current = false;
      setSending(false);
      setPreview(false);
      setStatus("Broadcast ended. The recording is being prepared for Sermons.");
    }
  }, [stopVersion]);
  async function prepare() {
    const media = new StudioMedia();
    engine.current = media;
    media.onChange = () => redraw((v) => v + 1);
    const stream = await media.open(options);
    if (engine.current !== media) {
      media.close();
      throw Error("Preview was closed");
    }
    if (video.current) {
      video.current.srcObject = stream;
      await video.current.play();
    }
    setPreview(true);
    return stream;
  }
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function show() {
    await action(prepare);
  }
  async function start() {
    setBusy(true);
    setError("");
    setStatus("Connecting…");
    try {
      const media = engine.current?.output || (await prepare());
      if (!mounted.current || !engine.current) throw Error("Studio was closed");
      DirectPublisher.mimeType();
      const reservation = await reserve("r2");
      reserved.current = true;
      sessionID.current = reservation.session.id;
      if (!mounted.current || !engine.current) throw Error("Studio was closed");
      if (reservation.transport === "r2") {
        direct.current = new DirectPublisher(media, reservation.session.id, reservation.encryptionKey, (message) => { if (mounted.current) setStatus(message); });
        setSending(true);
        setStatus("Sending video · preparing the live stream");
        return;
      }
      const pc = new RTCPeerConnection();
      peer.current = pc;
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      const codecs =
        RTCRtpSender.getCapabilities("video")?.codecs.filter(
          (c) => c.mimeType.toLowerCase() === "video/h264",
        ) || [];
      if (!codecs.length)
        throw Error("This browser cannot publish H.264 video. Use the app or an external encoder.");
      pc.getTransceivers()
        .filter((t) => t.sender.track?.kind === "video")
        .forEach((t) => t.setCodecPreferences(codecs));
      pc.onconnectionstatechange = () => {
        setStatus(
          pc.connectionState === "connected"
            ? "Broadcast connected"
            : `Connection: ${pc.connectionState}`,
        );
        if (pc.connectionState === "failed")
          setError(
            "The media connection failed. End the broadcast and reconnect, or use the external encoder settings.",
          );
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.iceGatheringState !== "complete")
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 4000);
          pc.addEventListener("icegatheringstatechange", () => {
            if (pc.iceGatheringState === "complete") {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      const response = await fetch(reservation.whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp,
      });
      if (!response.ok) throw Error(`Media server rejected the connection (${response.status}).`);
      const location = response.headers.get("Location");
      if (location) {
        const target = new URL(location, reservation.whipUrl);
        if (target.origin !== new URL(reservation.whipUrl).origin)
          throw Error("Media server returned an unexpected session address");
        resource.current = target.href;
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
      setSending(true);
    } catch (e) {
      release();
      setPreview(false);
      if (reserved.current) {
        await stop(sessionID.current).catch(() => {});
        reserved.current = false;
      }
      setError(e instanceof Error ? e.message : "Could not connect broadcast");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (ending) return;
    setEnding(true);
    try {
      await action(async () => {
        const publisher = direct.current;
        direct.current = null;
        let uploadError: unknown;
        try { await publisher?.stop(); } catch (e) { uploadError = e; }
        await stop(sessionID.current);
        if (uploadError) setError("Broadcast ended. Some recording segments remain on this browser; keep it open or revisit Live to retry.");
        reserved.current = false;
        release();
        setSending(false);
        setPreview(false);
        setStatus("Broadcast ended. The recording is being prepared for Sermons.");
      });
    } finally {
      setEnding(false);
    }
  }
  async function flip() {
    await action(async () => {
      const facing = options.facing === "user" ? "environment" : "user";
      await engine.current?.changeCamera(facing);
      update({ facing });
    });
  }
  function shareScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(
        "This browser cannot share its screen. Use a supported desktop browser or present slides below.",
      );
      return;
    }
    const capture = navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    void action(async () => {
      const stream = await capture;
      const media = engine.current;
      if (!media) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      await media.share(stream);
      update({ mode: "camera" });
    });
  }
  const media = engine.current;
  return (
    <section className="editor-card browser-studio">
      <h2>Live studio</h2>
      <p className="muted">
        Preview your service, choose what viewers see, then go live. The recording and paid access
        follow the same rules as the app.
      </p>
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        className="studio-preview"
        style={{ display: preview ? "block" : "none" }}
        aria-label="Outgoing broadcast preview"
      />
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <div className="row-actions">
        {!preview ? (
          <button className="secondary" disabled={busy || disabled} onClick={() => void show()}>
            Preview camera
          </button>
        ) : (
          <>
            <button
              className="secondary"
              aria-pressed={!options.mic}
              onClick={() => update({ mic: !options.mic })}
            >
              {options.mic ? "Mute microphone" : "Unmute microphone"}
            </button>
            <button
              className="secondary"
              aria-pressed={!options.camera}
              onClick={() => update({ camera: !options.camera })}
            >
              {options.camera ? "Camera off" : "Camera on"}
            </button>
            <button className="secondary" disabled={busy} onClick={() => void flip()}>
              Switch camera
            </button>
            {!sending && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  release();
                  setPreview(false);
                }}
              >
                Close preview
              </button>
            )}
          </>
        )}
        {sending ? (
          <button disabled={ending} onClick={() => void end()}>
            End broadcast
          </button>
        ) : (
          <button disabled={busy || disabled} onClick={() => void start()}>
            {busy ? "Connecting…" : "Start broadcast"}
          </button>
        )}
      </div>
      <div className="studio-grid">
        <fieldset className="studio-controls">
          <legend>Camera & quality</legend>
          <label>
            Broadcast quality
            <select
              value={options.quality}
              disabled={preview || busy}
              onChange={(e) => update({ quality: e.target.value as StudioOptions["quality"] })}
            >
              <option value="360p">360p · lower data</option>
              <option value="720p">720p · recommended</option>
              <option value="1080p">1080p · high detail</option>
            </select>
          </label>
          <small className="small-muted">Choose quality before opening the preview.</small>
          <label>
            Zoom · {options.zoom.toFixed(1)}×
            <input
              type="range"
              min="1"
              max="4"
              step="0.1"
              value={options.zoom}
              onChange={(e) => update({ zoom: Number(e.target.value) })}
            />
          </label>
          <label>
            Camera effect
            <select value={options.filter} onChange={(e) => update({ filter: e.target.value })}>
              <option value="none">Natural</option>
              <option value="contrast(1.12) saturate(1.08)">Vivid</option>
              <option value="sepia(0.25) saturate(0.9)">Warm</option>
              <option value="grayscale(1)">Black & white</option>
            </select>
          </label>
          <button
            className="secondary"
            disabled={!preview || !media?.torchSupported || busy}
            onClick={() => void action(() => media!.setTorch(!media!.torch))}
          >
            {media?.torch ? "Torch off" : "Torch on"}
          </button>
          <small className="small-muted">Torch appears on supported rear cameras.</small>
        </fieldset>
        <fieldset className="studio-controls">
          <legend>On screen</legend>
          <div className="segmented-control">
            {(
              [
                ["camera", "Camera / share"],
                ["slides", "Slides"],
                ["verse", "Scripture"],
                ["break", "Be right back"],
              ] as const
            ).map(([mode, label]) => (
              <button
                type="button"
                key={mode}
                aria-pressed={options.mode === mode}
                disabled={mode === "slides" && !media?.slideCount}
                onClick={() => update({ mode })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="row-actions">
            <button
              className="secondary"
              disabled={!preview || busy}
              onClick={() => (media?.sharing ? media.stopShare() : shareScreen())}
            >
              {media?.sharing ? "Stop screen sharing" : "Share screen"}
            </button>
          </div>
          <small className="small-muted">
            Choose a tab, window or screen. Shared sound is available when offered by your browser.
          </small>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.pip}
              onChange={(e) => update({ pip: e.target.checked })}
            />
            Camera in corner
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.shareAudio}
              onChange={(e) => update({ shareAudio: e.target.checked })}
            />
            Include shared sound
          </label>
          <label>
            Presentation · PDF or images
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              multiple
              disabled={!preview || busy}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                void action(async () => {
                  await media?.loadSlides(files);
                  update({ mode: "slides" });
                });
              }}
            />
          </label>
          {!!media?.slideCount && (
            <div className="row-actions">
              <button
                className="secondary"
                disabled={busy || media.slideIndex === 0}
                onClick={() =>
                  void action(async () => {
                    await media.showSlide(media.slideIndex - 1);
                    update({ mode: "slides" });
                  })
                }
              >
                Previous slide
              </button>
              <span>
                {media.slideIndex + 1} / {media.slideCount}
              </span>
              <button
                className="secondary"
                disabled={busy || media.slideIndex === media.slideCount - 1}
                onClick={() =>
                  void action(async () => {
                    await media.showSlide(media.slideIndex + 1);
                    update({ mode: "slides" });
                  })
                }
              >
                Next slide
              </button>
            </div>
          )}
          {options.mode === "verse" && (
            <>
              <label>
                Scripture reference
                <input
                  value={options.verseReference}
                  onChange={(e) => update({ verseReference: e.target.value })}
                  maxLength={150}
                  placeholder="John 3:16"
                />
              </label>
              <label>
                Scripture text
                <textarea
                  value={options.verseText}
                  maxLength={1600}
                  onChange={(e) => update({ verseText: e.target.value })}
                />
              </label>
            </>
          )}
        </fieldset>
        <fieldset className="studio-controls">
          <legend>Branding</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.banner}
              onChange={(e) => update({ banner: e.target.checked })}
            />
            Show lower banner
          </label>
          <label>
            Ministry / speaker
            <input
              value={options.name}
              maxLength={120}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
          <label>
            Service title
            <input
              value={options.title}
              maxLength={180}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.logo}
              onChange={(e) => update({ logo: e.target.checked })}
            />
            Show logo
          </label>
          <label>
            Custom logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!preview || busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void action(() => media!.setLogo(file));
              }}
            />
          </label>
          <small className="small-muted">
            PNG, JPG or WebP, up to 5 MB. Preview changes appear in the outgoing stream.
          </small>
        </fieldset>
      </div>
    </section>
  );
}
