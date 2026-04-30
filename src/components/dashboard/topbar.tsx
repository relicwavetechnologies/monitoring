"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  "/":              "Overview",
  "/sites":         "Sites",
  "/sites/new":     "Add site",
  "/subscriptions": "Alerts",
  "/admin":         "Admin",
  "/settings":      "Settings",
};

export function Topbar() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href  = "/" + segments.slice(0, i + 1).join("/");
    const label = LABELS[href] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    return { href, label };
  });

  return (
    <header
      className="shrink-0 flex items-center px-7"
      style={{
        height: 56,
        background: "var(--background-1)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <nav className="flex items-center gap-1 min-w-0">
        <Link
          href="/"
          className="subtle-link"
          style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.011em" }}
        >
          VisaWatch
        </Link>

        {crumbs.map(({ href, label }, i) => (
          <span key={href} className="flex items-center gap-1 min-w-0">
            <ChevronRight
              className="h-3 w-3 shrink-0"
              strokeWidth={1.8}
              style={{ color: "var(--foreground-5)" }}
            />
            {i === crumbs.length - 1 ? (
              <span
                className="truncate"
                style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.011em", color: "var(--foreground)" }}
              >
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="subtle-link truncate"
                style={{ fontSize: 13, letterSpacing: "-0.011em" }}
              >
                {label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </header>
  );
}
