"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  diffText: string;
  maxHeight?: number;
  className?: string;
}

export function DiffViewer({ diffText, maxHeight = 480, className }: DiffViewerProps) {
  const lines = diffText.split("\n");

  return (
    <ScrollArea style={{ maxHeight }} className={cn("w-full rounded-lg border border-border/50 bg-[#0d0d0d]", className)}>
      <div className="font-mono text-xs leading-6 p-4 min-w-0">
        {lines.map((line, i) => {
          const isAdded = line.startsWith("+ ");
          const isRemoved = line.startsWith("- ");
          const isContext = line.startsWith("  ");
          const isEllipsis = line.includes("... (");

          return (
            <div
              key={i}
              className={cn(
                "flex items-start px-2 rounded-sm",
                isAdded && "bg-emerald-950/50 text-emerald-300",
                isRemoved && "bg-red-950/50 text-red-300",
                isEllipsis && "text-zinc-600 italic",
                !isAdded && !isRemoved && !isEllipsis && "text-zinc-500"
              )}
            >
              <span
                className={cn(
                  "select-none w-4 shrink-0 mr-2 text-right",
                  isAdded && "text-emerald-600",
                  isRemoved && "text-red-600",
                  !isAdded && !isRemoved && "text-zinc-700"
                )}
              >
                {isAdded ? "+" : isRemoved ? "−" : " "}
              </span>
              <span className="break-all whitespace-pre-wrap">{line.slice(2)}</span>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p className="text-zinc-600 italic">No diff available.</p>
        )}
      </div>
    </ScrollArea>
  );
}
