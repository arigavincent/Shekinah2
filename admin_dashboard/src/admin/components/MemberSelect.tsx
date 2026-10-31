import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

type Option = { id: string; name: string; email: string; archived?: boolean };

// Search members by name or email and pick one; the value is the member's id.
export function MemberSelect({ token, value, onChange, placeholder = "Search name or email…", includeArchived = false }: {
  token: string | null; value: string; onChange: (id: string) => void; placeholder?: string; includeArchived?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [chosen, setChosen] = useState<Option | null>(null);
  useEffect(() => { if (!value) setChosen(null); }, [value]);
  useEffect(() => {
    const timer = setTimeout(() => {
      apiRequest<{ members: Option[] }>(`/api/v1/admin/members?query=${encodeURIComponent(query)}`, { token })
        .then((r) => setOptions((r.members || []).filter((m) => includeArchived || !m.archived)))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token, includeArchived]);
  if (chosen && value === chosen.id) {
    return (<div className="input" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chosen.name} · {chosen.email}</span>
      <button type="button" className="btn compact" onClick={() => { setChosen(null); onChange(""); }}>Change</button>
    </div>);
  }
  return (<div style={{ position: "relative" }}>
    <input className="input" value={query} placeholder={placeholder} onChange={(e) => setQuery(e.target.value)} />
    {query && options.length > 0 && (
      <div className="card" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: "auto", padding: 4 }}>
        {options.slice(0, 12).map((m) => (
          <button type="button" key={m.id} className="btn compact" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 2 }}
            onClick={() => { setChosen(m); setQuery(""); onChange(m.id); }}>
            <strong>{m.name}</strong> <span style={{ opacity: 0.7 }}>{m.email}</span>
          </button>
        ))}
      </div>
    )}
  </div>);
}
