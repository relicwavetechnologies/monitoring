"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PollResult {
  status: string;
  pagesCrawled?: number;
  error?: string;
  classification?: { summary?: string };
}

/**
 * Trigger a poll. Phase 2b: the Site-level endpoint fans out to every
 * MonitoredUrl under the Site and returns `{ siteId, polled, results }`.
 * The per-URL endpoint returns a single PollResult.
 */
export function PollButton({
  siteId,
  monitoredUrlId,
  label,
}: {
  siteId?: string;
  monitoredUrlId?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handlePoll = async () => {
    setLoading(true);
    try {
      const url = monitoredUrlId
        ? `/api/urls/${monitoredUrlId}/poll`
        : `/api/sites/${siteId}/poll`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      const results: PollResult[] = Array.isArray(data?.results)
        ? data.results
        : data?.status
        ? [data]
        : [];

      if (results.length === 0) {
        toast.warning("No URLs to poll", {
          description: "Add a MonitoredUrl on this site first.",
        });
        return;
      }

      const priority: Record<string, number> = {
        change_detected: 0,
        duplicate_change: 1,
        pending_stability_check: 2,
        baseline: 3,
        insignificant_diff: 4,
        unchanged: 5,
        paused: 6,
        not_found: 7,
        fetch_failed: 8,
      };
      const top = results.slice().sort(
        (a, b) => (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
      )[0];

      const summary = results.length > 1 ? ` (${results.length} URLs polled)` : "";

      switch (top.status) {
        case "change_detected":
          toast.success(`Change detected${summary}`, {
            description: top.classification?.summary ?? "A change was found.",
          });
          break;
        case "duplicate_change":
          toast.info(`Already-seen change${summary}`);
          break;
        case "pending_stability_check":
          toast.warning(`Change pending confirmation${summary}`, {
            description: "Same hash must persist past the stability window before classifying.",
          });
          break;
        case "baseline":
          toast.info(`Baseline saved${summary}`);
          break;
        case "insignificant_diff":
          toast.info(`Tiny change ignored${summary}`);
          break;
        case "unchanged":
          toast.info(`No changes${summary}`);
          break;
        case "paused":
          toast.warning(`Paused${summary}`);
          break;
        case "fetch_failed":
          toast.error("Fetch failed", { description: top.error ?? "unknown" });
          break;
        case "not_found":
          toast.error("Not found or inactive");
          break;
        default:
          toast.warning(`Status: ${top.status}${summary}`);
      }
    } catch {
      toast.error("Poll failed", { description: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs gap-1"
      onClick={handlePoll}
      disabled={loading}
    >
      <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
      {loading ? "Polling…" : label ?? "Poll"}
    </Button>
  );
}
