import { Link } from "react-router-dom";

import { getUser } from "../auth/session";

export function DashboardPage() {
  const user = getUser();

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Content Operations</h1>
          <p className="muted">
            Manage church content that appears in the mobile app.
          </p>
        </div>

        <div className="user-pill">
          {user?.name} · {user?.role}
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Sermons</span>
          <strong>Manage</strong>
          <p>Video/audio messages, thumbnails, dates, and categories.</p>
          <Link to="/sermons">Open Sermons →</Link>
        </article>

        <article className="stat-card muted-card">
          <span>Devotions</span>
          <strong>Next</strong>
          <p>Daily devotion content and scripture reflections.</p>
        </article>

        <article className="stat-card muted-card">
          <span>Events</span>
          <strong>Next</strong>
          <p>Church events, conferences, and service schedules.</p>
        </article>

        <article className="stat-card muted-card">
          <span>Updates</span>
          <strong>Next</strong>
          <p>Announcements, prayer points, and public updates.</p>
        </article>
      </section>
    </main>
  );
}
