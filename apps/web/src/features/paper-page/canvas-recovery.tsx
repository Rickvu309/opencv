import { useEffect, useReducer } from "react"
import { Button } from "@workspace/ui/components/button"
import { CopyButton } from "@workspace/ui/components/copy-button"

import {
  readBranch,
  recoveries,
  writingStorage,
  type Recovery,
} from "./canvas-branch.ts"
import { recoveryRecords } from "./canvas-save-record.ts"
import { pageWords } from "./canvas-save.ts"

type Model = { drafts: Recovery[]; unreadable: boolean }
export function RecoveryBar({
  docId,
  onRecover,
}: {
  docId: string
  onRecover: (selected: Recovery) => void
}) {
  const [model, update] = useReducer((_before: Model, next: Model) => next, {
    drafts: [],
    unreadable: false,
  })
  useEffect(() => {
    let active = true
    const refresh = async () => {
      const local = recoveries(docId)
      const stored = await recoveryRecords(docId)
      const own = readBranch(docId, writingStorage)
      const drafts = local.drafts.slice()
      for (const item of stored.drafts) {
        const branch = item.branch
        if (
          !drafts.some((found) => found.key === item.key) &&
          !own?.dismissed.includes(item.identity) &&
          (item.legacy ||
            pageWords(branch.draft.blocks) !== branch.basis?.words ||
            branch.unsaved.length)
        )
          drafts.push(item)
      }
      if (active)
        update({ drafts, unreadable: local.unreadable || stored.unreadable })
    }
    void refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      window.removeEventListener("storage", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [docId])
  if (!model.drafts.length && !model.unreadable) return null
  return (
    <aside
      aria-label="Recover writing"
      className="border-b bg-muted/30 px-4 py-3 text-sm"
    >
      {model.unreadable ? (
        <p role="status">
          Local copies could not all be checked. Any existing copies were left
          unchanged.
        </p>
      ) : null}
      {model.drafts.map((item, index) => (
        <div
          key={item.identity}
          className="flex flex-wrap items-center gap-3 py-1"
        >
          <p className="min-w-0 flex-1 basis-full break-words md:basis-auto">
            Local copy {index + 1}:{" "}
            {pageWords(item.branch.draft.blocks).slice(0, 90) || "Empty page"}
          </p>
          <CopyButton
            aria-label={`Copy local text ${index + 1}`}
            variant="outline"
            size="sm"
            className="h-11 md:h-8"
            value={pageWords(item.branch.draft.blocks)}
          >
            Copy local text
          </CopyButton>
          <Button
            variant="outline"
            size="sm"
            className="h-11 md:h-8"
            onClick={() => onRecover(item)}
          >
            Recover local copy {index + 1}
          </Button>
        </div>
      ))}
    </aside>
  )
}
