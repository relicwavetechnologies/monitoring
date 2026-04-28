"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Globe, Settings, Plus } from "lucide-react";

const nav = [
  { href: "/",        label: "Overview",  icon: LayoutDashboard },
  { href: "/sites",   label: "Sites",     icon: Globe },
  { href: "/settings",label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-full border-r"
      style={{
        background: "var(--background-1, #F5F5FC)",
        borderColor: "var(--border, #E8E8F2)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-5 py-7 border-b"
        style={{ borderColor: "var(--border, #E8E8F2)" }}
      >
        {/* Icon: accent-dim bg, accent-line border */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
          style={{
            background: "rgba(108,99,255,0.08)",
            border: "1px solid rgba(108,99,255,0.20)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "#6C63FF" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        {/* Brand name in Instrument Serif */}
        <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 17, letterSpacing: "-0.01em" }}>
          VisaWatch
        </span>
        <span
          className="ml-auto"
          style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "var(--foreground-3, #9494B0)", letterSpacing: "0.05em" }}
        >
          v0.1
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
        <p
          className="px-2 mb-2"
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 9.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--foreground-3, #9494B0)",
          }}
        >
          Main
        </p>

        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors duration-150",
                active
                  ? "font-medium"
                  : "font-normal hover:bg-[#E8E8F3]"
              )}
              style={{
                color: active ? "#6C63FF" : "var(--foreground-2, #5A5A7A)",
                background: active ? "rgba(108,99,255,0.08)" : undefined,
                border: active ? "1px solid rgba(108,99,255,0.20)" : "1px solid transparent",
              }}
            >
              {/* Nav dot */}
              <span
                className="w-[5px] h-[5px] rounded-full shrink-0"
                style={{ background: active ? "#6C63FF" : "#D4D4E8" }}
              />
              {label}
            </Link>
          );
        })}

        <div className="pt-5">
          <p
            className="px-2 mb-2"
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 9.5,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--foreground-3, #9494B0)",
            }}
          >
            Actions
          </p>
          <Link
            href="/sites/new"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-normal transition-colors duration-150 hover:bg-[#E8E8F3]"
            style={{
              color: "var(--foreground-2, #5A5A7A)",
              border: "1px solid transparent",
            }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: "#6C63FF" }} />
            Add Site
          </Link>
        </div>
      </nav>

      {/* Footer — mono, small */}
      <div
        className="border-t px-5 py-4"
        style={{
          borderColor: "var(--border, #E8E8F2)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 10,
          color: "var(--foreground-3, #9494B0)",
          lineHeight: 1.7,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-500" />
          Polling active · daily
        </div>
      </div>
    </aside>
  );
}
