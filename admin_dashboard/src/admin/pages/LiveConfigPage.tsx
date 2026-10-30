import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken, getUser } from "../auth/session";
import { AccessPrice } from "../components/AccessPrice";
import { BrowserStudio, type BroadcastReservation } from "../components/BrowserStudio";
import { LiveModeration } from "../components/LiveModeration";
import { LegacyLiveConfigPage } from "./LegacyLiveConfigPage";
import { useAdminFeedback } from "../feedback/AdminFeedback";
type Live = {
  id: string;
  title: string;
  status: string;
  price: number;
  viewers: number;
  broadcaster: string;
  startedAt?: string;
};
type Replay = {
  id: string;
  title: string;
  price: number;
  date: string;
  status: string;
  error?: string;
};
export function LiveConfigPage() {
  const admin = ["admin", "super_admin"].includes(getUser()?.role || ""),
    [permissions, setPermissions] = useState<string[]>([]),
    [current, setCurrent] = useState<Live | null>(null),
    [replays, setReplays] = useState<Replay[]>([]),
    [reservation, setReservation] = useState<BroadcastReservation | null>(null),
    [title, setTitle] = useState("Live Service"),
    [price, setPrice] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const { confirm } = useAdminFeedback();
  const [stopVersion, setStopVersion] = useState(0);
  const canBroadcast = admin || permissions.includes("live:broadcast"),
    canModerate = admin || permissions.includes("live:moderate");
  const load = useCallback(async () => {
    try {
      const [l, r, p] = await Promise.all([
        apiRequest<{ session: Live | null }>("/api/v1/live/current", { token: getToken() }),
        apiRequest<{ items: Replay[] }>("/api/v1/live/replays", { token: getToken() }),
        apiRequest<{ permissions: string[] }>("/api/v1/permissions/me", { token: getToken() }),
      ]);
      setCurrent(l.session);
      setReplays(r.items || []);
      setPermissions(p.permissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load live services");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);
  async function reserve(transport?: string) {
    const r = await apiRequest<BroadcastReservation>("/api/v1/live/start", {
      method: "POST",
      token: getToken(),
      body: { title, price, transport, format: transport === "r2" ? "fmp4" : undefined },
    });
    setReservation(r);
    setCurrent({ ...r.session, viewers: 0, broadcaster: getUser()?.name || "" });
    return r;
  }
  async function stop(sessionId?: string) {
    await apiRequest("/api/v1/live/stop", {
      method: "POST",
      token: getToken(),
      body: { sessionId: sessionId || current?.id },
    });
    setReservation(null);
    setStopVersion((n) => n + 1);
    await load();
  }
  async function external() {
    setBusy(true);
    setError("");
    try {
      await reserve();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare broadcast");
    } finally {
      setBusy(false);
    }
  }
  async function end() {
    if (
      !(await confirm({
        title: "End this broadcast?",
        message:
          "The live service will end for everyone. Its recording will be prepared and added to Sermons.",
        confirmLabel: "End broadcast",
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    try {
      await stop();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Broadcasting</p>
          <h1>Live & replays</h1>
          <p className="muted">
            Free or paid services, live moderation and automatic recordings in Sermons.
          </p>
        </div>
        <button className="secondary" disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading live services…</p>
      ) : (
        <>
          <section className="list-card">
            <div className="section-title-row">
              <h2>{current ? current.title : "No active broadcast"}</h2>
              <span className={`status-chip ${current?.status === "live" ? "success" : "neutral"}`}>
                {current?.status || "Offline"}
              </span>
            </div>
            {current && (
              <>
                <p>
                  {current.broadcaster} · {current.viewers} current viewers ·{" "}
                  {current.price ? `Paid · KSh ${current.price}` : "Free"}
                </p>
                {canBroadcast && (
                  <button className="secondary" disabled={busy} onClick={() => void end()}>
                    End current broadcast
                  </button>
                )}
              </>
            )}
            <p className="small-muted">
              Live purchasers retain replay access. Anyone who did not purchase the paid service
              must pay before watching its recording.
            </p>
          </section>
          {canBroadcast && (
            <>
              <section className="editor-card">
                <h2>Next service</h2>
                <label>
                  Service title
                  <input
                    maxLength={120}
                    value={title}
                    disabled={!!current}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <AccessPrice price={price} onChange={setPrice} disabled={!!current} />
                <p className="small-muted">
                  Access and price are set before broadcasting begins. Confirmed payments unlock
                  paid services.
                </p>
              </section>
              <BrowserStudio
                reserve={reserve}
                stop={stop}
                stopVersion={stopVersion}
                disabled={!!current || busy}
              />
              <details className="list-card">
                <summary>External encoder (OBS / RTMP)</summary>
                <p className="muted">
                  Prepare a service, then connect your encoder using its private publish address.
                </p>
                {!current && (
                  <button disabled={busy} onClick={() => void external()}>
                    Prepare external broadcast
                  </button>
                )}
                {reservation && (
                  <label>
                    Private RTMP publish address
                    <input readOnly type="password" value={reservation.publishUrl} />
                    <button
                      className="secondary compact"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(reservation.publishUrl)
                          .catch(() => setError("Could not copy. Select the address manually."))
                      }
                    >
                      Copy publish address
                    </button>
                  </label>
                )}
                <p className="small-muted">
                  Only share this address with the broadcaster. Stop the service to revoke it.
                </p>
              </details>
            </>
          )}
          {canModerate && <LiveModeration />}
          <section className="list-card">
            <h2>Recordings</h2>
            <p className="muted">
              Recordings are secured in R2 and appear in Sermons as soon as processing finishes.
            </p>
            {!replays.length && <p className="small-muted">No recordings yet.</p>}
            {replays.map((r) => (
              <article className="item-row" key={r.id}>
                <div>
                  <h3>{r.title}</h3>
                  <p>
                    {r.price ? `Paid · KSh ${r.price}` : "Free"} ·{" "}
                    {r.date
                      ? new Date(r.date).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })
                      : ""}
                  </p>
                  {r.error && <p role="alert">{r.error}</p>}
                </div>
                <span className={`status-chip ${r.status === "ready" ? "success" : "warning"}`}>
                  {r.status === "ready" ? "Available in Sermons" : r.status}
                </span>
              </article>
            ))}
          </section>
          {admin && (
            <details className="list-card">
              <summary>External provider settings</summary>
              <LegacyLiveConfigPage />
            </details>
          )}
        </>
      )}
    </main>
  );
}
