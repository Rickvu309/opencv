import { useEffect, useReducer, useRef, type RefObject } from "react"
import {
  findImportChecks,
  hasPhoneRun,
  type CvBlockDocument,
  type PaperId,
  type PaperView,
} from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { reportRejected } from "@/lib/command-failure.ts"
import { useRunCommand } from "@/lib/contract-client.ts"

type Check = PaperView["checks"][number]

function openChecks(checks: PaperView["checks"]) {
  return checks.filter(
    (check) =>
      check.resolved !== true &&
      (check.kind === "phone" || check.kind === "dates")
  )
}

export function filledImportCheckIds(
  document: CvBlockDocument,
  checks: PaperView["checks"]
) {
  const stillOpen = findImportChecks(document)
  const ids: string[] = []
  for (const check of checks) {
    if (check.resolved === true) continue
    if (check.kind === "phone" && hasPhoneRun(document.header.phone)) {
      ids.push(check.id)
      continue
    }
    if (check.kind !== "dates" || !check.blockId) continue
    const open = stillOpen.some(
      (item) => item.kind === "dates" && item.blockId === check.blockId
    )
    if (!open) ids.push(check.id)
  }
  return ids
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

type CheckBarState = { checks: PaperView["checks"]; hidden: boolean }

type CheckBarAction =
  | { type: "checks_synced"; checks: PaperView["checks"] }
  | { type: "check_dismissed"; checks: PaperView["checks"] }
  | { type: "bar_hidden" }

function checkBarReducer(
  state: CheckBarState,
  action: CheckBarAction
): CheckBarState {
  switch (action.type) {
    case "checks_synced":
    case "check_dismissed":
      return { ...state, checks: action.checks }
    case "bar_hidden":
      return { ...state, hidden: true }
  }
}

export function useImportCheckBar({
  docId,
  initial,
  readDocument,
  dirtyRef,
}: {
  docId: PaperId
  initial: PaperView
  readDocument: () => CvBlockDocument
  dirtyRef: RefObject<boolean>
}) {
  const run = useRunCommand()
  const [{ checks, hidden }, dispatch] = useReducer(checkBarReducer, {
    checks: initial.checks,
    hidden: false,
  })
  const checksRef = useRef(checks)
  const stamp = useRef(initial.updatedAt)
  const readRef = useRef(readDocument)

  useEffect(() => {
    checksRef.current = checks
    readRef.current = readDocument
  }, [checks, readDocument])

  useEffect(() => {
    if (dirtyRef.current) return
    if (initial.updatedAt < stamp.current) return
    stamp.current = initial.updatedAt
    dispatch({ type: "checks_synced", checks: initial.checks })
  }, [initial, dirtyRef])

  async function dismiss(checkId: string) {
    if (!checksRef.current.some((check) => check.id === checkId)) return
    const saved = await run("paper.dismissCheck", { docId, checkId })
    stamp.current = saved.updatedAt
    checksRef.current = saved.checks
    dispatch({ type: "check_dismissed", checks: saved.checks })
  }

  async function settle() {
    const ids = filledImportCheckIds(readRef.current(), checksRef.current)
    for (const id of ids) await dismiss(id)
  }

  function skip(checkId: string) {
    void dismiss(checkId).catch(reportRejected("dismiss this check"))
  }

  function done() {
    dispatch({ type: "bar_hidden" })
    const source = checksRef.current.find((check) => check.kind === "source")
    if (source)
      void dismiss(source.id).catch(reportRejected("dismiss this check"))
  }

  return { checks, hidden, skip, done, settle }
}
