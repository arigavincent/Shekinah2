import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getToken, getUser } from "../auth/session";
type Overview = {
  members: number;
  newMembersWeek: number;
  pendingPayments: number;
  pendingAmount: number;
  givenThisMonth: number;
  books: number;
  bookSalesMonth: number;
  newPrayers: number;
  chatToday: number;
  liveTitle: string;
  liveStatus: string;
};
export function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await apiRequest<Overview>("/api/v1/admin/overview", { token: getToken() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load overview");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Shekinah Sons Global · Admin Console</p>
          <h1>Ministry overview</h1>
          <p className="muted">Welcome, {getUser()?.name}. Here’s what needs attention today.</p>
        </div>
        <button className="secondary" disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p role="status">{busy ? "Loading overview…" : "Overview unavailable."}</p>
      ) : (
        <>
          <div className="stats-grid">
            {[
              ["Members", data.members, `${data.newMembersWeek} joined this week`, "/users"],
              [
                "Payments to review",
                data.pendingPayments,
                `KSh ${data.pendingAmount.toLocaleString()} awaiting verification`,
                "/giving",
              ],
              [
                "Donations this month",
                `KSh ${data.givenThisMonth.toLocaleString()}`,
                "Confirmed donations · purchases reported separately",
                "/monetization",
              ],
              [
                "Book sales this month",
                data.bookSalesMonth,
                `${data.books} published materials`,
                "/library",
              ],
              ["New prayers", data.newPrayers, "Requests awaiting care", "/prayers"],
              ["Community today", data.chatToday, "Messages received today", "/community"],
            ].map(([label, value, detail, to]) => (
              <article className="stat-card" key={label}>
                <span>{label}</span>
                <strong className="metric-value">{value}</strong>
                <p className="small-muted">{detail}</p>
                <Link className="text-link" to={String(to)}>
                  View details →
                </Link>
              </article>
            ))}
          </div>
          <section className="list-card">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Broadcast</p>
                <h2>{data.liveTitle || "Ready for your next service"}</h2>
              </div>
              <span className={`status-chip ${data.liveStatus === "live" ? "success" : "neutral"}`}>
                {data.liveStatus || "Offline"}
              </span>
            </div>
            <p className="muted">
              Manage free and paid live access, chat moderation and automatic replays.
            </p>
            <Link className="text-link" to="/live">
              Open Live & replays →
            </Link>
          </section>
          <section className="list-card">
            <h2>Quick actions</h2>
            <div className="permission-grid">
              {[
                ["Publish sermons", "Single or batch audio and video uploads", "/sermons"],
                ["Publish materials", "Free or paid books with automatic covers", "/library"],
                ["Create events", "Custom questions, tickets and release dates", "/events"],
                ["Manage Users", "Profiles and staff permissions", "/users"],
                ["Serve Teams", "Leaders, member requests and placements", "/serve-settings"],
                ["Monetization", "Income by source, item reports and CSV", "/monetization"],
                ["Check-in", "Member codes, event tickets and attendance", "/checkins"],
                ["Settings", "Ministry details, RSS, email and production links", "/settings"],
              ].map(([title, description, to]) => (
                <Link className="permission-option" key={to} to={to}>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
