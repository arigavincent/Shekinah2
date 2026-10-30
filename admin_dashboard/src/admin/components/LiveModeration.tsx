import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
type Settings = { chatOff: boolean; slowModeSeconds: number; bannedWords: string[] };
type Message = {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  pinned: boolean;
  status: string;
};
type Ban = { userId: string; name: string; reason: string };
export function LiveModeration() {
  const [settings, setSettings] = useState<Settings>({
      chatOff: false,
      slowModeSeconds: 0,
      bannedWords: [],
    }),
    [messages, setMessages] = useState<Message[]>([]),
    [bans, setBans] = useState<Ban[]>([]),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const { confirm } = useAdminFeedback();
  async function load() {
    try {
      const [s, m, b] = await Promise.all([
        apiRequest<{ settings: Settings }>("/api/v1/live/chat/settings", { token: getToken() }),
        apiRequest<{ messages: Message[] }>("/api/v1/live/chat/messages?status=approved", {
          token: getToken(),
        }),
        apiRequest<{ bans: Ban[] }>("/api/v1/live/chat/bans", { token: getToken() }),
      ]);
      setSettings(s.settings);
      setMessages(m.messages || []);
      setBans(b.bans || []);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load moderation");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/v1/live/chat${path}`, { method, token: getToken(), body });
      setNotice("Changes saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save moderation");
    } finally {
      setBusy(false);
    }
  }
  async function ban(m: Message) {
    if (
      !(await confirm({
        title: `Block ${m.displayName} from live chat?`,
        message: "Their live comments will be hidden. You can unblock them below.",
        confirmLabel: "Block member",
        tone: "danger",
      }))
    )
      return;
    await act("/bans", "POST", { userId: m.userId, reason: "Blocked by a live moderator" });
  }
  return (
    <section className="list-card">
      <div className="section-title-row">
        <h2>Live chat moderation</h2>
        <button className="secondary" onClick={() => void load()}>
          Refresh chat
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loaded && (
        <>
          <div className="two-col">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.chatOff}
                onChange={(e) => setSettings({ ...settings, chatOff: e.target.checked })}
              />
              Only hosts and moderators may comment
            </label>
            <label>
              Slow mode (seconds)
              <input
                type="number"
                min="0"
                max="600"
                value={settings.slowModeSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, slowModeSeconds: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Blocked words (one per line)
            <textarea
              value={settings.bannedWords.join("\n")}
              onChange={(e) =>
                setSettings({ ...settings, bannedWords: e.target.value.split("\n") })
              }
            />
          </label>
          <button disabled={busy} onClick={() => void act("/settings", "PUT", settings)}>
            Save chat settings
          </button>
          <h3>Recent live comments</h3>
          {!messages.length && <p className="muted">No visible live comments.</p>}
          {messages.map((m) => (
            <article className="item-row" key={m.id}>
              <div>
                <strong>
                  {m.displayName}
                  {m.pinned ? " · Pinned" : ""}
                </strong>
                <p>{m.message}</p>
              </div>
              <div className="row-actions">
                <button
                  className="secondary compact"
                  disabled={busy}
                  onClick={() => void act(`/messages/${m.id}/pin`, "POST", { pinned: !m.pinned })}
                >
                  {m.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  className="secondary compact"
                  disabled={busy}
                  onClick={() => void act(`/messages/${m.id}/hide`, "POST", {})}
                >
                  Hide
                </button>
                <button className="secondary compact" disabled={busy} onClick={() => void ban(m)}>
                  Block
                </button>
              </div>
            </article>
          ))}
          <details className="queue-item">
            <summary>Blocked members ({bans.length})</summary>
            {bans.map((b) => (
              <article className="item-row" key={b.userId}>
                <p>
                  {b.name} · {b.reason}
                </p>
                <button
                  className="secondary compact"
                  disabled={busy}
                  onClick={() => void act(`/bans/${b.userId}`, "DELETE")}
                >
                  Unblock
                </button>
              </article>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
