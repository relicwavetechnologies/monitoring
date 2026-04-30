"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Bell,
  Shield,
  Settings,
  Plus,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/",              label: "Overview",      icon: LayoutDashboard },
  { href: "/sites",         label: "Sites",         icon: Globe },
  { href: "/subscriptions", label: "Alerts",        icon: Bell },
  { href: "/admin",         label: "Admin",         icon: Shield },
  { href: "/settings",      label: "Settings",      icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="glass-strong flex flex-col h-full shrink-0"
      style={{
        width: 220,
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-5 shrink-0"
        style={{ height: 52, borderBottom: "1px solid var(--border)" }}
      >
        <div
          aria-hidden
          className="h-7 w-7 flex items-center justify-center shrink-0"
          style={{
            borderRadius: 8,
            background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
            boxShadow:
              "0 1px 3px rgba(0,122,255,0.35), inset 0 0 0 0.5px rgba(255,255,255,0.20)",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            letterSpacing: "-0.022em",
            color: "var(--foreground)",
          }}
        >
          VisaWatch
        </span>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
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
      </nav>

      {/* ── Add site CTA ──────────────────────────────────────────────── */}
      <div
        className="px-3 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Link
          href="/sites/new"
          className="btn-pill w-full"
          style={{ fontSize: 13, padding: "7px 14px" }}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          Add site
        </Link>
      </div>

      {/* ── Status footer ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-5 shrink-0"
        style={{
          height: 36,
          borderTop: "1px solid var(--border)",
          fontFamily: 'ui-monospace, "SF Mono", monospace',
          fontSize: 10.5,
          letterSpacing: 0,
          color: "var(--foreground-4)",
        }}
      >
        <span className="status-dot status-dot-green" />
        <span>Polling active</span>
      </div>
    </aside>
  );
}
