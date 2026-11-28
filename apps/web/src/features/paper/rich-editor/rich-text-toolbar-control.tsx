import { useReducer, type ReactElement, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { mountRichPaperEditor } from "@workspace/paper-crdt/editor"

import { ToolbarItem } from "./rich-text-toolbar-item.tsx"

export type TextEditor = ReturnType<typeof mountRichPaperEditor>
export type TextFormatting = NonNullable<
  ReturnType<TextEditor["activeFormatting"]>
>
export type TextChoice = { value: string; label: string; face?: string }

export function shortcutLabel(shortcut: string, platform = navigator.platform) {
  return /Mac|iPhone|iPad|iPod/.test(platform)
    ? shortcut.replaceAll("Ctrl+", "⌘+")
    : shortcut
}

export function ToolbarHint({
  label,
  children,
}: {
  label: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <ToolbarItem label={label}>
      <ToolbarHint label={label}>
        <Button
          variant="ghost"
          size="icon"
          className="size-[44px] shrink-0 md:size-8"
          aria-label={label}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
        >
          {children}
        </Button>
      </ToolbarHint>
    </ToolbarItem>
  )
}

export function ToolbarChoice({
  label,
  value,
  choices,
  disabled,
  onChange,
  editor,
  icon,
  className = "",
  fallback,
  controls,
}: {
  label: string
  value: string | null
  choices: TextChoice[]
  disabled: boolean
  onChange: (value: string) => void
  editor: TextEditor | null
  icon?: ReactNode
  className?: string
  fallback?: (value: string) => string
  controls?: ReactNode
}) {
  const [open, dispatch] = useReducer(
    (_: boolean, action: { type: "open"; open: boolean }) => action.open,
    false
  )
  const setOpen = (open: boolean) => dispatch({ type: "open", open })
  const options =
    value && !choices.some((choice) => choice.value === value)
      ? [...choices, { value, label: fallback?.(value) ?? "Custom" }]
      : choices
  const selected = options.find((choice) => choice.value === value)
  return (
    <ToolbarItem label={label}>
      {controls}
      <Select
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) editor?.focus()
        }}
        value={disabled ? null : value}
        items={options}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) {
            onChange(next)
            setOpen(false)
          }
        }}
      >
        <ToolbarHint label={selected ? `${label}: ${selected.label}` : label}>
          <SelectTrigger
            aria-label={label}
            className={`min-h-11 shrink-0 border-transparent px-2 md:min-h-8 ${className}`}
          >
            {icon}
            <SelectValue
              placeholder={disabled ? "" : "Mixed"}
              className={icon ? "sr-only" : ""}
              style={selected?.face ? { fontFamily: selected.face } : undefined}
            />
          </SelectTrigger>
        </ToolbarHint>
        <SelectContent
          align="start"
          finalFocus={() => editor?.focus() ?? false}
        >
          {options.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              <span
                style={choice.face ? { fontFamily: choice.face } : undefined}
              >
                {choice.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ToolbarItem>
  )
}
