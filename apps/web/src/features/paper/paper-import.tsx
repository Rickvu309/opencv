import type { RefObject } from "react"
import { unreadableImportLink } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export const IMPORT_PAGES =
  "Pages files aren't supported. Try a PDF or Word file."

export type EditorCheck = {
  id: string
  kind: string
  message: string
  blockId?: string
  resolved?: boolean
}

export function pagesRefusal(file: { name: string; type: string }) {
  if (
    file.name.toLowerCase().endsWith(".pages") ||
    file.type === "application/vnd.apple.pages"
  ) {
    return IMPORT_PAGES
  }
  return null
}

export function linkRefusal(value: string) {
  return unreadableImportLink(value)
}

export function PaperImportInput({
  inputRef,
  accept,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  accept: string
  onFile: (file: File) => void
}) {
  return (
    <>
      {/* Documented exception: native file input. Kit Input cannot host a hidden file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ""
        }}
      />
    </>
  )
}

export function ImportProgressDialog({
  open,
  filename,
  onCancel,
}: {
  open: boolean
  filename: string
  onCancel: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importing…</DialogTitle>
          <DialogDescription>{filename}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CantReadDialog({
  open,
  sentence,
  onChoose,
  onBlank,
  onClose,
}: {
  open: boolean
  sentence: string
  onChoose: () => void
  onBlank: () => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Can&apos;t read this file</DialogTitle>
          <DialogDescription>{sentence}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onBlank}>
            Start blank
          </Button>
          <Button type="button" variant="glow" onClick={onChoose}>
            Choose another file
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function checkLabel(kind: string) {
  if (kind === "phone") return "Phone missing"
  if (kind === "dates") return "Dates missing"
  return "Check"
}

function checkAction(kind: string) {
  if (kind === "phone") return "Add phone"
  if (kind === "dates") return "Add dates"
  return "Add"
}

export function openImportChecks(checks: EditorCheck[]) {
  return checks.filter(
    (check) => check.kind !== "source" && check.resolved !== true
  )
}

export function ImportCheckBar({
  checks,
  onAddPhone,
  onAddDates,
  onSkip,
  onDone,
}: {
  checks: EditorCheck[]
  onAddPhone: () => void
  onAddDates: (blockId: string) => void
  onSkip: (checkId: string) => void
  onDone: () => void
}) {
  const source = checks.find((check) => check.kind === "source")
  const open = openImportChecks(checks)
  if (!source && open.length === 0) return null
  const filename = source?.message || "your file"
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
            <p className="text-sm font-medium">{checkLabel(check.kind)}</p>
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
            {checkAction(check.kind)}
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
