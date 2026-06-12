import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  getLiveConfig,
  type LiveConfig,
  type LiveConfigPayload,
  updateLiveConfig
} from "../api/adminLiveConfigApi";
import { isValidYouTubeId } from "../lib/validation";

const emptyForm: LiveConfigPayload = {
  isLive: false,
  title: "Sunday Celebration Service",
  viewers: "0",
  nextService: "Sunday, 9:00 AM",
  youtubeId: "jfKfPfyJRdk"
};

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

export function LiveConfigPage() {
  const [liveConfig, setLiveConfig] = useState<LiveConfig | null>(null);
  const [form, setForm] = useState<LiveConfigPayload>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await getLiveConfig();
      const config = response.liveConfig;

      setLiveConfig(config);
      setForm({
        isLive: config.isLive,
        title: config.title || emptyForm.title,
        viewers: config.viewers || "0",
        nextService: config.nextService || emptyForm.nextService,
        youtubeId: config.youtubeId || emptyForm.youtubeId
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
    if (!form.title.trim()) return "Live title is required.";
    if (!form.nextService.trim()) return "Next service is required.";
    if (!form.youtubeId.trim()) return "YouTube video/live ID is required.";
    if (!isValidYouTubeId(form.youtubeId)) return "YouTube video/live ID is invalid.";

    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateLiveConfig({
        isLive: form.isLive,
        title: form.title.trim(),
        viewers: form.viewers.trim(),
        nextService: form.nextService.trim(),
        youtubeId: form.youtubeId.trim()
      });

      setLiveConfig(response.liveConfig);
      setSuccess("Live configuration updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update live config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Broadcast</p>
          <h1>Live Config</h1>
          <p className="muted">
            Control the live service status and YouTube stream used by the mobile app.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

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
                  placeholder="Sunday Celebration Service"
                />
              </label>

              <div className="two-col">
                <label>
                  Viewers
                  <input
                    value={form.viewers}
                    onChange={event => updateField("viewers", event.target.value)}
                    placeholder="1,284"
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
                YouTube ID
                <input
                  value={form.youtubeId}
                  onChange={event => updateField("youtubeId", normalizeYouTubeInput(event.target.value))}
                  placeholder="jfKfPfyJRdk"
                />
              </label>

              <p className="small-muted">
                Use only the YouTube video/live ID, not the full URL. Example:
                <code> jfKfPfyJRdk</code>
              </p>

              <button disabled={saving}>
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
                  onClick={() => updateField("isLive", false)}
                >
                  Mark Offline
                </button>
              </div>
            </>
          )}
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Mobile Preview Data</h2>
          </div>

          <div className="preview-card">
            <span className={form.isLive ? "live-dot on" : "live-dot"} />
            <p className="eyebrow">{form.isLive ? "Live Now" : "Not Live"}</p>
            <h3>{form.title}</h3>
            <p className="muted">Viewers: {form.viewers || "0"}</p>
            <p className="muted">Next service: {form.nextService}</p>
            <p className="small-muted">YouTube ID: {form.youtubeId}</p>
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
