"use client"

import { useRef, useState, type ComponentProps } from "react"

import { Button } from "./button"
import { toast } from "./sonner"

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement("textarea")
    area.value = text
    area.style.cssText = "position:fixed;opacity:0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  }
}

type CopyButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "value" | "aria-label"
> & {
  "aria-label": string
  value: string | (() => string | Promise<string>)
  copiedMessage?: string
  errorMessage?: string | ((error: unknown) => string)
}

const DEFAULT_ERROR = "Could not copy. Try again."

function CopyButton({
  value,
  copiedMessage = "Copied",
  errorMessage = DEFAULT_ERROR,
  variant = "ghost",
  size = "icon-sm",
  children,
  ...props
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "pending" | "copied">("idle")
  const pending = useRef(false)

  async function copy() {
    if (pending.current) return
    pending.current = true
    setState("pending")
    try {
      const text = typeof value === "function" ? await value() : value
      if (!(await copyText(text))) throw new Error(DEFAULT_ERROR)
      setState("copied")
      toast(copiedMessage)
    } catch (error) {
      setState("idle")
      toast(
        typeof errorMessage === "function" ? errorMessage(error) : errorMessage
      )
    } finally {
      pending.current = false
    }
  }

  return (
    <Button
      type="button"
      data-slot="copy-button"
      data-state={state}
      variant={variant}
      size={size}
      {...props}
      onClick={() => void copy()}
    >
      {children}
    </Button>
  )
}

export { CopyButton, copyText }
export type { CopyButtonProps }
