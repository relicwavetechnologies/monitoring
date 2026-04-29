import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: number;
  className?: string;
}

const LABELS = ["", "Minimal", "Minor", "Notable", "Important", "Critical"];

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const s = Math.max(1, Math.min(5, severity));
  return (
    <span className={cn("sev-pill", `sev-${s}`, className)}>
      {LABELS[s]}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: number }) {
  const s = Math.max(1, Math.min(5, severity));
  const colorVar =
    s >= 5 ? "var(--red)"
    : s >= 4 ? "var(--red)"
    : s >= 3 ? "var(--orange)"
    : "var(--foreground-4)";
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: 8,
        height: 8,
        background: colorVar,
        boxShadow: `0 0 0 3px color-mix(in srgb, ${colorVar} 18%, transparent)`,
      }}
    />
  );
}
