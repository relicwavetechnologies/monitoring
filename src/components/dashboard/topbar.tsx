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
    <header className="h-14 border-b border-white/[0.07] flex items-center justify-between px-5 bg-background/70 backdrop-blur-md sticky top-0 z-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
          VisaWatch
        </Link>
        {crumbs.map(({ href, label }, i) => (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-white/20" />
            {i === crumbs.length - 1 ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-white/10 hover:ring-violet-500/40 transition-all">
              <AvatarFallback className="text-xs bg-violet-600 text-white font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-card border-white/[0.08]">
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold">{session?.user?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.07]" />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/settings")}
            >
              <Settings className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.07]" />
            <DropdownMenuItem
              className="text-red-400 cursor-pointer focus:text-red-400"
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
