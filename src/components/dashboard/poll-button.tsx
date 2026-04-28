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

      const pages = data.pagesCrawled ? ` (${data.pagesCrawled} pages crawled)` : "";

      if (data.status === "change_detected") {
        toast.success("Change detected!", {
          description: data.classification?.summary ?? "A change was found.",
        });
      } else if (data.status === "unchanged") {
        toast.info(`No changes detected${pages}`);
      } else if (data.status === "pending_stability_check") {
        toast.warning("Change pending — poll once more to confirm", {
          description: "Same change seen twice in a row will confirm it.",
        });
      } else if (data.status === "baseline") {
        toast.info(`Baseline saved${pages} — future polls will detect changes from here`);
      } else if (data.status === "insignificant_diff") {
        toast.info("Tiny change ignored — below noise threshold");
      } else if (data.status === "fetch_failed") {
        toast.error("Could not fetch site", { description: data.error });
      } else if (data.status === "not_found") {
        toast.error("Site not found or inactive");
      } else {
        toast.warning(`Unexpected status: ${JSON.stringify(data)}`);
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
      {loading ? "Crawling…" : "Poll"}
    </Button>
  );
}
