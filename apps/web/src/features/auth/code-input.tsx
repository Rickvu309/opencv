import { useEffect, useRef } from "react"
import { Input } from "@workspace/ui/components/input"

import { AUTH_COPY } from "./auth-copy.ts"

const LABELS = [
  "Digit 1",
  "Digit 2",
  "Digit 3",
  "Digit 4",
  "Digit 5",
  "Digit 6",
] as const

export function CodeInput({
  value,
  disabled,
  invalid = false,
  describedBy,
  focusNonce,
  onChange,
  onComplete,
}: {
  value: string
  disabled: boolean
  invalid?: boolean
  describedBy?: string
  focusNonce: number
  onChange: (next: string) => void
  onComplete: (code: string) => void
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "")

  useEffect(() => {
    if (focusNonce === 0 || disabled) return
    refs.current[0]?.focus()
  }, [focusNonce, disabled])

  function commit(next: string[], complete: boolean) {
    const joined = next.join("")
    onChange(joined)
    if (complete && joined.length === 6) onComplete(joined)
  }

  function writeAt(index: number, digit: string, move: boolean) {
    const next = digits.slice()
    next[index] = digit
    const joined = next.join("")
    commit(next, joined.length === 6)
    if (move && digit && index < 5) refs.current[index + 1]?.focus()
  }

  function onPaste(index: number, text: string) {
    const clean = text.replace(/\D/g, "")
    if (!clean) return
    if (clean.length >= 6) {
      commit(clean.slice(0, 6).split(""), true)
      refs.current[5]?.focus()
      return
    }
    const next = digits.slice()
    for (
      let offset = 0;
      offset < clean.length && index + offset < 6;
      offset += 1
    ) {
      next[index + offset] = clean[offset] ?? ""
    }
    const joined = next.join("")
    commit(next, joined.length === 6)
    const landing = Math.min(index + clean.length, 5)
    refs.current[landing]?.focus()
  }

  return (
    <div
      role="group"
      aria-label={AUTH_COPY.codeGroup}
      data-slot="email-code-digits"
      className="flex w-full min-w-0 items-center gap-2"
    >
      {digits.map((digit, index) => (
        <span key={LABELS[index]} className="contents">
          {index === 3 ? (
            <span
              aria-hidden
              data-slot="email-code-dash"
              className="h-0.5 w-2.5 shrink-0 rounded-[1px] bg-border"
            />
          ) : null}
          <Input
            ref={(node) => {
              refs.current[index] = node
            }}
            aria-label={LABELS[index]}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            data-filled={digit !== ""}
            value={digit}
            className="h-[52px] min-w-0 flex-1 rounded-lg px-0 text-center text-[26px] font-semibold md:text-[26px]"
            onFocus={(event) => event.currentTarget.select()}
            onPaste={(event) => {
              event.preventDefault()
              if (disabled) return
              onPaste(index, event.clipboardData.getData("text"))
            }}
            onKeyDown={(event) => {
              if (disabled) return
              if (event.key === "ArrowLeft" && index > 0) {
                event.preventDefault()
                refs.current[index - 1]?.focus()
              } else if (event.key === "ArrowRight" && index < 5) {
                event.preventDefault()
                refs.current[index + 1]?.focus()
              } else if (event.key === "Backspace") {
                event.preventDefault()
                if (digit) {
                  writeAt(index, "", false)
                } else if (index > 0) {
                  const next = digits.slice()
                  next[index - 1] = ""
                  commit(next, false)
                  refs.current[index - 1]?.focus()
                }
              }
            }}
            onChange={(event) => {
              if (disabled) return
              const clean = event.currentTarget.value.replace(/\D/g, "")
              if (!clean) {
                writeAt(index, "", false)
                return
              }
              if (clean.length >= 6) {
                onPaste(0, clean)
                return
              }
              writeAt(index, clean.slice(-1), true)
            }}
          />
        </span>
      ))}
    </div>
  )
}
