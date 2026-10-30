import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
type Totals = {
  confirmed: number;
  pending: number;
  failed: number;
  cancelled: number;
  sales: number;
  transactions: number;
};
type Report = { totals: Totals; trend: (Totals & { date: string })[] };
export function IncomeDetails({
  id,
  title,
  kind,
  from,
  to,
  currency,
  onClose,
}: {
  id: string;
  title: string;
  kind: string;
  from: string;
  to: string;
  currency: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiRequest<Report>(
      `/api/v1/admin/giving/analytics?${new URLSearchParams({ from, to, currency, item: id })}`,
      { token: getToken() },
    )
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [id, from, to, currency]);
  const format = (n: number) => `${currency} ${n.toLocaleString("en-KE")}`;
  return (
    <section className="list-card" aria-label="Item income details">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Item report</p>
          <h2>{title}</h2>
        </div>
        <button className="secondary compact" onClick={onClose}>
          Close details
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p role="status">Loading item report…</p>
      ) : (
        <>
          <div className="stats-grid compact">
            {[
              ["Confirmed", data.totals.confirmed],
              ["Pending", data.totals.pending],
              ["Failed", data.totals.failed],
              ["Cancelled", data.totals.cancelled],
            ].map(([label, value]) => (
              <article className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{format(Number(value))}</strong>
              </article>
            ))}
          </div>
          <p className="muted">
            {data.totals.sales} confirmed payments from {data.totals.transactions} recorded
            transactions in this period.
          </p>
          {["live", "replays"].includes(kind) && (
            <p className="small-muted">
              This service’s report includes live and later replay purchases. Replay access included
              with a live purchase contributes no extra sale.
            </p>
          )}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date (Nairobi)</th>
                  <th>Confirmed</th>
                  <th>Payments</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.trend
                  .filter((d) => d.transactions > 0)
                  .map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{format(d.confirmed)}</td>
                      <td>{d.sales}</td>
                      <td>{format(d.pending)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Link
            className="text-link"
            to={kind === "books" ? "/library" : kind === "events" ? "/events" : "/live"}
          >
            Open {kind === "books" ? "Library" : kind === "events" ? "Events" : "Live & replays"} →
          </Link>
        </>
      )}
    </section>
  );
}
