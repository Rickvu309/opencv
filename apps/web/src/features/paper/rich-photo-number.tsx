import { useEffect, useReducer } from "react"
import { Input } from "@workspace/ui/components/input"

type DraftAction =
  { type: "edit"; value: string } | { type: "sync"; value: number }

function photoNumberDraft(draft: string, action: DraftAction) {
  switch (action.type) {
    case "edit":
      return action.value
    case "sync":
      return String(action.value)
    default:
      return draft
  }
}

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
  const [draft, dispatch] = useReducer(photoNumberDraft, String(value))
  useEffect(() => dispatch({ type: "sync", value }), [value])
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
      onChange={(event) =>
        dispatch({ type: "edit", value: event.currentTarget.value })
      }
      onBlur={(event) => {
        if (draft.trim() && event.currentTarget.validity.valid) {
          onCommit(Number(draft))
        } else {
          dispatch({ type: "sync", value })
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
