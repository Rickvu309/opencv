import { type PaperView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

type Check = PaperView["checks"][number]

function openChecks(checks: PaperView["checks"]) {
  return checks.filter(
    (check) =>
      check.resolved !== true &&
      (check.kind === "phone" || check.kind === "dates")
  )
}

type BoundFocus = {
  focusField(name: string, blockId?: string): void
}

let boundFocus: BoundFocus | null = null

export function bindPaperFocus(handle: BoundFocus | null) {
  boundFocus = handle
}

export function focusPhoneField() {
  if (boundFocus) {
    boundFocus.focusField("phone")
    return
  }
  document.querySelector<HTMLElement>('[aria-label="Phone"]')?.focus()
}

export function focusDatesField(blockId: string) {
  if (boundFocus) {
    boundFocus.focusField("period", blockId)
    return
  }
  const root = document.querySelector<HTMLElement>(
    `[data-sortable-block="${CSS.escape(blockId)}"]`
  )
  const period = root?.querySelector<HTMLElement>(
    '[aria-label="Dates"], [aria-label="Period"]'
  )
  const field = period ?? root?.querySelector<HTMLElement>('[role="textbox"]')
  field?.focus()
}

function labelOf(check: Check) {
  if (check.kind === "phone") return "Phone missing"
  if (check.kind === "dates") return "Dates missing"
  return "Check"
}

function actionOf(check: Check) {
  if (check.kind === "phone") return "Add phone"
  if (check.kind === "dates") return "Add dates"
  return "Add"
}

export function PaperCheckBar({
  checks,
  hidden = false,
  onAddPhone,
  onAddDates,
  onSkip,
  onDone,
}: {
  checks: PaperView["checks"]
  hidden?: boolean
  onAddPhone: () => void
  onAddDates: (blockId: string) => void
  onSkip: (checkId: string) => void
  onDone: () => void
}) {
  if (hidden) return null
  const source = checks.find((check) => check.kind === "source")
  const open = openChecks(checks)
  if (!source && open.length === 0) return null
  const filename = source?.message || "your file"
  return (
    <div
      role="region"
      aria-label="Import checks"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Imported from {filename}</p>
        {open.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {open.length} to check
          </p>
        ) : (
          <Button type="button" variant="ghost" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
      {open.map((check) => (
        <div key={check.id} className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{labelOf(check)}</p>
            <p className="text-sm text-muted-foreground">{check.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (check.kind === "phone") onAddPhone()
              else onAddDates(check.blockId ?? "")
            }}
          >
            {actionOf(check)}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSkip(check.id)}
          >
            Skip
          </Button>
        </div>
      ))}
    </div>
  )
}
