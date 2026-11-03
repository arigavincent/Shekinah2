import type { ReactNode } from "react";

// Plain public pages (privacy policy, account deletion) in the church's colours.
// They sit outside the admin console and need no sign-in.
export function PublicPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0d", color: "#e9e6df", fontFamily: "Inter, system-ui, sans-serif" }}>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 22px 80px", lineHeight: 1.65 }}>
        <p style={{ color: "#d4af37", letterSpacing: 3, fontWeight: 700, fontSize: 13, margin: 0 }}>SHEKINAH SONS GLOBAL</p>
        <h1 style={{ color: "#fff", fontSize: 34, margin: "8px 0 24px" }}>{title}</h1>
        <div className="public-page">{children}</div>
        <style>{`.public-page p{margin:0 0 14px}.public-page ul{list-style:disc;padding-left:22px;margin:0 0 14px}.public-page label{display:block}.public-page h2{color:#f0d27a;font-size:20px;margin:28px 0 8px}.public-page a{color:#f0d27a}.public-page li{margin:4px 0}
          .public-page input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #3a3528;background:#16161a;color:#fff;font-size:16px;margin:6px 0 14px}
          .public-page button{background:#c9a227;color:#111;border:0;border-radius:999px;padding:12px 22px;font-weight:700;font-size:15px;cursor:pointer}
          .public-page button.danger{background:#e53935;color:#fff}.public-page button:disabled{opacity:.5;cursor:default}`}</style>
      </main>
    </div>
  );
}
