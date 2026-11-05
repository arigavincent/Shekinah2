import { BellRing, BookOpen, Building2, CalendarDays, CalendarRange, Coins, HandHeart, Megaphone, MessagesSquare, Mic2, Settings, Sparkles, Sunrise } from "lucide-react";
import { ToolHub } from "../components/kit/Kit";

const gold = "#d4af37", blue = "#6ea8ff", green = "#4ade80", rose = "#ff8fa3";

// Every other tool as grouped cards, the same as More in the phone's admin console.
export function MoreHubPage() {
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin console</p>
          <h1>More</h1>
          <p className="muted">Content, ministry settings and community care.</p>
        </div>
      </header>
      <ToolHub groups={[
        ["Content", [
          { to: "/sermons", label: "Sermons", sub: "Videos, audio, notes, YouTube links", icon: Mic2, tint: gold },
          { to: "/devotions", label: "Devotions", sub: "Daily word and verse topics", icon: Sunrise, tint: gold },
          { to: "/reading-plans", label: "Reading plans", sub: "Daily readings and reflections", icon: CalendarRange, tint: gold },
          { to: "/updates", label: "Updates", sub: "Church news and announcements", icon: Megaphone, tint: gold },
        ]],
        ["Church life", [
          { to: "/events", label: "Events", sub: "Registrations, tickets, check-in", icon: CalendarDays, tint: blue },
          { to: "/serve-settings", label: "Serve", sub: "Ministry teams and requests", icon: HandHeart, tint: blue },
          { to: "/branches", label: "Branches", sub: "Locations and service times", icon: Building2, tint: blue },
          { to: "/settings", label: "Ministry settings", sub: "Service times, contacts, email", icon: Settings, tint: blue },
        ]],
        ["Care and community", [
          { to: "/prayers", label: "Prayer requests", sub: "Read, pray, pin to the wall", icon: HandHeart, tint: rose },
          { to: "/testimonies", label: "Testimonies", sub: "Approve what God has done", icon: Sparkles, tint: rose },
          { to: "/community", label: "Community", sub: "Moderate the chat", icon: MessagesSquare, tint: rose },
          { to: "/notifications", label: "Send notification", sub: "Reach every phone at once", icon: BellRing, tint: rose },
        ]],
        ["Income", [
          { to: "/monetization", label: "Monetization", sub: "Paid books, lives and replays", icon: Coins, tint: green },
          { to: "/library", label: "Books", sub: "Publish free or paid books", icon: BookOpen, tint: green },
        ]],
      ]} />
    </section>
  );
}
