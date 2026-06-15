import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { clearSession, getUser } from "../auth/session";
import { useAdminTheme } from "../theme";

const navSections = [
  {
    label: "Content",
    items: [
      { label: "Overview", to: "/" },
      { label: "Sermons", to: "/sermons" },
      { label: "Library", to: "/library" },
      { label: "Devotions", to: "/devotions" },
      { label: "Reading Plans", to: "/reading-plans" },
      { label: "Events", to: "/events" },
      { label: "Updates", to: "/updates" },
      { label: "Branches", to: "/branches" }
    ]
  },
  {
    label: "Care",
    items: [
      { label: "Prayer", to: "/prayers" },
      { label: "Chat", to: "/community" },
      { label: "Testimonies", to: "/testimonies" }
    ]
  },
  {
    label: "Operations",
    items: [
      { label: "Live", to: "/live" },
      { label: "Check-In", to: "/checkins" },
      { label: "Giving", to: "/giving" },
      { label: "Notifications", to: "/notifications" }
    ]
  }
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { mode, toggleTheme } = useAdminTheme();

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    window.matchMedia("(min-width: 981px)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 981px)");

    function handleChange(event: MediaQueryListEvent) {
      setSidebarOpen(event.matches);
    }

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  function toggleSidebar() {
    setSidebarOpen(current => !current);
  }

  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 980px)").matches) {
      setSidebarOpen(false);
    }
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  const currentItem =
    navSections
      .flatMap(section => section.items)
      .find(item => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to))) ||
    navSections[0].items[0];

  return (
    <div className={sidebarOpen ? "admin-shell" : "admin-shell sidebar-hidden"}>
      <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-top-row">
          <div className="brand">
            <div className="brand-mark">S</div>

            <div>
              <strong>Shekinah</strong>
              <span>Admin Console</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label} className="nav-group">
              <p className="nav-group-label">{section.label}</p>

              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={closeSidebarOnMobile}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <p>{user?.name || "Admin"}</p>
          <span>{user?.role || "admin"}</span>

          <button className="secondary full" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-topbar">
          <button
            type="button"
            className={sidebarOpen ? "sidebar-toggle active" : "sidebar-toggle"}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
            onClick={toggleSidebar}
          >
            <span className="folder-icon">▤</span>
          </button>

          <div className="workspace-title">
            <strong>Shekinah Admin</strong>
            <span>{currentItem.label}</span>
          </div>

          <div className="topbar-actions">
            <button type="button" className="secondary compact theme-toggle" onClick={toggleTheme}>
              {mode === "light" ? "Dark" : "Light"}
            </button>
          </div>
        </header>

        <Outlet />
      </section>
    </div>
  );
}
