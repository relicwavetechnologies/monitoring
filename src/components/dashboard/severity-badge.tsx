import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: number;
  className?: string;
}

const LABELS = ["", "Minimal", "Minor", "Notable", "Important", "Critical"];

const STYLES: Record<number, string> = {
  1: "bg-zinc-800 text-zinc-400 border-zinc-700",
  2: "bg-zinc-800 text-zinc-300 border-zinc-600",
  3: "bg-amber-950/80 text-amber-400 border-amber-800",
  4: "bg-orange-950/80 text-orange-400 border-orange-800",
  5: "bg-red-950/80 text-red-400 border-red-800",
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const s = Math.max(1, Math.min(5, severity));
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-semibold tracking-wide border", STYLES[s], className)}
    >
      {LABELS[s]}
    </Badge>
  );
}

export function SeverityDot({ severity }: { severity: number }) {
  const colors: Record<number, string> = {
    1: "bg-zinc-600",
    2: "bg-zinc-500",
    3: "bg-amber-400",
    4: "bg-orange-400",
    5: "bg-red-500",
  };
  const s = Math.max(1, Math.min(5, severity));
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", colors[s])} />;
}
