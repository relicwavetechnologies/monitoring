"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PollButton } from "./poll-button";
import { formatDistanceToNow } from "@/lib/time";
import { Pause, Play, ChevronRight } from "lucide-react";
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

const FETCH_TONE: Record<string, string> = {
  STATIC: "pill-green",
  PLAYWRIGHT: "pill-blue",
  STEALTH: "pill-indigo",
  EXTERNAL: "pill-orange",
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

  return (
    <div
      className="row-hover flex items-center gap-3 px-5 py-3.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <Link
        href={`/urls/${url.id}`}
        className="flex-1 min-w-0 flex items-center gap-2 transition-colors"
        style={{
          fontSize: 13.5,
          color: "var(--foreground)",
          letterSpacing: "-0.005em",
        }}
      >
        <span className="mono truncate">{url.url}</span>
      </Link>

      <span className={`pill ${FETCH_TONE[url.fetchMode] ?? "pill-muted"}`}>
        {url.fetchMode}
      </span>

      {url.paused && <span className="pill pill-muted">Paused</span>}

      {url.consecutiveFailures > 0 && (
        <span className="pill pill-red tabular">
          {url.consecutiveFailures}× {url.lastFailureKind?.toLowerCase() ?? "fail"}
        </span>
      )}

      <span className="hidden sm:inline label-mono shrink-0">
        {url.lastCheckedAt ? formatDistanceToNow(url.lastCheckedAt) : "never"}
      </span>

      <div className="flex items-center gap-1">
        <PollButton monitoredUrlId={url.id} />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={togglePaused}
          disabled={toggling}
          title={url.paused ? "Resume" : "Pause"}
        >
          {url.paused ? (
            <Play className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Pause className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </Button>

        <Link
          href={`/urls/${url.id}`}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md subtle-link"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
