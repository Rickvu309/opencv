import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import type { ComparisonTone } from "@/lib/types";

/**
 * Renders one of the dimension grid's soft-judgment cells: a compact chip
 * built on the same shared tone table every other status chip in the
 * product draws from, so a "warning" cell here reads exactly like a
 * "warning" anywhere else.
 */
export function ComparisonJudgmentChip({ tone, label }: { tone: ComparisonTone; label: string }) {
  const style = CHIP_TONES[tone];
  return <Chip label={label} dotClassName={style.dot} className={style.className} />;
}
