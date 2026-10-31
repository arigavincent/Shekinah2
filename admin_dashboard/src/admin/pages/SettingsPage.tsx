import { IntegrationSettings } from "../components/IntegrationSettings";
import { MinistryDetails } from "../components/MinistryDetails";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";

type SMTP = {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  from: string;
  security: string;
  passwordConfigured: boolean;
  source: string;
};
type Production = { apiUrl: string; dashboardUrl: string; appUrl: string; websiteUrl: string };
const emptySMTP: SMTP = {
  enabled: false,
  host: "",
  port: "587",
  username: "",
  from: "",
  security: "starttls",
  passwordConfigured: false,
  source: "environment",
};
export function SettingsPage() {
  const [smtp, setSMTP] = useState(emptySMTP),
    [production, setProduction] = useState<Production>({
      apiUrl: "",
      dashboardUrl: "",
      appUrl: "",
      websiteUrl: "",
    }),
    [feed, setFeed] = useState("");
  const [password, setPassword] = useState(""),
    [clearPassword, setClearPassword] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState<Record<string, string>>({});
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, p, f] = await Promise.all([
        apiRequest<{ smtp: SMTP }>("/api/v1/admin/settings/smtp", { token: getToken() }),
        apiRequest<{ production: Production }>("/api/v1/admin/settings/production", {
          token: getToken(),
        }),
        apiRequest<{ feedUrl: string }>("/api/v1/admin/settings/podcast", { token: getToken() }),
      ]);
      setSMTP({ ...emptySMTP, ...s.smtp, port: s.smtp.port || "587" });
      setProduction(p.production);
      setFeed(f.feedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setNotice((n) => ({ ...n, [key]: "" }));
    try {
      const message = await fn();
      setNotice((n) => ({ ...n, [key]: message }));
    } catch (e) {
      setNotice((n) => ({
        ...n,
        [key]: e instanceof Error ? e.message : "Could not save settings",
      }));
    } finally {
      setBusy("");
    }
  }
  function downloadRelease() {
    const file = new Blob(
      [`# Android release API address\nreleaseApiBase=${production.apiUrl}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(file),
      a = document.createElement("a");
    a.href = url;
    a.download = "shekinah-release.properties";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="setup-settings">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ministry administration</p>
          <h1>Settings</h1>
          <p className="muted">
            Ministry contacts, media, podcast imports, outgoing email and production links.
          </p>
        </div>
        <button className="secondary" onClick={() => void load()} disabled={loading || !!busy}>
          Refresh
        </button>
      </header>
      {loading ? (
        <p role="status">Loading settings…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <nav className="row-actions settings-jumps" aria-label="Settings sections">
            <a href="#integrations" className="text-link">
              Payments & integrations
            </a>
            <a href="#podcast-settings" className="text-link">
              Spotify RSS
            </a>
            <a href="#smtp-settings" className="text-link">
              Email
            </a>
          </nav>
          <IntegrationSettings />
          <MinistryDetails />
          <section className="list-card">
            <h2>Giving instructions</h2>
            <p className="muted">Manage paybill, Airtel and bank details shown to members.</p>
            <Link className="text-link" to="/giving">
              Open payment settings →
            </Link>
          </section>
          <section className="editor-card" id="podcast-settings" aria-label="Spotify RSS settings">
            <p className="eyebrow">01 · Audio sermons</p>
            <h2>Spotify podcast RSS</h2>
            <p className="muted">
              Paste the show’s podcast RSS feed. Episodes play in Shekinah’s own player and new
              episodes import automatically. Leave blank to pause imports.
            </p>
            <label>
              Podcast RSS feed URL
              <input
                type="url"
                value={feed}
                onChange={(e) => setFeed(e.target.value)}
                placeholder="https://…/rss"
              />
            </label>
            <div className="row-actions">
              <button
                disabled={!!busy}
                onClick={() =>
                  void action("podcast", async () => {
                    const r = await apiRequest<{ episodes: number }>(
                      "/api/v1/admin/settings/podcast",
                      { method: "PATCH", token: getToken(), body: { feedUrl: feed.trim() } },
                    );
                    return feed.trim()
                      ? `Feed saved · ${r.episodes} episodes found`
                      : "Podcast imports paused";
                  })
                }
              >
                Save RSS feed
              </button>
              <button
                className="secondary"
                disabled={!!busy || !feed.trim()}
                onClick={() =>
                  void action("podcast", async () => {
                    const r = await apiRequest<{
                      report: { podcastAdded: number; podcastUpdated: number; errors?: string[] };
                    }>("/api/v1/admin/sermons/sync", { method: "POST", token: getToken() });
                    if (r.report.errors?.length) throw Error(r.report.errors.join("; "));
                    return `Sync complete · ${r.report.podcastAdded} added, ${r.report.podcastUpdated} updated`;
                  })
                }
              >
                Sync saved feed now
              </button>
            </div>
            <p role="status">{notice.podcast}</p>
          </section>
          <section className="editor-card" id="smtp-settings" aria-label="SMTP settings">
            <p className="eyebrow">02 · Outgoing email</p>
            <h2>SMTP</h2>
            <p className="muted">
              Password reset codes and Serve emails use these saved settings immediately. The
              password is encrypted and is never shown again.
            </p>
            <label className="checkbox-label normal-offset">
              <input
                type="checkbox"
                checked={smtp.enabled}
                onChange={(e) => setSMTP({ ...smtp, enabled: e.target.checked })}
              />{" "}
              Enable outgoing email
            </label>
            <div className="two-col">
              <label>
                SMTP host
                <input
                  value={smtp.host}
                  onChange={(e) => setSMTP({ ...smtp, host: e.target.value })}
                  placeholder="smtp.your-provider.com"
                />
              </label>
              <label>
                Port
                <input
                  inputMode="numeric"
                  value={smtp.port}
                  onChange={(e) => setSMTP({ ...smtp, port: e.target.value })}
                />
              </label>
              <label>
                Encryption
                <select
                  value={smtp.security}
                  onChange={(e) => setSMTP({ ...smtp, security: e.target.value })}
                >
                  <option value="starttls">STARTTLS · usually port 587</option>
                  <option value="tls">TLS · usually port 465</option>
                  <option value="none">No TLS · local testing only</option>
                </select>
              </label>
              <label>
                Sender
                <input
                  value={smtp.from}
                  onChange={(e) => setSMTP({ ...smtp, from: e.target.value })}
                  placeholder="Shekinah Sons Global &lt;no-reply@your-domain&gt;"
                />
              </label>
              <label>
                Username
                <input
                  autoComplete="off"
                  value={smtp.username}
                  onChange={(e) => setSMTP({ ...smtp, username: e.target.value })}
                />
              </label>
              <label>
                {smtp.passwordConfigured
                  ? "Replace password (blank keeps saved password)"
                  : "SMTP password"}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setClearPassword(false);
                  }}
                />
              </label>
            </div>
            <div className="row-actions">
              <button
                disabled={!!busy}
                onClick={() =>
                  void action("smtp", async () => {
                    const r = await apiRequest<{ smtp: SMTP; message: string }>(
                      "/api/v1/admin/settings/smtp",
                      {
                        method: "PUT",
                        token: getToken(),
                        body: {
                          enabled: smtp.enabled,
                          host: smtp.host,
                          port: smtp.port,
                          username: smtp.username,
                          from: smtp.from,
                          security: smtp.security,
                          password,
                          clearPassword,
                        },
                      },
                    );
                    setSMTP(r.smtp);
                    setPassword("");
                    setClearPassword(false);
                    return r.message;
                  })
                }
              >
                Save SMTP settings
              </button>
              <button
                className="secondary"
                disabled={!!busy || !smtp.enabled}
                onClick={() =>
                  void action("smtp", async () => {
                    const r = await apiRequest<{ message: string }>(
                      "/api/v1/admin/settings/smtp/check",
                      { method: "POST", token: getToken() },
                    );
                    return r.message;
                  })
                }
              >
                Check saved connection
              </button>
              {smtp.passwordConfigured && (
                <button
                  className="secondary"
                  disabled={!!busy}
                  onClick={() => {
                    setSMTP({ ...smtp, username: "" });
                    setPassword("");
                    setClearPassword(true);
                    setNotice((n) => ({
                      ...n,
                      smtp: "Saved login will be removed when you save settings.",
                    }));
                  }}
                >
                  Remove saved login
                </button>
              )}
            </div>
            <p className="small-muted">
              Connection check verifies the server and login. It sends no email.
            </p>
            <p role="status">{notice.smtp}</p>
          </section>
          <section className="editor-card" aria-label="Production settings">
            <p className="eyebrow">03 · Production</p>
            <h2>Production links</h2>
            <p className="muted">
              Save the official URLs here. App download and website links update in the member app.
              Hosting, HTTPS certificates and release signing are completed during deployment.
            </p>
            <div className="two-col">
              {(
                [
                  ["apiUrl", "Production API origin"],
                  ["dashboardUrl", "Admin dashboard URL"],
                  ["appUrl", "App download URL"],
                  ["websiteUrl", "Ministry website URL"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="url"
                    value={production[key]}
                    onChange={(e) => setProduction({ ...production, [key]: e.target.value })}
                    placeholder="https://…"
                  />
                </label>
              ))}
            </div>
            <div className="row-actions">
              <button
                disabled={!!busy}
                onClick={() =>
                  void action("production", async () => {
                    const r = await apiRequest<{ production: Production; message: string }>(
                      "/api/v1/admin/settings/production",
                      { method: "PUT", token: getToken(), body: production },
                    );
                    setProduction(r.production);
                    return r.message;
                  })
                }
              >
                Save production links
              </button>
              <button
                className="secondary"
                disabled={!production.apiUrl || !!busy}
                onClick={downloadRelease}
              >
                Download Android release settings
              </button>
            </div>
            <p className="small-muted">
              Changing the API address is applied when the next signed APK is built; it does not
              redirect installed apps.
            </p>
            <p role="status">{notice.production}</p>
          </section>
        </>
      )}
    </main>
  );
}
