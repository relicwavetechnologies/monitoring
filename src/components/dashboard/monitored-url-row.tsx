"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PollButton } from "./poll-button";
import { formatDistanceToNow } from "@/lib/time";
import { ExternalLink, Pause, Play, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface MonitoredUrlRowProps {
  url: {
    id: string;
    url: string;
    paused: boolean;
    fetchMode: string;
    consecutiveFailures: number;
    lastFailureKind: string | null;
    lastCheckedAt: Date | null;
  };
}

const FETCH_MODE_BADGE: Record<string, string> = {
  STATIC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PLAYWRIGHT: "bg-blue-50 text-blue-700 border-blue-200",
  STEALTH: "bg-violet-50 text-violet-700 border-violet-200",
  EXTERNAL: "bg-amber-50 text-amber-700 border-amber-200",
};

export function MonitoredUrlRow({ url }: MonitoredUrlRowProps) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);

  const togglePaused = async () => {
    setToggling(true);
    try {
      await fetch(`/api/urls/${url.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !url.paused }),
      });
      toast.success(url.paused ? "URL resumed" : "URL paused");
      router.refresh();
    } catch {
      toast.error("Failed to update URL");
    } finally {
      setToggling(false);
    }
  };

  const failingBadge =
    url.consecutiveFailures > 0
      ? `${url.consecutiveFailures}× ${url.lastFailureKind ?? "fail"}`
      : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--border, #E8E8F2)" }}
    >
      <Link
        href={`/urls/${url.id}`}
        className="flex-1 min-w-0 flex items-center gap-2 hover:text-violet-700"
      >
        <span className="text-sm truncate" style={{ fontFamily: "var(--font-mono, monospace)" }}>
          {url.url}
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
      </Link>

      <Badge variant="outline" className={`text-[10px] ${FETCH_MODE_BADGE[url.fetchMode] ?? ""}`}>
        {url.fetchMode}
      </Badge>

      {url.paused && (
        <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
          Paused
        </Badge>
      )}

      {failingBadge && (
        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
          {failingBadge}
        </Badge>
      )}

      <span className="text-[11px] text-muted-foreground hidden sm:inline">
        {url.lastCheckedAt ? formatDistanceToNow(url.lastCheckedAt) : "never"}
      </span>

      <PollButton monitoredUrlId={url.id} />

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={togglePaused}
        disabled={toggling}
      >
        {url.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </Button>

      <Link
        href={`/urls/${url.id}`}
        className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
