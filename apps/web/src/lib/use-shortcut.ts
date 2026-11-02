import { useEffect, useRef } from "react"

type Shortcut = {
  key: string | readonly string[]
  onPress: (event: KeyboardEvent) => void
  enabled?: boolean
  mod?: boolean
  inFields?: boolean
  capture?: boolean
  stop?: boolean
  prevent?: boolean
}

const pressed = new Set<number>()
let watchers = 0

function track(event: PointerEvent) {
  if (event.type === "pointerdown") pressed.add(event.pointerId)
  else pressed.delete(event.pointerId)
}

function release() {
  pressed.clear()
}

function trackMove(event: PointerEvent) {
  if (event.buttons === 0) pressed.delete(event.pointerId)
}

function watch() {
  if (watchers++ > 0) return
  window.addEventListener("pointerdown", track, true)
  window.addEventListener("pointerup", track, true)
  window.addEventListener("pointercancel", track, true)
  window.addEventListener("pointermove", trackMove, true)
  window.addEventListener("blur", release)
}

function unwatch() {
  if (--watchers > 0) return
  window.removeEventListener("pointerdown", track, true)
  window.removeEventListener("pointerup", track, true)
  window.removeEventListener("pointercancel", track, true)
  window.removeEventListener("pointermove", trackMove, true)
  window.removeEventListener("blur", release)
  pressed.clear()
}

export function gestureActive() {
  return pressed.size > 0
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  )
}

function keyMatches(key: Shortcut["key"], event: KeyboardEvent) {
  const pressedKey = event.key.toLowerCase()
  const keys = typeof key === "string" ? [key] : key
  return keys.some((candidate) => candidate.toLowerCase() === pressedKey)
}

function modifiersMatch(mod: boolean, event: KeyboardEvent) {
  if (mod) return (event.metaKey || event.ctrlKey) && !event.altKey
  return !event.metaKey && !event.ctrlKey && !event.altKey
}

export function useShortcut(shortcut: Shortcut) {
  const latest = useRef(shortcut)
  useEffect(() => {
    latest.current = shortcut
  })
  const enabled = shortcut.enabled ?? true
  const capture = shortcut.capture ?? false

  useEffect(() => {
    if (!enabled) return
    watch()
    function onKey(event: KeyboardEvent) {
      const current = latest.current
      if (!keyMatches(current.key, event)) return
      if (!modifiersMatch(current.mod ?? false, event)) return
      if (event.defaultPrevented && !capture) return
      if (event.repeat || event.isComposing || event.keyCode === 229) return
      if (gestureActive()) return
      if (!current.inFields && isTypingTarget(event.target)) return
      if (current.prevent ?? true) event.preventDefault()
      if (current.stop) event.stopImmediatePropagation()
      current.onPress(event)
    }
    window.addEventListener("keydown", onKey, capture)
    return () => {
      window.removeEventListener("keydown", onKey, capture)
      unwatch()
    }
  }, [enabled, capture])
}
