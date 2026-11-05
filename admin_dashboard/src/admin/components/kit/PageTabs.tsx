import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type PageTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Small number shown beside the label (e.g. items waiting). */
  count?: number;
  content: ReactNode;
};

// A row of pills under the page title that shows one section at a time,
// like the filters on the phone's admin console. Every panel stays mounted
// (only hidden), so a half-filled form or a running upload survives a switch.
// The open tab is remembered per page for the rest of the browser session.
export function PageTabs({ tabs, active, onChange, storageKey }: {
  tabs: PageTab[];
  active?: string;
  onChange?: (id: string) => void;
  storageKey?: string;
}) {
  const key = `page-tab:${storageKey ?? (typeof window === "undefined" ? "" : window.location.pathname)}`;
  const [own, setOwn] = useState<string>(() => {
    if (typeof window === "undefined") return tabs[0]?.id ?? "";
    const saved = window.sessionStorage.getItem(key);
    return saved && tabs.some(t => t.id === saved) ? saved : tabs[0]?.id ?? "";
  });
  const current = active ?? own;
  const shown = tabs.some(t => t.id === current) ? current : tabs[0]?.id;

  useEffect(() => {
    if (shown) window.sessionStorage.setItem(key, shown);
  }, [key, shown]);

  function pick(id: string) {
    setOwn(id);
    onChange?.(id);
  }

  if (tabs.length === 0) return null;

  return (
    <div className="page-tabs">
      <div className="page-tabs-bar" role="tablist" aria-label="Sections">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const on = tab.id === shown;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={on}
              aria-controls={`panel-${tab.id}`}
              className={on ? "page-tab active" : "page-tab"}
              onClick={() => pick(tab.id)}
            >
              {Icon ? <Icon size={15} aria-hidden="true" /> : null}
              <span>{tab.label}</span>
              {tab.count ? <span className="page-tab-count">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      {tabs.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== shown}
          className="page-tab-panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
