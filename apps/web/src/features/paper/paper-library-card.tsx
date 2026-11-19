import { Fragment, type ReactNode } from "react"
import { MoreHorizontal, type LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import "./design/paper-picture.css"

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
      className="paper-picture paper-sheet rounded-[3px]"
      aria-hidden="true"
    >
      {preview ?? (
        <span className="paper-picture-text flex flex-col gap-4 font-serif text-[12pt] leading-[1.6]">
          {lead ? (
            <span
              data-slot="paper-library-preview-name"
              className="text-[20pt] leading-[1.2] font-bold wrap-anywhere"
            >
              {lead}
            </span>
          ) : null}
          {rest.length > 0 ? (
            <span
              data-slot="paper-library-preview"
              className="wrap-anywhere whitespace-pre-line"
            >
              {rest.join("\n")}
            </span>
          ) : null}
        </span>
      )}
      {badge ? (
        <span className="absolute start-3 bottom-3 rounded bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
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

export function PaperActionMenu({
  label,
  actions,
  className,
}: {
  label: string
  actions: PaperCardAction[]
  className?: string
}) {
  if (actions.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("size-11 md:size-7", className)}
            aria-label={label}
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {actions.map(
          ({ label: action, icon: Icon, onSelect, destructive }, index) => (
            <Fragment key={action}>
              {destructive && index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={destructive ? "destructive" : "default"}
                onClick={onSelect}
              >
                <Icon aria-hidden="true" />
                {action}
              </DropdownMenuItem>
            </Fragment>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const body: ReactNode = (
    <>
      <PaperSheet lines={lines} badge={badge} preview={preview} />
      <PaperLabel name={name} meta={meta} />
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
          aria-label={openLabel ?? name}
          className="group/card h-auto min-h-11 w-full min-w-0 flex-col items-start gap-3 rounded-[3px] border-0 p-0 font-normal whitespace-normal hover:bg-transparent aria-expanded:bg-transparent"
          onClick={onOpen}
        >
          {body}
        </Button>
      ) : (
        <div className="flex w-full min-w-0 flex-col items-start gap-3">
          {body}
        </div>
      )}
      <PaperActionMenu
        label={`${name} menu`}
        actions={actions}
        className="absolute top-1.5 right-1.5 size-11 bg-card/90 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:aria-expanded:opacity-100 md:[@media(pointer:fine)]:size-7"
      />
    </div>
  )
}
