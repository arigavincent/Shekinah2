import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { MemberSelect } from "../components/MemberSelect";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";

type Fund = { id: string; name: string; code: string; description: string; isActive: boolean };
type Kiosk = { id: string; name: string; location: string; serialNumber: string; locked: boolean; pairedAt: string };

export function FinancePage() {
  const [tab, setTab] = useState<"funds"|"transaction"|"kiosks"|"refunds"|"statements">("funds");
  const token = getToken();
  return (
    <div className="admin-page">
      <header className="page-header"><div><p className="eyebrow">Super Admin</p><h1>Finance & Funds</h1><p className="muted">Funds, cash and cheque entries, refunds and yearly giving statements.</p></div></header>
      <div className="tabs" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["funds","transaction","kiosks","refunds","statements"] as const).map(t => (
          <button key={t} className={`btn compact ${tab===t?"primary":""}`} onClick={() => setTab(t)}>{t === "funds" ? "Chart of Accounts" : t === "transaction" ? "Manual Entry" : t === "kiosks" ? "POS & Kiosks" : t === "refunds" ? "Refunds" : "Donor Statements"}</button>
        ))}
      </div>
      {tab === "funds" && <FundsTab token={token} />}
      {tab === "transaction" && <TransactionTab token={token} />}
      {tab === "kiosks" && <KiosksTab token={token} />}
      {tab === "refunds" && <RefundsTab token={token} />}
      {tab === "statements" && <StatementsTab token={token} />}
    </div>
  );
}

function FundsTab({ token }: { token: string | null }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [desc, setDesc] = useState("");
  const { showToast } = useAdminFeedback();
  async function load() { setLoading(true); try { const r = await apiRequest<{ funds: Fund[] }>("/api/v1/admin/sa/finance/funds", { token }); setFunds(r.funds || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function save() {
    try { await apiRequest("/api/v1/admin/sa/finance/funds", { method: "PUT", token, body: { name, code, description: desc } }); showToast({ title: "Saved", message: "Fund saved", tone: "success" }); setName(""); setCode(""); setDesc(""); void load(); } catch (e: any) { setError(e.message); }
  }
  return (<div>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>Add / Edit Fund</h3>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input className="input" placeholder="Fund name" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
        <input className="input" placeholder="Code" value={code} onChange={e => setCode(e.target.value)} style={{ width: 100 }} />
        <input className="input" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} style={{ flex: 2 }} />
        <button className="btn primary" onClick={save} disabled={!name}>Save</button>
      </div>
    </div>
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Active</th></tr></thead><tbody>
        {funds.map(f => <tr key={f.id}><td>{f.name}</td><td><code>{f.code}</code></td><td>{f.description}</td><td>{f.isActive ? "✓" : "✗"}</td></tr>)}
      </tbody></table></div>
    )}
  </div>);
}

function TransactionTab({ token }: { token: string | null }) {
  const [fundId, setFundId] = useState(""); const [amount, setAmount] = useState(""); const [type, setType] = useState("cash");
  const [donorId, setDonorId] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function submit() {
    setError(""); setSuccess("");
    try { await apiRequest("/api/v1/admin/sa/finance/transactions", { method: "POST", token, body: { fundId, amount: parseFloat(amount), currency: "KES", type, donorId: donorId || undefined, notes } }); setSuccess("Transaction recorded"); setAmount(""); setNotes(""); } catch (e: any) { setError(e.message); }
  }
  return (<div className="card" style={{ padding: 16 }}>
    <h3>Record Manual Transaction</h3>
    {error && <div className="alert alert-error">{error}</div>}
    {success && <div className="alert alert-success">{success}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
      <label>Fund ID<input className="input" value={fundId} onChange={e => setFundId(e.target.value)} /></label>
      <label>Amount<input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Type<select className="input" value={type} onChange={e => setType(e.target.value)}><option value="cash">Cash</option><option value="check">Check</option><option value="transfer">Transfer</option><option value="mpesa">M-Pesa</option></select></label>
      <label>Donor (optional)<MemberSelect token={token} value={donorId} onChange={setDonorId} /></label>
      <label style={{ gridColumn: "1/3" }}>Notes<textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></label>
    </div>
    <button className="btn primary" style={{ marginTop: 12 }} onClick={submit} disabled={!fundId || !amount}>Record</button>
  </div>);
}

function KiosksTab({ token }: { token: string | null }) {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [name, setName] = useState(""); const [loc, setLoc] = useState(""); const [serial, setSerial] = useState("");
  const { showToast } = useAdminFeedback();
  async function load() { setLoading(true); try { const r = await apiRequest<{ kiosks: Kiosk[] }>("/api/v1/admin/sa/kiosks", { token }); setKiosks(r.kiosks || []); } catch (e: any) { setError(e.message); } setLoading(false); }
  useEffect(() => { void load(); }, []);
  async function pair() { try { await apiRequest("/api/v1/admin/sa/kiosks", { method: "POST", token, body: { name, location: loc, serialNumber: serial } }); showToast({ title: "Paired", message: "Kiosk paired", tone: "success" }); setName(""); setLoc(""); setSerial(""); void load(); } catch (e: any) { setError(e.message); } }
  async function toggleLock(k: Kiosk) { try { await apiRequest(`/api/v1/admin/sa/kiosks/${k.id}/lock`, { method: "PATCH", token, body: { locked: !k.locked } }); void load(); } catch (e: any) { setError(e.message); } }
  async function unbind(k: Kiosk) { try { await apiRequest(`/api/v1/admin/sa/kiosks/${k.id}`, { method: "DELETE", token }); void load(); } catch (e: any) { setError(e.message); } }
  return (<div>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3>Pair New Kiosk</h3>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
        <input className="input" placeholder="Location" value={loc} onChange={e => setLoc(e.target.value)} style={{ flex: 1 }} />
        <input className="input" placeholder="Serial #" value={serial} onChange={e => setSerial(e.target.value)} style={{ flex: 1 }} />
        <button className="btn primary" onClick={pair} disabled={!name}>Pair</button>
      </div>
    </div>
    {loading ? <div className="loading-spinner" /> : (
      <div className="card"><table className="data-table"><thead><tr><th>Name</th><th>Location</th><th>Serial</th><th>Locked</th><th>Actions</th></tr></thead><tbody>
        {kiosks.map(k => <tr key={k.id}><td>{k.name}</td><td>{k.location}</td><td><code>{k.serialNumber}</code></td><td>{k.locked ? "🔒" : "🔓"}</td>
          <td style={{ display: "flex", gap: 4 }}><button className="btn compact" onClick={() => toggleLock(k)}>{k.locked ? "Unlock" : "Lock"}</button><button className="btn compact danger" onClick={() => unbind(k)}>Unbind</button></td></tr>)}
      </tbody></table></div>
    )}
  </div>);
}

function RefundsTab({ token }: { token: string | null }) {
  const [txId, setTxId] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  async function submit() { setError(""); setSuccess(""); try { await apiRequest(`/api/v1/admin/sa/finance/transactions/${txId}/refund`, { method: "POST", token, body: { reason } }); setSuccess("Refund processed"); setTxId(""); setReason(""); } catch (e: any) { setError(e.message); } }
  return (<div className="card" style={{ padding: 16 }}>
    <h3>Process Refund</h3>
    {error && <div className="alert alert-error">{error}</div>}
    {success && <div className="alert alert-success">{success}</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <input className="input" placeholder="Payment reference (shown on the Payments page and the receipt)" value={txId} onChange={e => setTxId(e.target.value.trim())} style={{ flex: 1 }} />
      <input className="input" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} style={{ flex: 2 }} />
      <button className="btn danger" onClick={submit} disabled={!txId || !reason}>Refund</button>
    </div>
  </div>);
}

function StatementsTab({ token }: { token: string | null }) {
  const [memberId, setMemberId] = useState(""); const [year, setYear] = useState(new Date().getFullYear().toString());
  const [data, setData] = useState<StatementData | null>(null); const [error, setError] = useState("");
  async function fetch_() { setError(""); try { const r = await apiRequest<StatementData>(`/api/v1/admin/sa/members/${memberId}/donation-statement?year=${year}`, { token }); setData(r); } catch (e: any) { setError(e.message); } }
  return (<div className="card" style={{ padding: 16 }}>
    <h3>Donor Statement</h3>
    {error && <div className="alert alert-error">{error}</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <div style={{ flex: 2 }}><MemberSelect token={token} value={memberId} onChange={setMemberId} includeArchived /></div>
      <input className="input" placeholder="Year" value={year} onChange={e => setYear(e.target.value)} style={{ width: 90 }} />
      <button className="btn primary" onClick={fetch_} disabled={!memberId}>Generate</button>
    </div>
    {data && <Statement data={data} />}
  </div>);
}

type StatementData = { member: { name: string; email: string }; year: string; totals: Record<string, number>; contributions: { date: string; amount: number; currency: string; category: string; method: string; reference: string }[] };
function Statement({ data }: { data: StatementData }) {
  const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;
  return (<div className="statement" style={{ marginTop: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div><h3 style={{ margin: 0 }}>Giving statement {data.year}</h3><p style={{ margin: "4px 0 0", color: "var(--text-secondary)" }}>{data.member.name} · {data.member.email}</p></div>
      <button className="btn compact" onClick={() => window.print()}>Print</button>
    </div>
    {data.contributions.length === 0 ? <p style={{ marginTop: 12 }}>No confirmed giving in {data.year}.</p> : (<>
      <table className="data-table" style={{ marginTop: 12 }}><thead><tr><th>Date</th><th>Towards</th><th>Method</th><th>Reference</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead><tbody>
        {data.contributions.map((c, i) => <tr key={i}><td>{new Date(c.date).toLocaleDateString()}</td><td>{c.category}</td><td>{c.method.replace(/_/g, " ")}</td><td><code style={{ fontSize: 12 }}>{c.reference}</code></td><td style={{ textAlign: "right" }}>{money(c.amount, c.currency)}</td></tr>)}
      </tbody></table>
      <p style={{ textAlign: "right", fontWeight: 600, marginTop: 8 }}>Total: {Object.entries(data.totals).map(([c, n]) => money(n, c)).join(" + ")}</p>
    </>)}
  </div>);
}
