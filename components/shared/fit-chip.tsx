import type { FitLevel } from "@/lib/types";
import { Chip } from "@/components/shared/chip";

const FIT_STYLES: Record<FitLevel, { className: string; dot: string; label: string }> = {
  Strong: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500", label: "Strong fit" },
  Medium: { className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500", label: "Medium fit" },
  Weak: { className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", dot: "bg-rose-500", label: "Weak fit" },
  Unknown: { className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", label: "Unknown fit" },
};

export function FitChip({ fit, className }: { fit: FitLevel; className?: string }) {
  const style = FIT_STYLES[fit];
  return (
    <Chip
      label={style.label}
      dotClassName={style.dot}
      className={className ? `${style.className} ${className}` : style.className}
    />
  );
}
