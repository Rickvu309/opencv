import { Fragment, type ReactNode } from "react"
import { File, MoreHorizontal, type LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import { libraryDisplayName } from "./paper-library-entries.ts"

export type PaperCardAction = {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

export function PaperSheet({
  lines = [],
  badge,
  preview,
}: {
  lines?: string[]
  badge?: string
  preview?: ReactNode
}) {
  const [lead, ...rest] = lines
  return (
    <div
      data-slot="paper-library-sheet"
      className="paper-sheet @container relative block aspect-[17/22] w-full overflow-hidden rounded-[3px] bg-white text-left text-black/85"
      aria-hidden="true"
    >
      {preview ?? (
        <span className="flex h-full flex-col gap-[3cqw] px-[9cqw] py-[10cqw]">
          {lead ? (
            <span
              data-slot="paper-library-preview-name"
              className="line-clamp-2 font-serif text-[6cqw] leading-[1.2] font-bold break-words"
            >
              {lead}
            </span>
          ) : null}
          {rest.length > 0 ? (
            <span
              data-slot="paper-library-preview"
              className="line-clamp-8 font-serif text-[3.3cqw] leading-[1.6] break-words whitespace-pre-line text-black/70"
            >
              {rest.join("\n")}
            </span>
          ) : null}
          {badge ? (
            <File
              className="m-auto size-8 text-muted-foreground"
              strokeWidth={1.5}
            />
          ) : null}
        </span>
      )}
      {badge ? (
        <span className="absolute start-3 bottom-3 rounded bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-medium text-secondary-foreground">
          {badge}
        </span>
      ) : null}
    </div>
  )
}

function PaperLabel({ name, meta }: { name: string; meta: string }) {
  return (
    <span
      data-slot="paper-library-label"
      className="flex w-full min-w-0 flex-col gap-1 text-left"
    >
      <span
        title={name}
        className="block truncate text-[0.8125rem] leading-[1.125rem] font-medium text-foreground"
      >
        {name}
      </span>
      <span className="truncate text-xs font-normal text-muted-foreground">
        {meta}
      </span>
    </span>
  )
}

export function PaperLibraryCard({
  name,
  meta,
  badge,
  lines = [],
  preview,
  openLabel,
  onOpen,
  actions,
}: {
  name: string
  meta: string
  badge?: string
  lines?: string[]
  preview?: ReactNode
  openLabel?: string
  onOpen?: () => void
  actions: PaperCardAction[]
}) {
  const displayName = libraryDisplayName(name)
  const displayLabel = openLabel?.replace(name, displayName)
  const body: ReactNode = (
    <>
      <PaperSheet lines={lines} badge={badge} preview={preview} />
      <PaperLabel name={displayName} meta={meta} />
    </>
  )
  return (
    <div
      data-slot="paper-library-card"
      className="paper-desk-card group/card relative min-w-0"
    >
      {onOpen ? (
        <Button
          type="button"
          variant="ghost"
          aria-label={displayLabel ?? displayName}
          className="group/card h-auto min-h-11 w-full min-w-0 flex-col items-start gap-3 rounded-[3px] border-0 p-0 font-normal whitespace-normal hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
          onClick={onOpen}
        >
          {body}
        </Button>
      ) : (
        <div className="flex w-full min-w-0 flex-col items-start gap-3">
          {body}
        </div>
      )}
      {actions.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1.5 right-1.5 size-11 bg-card/90 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:aria-expanded:opacity-100 md:[@media(pointer:fine)]:size-7"
                aria-label={`${displayName} menu`}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {actions.map(
              ({ label, icon: Icon, onSelect, destructive }, index) => (
                <Fragment key={label}>
                  {destructive && index > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem
                    variant={destructive ? "destructive" : "default"}
                    onClick={onSelect}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </DropdownMenuItem>
                </Fragment>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
