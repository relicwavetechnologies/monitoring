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
  "/sites/new": "Add Site",
  "/settings": "Settings",
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
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header
      className="h-14 flex items-center justify-between px-5 sticky top-0 z-10 border-b"
      style={{
        background: "var(--background-1, #F5F5FC)",
        borderColor: "var(--border, #E8E8F2)",
      }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link
          href="/"
          className="transition-colors"
          style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 15,
            color: "var(--foreground-2, #5A5A7A)",
          }}
        >
          VisaWatch
        </Link>
        {crumbs.map(({ href, label }, i) => (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--border-2, #D4D4E8)" }} />
            {i === crumbs.length - 1 ? (
              <span style={{ color: "var(--foreground, #0D0D1C)", fontWeight: 500, fontSize: 13 }}>{label}</span>
            ) : (
              <Link
                href={href}
                style={{ color: "var(--foreground-2, #5A5A7A)", fontSize: 13 }}
              >
                {label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2">
            <Avatar
              className="h-8 w-8 cursor-pointer transition-all ring-2 ring-[var(--border-2)]"
            >
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ background: "#6C63FF" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52"
            style={{ background: "var(--background-1)", borderColor: "var(--border)" }}
          >
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {session?.user?.name ?? "User"}
              </p>
              <p
                className="text-xs truncate mt-0.5"
                style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--foreground-3)" }}
              >
                {session?.user?.email}
              </p>
            </div>
            <DropdownMenuSeparator style={{ background: "var(--border)" }} />
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/settings")}>
              <Settings className="h-3.5 w-3.5 mr-2" style={{ color: "var(--foreground-3)" }} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: "var(--border)" }} />
            <DropdownMenuItem
              className="cursor-pointer"
              style={{ color: "#DC2626" }}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
