import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: number;
  className?: string;
}

const LABELS = ["", "Minimal", "Minor", "Notable", "Important", "Critical"];

// Doc badge style: mono pill, colour-coded
const STYLES: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  2: { bg: "#F8FAFC", color: "#475569", border: "#CBD5E1" },
  3: { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  4: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  5: { bg: "#FEE2E2", color: "#7F1D1D", border: "#FCA5A5" },
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const s = Math.max(1, Math.min(5, severity));
  const { bg, color, border } = STYLES[s];
  return (
    <span
      className={cn("inline-block", className)}
      style={{
        padding: "2px 9px",
        borderRadius: 100,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 9.5,
        fontWeight: 500,
        letterSpacing: "0.04em",
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      {LABELS[s]}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: number }) {
  const colors: Record<number, string> = {
    1: "#CBD5E1",
    2: "#94A3B8",
    3: "#D97706",
    4: "#EF4444",
    5: "#DC2626",
  };
  const s = Math.max(1, Math.min(5, severity));
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: 8, height: 8, background: colors[s] }}
    />
  );
}
