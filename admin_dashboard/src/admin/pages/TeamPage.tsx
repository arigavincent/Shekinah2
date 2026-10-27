import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { InlineAlert } from "../components/InlineAlert";
import { listMembers, setMemberPermissions, type Member } from "../api/adminMembersApi";

// What each permission lets a member do in the app.
const PERMISSIONS: { key: string; label: string; detail: string }[] = [
  { key: "live:broadcast", label: "Go live", detail: "Stream services from the app's Live tab" },
  { key: "live:moderate", label: "Moderate live chat", detail: "Pin, remove and block comments; slow mode" },
  { key: "books:publish", label: "Publish books", detail: "Add books and materials, set free or a price" }
];

export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function load(q = query) {
    setLoading(true);
    setError("");
    try {
      const response = await listMembers(q);
      setMembers(response.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function toggle(member: Member, key: string) {
    const next = member.permissions.includes(key) ? member.permissions.filter(p => p !== key) : [...member.permissions, key];
    setSaving(member.id + key);
    try {
      const response = await setMemberPermissions(member.id, next);
      setMembers(items => items.map(m => (m.id === member.id ? { ...m, permissions: response.permissions } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update permissions");
    } finally {
      setSaving("");
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Team &amp; permissions</h1>
          <p className="muted">
            Choose who can go live, moderate the live chat and publish books. Admins can always do all three.
          </p>
        </div>
        <button className="secondary compact" onClick={() => load()}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      {error ? <InlineAlert title="Team" message={error} /> : null}

      <section className="list-card">
        <div className="list-controls">
          <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search members by name or email..." />
        </div>

        {loading ? (
          <p className="muted">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="muted">No members found.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  {PERMISSIONS.map(p => (
                    <th key={p.key} title={p.detail}>{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(member => {
                  const admin = member.role === "admin" || member.role === "super_admin";
                  return (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <p className="cell-note">{member.email}{admin ? " · admin" : ""}</p>
                      </td>
                      {PERMISSIONS.map(p => (
                        <td key={p.key}>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={admin || member.permissions.includes(p.key)}
                              disabled={admin || saving === member.id + p.key}
                              onChange={() => toggle(member, p.key)}
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
