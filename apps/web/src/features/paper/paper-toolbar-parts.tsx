import type { ComponentProps, MouseEvent, ReactNode } from "react"

import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, MoreHorizontal } from "lucide-react"

export function ToolbarRoot({
  children,
  className,
  ...rest
}: {
  children: ReactNode
  className?: string
} & ComponentProps<"div">) {
  return (
    <div
      role="toolbar"
      data-paper-toolbar
      className={cn(
        "flex min-h-11 items-center gap-1 overflow-x-auto rounded-lg border border-border bg-background px-2 py-1.5 shadow-sm",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function ToolbarZone({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {children}
    </div>
  )
}

export function ToolbarSpacer() {
  return <span className="min-w-2 flex-1" aria-hidden />
}

export function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
}

export function ToolbarMeta({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "shrink-0 px-2 text-xs text-muted-foreground tabular-nums",
        className
      )}
    >
      {children}
    </span>
  )
}

function keepEditorFocus(e: MouseEvent) {
  e.preventDefault()
}

export function ToolbarButton({
  label,
  onMouseDown,
  onClick,
  children,
  active,
  className,
}: {
  label: string
  onMouseDown?: () => void
  onClick?: () => void
  children: ReactNode
  active?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      onMouseDown={(e) => {
        if (onMouseDown) {
          keepEditorFocus(e)
          onMouseDown()
        }
      }}
      onClick={onClick}
      className={cn(
        "text-muted-foreground",
        active && "bg-muted text-foreground",
        className
      )}
    >
      {children}
    </Button>
  )
}

export type MenuItem = {
  id: string
  label: string
  hint?: string
  icon?: ReactNode
  disabled?: boolean
}

export type MenuSection = {
  label?: string
  items: MenuItem[]
}

function MenuItemRow({
  item,
  onSelect,
}: {
  item: MenuItem
  onSelect: (id: string) => void
}) {
  return (
    <DropdownMenuItem
      disabled={item.disabled}
      onClick={() => onSelect(item.id)}
      className="items-start"
    >
      {item.icon ? (
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {item.icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-xs font-medium">{item.label}</span>
        {item.hint ? (
          <span className="block text-micro leading-snug text-muted-foreground">
            {item.hint}
          </span>
        ) : null}
      </span>
    </DropdownMenuItem>
  )
}

export function ToolbarMenu({
  label,
  shortLabel,
  icon,
  items,
  onSelect,
  className,
  align = "start",
  hideLabel,
  panelClassName,
}: {
  label: string
  shortLabel?: string
  icon?: ReactNode
  items: MenuItem[]
  onSelect: (id: string) => void
  className?: string
  align?: "start" | "end"
  hideLabel?: boolean
  panelClassName?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 shrink-0 gap-1 px-2 text-xs font-medium text-muted-foreground",
              className
            )}
          />
        }
        aria-label={label}
        aria-haspopup="menu"
        onMouseDown={keepEditorFocus}
      >
        {icon}
        {hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("min-w-44", panelClassName)}>
        {items.map((item) => (
          <MenuItemRow key={item.id} item={item} onSelect={onSelect} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ToolbarOverflowMenu({
  sections,
  onSelect,
  align = "end",
}: {
  sections: MenuSection[]
  onSelect: (id: string) => void
  align?: "start" | "end"
}) {
  const flatCount = sections.reduce((n, s) => n + s.items.length, 0)
  if (flatCount === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
          />
        }
        aria-label="More options"
        aria-haspopup="menu"
        onMouseDown={keepEditorFocus}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-52">
        {sections.map((section, i) => (
          <div key={section.label ?? i}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            {section.label ? (
              <DropdownMenuLabel className="text-2xs font-medium tracking-wide uppercase">
                {section.label}
              </DropdownMenuLabel>
            ) : null}
            {section.items.map((item) => (
              <MenuItemRow key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ToolbarToggle({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string
  options: { id: string; label: string; icon?: ReactNode }[]
  onChange: (id: string) => void
  ariaLabel: string
}) {
  return (
    <ButtonGroup aria-label={ariaLabel} className="rounded-lg border border-border p-0.5">
      {options.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          variant="ghost"
          size="xs"
          onMouseDown={keepEditorFocus}
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={cn(
            value === opt.id
              ? "bg-muted text-foreground"
              : "text-muted-foreground"
          )}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </Button>
      ))}
    </ButtonGroup>
  )
}

/** @deprecated Use ToolbarZone inside ToolbarRoot */
export function ToolbarGroup({
  label,
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <ToolbarZone className={className}>
      {label ? <span className="sr-only">{label}</span> : null}
      {children}
    </ToolbarZone>
  )
}

export function runEditorCommand(command: string, value?: string) {
  document.execCommand(command, false, value)
}
