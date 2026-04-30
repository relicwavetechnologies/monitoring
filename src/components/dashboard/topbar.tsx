"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, LogOut, Settings } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/",              label: "Overview" },
  { href: "/sites",         label: "Sites" },
  { href: "/subscriptions", label: "Alerts" },
  { href: "/admin",         label: "Admin" },
];

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

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
      className="glass-strong sticky top-0 z-50 w-full"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Inner row — constrained width, centered */}
      <div
        className="mx-auto flex h-14 items-center gap-5 px-6 md:px-10"
        style={{ maxWidth: 1200 }}
      >
        {/* ── Brand ─────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div
            className="h-7 w-7 flex items-center justify-center shrink-0"
            style={{
              borderRadius: 8,
              background: "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
              boxShadow:
                "0 1px 2px rgba(0,122,255,0.30), inset 0 0 0 0.5px rgba(255,255,255,0.18)",
            }}
          >
            <svg
              width="14"
              height="14"
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
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.024em",
              color: "var(--foreground)",
            }}
          >
            VisaWatch
          </span>
        </Link>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div
          className="shrink-0 h-4 w-px"
          style={{ background: "var(--border-2)" }}
          aria-hidden
        />

        {/* ── Nav links ─────────────────────────────────────────────── */}
        <nav className="flex items-center gap-0.5 flex-1">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="topnav-link"
                data-active={active ? "true" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right actions ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/sites/new"
            className="btn-pill"
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            Add site
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
              <Avatar
                className="h-8 w-8 cursor-pointer"
                style={{
                  boxShadow:
                    "0 0 0 1.5px var(--border-2), 0 0.5px 1px rgba(0,0,0,0.04)",
                }}
              >
                <AvatarFallback
                  className="text-[11px] font-semibold text-white tabular"
                  style={{
                    background:
                      "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
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
              className="w-60 p-1"
              style={{
                background: "var(--background-1)",
                borderColor: "var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="px-3 py-2.5">
                <p
                  className="text-headline"
                  style={{ color: "var(--foreground)" }}
                >
                  {session?.user?.name ?? "User"}
                </p>
                <p
                  className="text-footnote mono mt-0.5 truncate"
                  style={{ color: "var(--foreground-3)" }}
                >
                  {session?.user?.email}
                </p>
              </div>
              <DropdownMenuSeparator style={{ background: "var(--border)" }} />
              <DropdownMenuItem
                className="cursor-pointer rounded-md"
                onClick={() => router.push("/settings")}
                style={{ fontSize: 13.5, letterSpacing: "-0.011em" }}
              >
                <Settings className="h-4 w-4 mr-2" strokeWidth={1.85} />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ background: "var(--border)" }} />
              <DropdownMenuItem
                className="cursor-pointer rounded-md"
                onClick={() => signOut({ callbackUrl: "/login" })}
                style={{
                  color: "var(--red-ink)",
                  fontSize: 13.5,
                  letterSpacing: "-0.011em",
                }}
              >
                <LogOut className="h-4 w-4 mr-2" strokeWidth={1.85} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
