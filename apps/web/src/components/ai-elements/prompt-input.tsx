import {
  use,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"

import {
  PromptInputFrame,
  type PromptInputFrameName,
} from "./prompt-input-frame.ts"

const frameClasses: Record<
  PromptInputFrameName,
  {
    textarea: string
    start: string
    end: string
    group?: string
    stacked?: true
  }
> = {
  standard: {
    textarea:
      "max-h-48 min-h-[52px] px-1.5 py-3.5 text-base leading-6 md:min-h-11 md:py-2.5 md:text-[14px] md:leading-6",
    start: "self-end ps-1.5 pb-1 md:ps-1.5 md:pb-1.5",
    end: "self-end gap-1 pe-1.5 pb-1 md:pe-1.5 md:pb-1.5",
  },
  page: {
    textarea:
      "max-h-60 min-h-[68px] pt-4 pb-3 text-base leading-6 md:text-[15px] group-data-[stacked=true]/input-group:px-[18px] group-data-[stacked=true]/input-group:pb-3",
    start: "self-end ps-3 pe-3 pt-0 pb-3",
    end: "self-end gap-1.5 pe-3 pt-0 pb-3",
    stacked: true,
  },
  panel: {
    group: "gap-2.5 px-3 pt-3 pb-2.5",
    textarea:
      "max-h-48 min-h-6 p-0 text-base leading-6 md:text-[14px] group-data-[stacked=true]/input-group:p-0",
    start: "self-end p-0",
    end: "self-end gap-1 p-0",
    stacked: true,
  },
}

function nextStacked({
  value,
  stackedAt,
  wraps,
}: {
  value: string
  stackedAt: number | null
  wraps: boolean
}): number | null {
  if (stackedAt !== null) return value.length >= stackedAt ? stackedAt : null
  return wraps || value.includes("\n") ? value.length : null
}

const STACKED_TEXT =
  "group-data-[stacked=true]/input-group:order-first group-data-[stacked=true]/input-group:basis-full group-data-[stacked=true]/input-group:px-4 group-data-[stacked=true]/input-group:pb-1"
const STACKED_START = "group-data-[stacked=true]/input-group:order-1"
const STACKED_END = "group-data-[stacked=true]/input-group:ms-auto"

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
  const groupRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const stackedAt = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (frame.stacked) return
    const group = groupRef.current
    const text = textRef.current
    if (!group || !text) return
    const wraps = () => {
      const style = getComputedStyle(text)
      const oneLine =
        Number.parseFloat(style.lineHeight) +
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom)
      return Number.isFinite(oneLine) && text.scrollHeight > oneLine + 2
    }
    const was = stackedAt.current
    let next = nextStacked({ value, stackedAt: was, wraps: wraps() })
    group.dataset.stacked = next === null ? "false" : "true"
    if (was !== null && next === null && wraps()) next = value.length
    stackedAt.current = next
    group.dataset.stacked = next === null ? "false" : "true"
  }, [value, frame.stacked])

  return (
    <InputGroup
      ref={groupRef}
      data-stacked={frame.stacked ? "true" : "false"}
      data-slot="prompt-input"
      data-layout="row"
      className={cn(
        "h-auto flex-row flex-wrap items-end rounded-3xl bg-background shadow-xs has-disabled:bg-background has-disabled:opacity-100",
        frame.group,
        className
      )}
      {...props}
    >
      <InputGroupAddon
        align="inline-start"
        className={cn(frame.start, STACKED_START)}
      >
        {tools}
      </InputGroupAddon>
      <InputGroupTextarea
        ref={textRef}
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
        className={cn(STACKED_TEXT, frame.textarea)}
      />
      <InputGroupAddon
        align="inline-end"
        className={cn(frame.end, STACKED_END)}
      >
        {actions}
      </InputGroupAddon>
    </InputGroup>
  )
}
