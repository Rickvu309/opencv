import { useState, type DragEvent } from "react"
import { FileUp, LoaderCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export function PaperImportRow({
  link,
  onLinkChange,
  onSubmitLink,
  onChooseFile,
  onDropFile,
}: {
  link: string
  onLinkChange: (value: string) => void
  onSubmitLink: () => void
  onChooseFile: () => void
  onDropFile: (event: DragEvent<HTMLDivElement>) => void
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  return (
    <div
      role="region"
      aria-label="Import a file"
      className="w-full max-w-170 rounded-2xl border border-border bg-card px-4 py-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDropFile}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary"
        >
          <FileUp className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold">Import a file</p>
          <p className="text-xs text-muted-foreground/85">
            Drop a PDF, Word or Google Doc, or{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-normal text-muted-foreground/85"
              onClick={() => setLinkOpen((open) => !open)}
              aria-expanded={linkOpen}
              aria-controls="paper-import-link"
            >
              paste a LinkedIn link.
            </Button>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 bg-card"
          onClick={onChooseFile}
        >
          Choose file
        </Button>
      </div>
      {linkOpen ? (
        <div id="paper-import-link" className="pt-3">
          <Input
            aria-label="Paste a link"
            placeholder="Paste a link"
            value={link}
            onChange={(event) => onLinkChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              onSubmitLink()
            }}
          />
        </div>
      ) : null}
    </div>
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
        </DialogHeader>
        <div role="status" className="flex items-center gap-3">
          <LoaderCircle
            aria-hidden
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          <p className="truncate text-sm text-muted-foreground">{filename}</p>
        </div>
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
  blankPending = false,
}: {
  open: boolean
  sentence: string
  onChoose: () => void
  onBlank: () => void
  onClose: () => void
  blankPending?: boolean
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
          <DialogDescription role="alert">{sentence}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onBlank}
            disabled={blankPending}
          >
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
