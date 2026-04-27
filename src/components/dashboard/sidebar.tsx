"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Globe,
  Settings,
  Zap,
  Shield,
  ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/sites", label: "Sites", icon: Globe },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border/50 bg-sidebar flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border/50">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-sm tracking-tight">Visa Monitor</span>
        <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">BETA</Badge>
      </div>

      <ScrollArea className="flex-1 py-3">
        <div className="px-3 space-y-0.5">
          {/* Favourites section label */}
          <div className="px-2 mb-2 mt-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Navigation
            </span>
          </div>

          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {active && (
                  <ChevronRight className="h-3 w-3 opacity-40" />
                )}
              </Link>
            );
          })}
        </div>

        <Separator className="my-3 mx-3" />

        {/* Quick actions */}
        <div className="px-3 space-y-0.5">
          <div className="px-2 mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </span>
          </div>
          <Link
            href="/sites/new"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Zap className="h-4 w-4 shrink-0" />
            Add Site
          </Link>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border/50 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          Auto-refreshes every 5 min
        </p>
      </div>
    </aside>
  );
}
