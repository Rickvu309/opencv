export function focusSearchButton() {
  const timer = window.setTimeout(() => {
    if (typeof document === "undefined") return
    const buttons = [
      ...document.querySelectorAll<HTMLElement>('button[aria-label="Search"]'),
    ]
    const visible = buttons.find((button) => button.getClientRects().length > 0)
    ;(visible ?? buttons[0])?.focus()
  }, 30)
  return () => window.clearTimeout(timer)
}
