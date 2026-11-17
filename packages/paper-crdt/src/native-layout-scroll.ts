export function scrollOversizedContent(event: KeyboardEvent) {
  const target = event.target
  if (
    !(target instanceof HTMLElement) ||
    target !== document.activeElement ||
    !target.matches(
      "[data-paper-oversized-row=true], [data-paper-oversized-block=true]"
    ) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return false
  const steps: Record<string, number> = {
    ArrowUp: -40,
    ArrowDown: 40,
    PageUp: -target.clientHeight,
    PageDown: target.clientHeight,
    Home: -target.scrollHeight,
    End: target.scrollHeight,
  }
  const step = steps[event.key]
  if (step === undefined) return false
  event.preventDefault()
  event.stopImmediatePropagation()
  target.scrollTop += step
  return true
}
