import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, Globe, Pencil, Plus, X } from "lucide-react"

import {
  BLOCK_LABELS,
  BLOCK_PURPOSE,
  type PitchBlockKind,
} from "@/features/pitch/pitch-types.ts"

type Props = {
  published: boolean
  addOpen: boolean
  onToggleAdd: () => void
  onAddBlock: (kind: PitchBlockKind) => void
  onPublish: () => void
  onUnpublish: () => void
  onDone: () => void
}

export function PitchEditToolbar({
  published,
  addOpen,
  onToggleAdd,
  onAddBlock,
  onPublish,
  onUnpublish,
  onDone,
}: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:pb-5">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/95 px-3 py-2.5 shadow-[0_8px_32px_oklch(0_0_0/0.12)] backdrop-blur-md">
        <div className="flex items-center gap-2 pr-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted">
            <Pencil className="size-3.5 text-muted-foreground" />
          </span>
          <span className="text-xs font-medium">Editing Pitch</span>
        </div>

        <div className="relative">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onToggleAdd}
          >
            <Plus className="size-3.5" />
            Add section
          </Button>
          {addOpen ? (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-xl">
              {(Object.keys(BLOCK_LABELS) as PitchBlockKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-label={BLOCK_LABELS[kind]}
                  onClick={() => onAddBlock(kind)}
                  className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-muted"
                >
                  <span className="text-xs font-medium">
                    {BLOCK_LABELS[kind]}
                  </span>
                  <span className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {BLOCK_PURPOSE[kind]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        {published ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onUnpublish}
          >
            <EyeOff className="size-3.5" />
            Unpublish
          </Button>
        ) : (
          <Button type="button" size="sm" className="h-8" onClick={onPublish}>
            <Globe className="size-3.5" />
            Publish
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant={published ? "outline" : "secondary"}
          className={cn(
            "ml-auto h-8",
            published && "border-emerald-200 text-emerald-800"
          )}
          onClick={onDone}
        >
          {published ? (
            <>
              <Eye className="size-3.5" />
              Preview
            </>
          ) : (
            <>
              <X className="size-3.5" />
              Done
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
