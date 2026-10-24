import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"

import { DestructiveCommandDialog } from "@/features/commands/destructive-command-dialog.tsx"

import { isSampleCv, type PaperDoc } from "./paper-data.ts"

type Card = { id: string; company: string; title: string }

type Props = {
  renameTarget: PaperDoc | null
  onRename: (name: string) => void
  onCloseRename: () => void
  deleteTarget: PaperDoc | null
  onConfirmDelete: () => void
  onCloseDelete: () => void
  linkTarget: PaperDoc | null
  cards: readonly Card[]
  onLink: (cardId: string | null) => void
  onCloseLink: () => void
}

export function PaperDialogs({
  renameTarget,
  onRename,
  onCloseRename,
  deleteTarget,
  onConfirmDelete,
  onCloseDelete,
  linkTarget,
  cards,
  onLink,
  onCloseLink,
}: Props) {
  return (
    <>
      {renameTarget ? (
        <RenameDialog
          key={renameTarget.id}
          doc={renameTarget}
          onSubmit={onRename}
          onClose={onCloseRename}
        />
      ) : null}

      {deleteTarget ? (
        <DestructiveCommandDialog
          open
          title={isSampleCv(deleteTarget) ? "Clear sample" : "Delete"}
          name={deleteTarget.name}
          onOpenChange={(open) => {
            if (!open) onCloseDelete()
          }}
          onConfirm={onConfirmDelete}
        />
      ) : null}

      <Dialog
        open={Boolean(linkTarget)}
        onOpenChange={(open) => {
          if (!open) onCloseLink()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Apply</DialogTitle>
            <DialogDescription>
              Connect this CV, Letter or Proof to an Opportunity card, or remove
              the link.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1">
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Apply cards yet.
              </p>
            ) : (
              cards.map((card) => (
                <Button
                  key={card.id}
                  type="button"
                  variant={
                    linkTarget?.applyCardId === card.id ? "secondary" : "ghost"
                  }
                  className="justify-start"
                  onClick={() => onLink(card.id)}
                >
                  {card.company} · {card.title}
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            {linkTarget?.applyCardId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onLink(null)}
              >
                Unlink
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onCloseLink}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RenameDialog({
  doc,
  onSubmit,
  onClose,
}: {
  doc: PaperDoc
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(doc.name)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>
            The name shows in Paper and in the editor header.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Name"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(value)
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit(value)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
