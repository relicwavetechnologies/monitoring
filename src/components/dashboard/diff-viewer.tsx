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
    <div
      style={{
        maxHeight,
        overflowY: "auto",
        background: "var(--background-1, #F5F5FC)",
        border: "1px solid var(--border, #E8E8F2)",
        borderRadius: 6,
      }}
      className={cn("w-full", className)}
    >
      <div
        style={{
          fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
          fontSize: 12,
          lineHeight: 1.7,
          padding: 16,
        }}
      >
        {lines.map((line, i) => {
          const isAdded   = line.startsWith("+ ");
          const isRemoved = line.startsWith("- ");
          const isEllipsis = line.includes("... (");

          return (
            <div
              key={i}
              className="flex items-start"
              style={{
                borderRadius: 3,
                padding: "1px 6px",
                marginBottom: 1,
                background: isAdded ? "#D1FAE5" : isRemoved ? "#FEE2E2" : undefined,
                color: isAdded
                  ? "#065F46"
                  : isRemoved
                    ? "#991B1B"
                    : isEllipsis
                      ? "#9494B0"
                      : "#5A5A7A",
                fontStyle: isEllipsis ? "italic" : undefined,
              }}
            >
              <span
                className="select-none w-4 shrink-0 mr-2 text-right"
                style={{
                  color: isAdded ? "#059669" : isRemoved ? "#DC2626" : "#D4D4E8",
                }}
              >
                {isAdded ? "+" : isRemoved ? "−" : " "}
              </span>
              <span className="break-all whitespace-pre-wrap">{line.slice(2)}</span>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p style={{ color: "#9494B0", fontStyle: "italic" }}>No diff available.</p>
        )}
      </div>
    </div>
  );
}
