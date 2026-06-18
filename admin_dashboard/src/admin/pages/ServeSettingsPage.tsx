import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  getServeSettings,
  updateServeSettings
} from "../api/adminServeSettingsApi";
import { InlineAlert } from "../components/InlineAlert";
import { useAdminFeedback } from "../feedback/AdminFeedback";

function normalize(value: string) {
  const digits = value.replace(/\D+/g, "");

  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
    return `254${digits}`;
  }

  return digits;
}

export function ServeSettingsPage() {
  const { showToast } = useAdminFeedback();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await getServeSettings();
      setWhatsappNumber(response.serve?.whatsappNumber || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load serve settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const cleanNumber = normalize(whatsappNumber);
    if (cleanNumber && !/^254[17]\d{8}$/.test(cleanNumber)) {
      setError("Use a valid WhatsApp number such as 254712345678.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await updateServeSettings({
        whatsappNumber: cleanNumber
      });

      setWhatsappNumber(response.serve?.whatsappNumber || "");

      showToast({
        title: "Serve settings saved",
        message: "Serve requests will now open WhatsApp using this number.",
        tone: "success"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save serve settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Serve Settings</h1>
          <p className="muted">
            Choose the WhatsApp number that receives serve requests from the mobile app.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Serve settings could not be updated" message={error} /> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <h2>Responsible WhatsApp Contact</h2>

          <label>
            WhatsApp Number
            <input
              value={whatsappNumber}
              onChange={event => setWhatsappNumber(event.target.value)}
              placeholder="254712345678"
              disabled={loading || saving}
            />
          </label>

          <p className="muted">
            Use international format without spaces, for example 254712345678. Members will not see this number before WhatsApp opens.
          </p>

          <button disabled={loading || saving}>
            {saving ? "Saving..." : "Save Serve Settings"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Mobile App Behavior</h2>
            <span className="count-pill">WhatsApp</span>
          </div>

          <p className="muted">
            When a member submits the Serve form, the app will open WhatsApp with a prepared message addressed to the configured number.
          </p>

          <p className="muted">
            The member only needs to review the message and tap Send.
          </p>
        </section>
      </section>
    </main>
  );
}
