import {Link} from "react-router-dom";
import {getUser} from "../auth/session";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check, FileText, Receipt, RefreshCw, Printer } from "lucide-react";

import { API_BASE_URL } from "../api/client";
import { getToken } from "../auth/session";
import { InlineAlert } from "../components/InlineAlert";
import { PaginationBar } from "../components/PaginationBar";
import { usePaginatedItems } from "../hooks/usePaginatedItems";
import {
  getGivingDetails,
  listGivingTransactions,
  reviewGivingTransaction,
  saveGivingDetails,
  type GivingDetails,
  type GivingTransaction,
  type Paybill
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
  if (status === "awaiting_verification") return "Needs check";
  if (status === "success") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function methodLabel(method: string) {
  if (method === "mpesa_paybill") return "M-Pesa paybill";
  if (method === "airtel_paybill") return "Airtel paybill";
  if (method === "bank") return "Bank";
  if (method === "card") return "Card";
  return "M-Pesa prompt";
}

const emptyPaybill: Paybill = { enabled: false, paybill: "", account: "", accountHint: "", name: "Shekinah Sons Global" };
const emptyDetails: GivingDetails = {
  mpesa: { ...emptyPaybill },
  airtel: { ...emptyPaybill },
  bank: { enabled: false, bankName: "", accountName: "Shekinah Sons Global", accountNumber: "", branch: "", swiftCode: "", reference: "" },
  note: "",
  categories: ["Tithe", "Offering", "Thanksgiving", "Project", "Special Seed"]
};

// The payment details members see on the giving cards in the app.
function PaymentDetailsCard() {
  const [details, setDetails] = useState<GivingDetails>(emptyDetails);
  const [categories, setCategories] = useState(emptyDetails.categories.join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getGivingDetails()
      .then(response => {
        setDetails({ ...emptyDetails, ...response.details });
        setCategories((response.details.categories || []).join(", "));
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load payment details"));
  }, []);

  function paybill(key: "mpesa" | "airtel", label: string) {
    const value = details[key];
    const set = (patch: Partial<Paybill>) => setDetails({ ...details, [key]: { ...value, ...patch } });
    return (
      <fieldset className="editor-card">
        <label className="checkbox-row">
          <input type="checkbox" checked={value.enabled} onChange={e => set({ enabled: e.target.checked })} /> {label}
        </label>
        <label>Paybill number<input value={value.paybill} onChange={e => set({ paybill: e.target.value })} placeholder="e.g. 247247" /></label>
        <label>Account number<input value={value.account} onChange={e => set({ account: e.target.value })} placeholder="Leave empty to use the giving type" /></label>
        <label>Hint for the account<input value={value.accountHint} onChange={e => set({ accountHint: e.target.value })} placeholder="e.g. Use TITHE, OFFERING or your name" /></label>
        <label>Business name shown<input value={value.name} onChange={e => set({ name: e.target.value })} /></label>
      </fieldset>
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await saveGivingDetails({ ...details, categories: categories.split(",").map(item => item.trim()).filter(Boolean) });
      setDetails({ ...emptyDetails, ...response.details });
      setMessage("Saved. Members see the new details next time they open Giving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment details");
    } finally {
      setSaving(false);
    }
  }

  const bank = details.bank;
  const setBank = (patch: Partial<typeof bank>) => setDetails({ ...details, bank: { ...bank, ...patch } });

  return (
    <section className="list-card">
      <div className="section-title-row">
        <h2>Payment details</h2>
        <span className="count-pill">Shown in the app</span>
      </div>
      <p className="muted">Members pay with these details on their own phone or bank, then confirm in the app with the transaction code. Confirm each one below once it shows in your statement.</p>
      {error ? <InlineAlert title="Payment details" message={error} /> : null}
      <div className="content-grid">
        {paybill("mpesa", "M-Pesa paybill")}
        {paybill("airtel", "Airtel Money paybill")}
        <fieldset className="editor-card">
          <label className="checkbox-row">
            <input type="checkbox" checked={bank.enabled} onChange={e => setBank({ enabled: e.target.checked })} /> Bank transfer
          </label>
          <label>Bank<input value={bank.bankName} onChange={e => setBank({ bankName: e.target.value })} /></label>
          <label>Account name<input value={bank.accountName} onChange={e => setBank({ accountName: e.target.value })} /></label>
          <label>Account number<input value={bank.accountNumber} onChange={e => setBank({ accountNumber: e.target.value })} /></label>
          <label>Branch<input value={bank.branch} onChange={e => setBank({ branch: e.target.value })} /></label>
          <label>SWIFT code<input value={bank.swiftCode} onChange={e => setBank({ swiftCode: e.target.value })} /></label>
          <label>Reference to use<input value={bank.reference} onChange={e => setBank({ reference: e.target.value })} placeholder="e.g. Your name + giving type" /></label>
        </fieldset>
      </div>
      <label>Giving types (comma separated)<input value={categories} onChange={e => setCategories(e.target.value)} /></label>
      <label>Note shown under the options<input value={details.note} onChange={e => setDetails({ ...details, note: e.target.value })} /></label>
      {message ? <p className="muted">{message}</p> : null}
      <button disabled={saving} onClick={save}>{saving ? "Saving..." : "Save payment details"}</button>
    </section>
  );
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
  const [currency,setCurrency]=useState("KES");
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
        transaction.providerReference || "",
        transaction.payerName || "",
        transaction.resultDescription,
        transaction.note
      ]
        .join(" ")
        .toLowerCase();

      return (transaction.currency||"KES")===currency && matchesStatus && matchesCategory && (!q || searchable.includes(q));
    });

    return next.sort((a, b) => {
      if (sortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "amount_high") return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === "amount_low") return Number(a.amount || 0) - Number(b.amount || 0);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [transactions, query, status, category, sortBy,currency]);

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
    return filtered.reduce(
      (acc, transaction) => {
        acc.count += 1;
        if (transaction.status === "success") {
          acc.successCount += 1;
          acc.successAmount += Number(transaction.amount || 0);
        }
        if (transaction.status === "pending" || transaction.status === "awaiting_verification") {
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
  }, [filtered]);

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

  async function review(id: string, next: "success" | "failed") {
    try {
      const response = await reviewGivingTransaction(id, next);
      setTransactions(items => items.map(item => (item.id === id ? response.transaction : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the transaction");
    }
  }

  async function openDocument(transactionId: string, kind: "receipt" | "invoice") {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/giving/transactions/${transactionId}/${kind}.pdf`, {headers:{Authorization:`Bearer ${getToken()}`}});
      if(!response.ok) throw new Error(`Could not download ${kind} (${response.status})`);
      const url=URL.createObjectURL(await response.blob());
      const link=document.createElement("a");link.href=url;link.download=`${kind}-${transactionId}.pdf`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error) {setError(error instanceof Error?error.message:"Could not download document");}
  }

  async function printReceipt(transactionId: string) {
    const popup = window.open("", "_blank");
    if (!popup) { setError("Allow the receipt window to open, then choose Print again."); return; }
    popup.opener = null;
    popup.document.body.textContent = "Preparing receipt…";
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/giving/transactions/${transactionId}/receipt.pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error(`Could not print receipt (${response.status})`);
      const { printReceiptPDF } = await import("../lib/printReceipt");
      await printReceiptPDF(popup, await response.arrayBuffer());
    } catch (error) { popup.close(); setError(error instanceof Error ? error.message : "Could not print receipt"); }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Payments</h1>
          <p className="muted">
            Set the paybill and bank details members see, and confirm the gifts they report.
          </p>
        </div>

        <button className="secondary compact" onClick={load}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Giving data could not be loaded" message={error} /> : null}

      {["admin","super_admin"].includes(getUser()?.role||"")&&<PaymentDetailsCard />}

      <label>Currency<select value={currency} onChange={e=>setCurrency(e.target.value)}>{Array.from(new Set(["KES",...transactions.map(t=>t.currency||"KES")])).map(c=><option key={c}>{c}</option>)}</select></label>
      <p className="muted">These totals cover the matching transactions in the latest 200 payments, including donations and purchases. <Link className="text-link" to="/monetization">View income by source and item →</Link></p>
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
          <span>{totals.pendingCount} to confirm</span>
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
              <option value="awaiting_verification">Needs check</option>
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
                  <th>Member</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Code</th>
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
                    <td>
                      <span>{transaction.payerName || "—"}</span>
                      {transaction.phone ? <p className="cell-note tabular">{transaction.phone}</p> : null}
                    </td>
                    <td>
                      <span className={statusClass(transaction.status)}>
                        {statusLabel(transaction.status)}
                      </span>
                    </td>
                    <td>{methodLabel(transaction.method)}</td>
                    <td>
                      <CopyableId value={transaction.providerReference || transaction.mpesaReceiptNumber || transaction.checkoutRequestId} />
                    </td>
                    <td className="cell-result">
                      <span>{transaction.resultDescription || "—"}</span>
                      {transaction.note ? (
                        <p className="cell-note">Note: {transaction.note}</p>
                      ) : null}
                    </td>
                    <td className="actions-col">
                      <div className="row-actions-compact">
                        {transaction.status === "awaiting_verification" ? (
                          <>
                            <button type="button" className="ghost-action" onClick={() => review(transaction.id, "success")} title="Seen in the statement">
                              <Check size={14} aria-hidden="true" /> Confirm
                            </button>
                            <button type="button" className="ghost-action" onClick={() => review(transaction.id, "failed")} title="Not in the statement">
                              Not found
                            </button>
                          </>
                        ) : null}
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
                        {transaction.status === "success" && <button type="button" className="ghost-action" onClick={() => printReceipt(transaction.id)} title="Print confirmed payment receipt"><Printer size={14} aria-hidden="true" /> Print receipt</button>}
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
