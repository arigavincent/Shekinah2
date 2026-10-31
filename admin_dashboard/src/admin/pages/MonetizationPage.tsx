import { IncomeDetails } from "../components/IncomeDetails";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest, API_BASE_URL } from "../api/client";
import { getToken } from "../auth/session";
import { nairobiNow } from "../publishing/queue";
type Amounts = {
  confirmed: number;
  pending: number;
  failed: number;
  cancelled: number;
  sales: number;
  transactions: number;
};
type Row = Amounts & { kind: string; id: string; title: string };
type Analytics = {
  from: string;
  to: string;
  currency: string;
  totals: Amounts;
  streams: Row[];
  items: Row[];
  trend: (Amounts & { date: string })[];
};
const names: Record<string, string> = {
  donations: "Donations",
  books: "Books & materials",
  events: "Event tickets",
  live: "Live access",
  replays: "Replay access",
  other: "Other purchases",
};
const money = (n: number) => Number(n || 0).toLocaleString("en-KE");
export function MonetizationPage() {
  const today = nairobiNow().slice(0, 10),
    [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [currency, setCurrency] = useState("KES"),
    [kind, setKind] = useState("all"),
    [data, setData] = useState<Analytics | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  useEffect(() => setSelected(null), [from, to, currency]);
  const sequence = useRef(0);
  const params = () => new URLSearchParams({ from, to, currency }).toString();
  async function load() {
    const seq = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<Analytics>(`/api/v1/admin/giving/analytics?${params()}`, {
        token: getToken(),
      });
      if (seq === sequence.current) setData(r);
    } catch (e) {
      if (seq === sequence.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load analytics");
      }
    } finally {
      if (seq === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [from, to, currency]);
  async function csv() {
    setError("");
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/v1/admin/giving/analytics?${params()}&format=csv`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (!r.ok) throw Error("Could not export income");
      const u = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = u;
      a.download = `shekinah-income-${from}-${to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Monetization & analytics</h1>
          <p className="muted">
            Confirmed income from books, events, live services and replays, alongside donations.
          </p>
        </div>
        <div className="row-actions">
          <button className="secondary" disabled={busy} onClick={() => void load()}>
            Refresh
          </button>
          <button disabled={busy || !data} onClick={() => void csv()}>
            Export CSV
          </button>
        </div>
      </header>
      <section className="list-card">
        <div className="review-grid">
          <label>
            From (Nairobi)
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To (Nairobi)
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            Currency
            <input
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </label>
        </div>
        <p className="small-muted">
          Reporting uses payment creation dates in Africa/Nairobi. Each currency is reported
          separately. Pending, failed and cancelled payments do not count as income.
        </p>
      </section>
      {selected && (
        <IncomeDetails
          key={`${selected.id}-${from}-${to}-${currency}`}
          {...selected}
          from={from}
          to={to}
          currency={currency}
          onClose={() => setSelected(null)}
        />
      )}
      {error && <p role="alert">{error}</p>}
      {busy ? (
        <p role="status">Loading income…</p>
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                ["Confirmed income", data.totals.confirmed],
                ["Pending verification / payment", data.totals.pending],
                ["Failed", data.totals.failed],
                ["Cancelled", data.totals.cancelled],
              ].map(([label, value]) => (
                <article className="stat-card" key={label}>
                  <span>{label}</span>
                  <strong className="metric-value">
                    {data.currency} {money(Number(value))}
                  </strong>
                </article>
              ))}
            </div>
            <section className="list-card">
              <div className="section-title-row">
                <h2>Income by source</h2>
                <Link className="text-link" to="/giving">
                  Review payments →
                </Link>
              </div>
              <div className="stats-grid compact">
                {data.streams.map((s) => (
                  <article className="stat-card" key={s.kind}>
                    <span>{names[s.kind]}</span>
                    <strong>
                      {data.currency} {money(s.confirmed)}
                    </strong>
                    <p className="small-muted">
                      {s.sales} confirmed payments · {data.currency} {money(s.pending)} pending
                    </p>
                  </article>
                ))}
              </div>
              <p className="small-muted">
                A live purchase includes its replay. Only a new purchase after the service ends
                counts as replay income; included replay access is never counted twice.
              </p>
            </section>
            <section className="list-card">
              <h2>Daily confirmed income</h2>
              {data.trend.length <= 93 ? (
                data.trend.map((d) => (
                  <div className="trend-row" key={d.date}>
                    <span>{d.date.slice(5)}</span>
                    <div className="trend-bar">
                      <span
                        style={{
                          width: `${(d.confirmed / Math.max(1, ...data.trend.map((x) => x.confirmed))) * 100}%`,
                        }}
                      />
                    </div>
                    <span>{money(d.confirmed)}</span>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Choose up to three months to view daily bars. Totals and CSV still include the
                  full range.
                </p>
              )}
            </section>
            <section className="list-card">
              <div className="section-title-row">
                <h2>Item performance</h2>
                <label>
                  Source
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="all">All sources</option>
                    {Object.entries(names).map(([k, n]) => (
                      <option key={k} value={k}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Item / giving type</th>
                      <th>Source</th>
                      <th>Confirmed</th>
                      <th>Payments</th>
                      <th>Pending</th>
                      <th>Failed / cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items
                      .filter((r) => kind === "all" || r.kind === kind)
                      .map((r, i) => (
                        <tr key={`${r.kind}-${r.id}-${i}`}>
                          <td>
                            {r.id ? (
                              <button
                                className="secondary compact"
                                onClick={() => {
                                  setSelected(r);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                {r.title}
                              </button>
                            ) : (
                              <strong>{r.title}</strong>
                            )}
                          </td>
                          <td>{names[r.kind]}</td>
                          <td>
                            {data.currency} {money(r.confirmed)}
                          </td>
                          <td>{r.sales}</td>
                          <td>{money(r.pending)}</td>
                          <td>
                            {money(r.failed)} / {money(r.cancelled)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && <p className="muted">No payments in this date range.</p>}
            </section>
            <p className="small-muted">
              Reading and watch-time analytics are unavailable until server-side engagement tracking
              is enabled. This report uses recorded financial transactions.
            </p>
          </>
        )
      )}
    </main>
  );
}
