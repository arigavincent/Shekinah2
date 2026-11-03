import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";

const TOPICS: [string, string][] = [
  ["faith", "Faith"], ["hope", "Hope"], ["love", "Love"], ["peace", "Peace"], ["strength", "Strength"], ["healing", "Healing"],
  ["provision", "Provision"], ["prayer", "Prayer"], ["salvation", "Salvation"], ["guidance", "Guidance"], ["thanksgiving", "Thanksgiving"], ["holyspirit", "Holy Spirit"],
];

// Which topics the app's daily verses come from (the greeting verse and the
// Verse of the Day, new every morning at 7). None chosen = all topics.
export function VerseTopicsCard() {
  const [chosen, setChosen] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest<{ topics: string[] }>("/api/v1/settings/verse-topics", { token: getToken() })
      .then((r) => { setChosen(r.topics || []); setSaved(r.topics || []); })
      .catch((e) => setMessage(e instanceof Error ? e.message : "Could not load"));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await apiRequest<{ topics: string[] }>("/api/v1/admin/settings/verse-topics", { method: "PUT", token: getToken(), body: { topics: chosen } });
      setSaved(r.topics);
      setMessage("Saved. Members see it from the next 7 AM verse.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const changed = chosen.slice().sort().join() !== saved.slice().sort().join();
  return (
    <section className="list-card" style={{ marginBottom: 18 }}>
      <div className="section-title-row"><h2>Daily verse topics</h2></div>
      <p className="muted">
        The app's Home shows a new verse every morning at 7 (the greeting verse and the Verse of the Day), read from the offline Bible.
        Pick topics to focus them, for example Faith and Healing during a healing series. With none picked, every topic is used.
      </p>
      <div className="segmented-control" aria-label="Daily verse topics">
        {TOPICS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={chosen.includes(id)}
            onClick={() => setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])}>{label}</button>
        ))}
      </div>
      <p className="small-muted">Using: {chosen.length ? TOPICS.filter(([id]) => chosen.includes(id)).map(([, l]) => l).join(", ") : "all topics"}</p>
      {message ? <p className="small-muted">{message}</p> : null}
      <button type="button" disabled={busy || !changed} onClick={() => void save()}>{busy ? "Saving…" : "Save topics"}</button>
    </section>
  );
}
