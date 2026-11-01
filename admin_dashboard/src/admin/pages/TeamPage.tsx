import { useEffect, useRef, useState } from "react";
import { listMembers, setMemberPermissions, type Member } from "../api/adminMembersApi";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { useAdminFeedback } from "../feedback/AdminFeedback";
const PERMISSIONS: { key: string; label: string; detail: string }[] = [
  { key: "sermons:manage", label: "Manage sermons", detail: "Upload and schedule audio or video" },
  { key: "events:manage", label: "Manage events", detail: "Create events and registration forms" },
  {
    key: "content:manage",
    label: "Manage content",
    detail: "Devotions, updates and reading plans",
  },
  {
    key: "community:moderate",
    label: "Moderate community",
    detail: "Review messages, reports and testimonies",
  },
  { key: "finance:manage", label: "Finance", detail: "Verify payments and view receipts" },
  { key: "live:broadcast", label: "Go live", detail: "Stream services from the app's Live tab" },
  {
    key: "live:moderate",
    label: "Moderate live chat",
    detail: "Pin, remove and block comments; slow mode",
  },
  {
    key: "books:publish",
    label: "Publish books",
    detail: "Add books and materials, set free or a price",
  },
  { key: "checkin:scan", label: "Gate check-in", detail: "Scan members' codes and see attendance" },
];

type Change = {
  member: string;
  email: string;
  permission: string;
  action: string;
  changedBy: string;
  at: string;
};
export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(""),
    [error, setError] = useState(""),
    [changes, setChanges] = useState<Change[]>([]);
  const version = useRef(0),
    { confirm, showToast } = useAdminFeedback();
  async function load(q = query) {
    const request = ++version.current;
    setLoading(true);
    setError("");
    try {
      const r = await listMembers(q);
      if (request === version.current) setMembers(r.members || []);
    } catch (e) {
      if (request === version.current)
        setError(e instanceof Error ? e.message : "Could not load users");
    } finally {
      if (request === version.current) setLoading(false);
    }
  }
  async function log() {
    try {
      const r = await apiRequest<{ changes: Change[] }>("/api/v1/admin/permissions/log", {
        token: getToken(),
      });
      setChanges(r.changes || []);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    const t = setTimeout(() => void load(query), 250);
    return () => {
      clearTimeout(t);
      version.current++;
    };
  }, [query]);
  async function toggle(member: Member, key: string) {
    setSaving(member.id);
    setError("");
    try {
      const next = member.permissions.includes(key)
        ? member.permissions.filter((p) => p !== key)
        : [...member.permissions, key];
      const r = await setMemberPermissions(member.id, next);
      setMembers((items) =>
        items.map((m) => (m.id === member.id ? { ...m, permissions: r.permissions } : m)),
      );
      showToast({
        title: "Permissions updated",
        message: member.name + "’s access has been saved.",
        tone: "success",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save permissions");
    } finally {
      setSaving("");
    }
  }
  async function reset(member: Member) {
    if (
      !(await confirm({
        title: "Send password reset?",
        message: `A reset code will be emailed to ${member.email}.`,
        confirmLabel: "Send reset code",
      }))
    )
      return;
    setSaving(member.id);
    setError("");
    try {
      const r = await apiRequest<{ message: string }>(
        `/api/v1/admin/members/${member.id}/reset-password`,
        { method: "POST", token: getToken() },
      );
      showToast({ title: "Password reset", message: r.message, tone: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset code");
    } finally {
      setSaving("");
    }
  }
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Manage Users</h1>
          <p className="muted">
            Member profiles, staff access and permission history. Serve Teams are managed
            separately.
          </p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      <section className="list-card">
        <label>
          Find a user
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
          />
        </label>
        <p className="small-muted">
          {loading ? "Loading users…" : `${members.length} users shown · search to narrow the list`}
        </p>
        {!loading && members.length === 0 && <p>No users match your search.</p>}
        {members.map((m) => {
          const admin = ["admin", "super_admin"].includes(m.role);
          return (
            <details className="user-card" key={m.id}>
              <summary>
                <strong>{m.name}</strong> · {m.email}{" "}
                <span className="status-chip">
                  {m.role === "super_admin" ? "Super admin" : admin ? "Admin" : m.permissions.length ? "Staff" : "Member"}
                </span>{" "}
                <span className={`status-chip ${m.isActive ? "success" : "danger"}`}>
                  {m.isActive ? "Active" : "Inactive"}
                </span>
              </summary>
              <p className="small-muted">
                Joined {new Date(m.createdAt).toLocaleDateString("en-KE")} · Role:{" "}
                {m.role.replaceAll("_", " ")}
              </p>
              <p className="muted">
                {admin
                  ? "Administrators have full access to the system."
                  : "Grant only the tools this person needs. Changes apply to both web and app."}
              </p>
              <div className="permission-grid">
                {PERMISSIONS.map((p) => (
                  <label className="permission-option" key={p.key}>
                    <input
                      aria-label={`${p.label} for ${m.name}`}
                      type="checkbox"
                      checked={admin || m.permissions.includes(p.key)}
                      disabled={admin || !!saving || !m.isActive}
                      onChange={() => void toggle(m, p.key)}
                    />
                    <span>
                      {p.label}
                      <small>{p.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="secondary compact"
                disabled={!!saving || !m.isActive}
                onClick={() => void reset(m)}
              >
                Send password reset
              </button>
            </details>
          );
        })}
      </section>
      <details
        className="list-card"
        onToggle={(e) => {
          if (e.currentTarget.open) void log();
        }}
      >
        <summary>Permission history</summary>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Change</th>
                <th>Changed by</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, i) => (
                <tr key={i}>
                  <td>
                    {c.member}
                    <p className="cell-note">{c.email}</p>
                  </td>
                  <td>
                    {PERMISSIONS.find((p) => p.key === c.permission)?.label || c.permission} ·{" "}
                    {c.action}
                  </td>
                  <td>{c.changedBy}</td>
                  <td>{new Date(c.at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!changes.length && <p className="muted">No permission changes recorded.</p>}
      </details>
    </main>
  );
}
