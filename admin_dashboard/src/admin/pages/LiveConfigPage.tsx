import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  createCloudflareLiveInput,
  getLiveConfig,
  resetCloudflareLiveInput,
  type LiveConfig,
  type LiveConfigPayload,
  updateLiveConfig
} from "../api/adminLiveConfigApi";
import { InlineAlert } from "../components/InlineAlert";
import { useAdminFeedback } from "../feedback/AdminFeedback";
import { isValidYouTubeId } from "../lib/validation";

const emptyForm: LiveConfigPayload = {
  isLive: false,
  title: "Live Stream",
  viewers: "0",
  nextService: "",
  youtubeId: "",
  provider: "youtube",
  replayUrl: ""
};

type BrowserBroadcastStatus = "idle" | "camera-ready" | "connecting" | "broadcasting";

function normalizeYouTubeInput(value: string) {
  const raw = value.trim();
  if (!raw) return raw;

  const match =
    raw.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    raw.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    raw.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/) ||
    raw.match(/^([A-Za-z0-9_-]{11})$/);

  return match?.[1] || raw;
}

function copyValue(value: string | undefined, label: string, showToast: ReturnType<typeof useAdminFeedback>["showToast"]) {
  const clean = (value || "").trim();
  if (!clean) return;

  navigator.clipboard.writeText(clean);
  showToast({
    title: `${label} copied`,
    message: "Copied to clipboard.",
    tone: "success"
  });
}

function SecretValue({ value }: { value?: string }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <span className="small-muted">Not generated</span>;

  return (
    <span className="secret-value">
      <code>{revealed ? value : "••••••••••••••••••••••••"}</code>
      <button type="button" className="secondary compact" onClick={() => setRevealed(current => !current)}>
        {revealed ? "Hide" : "Reveal"}
      </button>
    </span>
  );
}

async function waitForIceGatheringComplete(peerConnection: RTCPeerConnection) {
  if (peerConnection.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      peerConnection.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }, 5000);

    function onChange() {
      if (peerConnection.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        peerConnection.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    }

    peerConnection.addEventListener("icegatheringstatechange", onChange);
  });
}

export function LiveConfigPage() {
  const { showToast } = useAdminFeedback();
  const [liveConfig, setLiveConfig] = useState<LiveConfig | null>(null);
  const [form, setForm] = useState<LiveConfigPayload>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingInput, setCreatingInput] = useState(false);
  const [resettingInput, setResettingInput] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<BrowserBroadcastStatus>("idle");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [hasLocalMedia, setHasLocalMedia] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState("");

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const whipResourceUrlRef = useRef<string>("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await getLiveConfig();
      const config = response.liveConfig;

      setLiveConfig(config);
      setForm({
        isLive: config.isLive,
        title: config.title || emptyForm.title,
        viewers: config.viewers || "0",
        nextService: config.nextService || emptyForm.nextService,
        youtubeId: config.youtubeId || emptyForm.youtubeId,
        provider: config.provider || "youtube",
        replayUrl: config.replayUrl || ""
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    return () => {
      stopLocalTracks();
      peerConnectionRef.current?.close();
    };
  }, []);

  function updateField<K extends keyof LiveConfigPayload>(
    key: K,
    value: LiveConfigPayload[K]
  ) {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  }

  function validate() {
    if (!form.nextService.trim()) return "Next service is required.";
    if (!form.title.trim()) return "Live title is required.";

    if (form.provider === "youtube" && form.isLive) {
      if (!form.youtubeId.trim()) return "YouTube video/live ID is required.";
      if (!isValidYouTubeId(form.youtubeId)) return "YouTube video/live ID is invalid.";
    }

    if (form.youtubeId.trim() && !isValidYouTubeId(form.youtubeId)) {
      return "YouTube video/live ID is invalid.";
    }

    if (form.provider === "cloudflare_stream" && form.isLive && !liveConfig?.webRtcPlaybackUrl && !liveConfig?.playbackHlsUrl) {
      return "Create a Cloudflare live input before going live with Shekinah Live.";
    }

    return "";
  }

  function stopLocalTracks() {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    setHasLocalMedia(false);
    setMicEnabled(true);
    setCameraEnabled(true);
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !micEnabled;
    stream.getAudioTracks().forEach(track => {
      track.enabled = next;
    });
    setMicEnabled(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !cameraEnabled;
    stream.getVideoTracks().forEach(track => {
      track.enabled = next;
    });
    setCameraEnabled(next);
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
      const response = await updateLiveConfig({
        isLive: form.isLive,
        title: form.title.trim(),
        viewers: form.viewers.trim(),
        nextService: form.nextService.trim(),
        youtubeId: form.youtubeId.trim(),
        provider: form.provider,
        replayUrl: form.replayUrl?.trim() || ""
      });

      setLiveConfig(response.liveConfig);
      showToast({
        title: "Live configuration updated",
        message: form.isLive
          ? "Members will now see the active livestream."
          : "The app now shows the offline live-service state.",
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update live config");
    } finally {
      setSaving(false);
    }
  }

  async function createInput() {
    setCreatingInput(true);
    setError("");

    try {
      const response = await createCloudflareLiveInput();
      setLiveConfig(response.liveConfig);
      setForm(current => ({
        ...current,
        provider: "cloudflare_stream"
      }));
      showToast({
        title: "Cloudflare live input created",
        message: "Browser publishing and native playback URLs are ready.",
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Cloudflare live input");
    } finally {
      setCreatingInput(false);
    }
  }

  async function markOfflineNow() {
    const nextForm = {
      ...form,
      isLive: false
    };

    setSaving(true);
    setError("");

    try {
      const response = await updateLiveConfig({
        isLive: false,
        title: nextForm.title.trim(),
        viewers: nextForm.viewers.trim(),
        nextService: nextForm.nextService.trim(),
        youtubeId: nextForm.youtubeId.trim(),
        provider: nextForm.provider,
        replayUrl: nextForm.replayUrl?.trim() || ""
      });

      setLiveConfig(response.liveConfig);
      setForm(nextForm);
      showToast({
        title: "Live stream marked offline",
        message: "Members will now see the offline live-service state.",
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark live stream offline");
    } finally {
      setSaving(false);
    }
  }

  async function resetInput() {
    const confirmation = window.prompt(
      "This will delete the current Cloudflare live input and clear all stream credentials. Type RESET to continue."
    );

    if (confirmation !== "RESET") {
      return;
    }

    await stopBrowserBroadcast({ markOffline: false });
    setResettingInput(true);
    setError("");

    try {
      const response = await resetCloudflareLiveInput();
      setLiveConfig(response.liveConfig);
      setForm(current => ({
        ...current,
        isLive: false,
        provider: "cloudflare_stream"
      }));
      showToast({
        title: "Cloudflare live input reset",
        message: "The stream credentials were cleared. Create a new input when you are ready.",
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset Cloudflare live input");
    } finally {
      setResettingInput(false);
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera and microphone access.");
      return;
    }

    setStartingCamera(true);
    setError("");
    setBroadcastMessage("");

    try {
      stopLocalTracks();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }

      setHasLocalMedia(true);
      setMicEnabled(stream.getAudioTracks().some(track => track.enabled));
      setCameraEnabled(stream.getVideoTracks().some(track => track.enabled));
      setBroadcastStatus("camera-ready");
      setBroadcastMessage("Camera and microphone are ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start camera");
      stopLocalTracks();
      setBroadcastStatus("idle");
    } finally {
      setStartingCamera(false);
    }
  }

  async function startBrowserBroadcast() {
    if (!liveConfig?.webRtcPublishUrl) {
      setError("Create a Cloudflare live input first. The WebRTC publish URL is missing.");
      return;
    }

    if (!form.nextService.trim()) {
      setError("Next service is required before starting a browser broadcast.");
      return;
    }

    setBroadcastStatus("connecting");
    setBroadcastMessage("Connecting browser camera to Cloudflare...");
    setError("");

    try {
      let stream = localStreamRef.current;
      if (!stream) {
        await startCamera();
        stream = localStreamRef.current;
      }

      if (!stream) {
        throw new Error("Camera stream was not started.");
      }

      peerConnectionRef.current?.close();

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }]
      });

      peerConnectionRef.current = peerConnection;
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);

      if (!peerConnection.localDescription?.sdp) {
        throw new Error("Browser did not create a WebRTC offer.");
      }

      const response = await fetch(liveConfig.webRtcPublishUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp"
        },
        body: peerConnection.localDescription.sdp
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(responseText || `Cloudflare WHIP publish failed with HTTP ${response.status}`);
      }

      const answerSdp = await response.text();
      const resourceUrl = response.headers.get("Location") || "";

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });

      whipResourceUrlRef.current = resourceUrl;

      const liveResponse = await updateLiveConfig({
        isLive: true,
        title: form.title.trim(),
        viewers: form.viewers.trim(),
        nextService: form.nextService.trim(),
        youtubeId: form.youtubeId.trim(),
        provider: "cloudflare_stream",
        replayUrl: form.replayUrl?.trim() || ""
      });

      setLiveConfig(liveResponse.liveConfig);
      setForm(current => ({
        ...current,
        isLive: true,
        provider: "cloudflare_stream"
      }));

      setBroadcastStatus("broadcasting");
      setBroadcastMessage("Browser broadcast is live. Members can watch from the app through Cloudflare WebRTC playback.");
      showToast({
        title: "Browser broadcast started",
        message: "Cloudflare accepted the WebRTC broadcast.",
        tone: "success"
      });
    } catch (err) {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      whipResourceUrlRef.current = "";
      setBroadcastStatus(localStreamRef.current ? "camera-ready" : "idle");
      setBroadcastMessage("");
      setError(err instanceof Error ? err.message : "Failed to start browser broadcast");
    }
  }

  async function stopBrowserBroadcast(options: { markOffline?: boolean } = { markOffline: true }) {
    const resourceUrl = whipResourceUrlRef.current;

    if (resourceUrl) {
      await fetch(resourceUrl, { method: "DELETE" }).catch(() => undefined);
    }

    whipResourceUrlRef.current = "";
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    stopLocalTracks();

    setBroadcastStatus("idle");
    setBroadcastMessage("");

    if (options.markOffline !== false && form.isLive) {
      await markOfflineNow();
    }
  }

  const isCloudflare = form.provider === "cloudflare_stream";
  const canStartBrowserBroadcast = Boolean(liveConfig?.webRtcPublishUrl) && broadcastStatus !== "connecting" && broadcastStatus !== "broadcasting";
  const isBroadcasting = broadcastStatus === "broadcasting";

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Broadcast</p>
          <h1>Live Config</h1>
          <p className="muted">
            Create a Shekinah-owned Cloudflare live input, publish from the browser, and control what the mobile app shows.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Live configuration could not be updated" message={error} /> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <div className="section-title-row">
            <h2>Live Service Settings</h2>

            <span className={form.isLive ? "status-pill live" : "status-pill offline"}>
              {form.isLive ? "Live" : "Offline"}
            </span>
          </div>

          {loading ? (
            <p className="muted">Loading live config...</p>
          ) : (
            <>
              <label>
                Live Provider
                <select value={form.provider} onChange={event => updateField("provider", event.target.value as LiveConfigPayload["provider"])}>
                  <option value="cloudflare_stream">Shekinah Live / Cloudflare Stream</option>
                  <option value="youtube">YouTube fallback</option>
                  <option value="facebook">Facebook fallback</option>
                  <option value="external_hls">External HLS</option>
                </select>
              </label>

              <label className="checkbox-label normal-offset">
                <input
                  type="checkbox"
                  checked={form.isLive}
                  onChange={event => updateField("isLive", event.target.checked)}
                />
                Service is currently live
              </label>

              <label>
                Live Title
                <input
                  value={form.title}
                  onChange={event => updateField("title", event.target.value)}
                  placeholder="Sunday Service Live"
                />
              </label>

              <div className="two-col">
                <label>
                  Viewers
                  <input
                    value={form.viewers}
                    onChange={event => updateField("viewers", event.target.value)}
                    placeholder="0"
                  />
                </label>

                <label>
                  Next Service
                  <input
                    value={form.nextService}
                    onChange={event => updateField("nextService", event.target.value)}
                    placeholder="Sunday, 9:00 AM"
                  />
                </label>
              </div>

              <label>
                Fallback YouTube ID
                <input
                  value={form.youtubeId}
                  onChange={event => updateField("youtubeId", normalizeYouTubeInput(event.target.value))}
                  placeholder="Optional fallback video/live ID"
                />
              </label>

              <label>
                Replay URL
                <input
                  value={form.replayUrl || ""}
                  onChange={event => updateField("replayUrl", event.target.value)}
                  placeholder="Optional replay URL after the service"
                />
              </label>

              <button className="primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Live Config"}
              </button>

              <div className="two-col">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => updateField("isLive", true)}
                >
                  Go Live Now
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={markOfflineNow}
                  disabled={saving || !form.isLive}
                >
                  Mark Offline Now
                </button>
              </div>
            </>
          )}
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Shekinah Live Input</h2>
          </div>

          <div className="preview-card">
            <span className={form.isLive ? "live-dot on" : "live-dot"} />
            <p className="eyebrow">{isCloudflare ? "Cloudflare Stream" : "Fallback Provider"}</p>
            <h3>{liveConfig?.cloudflareLiveInputId ? "Live input ready" : "No Cloudflare input yet"}</h3>
            <p className="muted">
              Create one live input, then use browser broadcasting for the simplest church workflow.
            </p>

            <button
              type="button"
              className="secondary"
              onClick={createInput}
              disabled={creatingInput}
            >
              {creatingInput ? "Creating..." : liveConfig?.cloudflareLiveInputId ? "Create New Cloudflare Live Input" : "Create Cloudflare Live Input"}
            </button>
          </div>

          {liveConfig?.cloudflareLiveInputId ? (
            <>
              <div className="browser-live-card">
                <div>
                  <p className="eyebrow">Browser Broadcast</p>
                  <h3>Go Live from Browser</h3>
                  <p className="muted">
                    Use this to publish camera and microphone directly to Cloudflare without OBS.
                  </p>
                </div>

                <video ref={videoPreviewRef} className="browser-video-preview" playsInline muted />

                <div className="browser-live-actions">
                  <button type="button" className="secondary" onClick={startCamera} disabled={startingCamera || isBroadcasting}>
                    {startingCamera ? "Starting Camera..." : "Start Camera"}
                  </button>
                  {hasLocalMedia ? (
                    <>
                      <button type="button" className="secondary" onClick={toggleMic}>
                        {micEnabled ? "Mute Mic" : "Unmute Mic"}
                      </button>
                      <button type="button" className="secondary" onClick={toggleCamera}>
                        {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="primary" onClick={startBrowserBroadcast} disabled={!canStartBrowserBroadcast}>
                    {broadcastStatus === "connecting" ? "Connecting..." : "Start Broadcast"}
                  </button>
                  <button type="button" className="secondary" onClick={() => stopBrowserBroadcast()} disabled={!isBroadcasting && broadcastStatus !== "camera-ready"}>
                    Stop Broadcast
                  </button>
                </div>

                {broadcastMessage ? <p className="small-muted">{broadcastMessage}</p> : null}
                {!liveConfig.webRtcPublishUrl ? (
                  <InlineAlert
                    title="WebRTC publish URL missing"
                    message="Create a fresh Cloudflare live input after deploying the backend WebRTC migration."
                  />
                ) : null}
              </div>

              <div className="credential-grid">
                <article>
                  <span>WebRTC Playback URL</span>
                  <code>{liveConfig.webRtcPlaybackUrl || "Not generated"}</code>
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.webRtcPlaybackUrl, "WebRTC playback URL", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>WebRTC Publish URL</span>
                  <SecretValue value={liveConfig.webRtcPublishUrl} />
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.webRtcPublishUrl, "WebRTC publish URL", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>Playback HLS</span>
                  <code>{liveConfig.playbackHlsUrl || "Not generated"}</code>
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.playbackHlsUrl, "Playback HLS URL", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>RTMPS URL</span>
                  <code>{liveConfig.rtmpsUrl || "Not generated"}</code>
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.rtmpsUrl, "RTMPS URL", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>Stream Key</span>
                  <SecretValue value={liveConfig.streamKey} />
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.streamKey, "Stream key", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>SRT URL</span>
                  <code>{liveConfig.srtUrl || "Not generated"}</code>
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.srtUrl, "SRT URL", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>SRT Stream ID</span>
                  <code>{liveConfig.srtStreamId || "Not generated"}</code>
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.srtStreamId, "SRT stream ID", showToast)}>
                    Copy
                  </button>
                </article>

                <article>
                  <span>SRT Passphrase</span>
                  <SecretValue value={liveConfig.srtPassphrase} />
                  <button type="button" className="secondary compact" onClick={() => copyValue(liveConfig.srtPassphrase, "SRT passphrase", showToast)}>
                    Copy
                  </button>
                </article>
              </div>
            </>
          ) : null}

          <div className="danger-zone">
            <div>
              <strong>Danger Zone</strong>
              <p>
                Reset only if stream credentials were exposed, compromised, or you need a fresh Cloudflare input.
                This deletes the current Cloudflare live input and clears the saved broadcast credentials.
              </p>
            </div>
            <button
              type="button"
              className="danger"
              onClick={resetInput}
              disabled={resettingInput || !liveConfig?.cloudflareLiveInputId}
            >
              {resettingInput ? "Resetting..." : "Reset Cloudflare Live Input"}
            </button>
          </div>

          {liveConfig ? (
            <p className="small-muted">
              Last updated: {new Date(liveConfig.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
