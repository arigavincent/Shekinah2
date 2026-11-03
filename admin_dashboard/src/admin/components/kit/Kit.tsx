import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

// Small pieces that give web pages the phone app's look.
const avatarColors = ["#e0565b", "#3fa7d6", "#59c36a", "#a26bd8", "#e39a3b", "#3b82c4", "#d95da4", "#2bb3a3"];
export function personColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return avatarColors[Math.abs(h) % avatarColors.length];
}
export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}
export function Avatar({ name, id, size = 40 }: { name: string; id: string; size?: number }) {
  const c = personColor(id);
  return <span className="kit-avatar" style={{ width: size, height: size, background: `linear-gradient(135deg, ${c}, ${c}99)`, fontSize: size * 0.36 }}>{initials(name)}</span>;
}
export function Person({ name, id, sub }: { name: string; id: string; sub?: string }) {
  return <div className="kit-person"><Avatar name={name} id={id} /><div><strong>{name}</strong>{sub ? <small>{sub}</small> : null}</div></div>;
}

export type HubTool = { to: string; label: string; sub: string; icon: LucideIcon; tint?: string };
export function ToolHub({ groups }: { groups: [string, HubTool[]][] }) {
  return (
    <>
      {groups.map(([group, tools]) => (
        <section key={group}>
          <p className="kit-hub-group">{group}</p>
          <div className="kit-hub">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to} className="kit-hub-card" style={{ ["--tile" as string]: t.tint || "#d4af37" }}>
                  <span className="kit-icon-tile"><Icon size={22} /></span>
                  <strong>{t.label}</strong>
                  <span>{t.sub}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
