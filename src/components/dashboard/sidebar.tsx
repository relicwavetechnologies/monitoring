"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Globe,
  Bell,
  Shield,
  Settings,
  Plus,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/",              label: "Overview",  icon: LayoutDashboard },
  { href: "/sites",         label: "Sites",     icon: Globe },
  { href: "/subscriptions", label: "Alerts",    icon: Bell },
  { href: "/admin",         label: "Admin",     icon: Shield },
  { href: "/settings",      label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <aside
      className="flex flex-col h-full shrink-0"
      style={{
        width: 232,
        background: "var(--background-1)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 shrink-0" style={{ height: 56 }}>
        <div
          aria-hidden
          className="h-7 w-7 flex items-center justify-center shrink-0"
          style={{
            borderRadius: 8,
            background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
          }}
        >
          <svg
            width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="white" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--foreground)" }}>
          VisaWatch
        </span>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        <p className="sidebar-section">Menu</p>

        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="sidebar-link"
              data-active={active ? "true" : undefined}
            >
              <Icon
                className="shrink-0"
                style={{ width: 15, height: 15 }}
                strokeWidth={active ? 2.2 : 1.85}
              />
              {label}
            </Link>
          );
        })}

        {/* ── Add site ────────────────────────────────────────────────── */}
        <div className="pt-3 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <Link
            href="/sites/new"
            className="btn-pill w-full"
            style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8 }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            Add site
          </Link>
        </div>
      </nav>

      {/* ── User footer ───────────────────────────────────────────────── */}
      <div
        className="px-3 py-3 shrink-0 space-y-0.5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* User row */}
        <div className="sidebar-user">
          {/* Avatar */}
          <div
            className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-white text-[11px] font-semibold tabular"
            style={{ background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)" }}
          >
            {initials}
          </div>
          {/* Name + email */}
          <div className="flex-1 min-w-0">
            <p
              className="truncate"
              style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.011em", color: "var(--foreground)", lineHeight: 1.3 }}
            >
              {session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "User"}
            </p>
            <p
              className="truncate"
              style={{ fontSize: 11, color: "var(--foreground-4)", letterSpacing: 0, lineHeight: 1.3 }}
            >
              {session?.user?.email}
            </p>
          </div>
          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md"
            style={{
              color: "var(--foreground-4)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color var(--d-fast) var(--ease-standard), background var(--d-fast) var(--ease-standard)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--background-2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-4)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Polling status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ fontFamily: 'ui-monospace,"SF Mono",monospace', fontSize: 10.5, color: "var(--foreground-4)" }}
        >
          <span className="status-dot status-dot-green" />
          Polling active
        </div>
      </div>
    </aside>
  );
}
