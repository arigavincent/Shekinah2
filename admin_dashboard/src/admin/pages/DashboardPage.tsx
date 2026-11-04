import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, ClipboardCheck, HandHeart, MessagesSquare, Mic2, Radio, RefreshCw, Settings, Users, Wallet, Coins, type LucideIcon } from "lucide-react";
import { apiRequest } from "../api/client";
import { getToken, getUser } from "../auth/session";
import { ToolHub } from "../components/kit/Kit";
import dove from "../assets/dove.png";

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

type Tile = { label: string; value: string | number; detail: string; to: string; icon: LucideIcon; tint: string; attention?: boolean };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// The admin home, laid out like the phone's Overview: a glowing greeting, the
// live card, what needs attention, and quick actions as cards.
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
  const name = (getUser()?.name || "").split(" ")[0];
  const live = data?.liveStatus === "live";
  const tiles: Tile[] = data
    ? [
        { label: "Payments to check", value: data.pendingPayments, detail: `KSh ${data.pendingAmount.toLocaleString()} waiting`, to: "/giving", icon: Wallet, tint: "#d4af37", attention: data.pendingPayments > 0 },
        { label: "Given this month", value: `KSh ${data.givenThisMonth.toLocaleString()}`, detail: "Confirmed gifts", to: "/monetization", icon: Coins, tint: "#4ade80" },
        { label: "Members", value: data.members, detail: `+${data.newMembersWeek} this week`, to: "/sa/members", icon: Users, tint: "#6ea8ff" },
        { label: "Book sales", value: data.bookSalesMonth, detail: `${data.books} titles on the shelf`, to: "/library", icon: BookOpen, tint: "#b79cff" },
        { label: "Prayer requests", value: data.newPrayers, detail: "New to read", to: "/prayers", icon: HandHeart, tint: "#ff8fa3", attention: data.newPrayers > 0 },
        { label: "Chat today", value: data.chatToday, detail: "Community messages", to: "/community", icon: MessagesSquare, tint: "#6ea8ff" },
      ]
    : [];
  return (
    <main className="fx-page">
      <header className="fx-hero">
        <div className="fx-hero-glow" aria-hidden="true" />
        <img className="fx-hero-dove" src={dove} alt="" />
        <div className="fx-hero-text">
          <p className="eyebrow">Shekinah Sons Global · Admin console</p>
          <h1>{greeting()}{name ? `, ${name}` : ""}</h1>
          <p className="muted">Here's what needs attention today.</p>
        </div>
        <button className="secondary fx-refresh" disabled={busy} onClick={() => void load()} aria-label="Refresh">
          <RefreshCw size={16} className={busy ? "fx-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {!data ? (
        <p role="status" className="muted">{busy ? "Loading overview…" : "Overview unavailable."}</p>
      ) : (
        <>
          <Link to="/live" className={`fx-live ${live ? "is-live" : ""}`}>
            <span className="fx-live-icon"><Radio size={26} /></span>
            <span className="fx-live-text">
              <small>{live ? "LIVE NOW" : "NOT LIVE"}</small>
              <strong>{live ? data.liveTitle || "Live service" : "Ready for your next service"}</strong>
              <span>{live ? "Watch, moderate chat and see viewers" : "Cameras, OBS, YouTube forwarding and replays"}</span>
            </span>
            <span className="fx-live-cta">{live ? "Open live" : "Go live"}</span>
          </Link>

          <div className="fx-tiles">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <Link key={t.label} to={t.to} className={`fx-tile ${t.attention ? "attention" : ""}`} style={{ ["--tile" as string]: t.tint }}>
                  <span className="kit-icon-tile"><Icon size={22} /></span>
                  <strong>{t.value}</strong>
                  <span className="fx-tile-label">{t.label}</span>
                  <small>{t.detail}</small>
                </Link>
              );
            })}
          </div>

          <ToolHub groups={[["Quick actions", [
            { to: "/sermons", label: "Publish sermons", sub: "Audio, video, notes, YouTube links", icon: Mic2, tint: "#d4af37" },
            { to: "/events", label: "Create an event", sub: "Questions, tickets, release dates", icon: CalendarDays, tint: "#6ea8ff" },
            { to: "/checkins", label: "Check-in", sub: "Member codes and event tickets", icon: ClipboardCheck, tint: "#4ade80" },
            { to: "/notifications", label: "Send notification", sub: "Reach every phone at once", icon: MessagesSquare, tint: "#ff8fa3" },
            { to: "/library", label: "Publish books", sub: "Free or paid, automatic covers", icon: BookOpen, tint: "#b79cff" },
            { to: "/settings", label: "Ministry settings", sub: "Service times, contacts, email", icon: Settings, tint: "#d4af37" },
          ]]]} />
        </>
      )}
    </main>
  );
}
