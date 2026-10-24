import type {
  FilterGroup,
  FilterValue,
} from "@workspace/ui/components/filter-menu"

import { STAGES, type ApplyCard } from "@/features/apply/apply-types.ts"

export const APPLY_FILTER_STARRED = "starred"

export function applyFilterGroups(cards: readonly ApplyCard[]): FilterGroup[] {
  const companies = [...new Set(cards.map((card) => card.company))].sort(
    (a, b) => a.localeCompare(b)
  )
  return [
    {
      id: "stage",
      label: "Stage",
      options: STAGES.map((stage) => ({ id: stage.id, label: stage.label })),
    },
    {
      id: "company",
      label: "Company",
      options: companies.map((company) => ({ id: company, label: company })),
    },
    {
      id: APPLY_FILTER_STARRED,
      label: "Starred",
      options: [{ id: "yes", label: "Starred only" }],
    },
  ]
}

export function activeFilterCount(filters: FilterValue) {
  return Object.values(filters).reduce((sum, ids) => sum + ids.length, 0)
}

/** Search words and filter groups combine with AND; options in a group with OR. */
export function filterApplyCards(
  cards: readonly ApplyCard[],
  query: string,
  filters: FilterValue
): ApplyCard[] {
  const q = query.trim().toLowerCase()
  const stages = filters.stage ?? []
  const companies = filters.company ?? []
  const starredOnly = (filters[APPLY_FILTER_STARRED] ?? []).length > 0
  return cards.filter(
    (card) =>
      (!q ||
        card.title.toLowerCase().includes(q) ||
        card.company.toLowerCase().includes(q)) &&
      (stages.length === 0 || stages.includes(card.stage)) &&
      (companies.length === 0 || companies.includes(card.company)) &&
      (!starredOnly || card.starred)
  )
}
