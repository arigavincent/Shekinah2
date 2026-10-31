import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
type Ministry = {
  phone: string;
  email: string;
  address: string;
  website: string;
  radioUrl: string;
  tvUrl: string;
  appUrl: string;
};
export function MinistryDetails() {
  const [value, setValue] = useState<Ministry | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    void apiRequest<{ ministry: Ministry }>("/api/v1/admin/settings/ministry", {
      token: getToken(),
    })
      .then((r) => setValue(r.ministry))
      .catch((e) => setError(String(e)));
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<{ ministry: Ministry }>("/api/v1/admin/settings/ministry", {
        method: "PUT",
        token: getToken(),
        body: value,
      });
      setValue(r.ministry);
      setNotice("Ministry details saved for the member app.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save ministry details");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="editor-card" onSubmit={save}>
      <p className="eyebrow">Ministry</p>
      <h2>Contact & media</h2>
      <p className="muted">
        Official contact details, radio and TV streams, website and app links. Blank links remain
        unavailable in the app.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {value && (
        <>
          <div className="two-col">
            {(
              [
                ["phone", "Phone"],
                ["email", "Email"],
                ["address", "Address"],
                ["website", "Website URL"],
                ["radioUrl", "Radio stream URL"],
                ["tvUrl", "TV stream URL"],
                ["appUrl", "App download URL"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type={
                    key === "email"
                      ? "email"
                      : key.endsWith("Url") || key === "website"
                        ? "url"
                        : "text"
                  }
                  value={value[key]}
                  onChange={(e) => setValue({ ...value, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <button disabled={busy}>{busy ? "Saving…" : "Save ministry details"}</button>
        </>
      )}
    </form>
  );
}
