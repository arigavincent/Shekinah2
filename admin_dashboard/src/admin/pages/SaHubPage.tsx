import { BadgeCheck, CalendarCheck, DollarSign, Home, KeyRound, MessageSquareText, Send, ShieldAlert, Users, UsersRound, Webhook } from "lucide-react";
import { ToolHub } from "../components/kit/Kit";

const gold = "#d4af37", blue = "#6ea8ff", green = "#4ade80", rose = "#ff8fa3", violet = "#b79cff";

// Super Admin tools as grouped cards, the same as SA Tools in the phone app.
export function SaHubPage() {
  return (
    <section className="admin-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>SA Tools</h1>
          <p className="muted">Full system governance and control.</p>
        </div>
      </header>
      <ToolHub groups={[
        ["People", [
          { to: "/sa/members", label: "Members", sub: "Accounts, roles, suspend", icon: Users, tint: gold },
          { to: "/sa/roles", label: "Roles", sub: "What each staff role can do", icon: BadgeCheck, tint: gold },
          { to: "/sa/groups", label: "Groups", sub: "Cells, ministries, classes", icon: UsersRound, tint: gold },
          { to: "/sa/families", label: "Families", sub: "Households and children", icon: Home, tint: gold },
        ]],
        ["Messages", [
          { to: "/sa/messages", label: "Messages", sub: "Push and email to groups", icon: Send, tint: rose },
          { to: "/sa/comm-templates", label: "Comm Templates", sub: "Reusable messages", icon: MessageSquareText, tint: rose },
        ]],
        ["Gatherings and money", [
          { to: "/sa/attendance", label: "Attendance", sub: "Check-ins and reports", icon: CalendarCheck, tint: blue },
          { to: "/sa/finance", label: "Finance & Funds", sub: "Funds, entries, statements", icon: DollarSign, tint: green },
        ]],
        ["System", [
          { to: "/sa/system", label: "System & Governance", sub: "Modules, audit trail, backup", icon: ShieldAlert, tint: green },
          { to: "/sa/api-keys", label: "API Keys", sub: "Access for other systems", icon: KeyRound, tint: violet },
          { to: "/sa/webhooks", label: "Webhooks", sub: "Send events to other apps", icon: Webhook, tint: violet },
        ]],
      ]} />
    </section>
  );
}
