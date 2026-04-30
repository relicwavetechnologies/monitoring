import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional action element (a <Link> or <button>) shown beneath the description. */
  action?: ReactNode;
  /** Padding tone — "compact" for inline empties, "spacious" for full-page ones. */
  size?: "compact" | "spacious";
  /** When false, removes the dashed border style. Default true. */
  bordered?: boolean;
  className?: string;
}

/**
 * Reusable empty-state with the canonical Apple shape:
 * rounded icon chip → headline → sub → optional action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "compact",
  bordered = true,
  className,
}: EmptyStateProps) {
  const padY = size === "spacious" ? "py-20" : "py-12";

  return (
    <div
      className={`flex flex-col items-center justify-center text-center surface-flat ${padY} ${className ?? ""}`}
      style={bordered ? { borderStyle: "dashed" } : { border: "none" }}
    >
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center mb-3.5"
        style={{ background: "var(--background-2)" }}
      >
        <Icon
          className="h-6 w-6"
          strokeWidth={1.6}
          style={{ color: "var(--foreground-4)" }}
          aria-hidden
        />
      </div>
      <p className="text-headline" style={{ color: "var(--foreground)" }}>
        {title}
      </p>
      {description && (
        <p
          className="text-subhead mt-1.5 max-w-md"
          style={{ color: "var(--foreground-3)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
