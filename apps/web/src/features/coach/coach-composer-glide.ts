export function composerGlideDistance(fromTop: number, toTop: number) {
  const distance = Math.round(fromTop - toTop)
  return Math.abs(distance) < 2 ? 0 : distance
}

export function panelMotionToken(element: Element) {
  const style = getComputedStyle(element)
  const duration = Number.parseFloat(style.getPropertyValue("--duration-panel"))
  const easing = style.getPropertyValue("--ease-panel").trim()
  if (!Number.isFinite(duration) || !easing) return null
  return { duration, easing }
}

export function startComposerGlide(
  element: HTMLElement,
  fromTop: number,
  reducedMotion: boolean
) {
  const distance = composerGlideDistance(
    fromTop,
    element.getBoundingClientRect().top
  )
  if (reducedMotion || distance === 0 || !element.animate) return null
  const token = panelMotionToken(element)
  if (!token) return null
  return element.animate(
    [
      { transform: `translateY(${distance}px)` },
      { transform: "translateY(0)" },
    ],
    token
  )
}
