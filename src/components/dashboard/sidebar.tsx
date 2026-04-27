"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Globe, Settings, Plus, Activity } from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/sites", label: "Sites", icon: Globe },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-white/[0.07] bg-sidebar flex flex-col h-full">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/[0.07]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 shadow-lg shadow-violet-900/40">
          <Activity className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-foreground">VisaWatch</span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide">MONITOR</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        <p className="px-2 mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
          Main
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150",
                active
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05] border border-transparent"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-400" : "")} />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-2 mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
            Actions
          </p>
          <Link
            href="/sites/new"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.05] border border-transparent transition-all duration-150"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add Site
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.07] px-4 py-3 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
        <p className="text-[11px] text-muted-foreground">Polling active · daily</p>
      </div>
    </aside>
  );
}
