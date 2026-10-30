import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
type Field = {
  key: string;
  label: string;
  kind: string;
  hint?: string;
  required?: boolean;
  options?: string[];
};
type Integration = {
  id: string;
  title: string;
  description: string;
  fields: Field[];
  enabled: boolean;
  source: string;
  values: Record<string, string>;
  configured: Record<string, boolean>;
};
type Check = { id: string; title: string; status: string; message: string };
const base = "/api/v1/admin/settings/";
function IntegrationCard({ item, onSaved }: { item: Integration; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(item.enabled),
    [values, setValues] = useState({ ...item.values }),
    [clear, setClear] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setEnabled(item.enabled);
    setValues({ ...item.values });
    setClear([]);
  }, [item]);
  async function run(check: boolean) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await apiRequest<{ message: string; integration?: Integration }>(
        base + "integrations/" + item.id + (check ? "/check" : ""),
        {
          token: getToken(),
          method: check ? "POST" : "PUT",
          body: check ? {} : { enabled, values, clearSecrets: clear },
        },
      );
      setNotice(result.message);
      if (result.integration) {
        setValues(result.integration.values);
        setClear([]);
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="integration-card" open={item.id === "mpesa" ? true : undefined}>
      <summary>
        <span>
          <strong>{item.title}</strong>
          <small className="small-muted">
            {item.enabled ? "Enabled" : "Disabled"} ·{" "}
            {item.source === "admin" ? "Saved in admin" : "Deployment defaults"}
          </small>
        </span>
        <span className="text-link">Configure</span>
      </summary>
      <p className="muted">{item.description}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
      >
        <label className="integration-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
          />
          Enable this integration
        </label>
        <div className="two-col">
          {item.fields.map((f) => (
            <div
              className={
                "integration-field " +
                (f.kind === "json" || f.key === "FCM_SERVICE_ACCOUNT_JSON"
                  ? "integration-wide"
                  : "")
              }
              key={f.key}
            >
              <label htmlFor={`integration-${item.id}-${f.key}`}>
                {f.label}
                {f.required && enabled ? " *" : ""}
              </label>
              {f.kind === "select" ? (
                <select
                  id={`integration-${item.id}-${f.key}`}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  disabled={busy}
                >
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.kind === "json" ? (
                <textarea
                  id={`integration-${item.id}-${f.key}`}
                  rows={5}
                  spellCheck={false}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  disabled={busy}
                />
              ) : (
                <input
                  id={`integration-${item.id}-${f.key}`}
                  type={f.kind === "secret" ? "password" : f.kind === "url" ? "url" : "text"}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  autoComplete={f.kind === "secret" ? "new-password" : "off"}
                  placeholder={
                    f.kind === "secret" && item.configured[f.key]
                      ? "Saved securely · leave blank to keep"
                      : ""
                  }
                  disabled={busy}
                  required={enabled && f.required && f.kind !== "secret"}
                  maxLength={f.kind === "secret" ? 131072 : 2000}
                />
              )}
              {f.hint && <small className="small-muted">{f.hint}</small>}
              {f.kind === "secret" && item.configured[f.key] && (
                <span className="integration-secret">
                  <span className="small-muted">Saved · hidden</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={clear.includes(f.key)}
                      onChange={(e) =>
                        setClear(
                          e.target.checked ? [...clear, f.key] : clear.filter((k) => k !== f.key),
                        )
                      }
                      disabled={busy}
                    />
                    Clear saved value
                  </label>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="row-actions">
          <button type="submit" disabled={busy}>
            {busy ? "Working…" : "Save integration"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || !item.enabled}
            onClick={() => void run(true)}
          >
            Check saved connection
          </button>
        </div>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
export function IntegrationSettings() {
  const [items, setItems] = useState<Integration[]>([]),
    [checks, setChecks] = useState<Check[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    try {
      const [i, r] = await Promise.all([
        apiRequest<{ integrations: Integration[] }>(base + "integrations", { token: getToken() }),
        apiRequest<{ checks: Check[] }>(base + "readiness", { token: getToken() }),
      ]);
      setItems(i.integrations);
      setChecks(r.checks);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section id="integrations" className="integration-settings">
      <div className="page-header">
        <div>
          <p className="eyebrow">Services & payments</p>
          <h2>External integrations</h2>
          <p className="muted">
            Configure provider accounts here. Saved secrets stay encrypted on the server. Save
            changes before checking a connection.
          </p>
        </div>
        <button className="secondary" onClick={() => void load()}>
          Refresh status
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading integrations…</p>
      ) : (
        items.map((item) => (
          <IntegrationCard key={item.id} item={item} onSaved={() => void load()} />
        ))
      )}
      <details className="integration-card">
        <summary>
          <strong>Deployment readiness</strong>
          <span className="text-link">View checks</span>
        </summary>
        <p className="muted">
          Configuration checks are separate from payment acceptance and the final security review.
          Hosting, signing, database and storage roots are set during deployment.
        </p>
        <ul className="readiness-list">
          {checks.map((c) => (
            <li key={c.id}>
              <strong>{c.title}</strong>
              <span
                className={
                  c.status === "ready" || c.status === "configured" ? "readiness-ok" : "small-muted"
                }
              >
                {c.status.replaceAll("-", " ")}
              </span>
              <p>{c.message}</p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
