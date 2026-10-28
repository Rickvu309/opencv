import { useEffect, useRef, type KeyboardEvent } from "react"
import type { CvBlock, CvSectionKind } from "@workspace/domain"

import { cn } from "@workspace/ui/lib/utils"

const PLACEHOLDER =
  "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"

export function reducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

export function BlockField({
  label,
  value,
  placeholder,
  className,
  onChange,
  onSlash,
  onEnter,
}: {
  label: string
  value: string
  placeholder: string
  className?: string
  onChange: (value: string) => void
  onSlash?: (node: HTMLElement) => void
  onEnter?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || document.activeElement === node) return
    if (node.textContent !== value) node.textContent = value
  }, [value])
  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      tabIndex={-1}
      data-placeholder={placeholder}
      contentEditable
      suppressContentEditableWarning
      className={cn("min-w-0 flex-1 outline-none", PLACEHOLDER, className)}
      onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      onKeyDown={(event) => onFieldKey(event, onSlash, onEnter)}
    />
  )
}

function onFieldKey(
  event: KeyboardEvent<HTMLDivElement>,
  onSlash?: (node: HTMLElement) => void,
  onEnter?: () => void
) {
  const text = event.currentTarget.textContent ?? ""
  if (event.key === "/" && text === "") {
    event.preventDefault()
    onSlash?.(event.currentTarget)
  } else if (event.key === "Enter" && onEnter) {
    event.preventDefault()
    onEnter()
  } else if (event.key === "Escape") {
    event.preventDefault()
    event.currentTarget.closest<HTMLElement>("[data-sortable-block]")?.focus()
  }
}

export type BlockFieldProps = {
  block: CvBlock
  sectionKind: CvSectionKind
  onChange: (block: CvBlock) => void
  onCommit: (block: CvBlock) => void
  onSlash: (node: HTMLElement) => void
}
