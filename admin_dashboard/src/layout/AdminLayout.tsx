import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { clearSession, getUser } from "../auth/session";

const navItems = [
  { label: "Overview", to: "/" },
  { label: "Sermons", to: "/sermons" },
  { label: "Devotions", to: "/devotions" },
  { label: "Events", to: "/events" },
  { label: "Updates", to: "/updates" },
  { label: "Branches", to: "/branches" },
  { label: "Live", to: "/live" },
  { label: "Giving", to: "/giving" }
];

export function AdminLayout() {
  const navigate = useNavigate();
  const user = getUser();

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
          {navItems.map(item => (
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
            <span>Content dashboard</span>
          </div>
        </header>

        <Outlet />
      </section>
    </div>
  );
}
