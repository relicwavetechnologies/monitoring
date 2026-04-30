"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Settings,
  Plus,
  Bell,
  Shield,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/",              label: "Overview",      icon: LayoutDashboard },
  { href: "/sites",         label: "Sites",         icon: Globe },
  { href: "/subscriptions", label: "Subscriptions", icon: Bell },
  { href: "/admin",         label: "Admin",         icon: Shield },
  { href: "/settings",      label: "Settings",      icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="glass-strong w-[248px] shrink-0 flex flex-col h-full"
      style={{ borderRight: "1px solid var(--border)" }}
    >
      {/* ── Brand ───────────────────────────────────────────────── */}
      <div className="px-5 pt-7 pb-6 flex items-center gap-2.5">
        <div
          aria-hidden
          className="h-9 w-9 flex items-center justify-center shrink-0"
          style={{
            borderRadius: 10,
            background:
              "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
            boxShadow:
              "0 1px 2px rgba(0,122,255,0.30), inset 0 0 0 0.5px rgba(255,255,255,0.18)",
          }}
        >
          <svg
            width="18"
            height="18"
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
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.024em",
              color: "var(--foreground)",
            }}
          >
            VisaWatch
          </span>
          <span
            className="mt-1"
            style={{
              fontFamily: 'ui-monospace, "SF Mono", "Menlo", monospace',
              fontSize: 10,
              color: "var(--foreground-4)",
              letterSpacing: "0.04em",
            }}
          >
            v0.1
          </span>
        </div>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-active={active}
              className="nav-item flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg"
              style={{
                color: active ? "var(--primary)" : "var(--foreground-2)",
                background: active ? "var(--accent-dim)" : "transparent",
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                letterSpacing: "-0.011em",
                transition:
                  "background var(--d-fast) var(--ease-standard), color var(--d-fast) var(--ease-standard)",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "var(--background-2)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon
                className="h-[15px] w-[15px] shrink-0"
                strokeWidth={active ? 2.25 : 1.85}
                style={{
                  color: active ? "var(--primary)" : "var(--foreground-3)",
                }}
              />
              <span>{label}</span>
            </Link>
          );
        })}

        <div
          className="pt-3 mt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <Link
            href="/sites/new"
            className="btn-pill mx-1 flex w-[calc(100%-8px)]"
            style={{ marginTop: 6 }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            Add site
          </Link>
        </div>
      </nav>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div
        className="px-5 py-3.5 flex items-center gap-2"
        style={{
          borderTop: "1px solid var(--border)",
          fontFamily: 'ui-monospace, "SF Mono", "Menlo", monospace',
          fontSize: 10.5,
          color: "var(--foreground-4)",
          letterSpacing: 0,
        }}
      >
        <span className="status-dot status-dot-green" />
        <span>Polling active</span>
      </div>
    </aside>
  );
}
