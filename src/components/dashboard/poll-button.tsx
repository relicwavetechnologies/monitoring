"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PollButton({ siteId }: { siteId: string }) {
  const [loading, setLoading] = useState(false);

  const handlePoll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/poll`, { method: "POST" });
      const data = await res.json();

      if (data.status === "change_detected") {
        toast.success("Change detected!", {
          description: data.classification?.summary ?? "A change was found.",
        });
      } else if (data.status === "unchanged") {
        toast.info("No changes detected");
      } else if (data.status === "pending_stability_check") {
        toast.warning("Change pending", {
          description: "Same change on next poll will confirm it.",
        });
      } else if (data.status === "baseline") {
        toast.info("Baseline snapshot created");
      } else {
        toast.info(`Status: ${data.status}`);
      }
    } catch {
      toast.error("Poll failed", { description: "Could not reach the site." });
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
      {loading ? "Polling…" : "Poll"}
    </Button>
  );
}
