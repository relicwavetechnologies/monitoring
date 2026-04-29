"use client";

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
      className={cn("surface-flat overflow-hidden", className)}
      style={{ maxHeight, overflowY: "auto" }}
    >
      <div
        className="mono"
        style={{
          fontSize: 12.5,
          lineHeight: 1.7,
          padding: 18,
          letterSpacing: "-0.005em",
        }}
      >
        {lines.map((line, i) => {
          const isAdded = line.startsWith("+ ");
          const isRemoved = line.startsWith("- ");
          const isEllipsis = line.includes("... (");

          let bg: string | undefined;
          let color = "var(--foreground-2)";
          if (isAdded) {
            bg = "color-mix(in srgb, var(--green) 12%, transparent)";
            color = "var(--green-ink)";
          } else if (isRemoved) {
            bg = "color-mix(in srgb, var(--red) 12%, transparent)";
            color = "var(--red-ink)";
          } else if (isEllipsis) {
            color = "var(--foreground-4)";
          }

          return (
            <div
              key={i}
              className="flex items-start"
              style={{
                borderRadius: 4,
                padding: "1px 8px",
                marginBottom: 1,
                background: bg,
                color,
                fontStyle: isEllipsis ? "italic" : undefined,
              }}
            >
              <span
                aria-hidden
                className="select-none w-4 shrink-0 mr-2 text-right"
                style={{
                  color: isAdded
                    ? "var(--green)"
                    : isRemoved
                    ? "var(--red)"
                    : "var(--foreground-4)",
                  fontWeight: 600,
                  opacity: 0.85,
                }}
              >
                {isAdded ? "+" : isRemoved ? "−" : ""}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-words">
                {line.replace(/^[+\- ] ?/, "")}
              </span>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p style={{ color: "var(--foreground-4)", fontStyle: "italic" }}>
            No diff available.
          </p>
        )}
      </div>
    </div>
  );
}
