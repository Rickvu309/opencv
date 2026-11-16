import { useId, useRef } from "react"
import { Input } from "@workspace/ui/components/input"

export function RichPhotoNumber({
  name,
  value,
  error,
  onChange,
  onCommit,
}: {
  name: string
  value: string
  error?: string
  onChange: (value: string) => void
  onCommit: () => void
}) {
  const errorId = useId()
  const changed = useRef(false)
  const commitChangedField = () => {
    if (!changed.current) return
    changed.current = false
    onCommit()
  }
  return (
    <>
      <Input
        name={name}
        aria-label={name[0].toUpperCase() + name.slice(1)}
        className="h-11 tabular-nums md:h-8"
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          changed.current = true
          onChange(event.currentTarget.value)
        }}
        onBlur={commitChangedField}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          commitChangedField()
        }}
      />
      {error ? (
        <span id={errorId} className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </>
  )
}
