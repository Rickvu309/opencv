import { useEffect, useRef, useState, type RefObject } from "react"
import type { CvBlockDocument, PaperId, PaperView } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"

import { useRunCommand } from "@/lib/contract-client.ts"

type Check = PaperView["checks"][number]

function openChecks(checks: PaperView["checks"]) {
  return checks.filter(
    (check) =>
      check.resolved !== true &&
      (check.kind === "phone" || check.kind === "dates")
  )
}

function blockFilled(document: CvBlockDocument, blockId: string) {
  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.id !== blockId) continue
      if (
        block.type === "experience-entry" ||
        block.type === "education-entry"
      ) {
        return block.period.trim().length > 0
      }
      if (block.type === "text" || block.type === "heading") {
        return block.text.trim().length > 0
      }
    }
  }
  return false
}

export function filledImportCheckIds(
  document: CvBlockDocument,
  checks: PaperView["checks"]
) {
  const ids: string[] = []
  for (const check of checks) {
    if (check.resolved === true) continue
    if (check.kind === "phone" && document.header.phone.trim())
      ids.push(check.id)
    if (
      check.kind === "dates" &&
      check.blockId &&
      blockFilled(document, check.blockId)
    ) {
      ids.push(check.id)
    }
  }
  return ids
}

export function focusPhoneField() {
  document.querySelector<HTMLElement>('[aria-label="Phone"]')?.focus()
}

export function focusDatesField(blockId: string) {
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
  const [checks, setChecks] = useState(initial.checks)
  const [hidden, setHidden] = useState(false)
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
    setChecks(initial.checks)
  }, [initial, dirtyRef])

  async function dismiss(checkId: string) {
    if (!checksRef.current.some((check) => check.id === checkId)) return
    const saved = await run("paper.dismissCheck", { docId, checkId })
    stamp.current = saved.updatedAt
    checksRef.current = saved.checks
    setChecks(saved.checks)
  }

  async function settle() {
    const ids = filledImportCheckIds(readRef.current(), checksRef.current)
    for (const id of ids) await dismiss(id)
  }

  function skip(checkId: string) {
    void dismiss(checkId)
  }

  function done() {
    setHidden(true)
    const source = checksRef.current.find((check) => check.kind === "source")
    if (source) void dismiss(source.id)
  }

  return { checks, hidden, skip, done, settle }
}
