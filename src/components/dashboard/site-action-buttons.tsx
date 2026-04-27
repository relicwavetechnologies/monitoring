"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PollButton } from "./poll-button";
import { Pause, Play, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SiteActionButtonsProps {
  siteId: string;
  isActive: boolean;
}

export function SiteActionButtons({ siteId, isActive }: SiteActionButtonsProps) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleActive = async () => {
    setToggling(true);
    try {
      await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      toast.success(isActive ? "Site paused" : "Site activated");
      router.refresh();
    } catch {
      toast.error("Failed to update site");
    } finally {
      setToggling(false);
    }
  };

  const deleteSite = async () => {
    if (!confirm("Delete this site and all its data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      toast.success("Site deleted");
      router.push("/sites");
      router.refresh();
    } catch {
      toast.error("Failed to delete site");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <PollButton siteId={siteId} />
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 px-2 rounded-md border border-border/50 bg-background hover:bg-accent transition-colors focus:outline-none">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={toggleActive} disabled={toggling}>
            {isActive ? (
              <><Pause className="h-4 w-4 mr-2" />Pause monitoring</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Resume monitoring</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={deleteSite}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete site
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
