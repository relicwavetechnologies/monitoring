"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Settings } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const router   = useRouter();
  const { data: session } = useSession();

  /* breadcrumb segments */
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href  = "/" + segments.slice(0, i + 1).join("/");
    const label = LABELS[href] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    return { href, label };
  });

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header
      className="glass-strong shrink-0 flex items-center justify-between px-6 sticky top-0 z-10"
      style={{
        height: 52,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 min-w-0">
        <Link
          href="/"
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.011em",
            color: crumbs.length === 0 ? "var(--foreground)" : "var(--foreground-3)",
          }}
          className="subtle-link"
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
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "-0.011em",
                  color: "var(--foreground)",
                }}
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

      {/* ── Avatar ─────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Avatar
            className="h-7 w-7 cursor-pointer"
            style={{
              boxShadow: "0 0 0 1.5px var(--border-2), 0 0.5px 1px rgba(0,0,0,0.06)",
            }}
          >
            <AvatarFallback
              className="text-[10px] font-semibold text-white tabular"
              style={{
                background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
                letterSpacing: "-0.005em",
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-56 p-1"
          style={{
            background: "var(--background-1)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="px-3 py-2.5">
            <p className="text-callout-em" style={{ color: "var(--foreground)" }}>
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-footnote mono mt-0.5 truncate" style={{ color: "var(--foreground-3)" }}>
              {session?.user?.email}
            </p>
          </div>

          <DropdownMenuSeparator style={{ background: "var(--border)" }} />

          <DropdownMenuItem
            className="cursor-pointer rounded-md"
            onClick={() => router.push("/settings")}
            style={{ fontSize: 13.5, letterSpacing: "-0.011em" }}
          >
            <Settings className="h-[15px] w-[15px] mr-2" strokeWidth={1.85} />
            Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator style={{ background: "var(--border)" }} />

          <DropdownMenuItem
            className="cursor-pointer rounded-md"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ color: "var(--red-ink)", fontSize: 13.5, letterSpacing: "-0.011em" }}
          >
            <LogOut className="h-[15px] w-[15px] mr-2" strokeWidth={1.85} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
