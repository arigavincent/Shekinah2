import {DateTimeField} from "./DateTimeFields";
import { useEffect, useState } from "react";
import { apiRequest, API_BASE_URL } from "../api/client";
import { getToken } from "../auth/session";
import { releaseISO } from "../publishing/queue";
import { localRelease } from "./PublishingQueue";
import { AccessPrice } from "./AccessPrice";
import { MemberSelect } from "./MemberSelect";
import {
  RegistrationFields,
  emptyRegistration,
  type RegistrationSetup,
  type TicketTier,
} from "./RegistrationFields";
type Registrant = {
  id: string;
  voided?: boolean;
  name: string;
  email: string;
  phone: string;
  ticket: string;
  tierId?: string;
  payment: string;
  status?: string;
  answers: Record<string, string>;
  createdAt: string;
};
export function EventAccessEditor({
  id,
  publishedAt,
  isPublished,
  cancelledAt = "",
  closesAt = "",
}: {
  id: string;
  publishedAt: string;
  isPublished: boolean;
  cancelledAt?: string;
  closesAt?: string;
}) {
  const [cancelled, setCancelled] = useState(!!cancelledAt),
    [deadline, setDeadline] = useState(closesAt ? toLocalInput(closesAt) : ""),
    [issueTo, setIssueTo] = useState(""),
    [issueTier, setIssueTier] = useState("");
  async function act(path: string, method: string, body?: unknown, done?: (r: { message?: string; ticket?: string }) => void) {
    setError(""); setNotice("");
    try {
      const r = await apiRequest<{ message?: string; ticket?: string }>(`/api/v1/admin/events/${id}${path}`, { method, token: getToken(), body });
      setNotice(r.message || "Saved."); done?.(r);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
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
          {!(setup.tiers || []).length && <AccessPrice price={setup.price} onChange={(price) => setSetup({ ...setup, price })} />}
          <TierEditor tiers={setup.tiers || []} onChange={(tiers) => setSetup({ ...setup, tiers })} />
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
          <div className="filters-row" style={{ alignItems: "end", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <label>
              Registration closes (blank = open until the event)
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </label>
            <button className="secondary compact" onClick={() => void act("/deadline", "PUT", { closesAt: deadline ? new Date(deadline).toISOString() : "" })}>Save deadline</button>
            {cancelled
              ? <button className="secondary compact" onClick={() => void act("/restore", "POST", undefined, () => setCancelled(false))}>Restore event</button>
              : <button className="danger compact" onClick={() => void act("/cancel", "POST", { reason: "" }, () => setCancelled(true))}>Cancel event</button>}
            {cancelled && <span className="status-chip danger">Cancelled · hidden in the app</span>}
          </div>
          <details
            className="queue-item"
            onToggle={(e) => {
              if (e.currentTarget.open) void registrations();
            }}
          >
            <summary>Registrations & tickets</summary>
            <div className="filters-row" style={{ alignItems: "end", gap: 8, flexWrap: "wrap" }}>
              <label style={{ minWidth: 240, flex: 1 }}>
                Issue a ticket (registered in person)
                <MemberSelect token={getToken()} value={issueTo} onChange={setIssueTo} />
              </label>
              {(setup.tiers || []).length > 0 && (
                <label>
                  Ticket type
                  <select value={issueTier || setup.tiers![0].id} onChange={(e) => setIssueTier(e.target.value)}>
                    {setup.tiers!.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
              )}
              <button className="secondary compact" disabled={!issueTo} onClick={() => void act("/registrations", "POST", { userId: issueTo, tierId: issueTier || setup.tiers?.[0]?.id || "" }, () => { setIssueTo(""); void registrations(); })}>Issue ticket</button>
            </div>
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
                      {r.voided ? "Voided · " : ""}{setup.tiers?.find((t) => t.id === r.tierId)?.name ? `${setup.tiers.find((t) => t.id === r.tierId)!.name} · ` : ""}{r.payment || r.status} · {r.ticket || "Ticket pending payment"}
                    </p>
                    {!r.voided && r.id && <button className="secondary compact" onClick={() => void act(`/registrations/${r.id}`, "DELETE", undefined, () => void registrations())}>Void registration</button>}
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

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Ticket types (e.g. VIP and Regular), each with its own price and places.
export function TierEditor({ tiers, onChange }: { tiers: TicketTier[]; onChange: (t: TicketTier[]) => void }) {
  const edit = (i: number, p: Partial<TicketTier>) => onChange(tiers.map((t, k) => (k === i ? { ...t, ...p } : t)));
  return (
    <fieldset className="queue-item" style={{ display: "grid", gap: 8 }}>
      <legend>Ticket types</legend>
      {!tiers.length ? (
        <p className="small-muted">One price for everyone. Add ticket types for VIP, Regular and so on.</p>
      ) : (
        tiers.map((t, i) => (
          <div className="filters-row" key={t.id || i} style={{ alignItems: "end", gap: 8, flexWrap: "wrap" }}>
            <label style={{ flex: 2, minWidth: 160 }}>
              Name
              <input value={t.name} maxLength={40} placeholder="e.g. VIP" onChange={(e) => edit(i, { name: e.target.value })} />
            </label>
            <label style={{ flex: 1, minWidth: 110 }}>
              Price (KSh, 0 = free)
              <input type="number" min={0} value={t.price} onChange={(e) => edit(i, { price: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label style={{ flex: 1, minWidth: 110 }}>
              Places (0 = no limit)
              <input type="number" min={0} value={t.capacity} onChange={(e) => edit(i, { capacity: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            {t.spotsLeft !== undefined && t.spotsLeft >= 0 && <span className="small-muted">{t.spotsLeft} left</span>}
            <button type="button" className="danger compact" onClick={() => onChange(tiers.filter((_, k) => k !== i))}>Remove</button>
          </div>
        ))
      )}
      {tiers.length < 10 && (
        <button type="button" className="secondary compact" onClick={() => onChange([...tiers, { id: "", name: tiers.length ? "" : "Regular", price: 0, capacity: 0 }])}>
          Add ticket type
        </button>
      )}
    </fieldset>
  );
}
