"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";

const CRUMBS: Record<string, string> = {
  "/": "Overview",
  "/sites": "Sites",
  "/sites/new": "Add site",
  "/settings": "Settings",
  "/subscriptions": "Subscriptions",
  "/admin": "Admin",
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = CRUMBS[href] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
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
      className="glass h-14 flex items-center justify-between px-6 sticky top-0 z-10"
      style={{
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* ── Breadcrumb ────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 min-w-0">
        <Link
          href="/"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.014em",
            color: "var(--foreground)",
          }}
        >
          VisaWatch
        </Link>
        {crumbs.map(({ href, label }, i) => (
          <span key={href} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight
              className="h-3 w-3 shrink-0"
              strokeWidth={2}
              style={{ color: "var(--foreground-4)" }}
            />
            {i === crumbs.length - 1 ? (
              <span
                className="truncate"
                style={{
                  color: "var(--foreground-2)",
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: "-0.011em",
                }}
              >
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="truncate"
                style={{
                  color: "var(--foreground-3)",
                  fontSize: 13,
                  letterSpacing: "-0.011em",
                }}
              >
                {label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* ── Right ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2">
            <Avatar
              className="h-8 w-8 cursor-pointer transition-all"
              style={{
                boxShadow: "0 0 0 1.5px var(--border-2), var(--shadow-xs)",
              }}
            >
              <AvatarFallback
                className="text-[11px] font-semibold text-white tabular"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), var(--indigo))",
                  letterSpacing: "-0.005em",
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            style={{
              background: "var(--background-1)",
              borderColor: "var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              padding: 4,
            }}
          >
            <div className="px-3 py-2.5">
              <p
                className="text-sm font-semibold"
                style={{
                  color: "var(--foreground)",
                  letterSpacing: "-0.014em",
                }}
              >
                {session?.user?.name ?? "User"}
              </p>
              <p
                className="text-xs truncate mt-0.5 mono"
                style={{ color: "var(--foreground-3)" }}
              >
                {session?.user?.email}
              </p>
            </div>
            <DropdownMenuSeparator style={{ background: "var(--border)" }} />
            <DropdownMenuItem
              className="cursor-pointer rounded-md"
              onClick={() => router.push("/settings")}
            >
              <Settings className="h-4 w-4 mr-2" strokeWidth={1.85} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: "var(--border)" }} />
            <DropdownMenuItem
              className="cursor-pointer rounded-md"
              style={{ color: "var(--red-ink)" }}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" strokeWidth={1.85} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
