import { use, type ComponentProps, type ReactNode } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"

import { PromptInputFrame } from "./prompt-input-frame.ts"

const frameClasses = {
  standard: {
    textarea: "max-h-48 min-h-14 px-4 py-3.5 text-base md:text-base",
    toolbar: "justify-between gap-2 px-3 pb-3",
  },
  page: {
    textarea:
      "max-h-48 min-h-14 px-4 py-3.5 text-base md:min-h-[55px] md:pt-[15px] md:pb-0 md:text-base",
    toolbar: "justify-between gap-2 px-3 pb-3 md:pt-3.5 md:pb-[11px]",
  },
}

type PromptInputProps = Omit<ComponentProps<"div">, "onSubmit" | "children"> & {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  submitBlocked?: boolean
  disabled?: boolean
  placeholder: string
  label: string
  tools?: ReactNode
  actions?: ReactNode
}

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  submitBlocked = false,
  disabled = false,
  placeholder,
  label,
  tools,
  actions,
  className,
  ...props
}: PromptInputProps) {
  const frame = frameClasses[use(PromptInputFrame)]
  return (
    <InputGroup
      data-slot="prompt-input"
      className={cn(
        "h-auto flex-col items-stretch rounded-2xl bg-background shadow-xs has-disabled:bg-background has-disabled:opacity-100",
        className
      )}
      {...props}
    >
      <InputGroupTextarea
        disabled={disabled}
        value={value}
        rows={1}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return
          if (event.nativeEvent.isComposing) return
          event.preventDefault()
          if (!submitBlocked && !disabled) onSubmit()
        }}
        className={frame.textarea}
      />
      <InputGroupAddon align="block-end" className={frame.toolbar}>
        <div className="flex min-w-0 items-center gap-1">{tools}</div>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </InputGroupAddon>
    </InputGroup>
  )
}
