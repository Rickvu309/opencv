import { Chip } from "@/components/shared/chip";

export type CredibilityVerdict = "pass" | "fail";

const CREDIBILITY_STYLES: Record<CredibilityVerdict, { className: string; dot: string; label: string }> = {
  pass: {
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Passes checks",
  },
  fail: {
    className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Fails checks",
  },
};

/**
 * Shared credibility verdict chip, built on the same Chip primitive as
 * StatusChip, FitChip, PriorityChip, and ConfidenceChip. Used both by the AI
 * Analysis tab's validation layer and the opportunity summary band's
 * credibility flag, so the pass/fail color mapping lives in exactly one
 * place instead of being hand-rolled per surface.
 */
export function CredibilityChip({
  verdict,
  label,
  className,
}: {
  verdict: CredibilityVerdict;
  label?: string;
  className?: string;
}) {
  const style = CREDIBILITY_STYLES[verdict];
  return (
    <Chip
      label={label ?? style.label}
      dotClassName={style.dot}
      className={className ? `${style.className} ${className}` : style.className}
    />
  );
}
