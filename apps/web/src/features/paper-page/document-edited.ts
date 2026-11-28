import { useEffect, useReducer, useSyncExternalStore } from "react"

const MINUTE = 60_000

const UNITS = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", MINUTE],
] as const satisfies readonly (readonly [Intl.RelativeTimeFormatUnit, number])[]

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function documentEditedLabel(iso: string, now: number) {
  const elapsed = Math.max(0, now - Date.parse(iso))
  if (Number.isNaN(elapsed)) return null
  const unit = UNITS.find(([, size]) => elapsed >= size)
  if (!unit) return "Edited just now"
  const [name, size] = unit
  return `Edited ${relative.format(-Math.floor(elapsed / size), name)}`
}

function subscribeMinute(onTick: () => void) {
  const timer = setInterval(onTick, MINUTE)
  return () => clearInterval(timer)
}

const currentMinute = () => Math.floor(Date.now() / MINUTE)

type SaveWatch = {
  status: string
  seenSaved: boolean
  savedAt: string | null
}

function watchSaves(
  watch: SaveWatch,
  { status, at }: { status: string; at: number }
): SaveWatch {
  if (status === watch.status) return watch
  const returned = status === "Saved" && watch.seenSaved
  return {
    status,
    seenSaved: watch.seenSaved || status === "Saved",
    savedAt: returned ? new Date(at).toISOString() : watch.savedAt,
  }
}

export function useDocumentEdited(status: string, editedAt: string | null) {
  const minute = useSyncExternalStore(subscribeMinute, currentMinute)
  const [watch, observe] = useReducer(watchSaves, {
    status: "",
    seenSaved: false,
    savedAt: null,
  })
  useEffect(() => {
    observe({ status, at: Date.now() })
  }, [status])
  const latest = watch.savedAt ?? editedAt
  return latest === null ? null : documentEditedLabel(latest, minute * MINUTE)
}
