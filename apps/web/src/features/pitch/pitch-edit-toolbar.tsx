import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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
  onAddOpenChange: (open: boolean) => void
  onAddBlock: (kind: PitchBlockKind) => void
  onPublish: () => void
  onUnpublish: () => void
  onDone: () => void
}

export function PitchEditToolbar({
  published,
  addOpen,
  onAddOpenChange,
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

        <Popover open={addOpen} onOpenChange={onAddOpenChange}>
          <PopoverTrigger
            render={
              <Button type="button" size="sm" variant="outline" className="h-8" />
            }
          >
            <Plus className="size-3.5" />
            Add section
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-56 gap-0 p-1"
          >
            {(Object.keys(BLOCK_LABELS) as PitchBlockKind[]).map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="ghost"
                aria-label={BLOCK_LABELS[kind]}
                onClick={() => onAddBlock(kind)}
                className="h-auto w-full flex-col items-start rounded-lg px-2.5 py-2 text-left"
              >
                <span className="text-xs font-medium">
                  {BLOCK_LABELS[kind]}
                </span>
                <span className="mt-0.5 text-2xs leading-snug font-normal text-muted-foreground">
                  {BLOCK_PURPOSE[kind]}
                </span>
              </Button>
            ))}
          </PopoverContent>
        </Popover>

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
            published && "border-success/30 text-success"
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
