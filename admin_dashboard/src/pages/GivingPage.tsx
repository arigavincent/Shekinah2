import { useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../api/client";
import {
  listGivingTransactions,
  type GivingTransaction
} from "../api/adminGivingApi";

function formatKes(amount: number) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusClass(status: string) {
  if (status === "success") return "status-pill live";
  if (status === "failed" || status === "cancelled") return "status-pill danger";
  return "status-pill offline";
}

function statusLabel(status: string) {
  if (status === "success") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

export function GivingPage() {
  const [transactions, setTransactions] = useState<GivingTransaction[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return transactions.filter(transaction => {
      const matchesStatus = status === "all" || transaction.status === status;

      const searchable = [
        transaction.id,
        transaction.category,
        transaction.method,
        transaction.phone,
        transaction.status,
        transaction.checkoutRequestId,
        transaction.merchantRequestId,
        transaction.mpesaReceiptNumber,
        transaction.resultDescription,
        transaction.note
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!q || searchable.includes(q));
    });
  }, [transactions, query, status]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        acc.count += 1;

        if (transaction.status === "success") {
          acc.successCount += 1;
          acc.successAmount += Number(transaction.amount || 0);
        }

        if (transaction.status === "pending") {
          acc.pendingCount += 1;
          acc.pendingAmount += Number(transaction.amount || 0);
        }

        if (transaction.status === "failed") {
          acc.failedCount += 1;
        }

        return acc;
      },
      {
        count: 0,
        successCount: 0,
        successAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        failedCount: 0
      }
    );
  }, [transactions]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listGivingTransactions();
      setTransactions(response.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load giving transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openDocument(transactionId: string, kind: "receipt" | "invoice") {
    window.open(`${API_BASE_URL}/api/v1/admin/giving/transactions/${transactionId}/${kind}.pdf`, "_blank");
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Giving</h1>
          <p className="muted">
            Monitor M-Pesa giving transactions, payment status, receipts, and callback results.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <p>Total Transactions</p>
          <strong>{totals.count}</strong>
        </article>

        <article className="stat-card">
          <p>Paid Amount</p>
          <strong>{formatKes(totals.successAmount)}</strong>
          <span>{totals.successCount} paid</span>
        </article>

        <article className="stat-card">
          <p>Pending Amount</p>
          <strong>{formatKes(totals.pendingAmount)}</strong>
          <span>{totals.pendingCount} pending</span>
        </article>

        <article className="stat-card">
          <p>Failed</p>
          <strong>{totals.failedCount}</strong>
        </article>
      </section>

      <section className="list-card">
        <div className="section-title-row">
          <h2>Transactions</h2>
          <span className="count-pill">{filtered.length}</span>
        </div>

        <div className="toolbar-row">
          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search phone, receipt, category, transaction id..."
          />

          <select
            className="search"
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="success">Paid</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <p className="muted">Loading giving transactions...</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No giving transactions found.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Checkout ID</th>
                  <th>Result</th>
                  <th>Documents</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(transaction => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>
                      <strong>{formatKes(transaction.amount)}</strong>
                    </td>
                    <td>{transaction.category}</td>
                    <td>{transaction.phone}</td>
                    <td>
                      <span className={statusClass(transaction.status)}>
                        {statusLabel(transaction.status)}
                      </span>
                    </td>
                    <td>{transaction.mpesaReceiptNumber || "-"}</td>
                    <td>
                      <code>{transaction.checkoutRequestId || "-"}</code>
                    </td>
                    <td>
                      <small>{transaction.resultDescription || "-"}</small>
                      {transaction.note ? (
                        <p className="small-muted">Note: {transaction.note}</p>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {transaction.status === "success" ? (
                          <button className="secondary" onClick={() => openDocument(transaction.id, "receipt")}>
                            Receipt
                          </button>
                        ) : (
                          <span className="small-muted">Receipt after payment</span>
                        )}
                        <button className="secondary" onClick={() => openDocument(transaction.id, "invoice")}>
                          Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
