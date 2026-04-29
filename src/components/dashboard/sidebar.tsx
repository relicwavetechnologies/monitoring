"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Globe,
  Settings,
  Plus,
  Bell,
  Shield,
} from "lucide-react";

const nav = [
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
      className="glass w-64 shrink-0 flex flex-col h-full"
      style={{
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* ── Brand ───────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
        <div
          aria-hidden
          className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.57 0.21 252), oklch(0.55 0.20 265))",
            boxShadow: "0 1px 2px rgba(0,113,227,0.30)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "white" }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: "-0.022em",
              color: "var(--foreground)",
            }}
          >
            VisaWatch
          </span>
          <span
            className="mt-0.5"
            style={{
              fontFamily:
                'ui-monospace, "SF Mono", "Menlo", monospace',
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
      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "nav-item-row group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px]",
                "transition-colors duration-150"
              )}
              style={{
                color: active ? "var(--primary)" : "var(--foreground-2)",
                background: active ? "var(--accent-dim)" : "transparent",
                fontWeight: active ? 600 : 500,
                letterSpacing: "-0.011em",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--background-2)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                strokeWidth={active ? 2.25 : 1.85}
                style={{
                  color: active ? "var(--primary)" : "var(--foreground-3)",
                }}
              />
              <span>{label}</span>
            </Link>
          );
        })}

        <div className="pt-4 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <Link
            href="/sites/new"
            className="flex items-center gap-2.5 mx-1 mt-3 px-3 py-2 rounded-full text-[13px] transition-all"
            style={{
              background: "var(--primary)",
              color: "white",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              boxShadow: "0 1px 2px rgba(0,113,227,0.30)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--primary-hover)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,113,227,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--primary)";
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,113,227,0.30)";
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            Add site
          </Link>
        </div>
      </nav>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div
        className="px-5 py-3.5"
        style={{
          borderTop: "1px solid var(--border)",
          fontFamily: 'ui-monospace, "SF Mono", "Menlo", monospace',
          fontSize: 10.5,
          color: "var(--foreground-4)",
          letterSpacing: "-0.005em",
          lineHeight: 1.6,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--green)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--green) 18%, transparent)" }}
          />
          Polling active
        </div>
      </div>
    </aside>
  );
}
