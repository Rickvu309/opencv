import { SegmentedControl } from "@workspace/ui/components/segmented-control"
import type { PaperContentKind } from "@workspace/domain"

export type PaperKindFilter = "all" | PaperContentKind

const KIND_OPTIONS = [
  { value: "all", label: "All" },
  { value: "cv", label: "CV" },
  { value: "letter", label: "Letter" },
  { value: "proof", label: "Proof" },
] as const

type Props = {
  value: PaperKindFilter
  onChange: (value: PaperKindFilter) => void
  counts: Record<PaperKindFilter, number>
}

/** Loaded after the list, so the list does not wait for the control. */
export default function PaperKindFilterControl({
  value,
  onChange,
  counts,
}: Props) {
  return (
    <SegmentedControl
      aria-label="Show"
      size="sm"
      value={value}
      onChange={onChange}
      options={KIND_OPTIONS.map((option) => ({
        ...option,
        count: counts[option.value],
      }))}
    />
  )
}
