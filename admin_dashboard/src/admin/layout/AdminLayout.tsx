import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic2,
  BookOpen,
  Sunrise,
  CalendarRange,
  CalendarDays,
  Megaphone,
  Building2,
  HandHeart,
  MessagesSquare,
  Sparkles,
  Radio,
  ClipboardCheck,
  Wallet,
  BellRing,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  LogOut,
  Sun,
  Moon,
  Palette,
  type LucideIcon
} from "lucide-react";

import { clearSession, getUser } from "../auth/session";
import { useAdminTheme } from "../theme";

type NavItem = { label: string; to: string; icon: LucideIcon };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: "Content",
    items: [
      { label: "Overview", to: "/", icon: LayoutDashboard },
      { label: "Sermons", to: "/sermons", icon: Mic2 },
      { label: "Library", to: "/library", icon: BookOpen },
      { label: "Devotions", to: "/devotions", icon: Sunrise },
      { label: "Reading Plans", to: "/reading-plans", icon: CalendarRange },
      { label: "Events", to: "/events", icon: CalendarDays },
      { label: "Updates", to: "/updates", icon: Megaphone },
      { label: "Branches", to: "/branches", icon: Building2 }
    ]
  },
  {
    label: "Care",
    items: [
      { label: "Prayer", to: "/prayers", icon: HandHeart },
      { label: "Chat", to: "/community", icon: MessagesSquare },
      { label: "Testimonies", to: "/testimonies", icon: Sparkles }
    ]
  },
  {
    label: "Operations",
    items: [
      { label: "Live", to: "/live", icon: Radio },
      { label: "Check-In", to: "/checkins", icon: ClipboardCheck },
      { label: "Giving", to: "/giving", icon: Wallet },
      { label: "Notifications", to: "/notifications", icon: BellRing }
    ]
  },
  {
    label: "Profile",
    items: [
      { label: "Appearance", to: "/appearance", icon: Palette }
    ]
  }
];

const COLLAPSED_KEY = "shekinah-admin-sidebar-collapsed";
const SIDEBAR_DRAWER_QUERY = "(max-width: 1180px)";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { mode, toggleTheme } = useAdminTheme();

  // Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop rail collapse
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function handleToggle() {
    if (window.matchMedia(SIDEBAR_DRAWER_QUERY).matches) {
      setMobileOpen(open => !open);
    } else {
      setCollapsed(c => !c);
    }
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  const shellClass = [
    "admin-shell",
    collapsed ? "sidebar-collapsed" : "",
    mobileOpen ? "mobile-open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={`sidebar${mobileOpen ? " open" : ""}${collapsed ? " collapsed" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="sidebar-top-row">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">S</div>
            <div className="brand-text">
              <strong>Shekinah</strong>
              <span>Admin Console</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Sections">
          {navSections.map(section => (
            <div key={section.label} className="nav-group">
              <p className="nav-group-label">{section.label}</p>

              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      isActive ? "nav-link active" : "nav-link"
                    }
                    title={item.label}
                    aria-label={item.label}
                  >
                    <Icon size={18} className="nav-link-icon" aria-hidden="true" />
                    <span className="nav-link-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar" aria-hidden="true">
            {(user?.name || "A").charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-meta">
            <p>{user?.name || "Admin"}</p>
            <span>{user?.role || "admin"}</span>
          </div>
          <button
            type="button"
            className="secondary compact sidebar-user-logout"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="nav-link-label">Logout</span>
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="sidebar-toggle-float"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
        onClick={handleToggle}
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="theme-toggle-float"
        onClick={toggleTheme}
        aria-label={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
        title={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
      >
        {mode === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      </button>

      <section className="workspace">
        <Outlet />
      </section>
    </div>
  );
}
