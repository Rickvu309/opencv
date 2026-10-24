import { useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  FilterMenu,
  type FilterValue,
} from "@workspace/ui/components/filter-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ListFilter } from "lucide-react"

import {
  activeFilterCount,
  applyFilterGroups,
} from "@/features/apply/apply-filters.ts"
import type { ApplyCard } from "@/features/apply/apply-types.ts"

export function ApplyFilterPopover({
  cards,
  value,
  onChange,
}: {
  cards: readonly ApplyCard[]
  value: FilterValue
  onChange: (value: FilterValue) => void
}) {
  const groups = useMemo(() => applyFilterGroups(cards), [cards])
  const count = activeFilterCount(value)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="gap-1.5"
          />
        }
      >
        <ListFilter className="size-3.5" />
        Filters
        {count > 0 ? (
          <span className="tabular-nums" aria-label={`${count} active`}>
            {count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <FilterMenu
          groups={groups}
          value={value}
          onChange={onChange}
          hints={false}
          defaultOpen={["stage"]}
        />
      </PopoverContent>
    </Popover>
  )
}
