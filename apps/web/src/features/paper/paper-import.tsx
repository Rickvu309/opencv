import type { ComponentProps, DragEvent } from "react"
import { Spinner } from "@workspace/ui/components/spinner"

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
  return (
    <div
      role="region"
      aria-label="Import a file"
      className="rounded-lg border border-border p-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDropFile}
    >
      <p className="text-sm font-medium">Import a file</p>
      <p className="text-sm text-muted-foreground">
        Drop a PDF, Word or Google Doc, or paste a LinkedIn link.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmitLink()
        }}
      >
        <Input
          aria-label="Paste a link"
          placeholder="Paste a link"
          value={link}
          className="h-11 min-w-0 flex-1 basis-40 text-base md:h-8 md:text-sm"
          onChange={(event) => onLinkChange(event.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          className="h-11 shrink-0 md:h-8"
        >
          Import
        </Button>
      </form>
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-11 md:h-8"
        onClick={onChooseFile}
      >
        Choose file
      </Button>
    </div>
  )
}

export function PaperImportDialog({
  open,
  onClose,
  ...props
}: ComponentProps<typeof PaperImportRow> & {
  open: boolean
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
          <DialogTitle>Import</DialogTitle>
          <DialogDescription>Bring a file you already have.</DialogDescription>
        </DialogHeader>
        <PaperImportRow {...props} />
      </DialogContent>
    </Dialog>
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
          <Spinner aria-hidden />
          <p className="truncate text-sm text-muted-foreground">{filename}</p>
        </div>
        <div className="flex justify-end">
          <Button
            className="h-11 md:h-8"
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
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
  onRetry,
  blankPending = false,
}: {
  open: boolean
  sentence: string
  onChoose: () => void
  onBlank: () => void
  onClose: () => void
  onRetry?: () => void
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
          <DialogTitle>
            {onRetry ? "File not imported yet" : "Can't read this file"}
          </DialogTitle>
          <DialogDescription role="alert">{sentence}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          {onRetry ? (
            <Button
              className="h-11 md:h-8"
              type="button"
              variant="ghost"
              onClick={onChoose}
            >
              Choose another file
            </Button>
          ) : (
            <Button
              className="h-11 md:h-8"
              type="button"
              variant="ghost"
              onClick={onBlank}
              disabled={blankPending}
            >
              Start blank
            </Button>
          )}
          <Button
            className="h-11 md:h-8"
            type="button"
            variant="primary"
            onClick={onRetry ?? onChoose}
          >
            {onRetry ? "Try again" : "Choose another file"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
