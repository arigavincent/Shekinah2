import { useEffect, useMemo, useState } from "react";
import { Copy, Check, FileText, Receipt, RefreshCw } from "lucide-react";

import { API_BASE_URL } from "../api/client";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import {
  listGivingTransactions,
  type GivingTransaction
} from "../api/adminGivingApi";

function formatKes(amount: number) {
  return Number(amount || 0).toLocaleString();
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusClass(status: string) {
  if (status === "success") return "status-pill success";
  if (status === "failed" || status === "cancelled") return "status-pill danger";
  return "status-pill warning";
}

function statusLabel(status: string) {
  if (status === "success") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function CopyableId({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className="muted-dash">—</span>;

  const short = value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="cell-id" onClick={handleCopy} title={value}>
      <code>{short}</code>
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}

export function GivingPage() {
  const [transactions, setTransactions] = useState<GivingTransaction[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount_high" | "amount_low">("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const next = transactions.filter(transaction => {
      const matchesStatus = status === "all" || transaction.status === status;
      const matchesCategory = category === "all" || transaction.category === category;

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

      return matchesStatus && matchesCategory && (!q || searchable.includes(q));
    });

    return next.sort((a, b) => {
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "amount_high") return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === "amount_low") return Number(a.amount || 0) - Number(b.amount || 0);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [transactions, query, status, category, sortBy]);

  const { page, setPage, totalPages, pagedItems } = usePaginatedItems(
    filtered,
    10,
    [query, status, category, sortBy, transactions.length]
  );

  const categories = useMemo(
    () => Array.from(new Set(transactions.map(item => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [transactions]
  );

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
      { count: 0, successCount: 0, successAmount: 0, pendingCount: 0, pendingAmount: 0, failedCount: 0 }
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
    window.open(`${API_BASE_URL}/api/v1/giving/transactions/${transactionId}/${kind}.pdf`, "_blank");
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

        <button className="secondary compact" onClick={load}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Giving data could not be loaded" message={error} /> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <p>Total Transactions</p>
          <strong className="tabular">{totals.count}</strong>
        </article>

        <article className="stat-card stat-card--success">
          <p>Paid Amount</p>
          <strong className="tabular"><em>KES</em> {formatKes(totals.successAmount)}</strong>
          <span>{totals.successCount} paid</span>
        </article>

        <article className="stat-card stat-card--warning">
          <p>Pending Amount</p>
          <strong className="tabular"><em>KES</em> {formatKes(totals.pendingAmount)}</strong>
          <span>{totals.pendingCount} pending</span>
        </article>

        <article className="stat-card stat-card--danger">
          <p>Failed</p>
          <strong className="tabular">{totals.failedCount}</strong>
        </article>
      </section>

      <section className="list-card">
        <div className="section-title-row">
          <h2>Transactions</h2>
          <span className="count-pill">{filtered.length}</span>
        </div>

        <div className="list-controls">
          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search phone, receipt, category, transaction id..."
          />

          <div className="filters-row">
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="success">Paid</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select value={category} onChange={event => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select value={sortBy} onChange={event => setSortBy(event.target.value as "newest" | "oldest" | "amount_high" | "amount_low")}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Amount High-Low</option>
              <option value="amount_low">Amount Low-High</option>
            </select>

            {(query || status !== "all" || category !== "all" || sortBy !== "newest") ? (
              <button
                type="button"
                className="secondary compact"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setCategory("all");
                  setSortBy("newest");
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
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
                  <th className="num">Amount</th>
                  <th>Category</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Checkout ID</th>
                  <th>Result</th>
                  <th className="actions-col">Documents</th>
                </tr>
              </thead>

              <tbody>
                {pagedItems.map(transaction => (
                  <tr key={transaction.id}>
                    <td className="cell-date">{formatDate(transaction.createdAt)}</td>
                    <td className="num cell-amount">
                      <em>KES</em>
                      <strong className="tabular">{formatKes(transaction.amount)}</strong>
                    </td>
                    <td>{transaction.category || "—"}</td>
                    <td className="tabular">{transaction.phone || "—"}</td>
                    <td>
                      <span className={statusClass(transaction.status)}>
                        {statusLabel(transaction.status)}
                      </span>
                    </td>
                    <td>
                      {transaction.mpesaReceiptNumber ? (
                        <code className="cell-mono">{transaction.mpesaReceiptNumber}</code>
                      ) : (
                        <span className="muted-dash">—</span>
                      )}
                    </td>
                    <td>
                      <CopyableId value={transaction.checkoutRequestId} />
                    </td>
                    <td className="cell-result">
                      <span>{transaction.resultDescription || "—"}</span>
                      {transaction.note ? (
                        <p className="cell-note">Note: {transaction.note}</p>
                      ) : null}
                    </td>
                    <td className="actions-col">
                      <div className="row-actions-compact">
                        {transaction.status === "success" ? (
                          <button
                            type="button"
                            className="ghost-action"
                            onClick={() => openDocument(transaction.id, "receipt")}
                            title="Download receipt"
                          >
                            <Receipt size={14} aria-hidden="true" />
                            Receipt
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost-action"
                            disabled
                            title="Available after payment"
                          >
                            <Receipt size={14} aria-hidden="true" />
                            Receipt
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={() => openDocument(transaction.id, "invoice")}
                          title="Download invoice"
                        >
                          <FileText size={14} aria-hidden="true" />
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

        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          pageSize={10}
          totalItems={filtered.length}
          itemLabel="transactions"
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}
