import { PageTabs } from "../components/kit/PageTabs";
import { Clock, ShieldCheck, Video, Youtube } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getLiveConfig, updateLiveConfig } from "../api/adminLiveConfigApi";
import { getToken, getUser } from "../auth/session";
import { BrowserStudio, type BroadcastReservation } from "../components/BrowserStudio";
import { LiveModeration } from "../components/LiveModeration";
import { LivePreview } from "../components/LivePreview";
import { useAdminFeedback } from "../feedback/AdminFeedback";

type Live = {
  id: string;
  title: string;
  status: string;
  price: number;
  membersOnly?: boolean;
  viewers: number;
  broadcaster: string;
  startedAt?: string;
  playbackUrl?: string;
};

type Studio = {
  cameraKey: string;
  title: string;
  membersOnly: boolean;
  price: number;
  forwardEnabled: boolean;
  forwardUrl: string;
  server: string;
  streamKey: string;
  fullUrl: string;
  hlsUrl: string;
  whepUrl: string;
  camerasWork: boolean;
};

type Access = "everyone" | "members" | "paid";
const accessOf = (membersOnly: boolean, price: number): Access => (price > 0 ? "paid" : membersOnly ? "members" : "everyone");
const accessLabel = (l: { membersOnly?: boolean; price: number }) =>
  l.price > 0 ? `Paid · KSh ${l.price}` : l.membersOnly ? "Members only" : "Everyone";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type ServiceTime = { day: string; time: string };

function parseServices(text: string): ServiceTime[] {
  const out: ServiceTime[] = [];
  const re = /(sun|mon|tue|wed|thu|fri|sat)[a-z]*[ ,]+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let h = Number(m[2]) % 12;
    if (m[4].toLowerCase() === "p") h += 12;
    const day = DAYS.find((d) => d.toLowerCase().startsWith(m![1].toLowerCase())) || "Sunday";
    out.push({ day, time: `${String(h).padStart(2, "0")}:${m[3] || "00"}` });
  }
  return out;
}

function serviceLabel(s: ServiceTime) {
  const [h, min] = s.time.split(":").map(Number);
  return `${s.day}, ${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function since(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function AccessChoice({ value, price, onChange, disabled }: { value: Access; price: number; onChange: (a: Access, price: number) => void; disabled?: boolean }) {
  return (
    <fieldset className="access-choice" disabled={disabled}>
      <legend>Who can watch</legend>
      <div className="segmented-control" aria-label="Who can watch">
        <button type="button" aria-pressed={value === "everyone"} onClick={() => onChange("everyone", 0)}>Everyone</button>
        <button type="button" aria-pressed={value === "members"} onClick={() => onChange("members", 0)}>Members only</button>
        <button type="button" aria-pressed={value === "paid"} onClick={() => onChange("paid", price || 100)}>Paid</button>
      </div>
      {value === "paid" ? (
        <label>
          Price (KSh)
          <input type="number" min={1} max={1000000} value={price} onChange={(e) => onChange("paid", Math.max(1, Number(e.target.value)))} />
        </label>
      ) : (
        <p className="small-muted">
          {value === "members" ? "Only people signed in to the app can watch. Not shown to anyone else." : "Anyone with the app can watch."}
        </p>
      )}
    </fieldset>
  );
}

function CopyField({ label, value, secret, onError }: { label: string; value: string; secret?: boolean; onError: (m: string) => void }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <label>
      {label}
      <div style={{ display: "flex", gap: 8 }}>
        <input readOnly type={shown ? "text" : "password"} value={value} style={{ flex: 1, fontFamily: "monospace" }} />
        {secret ? (
          <button type="button" className="secondary compact" onClick={() => setShown((s) => !s)}>{shown ? "Hide" : "Show"}</button>
        ) : null}
        <button
          type="button"
          className="secondary compact"
          onClick={() =>
            void navigator.clipboard.writeText(value).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
              () => onError("Could not copy. Select the text and copy it by hand.")
            )
          }
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </label>
  );
}

export function LiveConfigPage() {
  const admin = ["admin", "super_admin"].includes(getUser()?.role || "");
  const { confirm, showToast } = useAdminFeedback();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [current, setCurrent] = useState<Live | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [draft, setDraft] = useState<Pick<Studio, "title" | "membersOnly" | "price">>({ title: "Live Service", membersOnly: false, price: 0 });
  const [youtube, setYoutube] = useState({ enabled: false, url: "rtmp://a.rtmp.youtube.com/live2", key: "" });
  const [services, setServices] = useState<ServiceTime[]>([{ day: "Sunday", time: "09:00" }]);
  const [savedServices, setSavedServices] = useState("");
  const [browser, setBrowser] = useState({ title: "Live Service", membersOnly: false, price: 0 });
  const [stopVersion, setStopVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);
  const canBroadcast = admin || permissions.includes("live:broadcast");
  const canModerate = admin || permissions.includes("live:moderate");

  const loadCurrent = useCallback(async () => {
    try {
      const l = await apiRequest<{ session: Live | null }>("/api/v1/live/current", { token: getToken() });
      setCurrent(l.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the live service");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await apiRequest<{ permissions: string[] }>("/api/v1/permissions/me", { token: getToken() });
        setPermissions(p.permissions);
        const allowed = admin || p.permissions.includes("live:broadcast");
        if (allowed) {
          const s = await apiRequest<{ studio: Studio }>("/api/v1/admin/live/studio", { token: getToken() });
          applyStudio(s.studio);
        }
        if (admin) {
          const cfg = await getLiveConfig();
          const parsed = parseServices(cfg.liveConfig.nextService || "");
          if (parsed.length) setServices(parsed);
          setSavedServices(cfg.liveConfig.nextService || "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load live settings");
      }
      await loadCurrent();
      setLoading(false);
    })();
    const timer = setInterval(() => void loadCurrent(), 8000);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(timer); clearInterval(clock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyStudio(s: Studio) {
    setStudio(s);
    setDraft({ title: s.title, membersOnly: s.membersOnly, price: s.price });
    const m = s.forwardUrl.match(/^(rtmps?:\/\/[^/]+\/[^/]+)\/(.+)$/);
    setYoutube({ enabled: s.forwardEnabled, url: m ? m[1] : s.forwardUrl || "rtmp://a.rtmp.youtube.com/live2", key: m ? m[2] : "" });
  }

  async function saveStudio(body: Partial<Studio>, message: string) {
    setBusy("studio");
    setError("");
    try {
      const r = await apiRequest<{ studio: Studio }>("/api/v1/admin/live/studio", { method: "PUT", token: getToken(), body });
      applyStudio(r.studio);
      showToast({ title: message, message: "", tone: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy("");
    }
  }

  async function newKey() {
    if (studio?.cameraKey && !(await confirm({
      title: "Make a new stream key?",
      message: "The current key stops working. Put the new one in OBS, the camera or the video switcher before the next service.",
      confirmLabel: "Make new key",
      tone: "danger",
    }))) return;
    setBusy("key");
    try {
      const r = await apiRequest<{ studio: Studio }>("/api/v1/admin/live/studio/key", { method: "POST", token: getToken() });
      applyStudio(r.studio);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make a key");
    } finally {
      setBusy("");
    }
  }

  async function saveServices() {
    const text = [...services]
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time.localeCompare(b.time))
      .map(serviceLabel)
      .join("; ");
    setBusy("services");
    try {
      await updateLiveConfig({ nextService: text });
      setSavedServices(text);
      showToast({ title: "Service times saved", message: text, tone: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save service times");
    } finally {
      setBusy("");
    }
  }

  async function reserve(transport?: string) {
    const r = await apiRequest<BroadcastReservation>("/api/v1/live/start", {
      method: "POST",
      token: getToken(),
      body: { title: browser.title, price: browser.price, membersOnly: browser.membersOnly, transport, format: transport === "r2" ? "fmp4" : undefined },
    });
    setCurrent({ ...r.session, viewers: 0, broadcaster: getUser()?.name || "" });
    return r;
  }

  async function stop(sessionId?: string) {
    await apiRequest("/api/v1/live/stop", { method: "POST", token: getToken(), body: { sessionId: sessionId || current?.id } });
    setStopVersion((n) => n + 1);
    await loadCurrent();
  }

  async function end() {
    if (!(await confirm({
      title: "End this broadcast?",
      message: "The live service ends for everyone, including YouTube if it's being forwarded. The recording is prepared and added to Sermons.",
      confirmLabel: "End broadcast",
      tone: "danger",
    }))) return;
    setBusy("end");
    try {
      await stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not end the broadcast");
    } finally {
      setBusy("");
    }
  }

  const live = current?.status === "live";
  const servicesText = services.map(serviceLabel).join("; ");
  const studioChanged = studio && (draft.title !== studio.title || draft.membersOnly !== studio.membersOnly || draft.price !== studio.price);
  const forwardUrl = youtube.key.trim() ? `${youtube.url.trim().replace(/\/$/, "")}/${youtube.key.trim()}` : "";

  return (
    <main className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Broadcasting</p>
          <h1>Live</h1>
          <p className="muted">Go live from cameras, OBS, a video switcher, this computer or the phone app. Choose who can watch, send it on to YouTube, and set the service times members count down to.</p>
        </div>
      </header>
      {error ? <p role="alert" className="error-text">{error}</p> : null}
      {loading ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          {/* What's on now */}
          <section className="list-card">
            <div className="section-title-row">
              <h2>{current ? current.title : "Not live"}</h2>
              <span className={`status-chip ${live ? "success" : current ? "warning" : "neutral"}`}>
                {live ? `● Live ${since(current?.startedAt)}` : current ? "Starting…" : "Offline"}
              </span>
            </div>
            {current ? (
              <>
                <p>
                  {current.broadcaster || "Broadcaster"} · {current.viewers} watching · {accessLabel(current)}
                  {studio?.forwardEnabled ? " · Also on YouTube" : ""}
                </p>
                {live && studio?.camerasWork && current.playbackUrl && !current.playbackUrl.includes("/live/direct/") ? (
                  <LivePreview whepUrl={studio.whepUrl} />
                ) : null}
                {current.status === "starting" ? <p className="small-muted">Waiting for the picture to arrive. If nothing comes within 3 minutes the service is cancelled.</p> : null}
                {canBroadcast ? (
                  <button className="danger" disabled={!!busy} onClick={() => void end()}>End broadcast</button>
                ) : null}
              </>
            ) : (
              <p className="muted">When a service starts, members get a notification and it appears here with a live preview.</p>
            )}
          </section>

          <PageTabs tabs={[
            ...(canBroadcast ? [{ id: "golive", label: "Go live", icon: Video, content: (<>
            {studio ? (
            <section className="editor-card">
              <h2>Cameras, OBS and video switchers</h2>
              {!studio.camerasWork ? (
                <p className="warning-text">
                  Cameras and OBS need the church's own live server (the Oracle server). On the current hosting, go live from the
                  phone app or from this computer below.
                </p>
              ) : null}
              <p className="muted">
                Put these in OBS (Settings → Stream → Service: Custom), a camera or a video switcher such as an ATEM Mini. Pressing
                <strong> Start streaming</strong> starts the service with the title and access below; stopping the stream ends it a
                minute later and the recording goes to Sermons.
              </p>
              {studio.cameraKey ? (
                <>
                  <CopyField label="Server" value={studio.server} onError={setError} />
                  <CopyField label="Stream key" value={studio.streamKey} secret onError={setError} />
                  <CopyField label="Full address (for cameras that take one address)" value={studio.fullUrl} secret onError={setError} />
                  <p className="small-muted">Keep the stream key private: anyone with it can broadcast to the church.</p>
                  <button type="button" className="secondary compact" disabled={!!busy} onClick={() => void newKey()}>Make a new key</button>
                </>
              ) : (
                <button type="button" disabled={!!busy} onClick={() => void newKey()}>Create a stream key</button>
              )}
              <label>
                Service title
                <input maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <AccessChoice
                value={accessOf(draft.membersOnly, draft.price)}
                price={draft.price}
                onChange={(a, price) => setDraft({ ...draft, membersOnly: a === "members", price: a === "paid" ? price : 0 })}
              />
              <button type="button" disabled={!studioChanged || !!busy || !draft.title.trim()} onClick={() => void saveStudio(draft, "Camera service settings saved")}>
                {busy === "studio" ? "Saving…" : "Save"}
              </button>
            </section>
            ) : null}
            <section className="editor-card">
              <h2>Go live from this computer</h2>
              <label>
                Service title
                <input maxLength={120} value={browser.title} disabled={!!current} onChange={(e) => setBrowser({ ...browser, title: e.target.value })} />
              </label>
              <AccessChoice
                value={accessOf(browser.membersOnly, browser.price)}
                price={browser.price}
                disabled={!!current}
                onChange={(a, price) => setBrowser({ ...browser, membersOnly: a === "members", price: a === "paid" ? price : 0 })}
              />
              <BrowserStudio reserve={reserve} stop={stop} stopVersion={stopVersion} disabled={!!current || !!busy} />
            </section>
            </>) }] : []),
            ...(canBroadcast && studio ? [{ id: "youtube", label: "YouTube", icon: Youtube, content: (<>
            <section className="editor-card">
              <h2>Also stream to YouTube</h2>
              <p className="muted">
                The server sends the same service to your YouTube channel (it can stay Private or Unlisted there), so you only stream
                once. In YouTube Studio → Go live → Stream, copy the stream URL and key.
              </p>
              <label>
                YouTube stream URL
                <input value={youtube.url} placeholder="rtmp://a.rtmp.youtube.com/live2" onChange={(e) => setYoutube({ ...youtube, url: e.target.value })} />
              </label>
              <label>
                YouTube stream key
                <input type="password" value={youtube.key} placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" onChange={(e) => setYoutube({ ...youtube, key: e.target.value })} />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={youtube.enabled} onChange={(e) => setYoutube({ ...youtube, enabled: e.target.checked })} />
                Send every live service to YouTube
              </label>
              <button
                type="button"
                disabled={!!busy || (youtube.enabled && !forwardUrl)}
                onClick={() => void saveStudio({ forwardEnabled: youtube.enabled, forwardUrl }, youtube.enabled ? "YouTube forwarding on" : "YouTube settings saved")}
              >
                Save YouTube settings
              </button>
              <p className="small-muted">Changes apply from the next service. Turning it off doesn't affect members watching in the app.</p>
            </section>
            </>) }] : []),
            ...(admin ? [{ id: "times", label: "Service times", icon: Clock, content: (<>
            <section className="editor-card">
              <h2>Service times</h2>
              <p className="muted">The app's Home and Live screens count down to whichever comes next, in Nairobi time.</p>
              {services.map((s, i) => (
                <div key={i} className="filters-row" style={{ alignItems: "flex-end" }}>
                  <label>
                    Day
                    <select value={s.day} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))}>
                      {DAYS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </label>
                  <label>
                    Time
                    <input type="time" value={s.time} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                  </label>
                  {services.length > 1 ? (
                    <button type="button" className="secondary compact" onClick={() => setServices(services.filter((_, j) => j !== i))}>Remove</button>
                  ) : null}
                </div>
              ))}
              {services.length < 6 ? (
                <button type="button" className="secondary compact" onClick={() => setServices([...services, { day: "Sunday", time: "11:00" }])}>+ Add another service</button>
              ) : null}
              <p className="small-muted">Members see: {servicesText}</p>
              <button type="button" disabled={!!busy || servicesText === savedServices} onClick={() => void saveServices()}>
                {busy === "services" ? "Saving…" : "Save service times"}
              </button>
            </section>
            </>) }] : []),
            ...(canModerate ? [{ id: "moderation", label: "Moderation", icon: ShieldCheck, content: <LiveModeration /> }] : []),
          ]} />

          <section className="list-card">
            <h2>Recordings</h2>
            <p className="muted">
              Every service is recorded and added to Sermons with a bright cover. Rename, change the cover or delete recordings in{" "}
              <Link to="/sermons">Sermons → Service recordings</Link>.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
