import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
type Team = {
  id: string;
  name: string;
  description: string;
  icon: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  sortOrder: number;
  isActive: boolean;
  members: number;
};
type Request = {
  id: string;
  team: string;
  teamId: string;
  name: string;
  email: string;
  phone: string;
  availability: string;
  message: string;
  status: string;
  emailed: boolean;
  createdAt: string;
};
type Overview = { teams: Team[]; requests: Request[]; contactEmail: string; emailReady: boolean };
const newTeam: Team = {
  id: "new",
  name: "",
  description: "",
  icon: "hand-heart",
  leaderName: "",
  leaderEmail: "",
  leaderPhone: "",
  sortOrder: 0,
  isActive: true,
  members: 0,
};
export function ServeSettingsPage() {
  const [data, setData] = useState<Overview | null>(null),
    [edit, setEdit] = useState<Team | null>(null),
    [contact, setContact] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [teamId, setTeamId] = useState("all"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const { confirm } = useAdminFeedback();
  async function load() {
    setError("");
    try {
      const r = await apiRequest<Overview>("/api/v1/admin/serve", { token: getToken() });
      setData(r);
      setContact(r.contactEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Serve teams");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    await act(async () => {
      await apiRequest(`/api/v1/admin/serve/teams/${edit.id}`, {
        method: "PUT",
        token: getToken(),
        body: edit,
      });
      setEdit(null);
    }, "Team saved.");
  }
  async function remove(t: Team) {
    if (
      !(await confirm({
        title: `Archive ${t.name}?`,
        message:
          "The team will no longer accept new requests. Existing request history is preserved.",
        confirmLabel: "Archive team",
        tone: "danger",
      }))
    )
      return;
    await act(
      () =>
        apiRequest(`/api/v1/admin/serve/teams/${t.id}`, { method: "DELETE", token: getToken() }),
      "Team archived.",
    );
  }
  const requests =
    data?.requests.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (teamId === "all" || r.teamId === teamId) &&
        [r.name, r.email, r.phone, r.team].join(" ").toLowerCase().includes(query.toLowerCase()),
    ) || [];
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Ministry care</p>
          <h1>Serve Teams</h1>
          <p className="muted">
            Team leaders, member requests and placements, shared with the app.
          </p>
        </div>
        <div className="row-actions">
          <button className="secondary" onClick={() => void load()}>
            Refresh
          </button>
          <button onClick={() => setEdit({ ...newTeam })}>New team</button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!data ? (
        <p role="status">Loading teams…</p>
      ) : (
        <>
          <section className="list-card">
            <h2>Request notifications</h2>
            <p className="muted">
              Requests stay in this dashboard even when email is unavailable.{" "}
              {data.emailReady ? "Email is configured." : "Outgoing email is not configured yet."}{" "}
              <Link className="text-link" to="/settings">
                Email settings →
              </Link>
            </p>
            <label>
              Coordinator email (fallback when a team has no leader email)
              <input type="email" value={contact} onChange={(e) => setContact(e.target.value)} />
            </label>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void act(
                  () =>
                    apiRequest("/api/v1/admin/serve/contact", {
                      method: "PUT",
                      token: getToken(),
                      body: { email: contact },
                    }),
                  "Coordinator email saved.",
                )
              }
            >
              Save coordinator
            </button>
          </section>
          {edit && (
            <form className="editor-card" onSubmit={save}>
              <h2>{edit.id === "new" ? "Create team" : "Edit team"}</h2>
              <div className="two-col">
                {(
                  [
                    ["name", "Team name"],
                    ["leaderName", "Leader name"],
                    ["leaderEmail", "Leader email"],
                    ["leaderPhone", "Leader phone"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={key === "name"}
                      type={key === "leaderEmail" ? "email" : "text"}
                      value={edit[key]}
                      onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Description
                <textarea
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </label>
              <label>
                Display order
                <input
                  type="number"
                  value={edit.sortOrder}
                  onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={edit.isActive}
                  onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
                />
                Accept new requests
              </label>
              <div className="row-actions">
                <button disabled={busy}>Save team</button>
                <button className="secondary" type="button" onClick={() => setEdit(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          <section className="list-card">
            <h2>Teams</h2>
            {data.teams.map((t) => (
              <article className="item-row" key={t.id}>
                <div>
                  <h3>{t.name}</h3>
                  <p>
                    {t.leaderName || "No leader assigned"} · {t.members} placed members ·{" "}
                    {t.isActive ? "Active" : "Inactive"}
                  </p>
                  <p className="small-muted">{t.description}</p>
                </div>
                <div className="row-actions">
                  <button className="secondary compact" onClick={() => setEdit({ ...t })}>
                    Edit
                  </button>
                  <button
                    className="secondary compact"
                    disabled={busy}
                    onClick={() => void remove(t)}
                  >
                    Archive
                  </button>
                </div>
              </article>
            ))}
          </section>
          <section className="list-card">
            <h2>Requests to serve</h2>
            <div className="review-grid">
              <label>
                Search
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, email, phone or team"
                />
              </label>
              <label>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  {["new", "contacted", "placed", "declined"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Team
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="all">All teams</option>
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!requests.length && <p className="muted">No matching requests.</p>}
            {requests.map((r) => (
              <article className="item-row" key={r.id}>
                <div>
                  <h3>
                    {r.name} · {r.team}
                  </h3>
                  <p>
                    {r.email} · {r.phone}
                  </p>
                  <p>{r.availability}</p>
                  <p>{r.message}</p>
                  <p className="small-muted">
                    {new Date(r.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}{" "}
                    · {r.emailed ? "Leader emailed" : "Email not sent"}
                  </p>
                </div>
                <label>
                  Status
                  <select
                    disabled={busy}
                    value={r.status}
                    onChange={(e) =>
                      void act(
                        () =>
                          apiRequest(`/api/v1/admin/serve/requests/${r.id}`, {
                            method: "PATCH",
                            token: getToken(),
                            body: { status: e.target.value },
                          }),
                        "Request updated.",
                      )
                    }
                  >
                    {["new", "contacted", "placed", "declined"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
