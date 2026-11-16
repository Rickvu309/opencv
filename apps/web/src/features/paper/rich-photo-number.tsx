import { useEffect, useState } from "react"
import { Input } from "@workspace/ui/components/input"

export function RichPhotoNumber({
  name,
  value,
  min,
  max,
  onCommit,
}: {
  name: string
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <Input
      name={name}
      className="h-11 tabular-nums md:h-8"
      type="number"
      inputMode="decimal"
      enterKeyHint="done"
      min={min}
      max={max}
      step="any"
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={(event) => {
        if (draft.trim() && event.currentTarget.validity.valid) {
          onCommit(Number(draft))
        } else {
          setDraft(String(value))
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return
        event.preventDefault()
        event.currentTarget.blur()
      }}
      required
    />
  )
}
