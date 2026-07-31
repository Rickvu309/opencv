/**
 * Shared tone table behind every status-style chip (StatusChip, FitChip,
 * PriorityChip, CredibilityChip, GoalStatusChip, SourceStatusChip). Each
 * chip file maps its own domain values onto one of these tones instead of
 * retyping the Tailwind pairing locally, so "success" or "warning" can
 * never quietly drift to a different shade in one chip type but not
 * another. See docs/design.md section 1, "Semantic status colors" and
 * "The chip color map."
 *
 * `neutral` is a real but unremarkable value (Saved, Low priority).
 * `muted` is the literal absence of a value (Closed, Unknown fit, Parked),
 * rendered with the plain muted surface token instead of a hue, since
 * there is nothing to color.
 */
export type ChipTone = "success" | "warning" | "danger" | "neutral" | "muted";

export const CHIP_TONES: Record<ChipTone, { className: string; dot: string }> = {
  success: {
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  warning: {
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  danger: {
    className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  neutral: {
    className: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    dot: "bg-slate-500",
  },
  muted: {
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};
