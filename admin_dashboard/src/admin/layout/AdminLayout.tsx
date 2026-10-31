import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
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
  Users,
  DollarSign,
  UsersRound,
  CalendarCheck,
  MessageSquareText,
  KeyRound,
  Webhook,
  ShieldAlert,
  type LucideIcon, BadgeCheck } from "lucide-react";

import { clearSession, getUser, getToken } from "../auth/session";
import {apiRequest} from "../api/client";
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
      { label: "Payments", to: "/giving", icon: Wallet },
      { label: "Monetization", to: "/monetization", icon: Wallet },
      { label: "Notifications", to: "/notifications", icon: BellRing },
      {label:"Settings",to:"/settings",icon:ShieldCheck},
      { label: "Serve Teams", to: "/serve-settings", icon: HandHeart },
      { label: "Users", to: "/users", icon: ShieldCheck }
    ]
  },
  {
    label: "Profile",
    items: [
      { label: "Appearance", to: "/appearance", icon: Palette },
      { label: "Account security", to: "/account-security", icon: ShieldCheck }
    ]
  }
];

const superAdminNavSection: NavSection = {
  label: "Super Admin",
  items: [
    { label: "Members", to: "/sa/members", icon: Users },
    { label: "Roles", to: "/sa/roles", icon: BadgeCheck },
    { label: "Finance & Funds", to: "/sa/finance", icon: DollarSign },
    { label: "Groups", to: "/sa/groups", icon: UsersRound },
    { label: "Attendance", to: "/sa/attendance", icon: CalendarCheck },
    { label: "Comm Templates", to: "/sa/comm-templates", icon: MessageSquareText },
    { label: "API Keys", to: "/sa/api-keys", icon: KeyRound },
    { label: "Webhooks", to: "/sa/webhooks", icon: Webhook },
    { label: "System & Governance", to: "/sa/system", icon: ShieldAlert },
  ]
};

const COLLAPSED_KEY = "shekinah-admin-sidebar-collapsed";
const SIDEBAR_DRAWER_QUERY = "(max-width: 1180px)";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { mode, toggleTheme } = useAdminTheme();
  const admin=user?.role==="admin"||user?.role==="super_admin";
  const [permissions,setPermissions]=useState<string[]|null>(null);
  const scopes:Record<string,string>={"/sermons":"sermons:manage","/library":"books:publish","/events":"events:manage","/devotions":"content:manage","/updates":"content:manage","/reading-plans":"content:manage","/community":"community:moderate","/testimonies":"community:moderate","/giving":"finance:manage","/monetization":"finance:manage","/checkins":"checkin:scan"};
  const isSuperAdmin = user?.role === "super_admin";
  const allowed=(path:string)=>admin||(path==="/live"&&Boolean(permissions?.some(p=>["live:broadcast","live:moderate"].includes(p))))||path==="/appearance"||Boolean(scopes[path]&&permissions?.includes(scopes[path]))||path.startsWith("/sa/");
  const baseSections = navSections.map(s=>({...s,items:s.items.filter(i=>allowed(i.to))})).filter(s=>s.items.length);
  const visibleSections = isSuperAdmin ? [...baseSections, superAdminNavSection] : baseSections;
  useEffect(()=>{void apiRequest<{permissions:string[]}>("/api/v1/permissions/me",{token:getToken()}).then(r=>setPermissions(r.permissions)).catch(()=>setPermissions([]));},[user?.id]);
  useEffect(()=>{if(permissions!==null&&!allowed(location.pathname))navigate(visibleSections[0]?.items[0]?.to||"/appearance",{replace:true});},[permissions,location.pathname]);


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
          {visibleSections.map(section => (
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
