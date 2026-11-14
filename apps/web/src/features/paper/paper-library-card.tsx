import { Fragment, type ReactNode } from "react"
import { MoreHorizontal, type LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export type PaperCardAction = {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

const SHEET =
  "relative flex aspect-[150/212] w-full flex-col overflow-hidden rounded-[3px] bg-card px-[13px] py-[14px] text-left shadow-sm ring-1 ring-foreground/5 transition-[box-shadow] duration-(--duration-micro) ease-(--ease-micro) group-hover/card:ring-foreground/15 group-focus-visible/card:ring-foreground/15 md:h-[212px] md:w-[150px]"

function PaperSheet({ name, badge }: { name: string; badge?: string }) {
  return (
    <span data-slot="paper-library-sheet" className={SHEET} aria-hidden="true">
      <span className="line-clamp-4 text-[9px] leading-tight font-bold break-words whitespace-normal text-foreground">
        {name}
      </span>
      {badge ? (
        <span className="absolute bottom-2.5 left-2.5 flex h-5 items-center rounded-[5px] bg-foreground px-[7px] text-[10px] font-bold text-card">
          {badge}
        </span>
      ) : null}
    </span>
  )
}

function PaperLabel({ name, meta }: { name: string; meta: string }) {
  return (
    <span
      data-slot="paper-library-label"
      className="flex w-full min-w-0 flex-col gap-1 text-left"
    >
      <span className="block h-[18px] truncate text-[13px] leading-[18px] font-medium text-foreground">
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
  openLabel,
  onOpen,
  actions,
}: {
  name: string
  meta: string
  badge?: string
  openLabel?: string
  onOpen?: () => void
  actions: PaperCardAction[]
}) {
  const body: ReactNode = (
    <>
      <PaperSheet name={name} badge={badge} />
      <PaperLabel name={name} meta={meta} />
    </>
  )
  return (
    <div
      data-slot="paper-library-card"
      className="group/card relative min-w-0 md:w-[150px]"
    >
      {onOpen ? (
        <Button
          type="button"
          variant="ghost"
          aria-label={openLabel}
          className="group/card h-auto min-h-11 w-full min-w-0 flex-col items-start gap-3 rounded-[3px] p-0 font-normal whitespace-normal hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
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
                className="absolute top-1.5 right-1.5 size-11 bg-card/90 group-focus-within/card:opacity-100 group-hover/card:opacity-100 aria-expanded:opacity-100 md:size-7 [@media(hover:hover)_and_(pointer:fine)]:opacity-0"
                aria-label={`${name} menu`}
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

export function PaperLibraryTile({
  label,
  icon: Icon,
  slot,
  onClick,
}: {
  label: string
  icon: LucideIcon
  slot: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-slot={slot}
      className="aspect-[150/212] h-auto min-h-11 w-full min-w-0 flex-col gap-2 rounded-[3px] border border-input p-0 text-[12.5px] font-medium whitespace-normal text-muted-foreground md:h-[212px] md:w-[150px]"
      onClick={onClick}
    >
      <span className="flex size-8 items-center justify-center rounded-full border border-border bg-card">
        <Icon className="size-[15px]" aria-hidden="true" />
      </span>
      {label}
    </Button>
  )
}
