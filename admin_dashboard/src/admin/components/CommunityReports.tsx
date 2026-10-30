import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
type Report = {
  id: number;
  messageId: string;
  reason: string;
  status: string;
  name: string;
  message: string;
};
export function CommunityReports() {
  const [reports, setReports] = useState<Report[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setReports(
        (
          await apiRequest<{ reports: Report[] }>("/api/v1/admin/community/reports", {
            token: getToken(),
          })
        ).reports || [],
      );
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function resolve(r: Report, hide: boolean) {
    setBusy(true);
    setError("");
    try {
      if (hide)
        await apiRequest(`/api/v1/admin/community/messages/${r.messageId}`, {
          method: "PATCH",
          token: getToken(),
          body: { status: "hidden", hiddenReason: "Reviewed community report" },
        });
      await apiRequest(`/api/v1/admin/community/reports/${r.id}`, {
        method: "PATCH",
        token: getToken(),
        body: {},
      });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="list-card">
      <div className="section-title-row">
        <h2>
          Reported messages <span className="count-pill">{reports.length}</span>
        </h2>
        <button className="secondary compact" onClick={() => void load()}>
          Refresh reports
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!reports.length && <p className="muted">No reports awaiting review.</p>}
      {reports.map((r) => (
        <article className="item-row" key={r.id}>
          <div>
            <h3>{r.name}</h3>
            <p>{r.message}</p>
            <p className="small-muted">Reason: {r.reason}</p>
          </div>
          <div className="row-actions">
            <button
              disabled={busy}
              className="secondary compact"
              onClick={() => void resolve(r, true)}
            >
              Hide & resolve
            </button>
            <button
              disabled={busy}
              className="secondary compact"
              onClick={() => void resolve(r, false)}
            >
              Dismiss report
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
