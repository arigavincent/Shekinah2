import {DateTimeField} from "./DateTimeFields";
import { useEffect, useState } from "react";
import { apiRequest, API_BASE_URL } from "../api/client";
import { getToken } from "../auth/session";
import { releaseISO } from "../publishing/queue";
import { localRelease } from "./PublishingQueue";
import { AccessPrice } from "./AccessPrice";
import {
  RegistrationFields,
  emptyRegistration,
  type RegistrationSetup,
} from "./RegistrationFields";
type Registrant = {
  name: string;
  email: string;
  phone: string;
  ticket: string;
  payment: string;
  status?: string;
  answers: Record<string, string>;
  createdAt: string;
};
export function EventAccessEditor({
  id,
  publishedAt,
  isPublished,
}: {
  id: string;
  publishedAt: string;
  isPublished: boolean;
}) {
  const [setup, setSetup] = useState<RegistrationSetup>({ ...emptyRegistration }),
    [release, setRelease] = useState(publishedAt),
    [published, setPublished] = useState(isPublished),
    [notify, setNotify] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [registrants, setRegistrants] = useState<Registrant[]>([]);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    void apiRequest<{ setup: RegistrationSetup }>(`/api/v1/admin/events/${id}/registration`, {
      token: getToken(),
    })
      .then((r) => {
        if (active) {
          setSetup(r.setup);
          setLoaded(true);
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      active = false;
    };
  }, [id]);
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/v1/admin/events/${id}/registration`, {
        method: "PUT",
        token: getToken(),
        body: setup,
      });
      await apiRequest(`/api/v1/admin/events/${id}`, {
        method: "PATCH",
        token: getToken(),
        body: { publishedAt: releaseISO(release), isPublished: published, notifyOnPublish: notify },
      });
      setNotice("Registration, pricing and release saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function registrations() {
    setError("");
    try {
      const r = await apiRequest<{ registrations: Registrant[] }>(
        `/api/v1/admin/events/${id}/registrations`,
        { token: getToken() },
      );
      setRegistrants(r.registrations || []);
    } catch (e) {
      setError(String(e));
    }
  }
  async function csv() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/admin/events/${id}/registrations.csv`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw Error("Could not export registrations");
      const u = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = u;
      a.download = `event-${id}-registrations.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section className="editor-card">
      <h2>Event registration & access</h2>
      <p className="muted">
        Paid tickets unlock after payment is confirmed. These settings are shared with the app.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loaded && (
        <>
          <AccessPrice price={setup.price} onChange={(price) => setSetup({ ...setup, price })} />
          <RegistrationFields value={setup} onChange={setSetup} />
          <div className="two-col">
<DateTimeField label="Release · Nairobi" value={release} onChange={v=>setRelease(releaseISO(v))} allowNow/>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Publish at release
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Notify members
            </label>
          </div>
          <button disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save registration & access"}
          </button>
          <details
            className="queue-item"
            onToggle={(e) => {
              if (e.currentTarget.open) void registrations();
            }}
          >
            <summary>Registrations & tickets</summary>
            <button className="secondary compact" onClick={() => void csv()}>
              Export registrations CSV
            </button>
            {!registrants.length ? (
              <p className="muted">No registrations yet.</p>
            ) : (
              registrants.map((r, i) => (
                <article className="item-row" key={i}>
                  <div>
                    <strong>{r.name}</strong>
                    <p>
                      {r.email} · {r.phone}
                    </p>
                    <p className="small-muted">
                      {r.payment || r.status} · {r.ticket || "Ticket pending payment"}
                    </p>
                    {Object.entries(r.answers || {}).map(([key, value]) => (
                      <p key={key}>
                        {setup.fields.find((q) => q.id === key)?.label || key}: {value}
                      </p>
                    ))}
                  </div>
                </article>
              ))
            )}
          </details>
        </>
      )}
    </section>
  );
}
