export const COMPOSER_GLIDE_ATTRIBUTE = "data-glide"
export const COMPOSER_GLIDE_DISTANCE = "--coach-glide-from"

export function composerGlideDistance(fromTop: number, toTop: number) {
  const distance = Math.round(fromTop - toTop)
  return Math.abs(distance) < 2 ? 0 : distance
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
  if (reducedMotion || distance === 0) return false
  element.style.setProperty(COMPOSER_GLIDE_DISTANCE, `${distance}px`)
  element.setAttribute(COMPOSER_GLIDE_ATTRIBUTE, "")
  const finish = () => {
    element.removeAttribute(COMPOSER_GLIDE_ATTRIBUTE)
    element.style.removeProperty(COMPOSER_GLIDE_DISTANCE)
  }
  element.addEventListener("animationend", finish, { once: true })
  element.addEventListener("animationcancel", finish, { once: true })
  return true
}
