import { Check, Moon, Sun } from "lucide-react";
import { ADMIN_PALETTES, useAdminTheme, type ThemePalette } from "../theme";
import { getUser } from "../auth/session";

export function AppearancePage() {
  const { mode, setMode, palette, setPalette } = useAdminTheme();
  const user = getUser();

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Appearance</h1>
          <p className="muted">
            Choose how the admin console looks for you. Your preferences are stored on this device.
          </p>
        </div>
      </header>

      <section className="appearance-grid">
        <article className="panel-card">
          <header className="panel-card-head">
            <p className="panel-card-eyebrow">Identity</p>
            <h2>Signed in</h2>
          </header>
          <div className="profile-row">
            <div className="profile-avatar">{(user?.name || "A").charAt(0).toUpperCase()}</div>
            <div className="profile-meta">
              <strong>{user?.name || "Admin"}</strong>
              <span>{user?.email || "—"}</span>
              <span className="role-pill">{user?.role || "admin"}</span>
            </div>
          </div>
        </article>

        <article className="panel-card">
          <header className="panel-card-head">
            <p className="panel-card-eyebrow">Theme</p>
            <h2>Light or dark</h2>
            <p className="muted">Pick the surface brightness that fits your environment.</p>
          </header>
          <div className="mode-toggle-row">
            <button
              type="button"
              className={`mode-tile ${mode === "light" ? "active" : ""}`}
              onClick={() => setMode("light")}
            >
              <Sun size={18} aria-hidden="true" />
              <span>Light</span>
            </button>
            <button
              type="button"
              className={`mode-tile ${mode === "dark" ? "active" : ""}`}
              onClick={() => setMode("dark")}
            >
              <Moon size={18} aria-hidden="true" />
              <span>Dark</span>
            </button>
          </div>
        </article>

        <article className="panel-card span-2">
          <header className="panel-card-head">
            <p className="panel-card-eyebrow">Palette</p>
            <h2>Accent color</h2>
            <p className="muted">Changes the accent across buttons, links, chips, and highlights.</p>
          </header>

          <div className="palette-grid">
            {ADMIN_PALETTES.map(option => (
              <PaletteSwatch
                key={option.id}
                id={option.id}
                label={option.label}
                description={option.description}
                swatch={option.swatch}
                active={palette === option.id}
                onSelect={() => setPalette(option.id)}
              />
            ))}
          </div>

          <div className="palette-preview">
            <div className="palette-preview-head">
              <p className="panel-card-eyebrow">Preview</p>
              <h3>How components look</h3>
            </div>
            <div className="palette-preview-body">
              <button type="button">Primary action</button>
              <button type="button" className="secondary">Secondary</button>
              <button type="button" className="danger">Delete</button>
              <span className="status-pill success">Paid</span>
              <span className="status-pill danger">Failed</span>
              <span className="status-pill warning">Pending</span>
              <a href="#preview" onClick={e => e.preventDefault()} className="accent-link">
                Accent link
              </a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

type SwatchProps = {
  id: ThemePalette;
  label: string;
  description: string;
  swatch: string;
  active: boolean;
  onSelect: () => void;
};

function PaletteSwatch({ id, label, description, swatch, active, onSelect }: SwatchProps) {
  return (
    <button
      type="button"
      className={`palette-tile ${active ? "active" : ""}`}
      onClick={onSelect}
      data-palette-preview={id}
      aria-pressed={active}
    >
      <span className="palette-swatch" style={{ background: swatch }} aria-hidden="true">
        {active ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <span className="palette-tile-meta">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
    </button>
  );
}
