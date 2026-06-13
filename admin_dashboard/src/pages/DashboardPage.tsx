import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { getUser } from "../auth/session";
import { listSermons, type Sermon } from "../api/adminSermonsApi";
import { listDevotions, type Devotion } from "../api/adminDevotionsApi";
import { listEvents, type EventItem } from "../api/adminEventsApi";
import { listUpdates, type UpdateItem } from "../api/adminUpdatesApi";
import { listBranches, type Branch } from "../api/adminBranchesApi";
import { listGivingTransactions, type GivingTransaction } from "../api/adminGivingApi";
import { listPrayers, type AdminPrayer } from "../api/adminPrayersApi";
import { getLiveConfig, type LiveConfig } from "../api/adminLiveConfigApi";
import { listNotificationMessages, type NotificationMessage } from "../api/adminNotificationsApi";
import { listRecentCheckins, type AdminCheckin } from "../api/adminCheckinsApi";
import { listAdminTestimonies, type AdminTestimony } from "../api/adminTestimoniesApi";
import { listCommunityMessages, type AdminCommunityMessage } from "../api/adminCommunityApi";
import { InlineAlert } from "../components/InlineAlert";

type DashboardState = {
  sermons: Sermon[];
  devotions: Devotion[];
  events: EventItem[];
  updates: UpdateItem[];
  branches: Branch[];
  giving: GivingTransaction[];
  prayers: AdminPrayer[];
  notifications: NotificationMessage[];
  checkins: AdminCheckin[];
  testimonies: AdminTestimony[];
  community: AdminCommunityMessage[];
  liveConfig: LiveConfig | null;
};

const EMPTY_STATE: DashboardState = {
  sermons: [],
  devotions: [],
  events: [],
  updates: [],
  branches: [],
  giving: [],
  prayers: [],
  notifications: [],
  checkins: [],
  testimonies: [],
  community: [],
  liveConfig: null
};

function byNewestDate<T extends { date?: string }>(items: T[]) {
  return [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DashboardPage() {
  const user = getUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardState>(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        listSermons(),
        listDevotions(),
        listEvents(),
        listUpdates(),
        listBranches(),
        listGivingTransactions(),
        listPrayers(),
        getLiveConfig(),
        listNotificationMessages(),
        listRecentCheckins(),
        listAdminTestimonies(),
        listCommunityMessages()
      ]);

      if (cancelled) return;

      const nextState: DashboardState = {
        sermons: results[0].status === "fulfilled" ? results[0].value.sermons : [],
        devotions: results[1].status === "fulfilled" ? results[1].value.devotions : [],
        events: results[2].status === "fulfilled" ? results[2].value.events : [],
        updates: results[3].status === "fulfilled" ? results[3].value.updates : [],
        branches: results[4].status === "fulfilled" ? results[4].value.branches : [],
        giving: results[5].status === "fulfilled" ? results[5].value.transactions : [],
        prayers: results[6].status === "fulfilled" ? results[6].value.prayers : [],
        liveConfig: results[7].status === "fulfilled" ? results[7].value.liveConfig : null,
        notifications: results[8].status === "fulfilled" ? results[8].value.messages : [],
        checkins: results[9].status === "fulfilled" ? results[9].value.checkins : [],
        testimonies: results[10].status === "fulfilled" ? results[10].value.testimonies : [],
        community: results[11].status === "fulfilled" ? results[11].value.messages : []
      };

      const failedCalls = results.filter(result => result.status === "rejected").length;
      if (failedCalls > 0) {
        setError(
          failedCalls === results.length
            ? "Dashboard metrics could not be loaded."
            : `Some dashboard panels are unavailable right now (${failedCalls} source${failedCalls === 1 ? "" : "s"} failed).`
        );
      }

      setData(nextState);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const pendingPrayers = data.prayers.filter(item => item.status === "new").length;
    const contactedPrayers = data.prayers.filter(item => item.status === "contacted").length;
    const failedGiving = data.giving.filter(item => item.status === "failed").length;
    const pendingGiving = data.giving.filter(item => item.status === "pending").length;
    const publishedTestimonies = data.testimonies.filter(item => item.status === "approved").length;
    const pendingTestimonies = data.testimonies.filter(item => item.status !== "approved").length;
    const hiddenChat = data.community.filter(item => item.status === "hidden").length;

    return {
      pendingPrayers,
      contactedPrayers,
      failedGiving,
      pendingGiving,
      publishedTestimonies,
      pendingTestimonies,
      hiddenChat
    };
  }, [data]);

  const latestContent = useMemo(
    () =>
      byNewestDate([
        ...data.sermons.map(item => ({
          id: `sermon-${item.id}`,
          type: item.type === "audio" ? "Audio sermon" : "Video sermon",
          title: item.title,
          meta: `${item.speaker} · ${item.category}`,
          date: item.updatedAt || item.createdAt || item.sermonDate,
          to: "/sermons"
        })),
        ...data.devotions.map(item => ({
          id: `devotion-${item.id}`,
          type: "Devotion",
          title: item.title,
          meta: item.excerpt,
          date: item.updatedAt || item.createdAt || item.devotionDate,
          to: "/devotions"
        })),
        ...data.events.map(item => ({
          id: `event-${item.id}`,
          type: "Event",
          title: item.title,
          meta: `${item.location} · ${item.eventTime}`,
          date: item.updatedAt || item.createdAt || item.eventDate,
          to: "/events"
        })),
        ...data.updates.map(item => ({
          id: `update-${item.id}`,
          type: "Update",
          title: item.title,
          meta: item.excerpt,
          date: item.updatedAt || item.createdAt || item.updateDate,
          to: "/updates"
        }))
      ]).slice(0, 6),
    [data]
  );

  const paymentWatchlist = useMemo(
    () =>
      byNewestDate(
        data.giving
          .filter(item => item.status === "failed" || item.status === "pending")
          .map(item => ({
            id: item.id,
            title: `${item.category} · KES ${item.amount}`,
            meta: `${item.phone || "Unknown number"} · ${item.resultDescription || item.status}`,
            date: item.updatedAt || item.createdAt,
            status: item.status
          }))
      ).slice(0, 5),
    [data]
  );

  const careQueue = useMemo(
    () =>
      byNewestDate(
        data.prayers
          .filter(item => item.status !== "contacted")
          .map(item => ({
            id: item.id,
            title: item.isPublic ? item.name || "Public request" : item.ownerEmail || item.name || "Private request",
            meta: `${item.category || "Prayer"} · ${item.status}`,
            date: item.updatedAt || item.createdAt,
            status: item.status
          }))
      ).slice(0, 5),
    [data]
  );

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Content Operations</h1>
          <p className="muted">
            Track publishing, care queues, live status, and payment health from one surface.
          </p>
        </div>

        <div className="user-pill">
          {user?.name} · {user?.role}
        </div>
      </header>

      {error ? <InlineAlert title="Dashboard metrics are partially unavailable" message={error} tone="info" /> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Sermons</span>
          <strong>{loading ? "…" : data.sermons.length}</strong>
          <p>
            {loading
              ? "Loading sermon metrics."
              : `${data.sermons.filter(item => item.type === "video").length} video · ${data.sermons.filter(item => item.type === "audio").length} audio`}
          </p>
          <Link to="/sermons">Open Sermons →</Link>
        </article>

        <article className="stat-card">
          <span>Devotions</span>
          <strong>{loading ? "…" : data.devotions.length}</strong>
          <p>
            {loading
              ? "Loading devotion metrics."
              : `${data.updates.length} public updates are also live in the app.`}
          </p>
          <Link to="/devotions">Open Devotions →</Link>
        </article>

        <article className="stat-card">
          <span>Events</span>
          <strong>{loading ? "…" : data.events.length}</strong>
          <p>
            {loading
              ? "Loading event metrics."
              : `${data.branches.length} branch locations are currently configured.`}
          </p>
          <Link to="/events">Open Events →</Link>
        </article>

        <article className="stat-card">
          <span>Live Status</span>
          <strong>{loading ? "…" : data.liveConfig?.isLive ? "Live" : "Offline"}</strong>
          <p>
            {loading
              ? "Loading live configuration."
              : data.liveConfig?.isLive
                ? `${data.liveConfig?.title || "Service"} · ${data.liveConfig?.viewers || "0"} viewers`
                : `Next service: ${data.liveConfig?.nextService || "Not set"}`}
          </p>
          <Link to="/live">Open Live Config →</Link>
        </article>
      </section>

      <section className="stats-grid compact-top">
        <article className="stat-card">
          <span>Prayer Queue</span>
          <strong>{loading ? "…" : stats.pendingPrayers}</strong>
          <p>
            {loading
              ? "Loading prayer queue."
              : `${stats.contactedPrayers} requests already marked contacted.`}
          </p>
          <Link to="/prayers">Review Prayer Queue →</Link>
        </article>

        <article className="stat-card">
          <span>Giving Watchlist</span>
          <strong>{loading ? "…" : stats.failedGiving}</strong>
          <p>
            {loading
              ? "Loading payment failures."
              : `${stats.pendingGiving} transactions are still pending.`}
          </p>
          <Link to="/giving">Open Giving →</Link>
        </article>

        <article className="stat-card">
          <span>Community</span>
          <strong>{loading ? "…" : data.community.length}</strong>
          <p>
            {loading
              ? "Loading community volume."
              : `${stats.hiddenChat} moderated messages are hidden.`}
          </p>
          <Link to="/community">Open Chat Moderation →</Link>
        </article>

        <article className="stat-card">
          <span>Testimonies</span>
          <strong>{loading ? "…" : stats.publishedTestimonies}</strong>
          <p>
            {loading
              ? "Loading testimony pipeline."
              : `${stats.pendingTestimonies} items still need review.`}
          </p>
          <Link to="/testimonies">Open Testimonies →</Link>
        </article>
      </section>

      <section className="content-grid compact-top">
        <article className="list-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Quick Actions</p>
              <h2>Start Work</h2>
            </div>
          </div>

          <div className="quick-actions-grid">
            <Link className="action-tile" to="/sermons">
              <strong>New Sermon</strong>
              <span>Upload a message, artwork, and media link.</span>
            </Link>
            <Link className="action-tile" to="/devotions">
              <strong>New Devotion</strong>
              <span>Publish a daily reading with cover art and body text.</span>
            </Link>
            <Link className="action-tile" to="/events">
              <strong>New Event</strong>
              <span>Add an upcoming service, conference, or gathering.</span>
            </Link>
            <Link className="action-tile" to="/live">
              <strong>Update Live</strong>
              <span>Change the stream status, title, and YouTube source.</span>
            </Link>
          </div>
        </article>

        <article className="list-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Operations</p>
              <h2>Today At A Glance</h2>
            </div>
          </div>

          <div className="ops-summary-grid">
            <div className="ops-summary-card">
              <span>Notifications Sent</span>
              <strong>{loading ? "…" : data.notifications.length}</strong>
              <p className="small-muted">
                Last broadcast: {data.notifications[0] ? formatDate(data.notifications[0].createdAt) : "No broadcasts yet"}
              </p>
            </div>
            <div className="ops-summary-card">
              <span>Recent Check-Ins</span>
              <strong>{loading ? "…" : data.checkins.length}</strong>
              <p className="small-muted">
                Latest scan: {data.checkins[0] ? `${data.checkins[0].name} · ${formatDate(data.checkins[0].createdAt)}` : "No recent check-ins"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="content-grid compact-top">
        <article className="list-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Publishing</p>
              <h2>Recent Content</h2>
            </div>
            <Link className="count-pill" to="/sermons">All content</Link>
          </div>

          {latestContent.length ? (
            <div className="activity-list">
              {latestContent.map(item => (
                <Link key={item.id} to={item.to} className="activity-row">
                  <div>
                    <span className="status-chip neutral">{item.type}</span>
                    <h3>{item.title}</h3>
                    <p>{item.meta}</p>
                  </div>
                  <time>{formatDate(item.date)}</time>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <p>No content has been created yet.</p>
            </div>
          )}
        </article>

        <article className="list-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Finance</p>
              <h2>Giving Watchlist</h2>
            </div>
            <Link className="count-pill" to="/giving">Open giving</Link>
          </div>

          {paymentWatchlist.length ? (
            <div className="activity-list">
              {paymentWatchlist.map(item => (
                <Link key={item.id} to="/giving" className="activity-row">
                  <div>
                    <span className={`status-chip ${item.status === "failed" ? "danger" : "warning"}`}>
                      {item.status}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.meta}</p>
                  </div>
                  <time>{formatDate(item.date)}</time>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <p>No failed or pending transactions need attention.</p>
            </div>
          )}
        </article>
      </section>

      <section className="content-grid compact-top">
        <article className="list-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Care</p>
              <h2>Prayer Queue</h2>
            </div>
            <Link className="count-pill" to="/prayers">Open queue</Link>
          </div>

          {careQueue.length ? (
            <div className="activity-list">
              {careQueue.map(item => (
                <Link key={item.id} to="/prayers" className="activity-row">
                  <div>
                    <span className={`status-chip ${item.status === "contacted" ? "success" : "neutral"}`}>
                      {item.status}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.meta}</p>
                  </div>
                  <time>{formatDate(item.date)}</time>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <p>No prayer requests are waiting in the queue.</p>
            </div>
          )}
        </article>

        <article className="list-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Channels</p>
              <h2>Coverage</h2>
            </div>
          </div>

          <div className="coverage-grid">
            <div className="coverage-card">
              <span>Branches</span>
              <strong>{loading ? "…" : data.branches.length}</strong>
            </div>
            <div className="coverage-card">
              <span>Updates</span>
              <strong>{loading ? "…" : data.updates.length}</strong>
            </div>
            <div className="coverage-card">
              <span>Notifications</span>
              <strong>{loading ? "…" : data.notifications.length}</strong>
            </div>
            <div className="coverage-card">
              <span>Check-Ins</span>
              <strong>{loading ? "…" : data.checkins.length}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
