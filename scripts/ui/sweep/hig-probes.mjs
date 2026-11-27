export function contrastInPage(limit) {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const paint = canvas.getContext("2d", { willReadFrequently: true })
  const rgba = (css) => {
    paint.clearRect(0, 0, 1, 1)
    paint.fillStyle = "rgba(0,0,0,0)"
    paint.fillStyle = css
    paint.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const shown = (element) =>
    element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    !element.closest('[aria-hidden="true"],[inert]')
  const onScreen = (box) =>
    box.width > 1 &&
    box.height > 1 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < innerHeight &&
    box.left < innerWidth
  const backdrop = (element) => {
    const layers = []
    let fade = 1
    let overImage = false
    for (let at = element; at; at = at.parentElement) {
      const style = getComputedStyle(at)
      if (at !== element) fade *= Number(style.opacity)
      if (style.backgroundImage !== "none") overImage = true
      const fill = rgba(style.backgroundColor)
      if (fill[3] > 0) {
        layers.push(fill)
        if (fill[3] >= 1) break
      }
    }
    return { layers, fade, overImage }
  }
  const name = (element, text) => {
    const control = element.closest(
      'button,a,[role="button"],[role="tab"],[role="menuitem"],label'
    )
    const label = (
      text ||
      control?.getAttribute("aria-label") ||
      control?.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
    return label ? `"${label}"` : element.tagName.toLowerCase()
  }
  const disabled = (element) =>
    Boolean(element.closest(':disabled,[aria-disabled="true"]'))
  const samples = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (
    let node = walker.nextNode();
    node && samples.length < limit;
    node = walker.nextNode()
  ) {
    const text = node.textContent.replace(/\s+/g, " ").trim()
    const element = node.parentElement
    if (!text || !element || seen.has(element)) continue
    seen.add(element)
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(element.tagName))
      continue
    if (!shown(element) || disabled(element)) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    const box = range.getBoundingClientRect()
    if (!onScreen(box)) continue
    const style = getComputedStyle(element)
    const color = rgba(style.color)
    const { layers, fade, overImage } = backdrop(element)
    samples.push({
      name: name(element, text),
      kind: "text",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fontSize: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight),
      color: [color[0], color[1], color[2], color[3] * fade],
      layers,
      overImage,
    })
  }
  const icons = document.querySelectorAll(
    'button svg,a svg,[role="button"] svg,[role="tab"] svg,[role="menuitem"] svg'
  )
  for (const icon of icons) {
    if (samples.length >= limit) break
    const control = icon.closest(
      'button,a,[role="button"],[role="tab"],[role="menuitem"]'
    )
    if (control.textContent.trim()) continue
    if (!shown(icon) || disabled(icon)) continue
    const box = icon.getBoundingClientRect()
    if (!onScreen(box)) continue
    const style = getComputedStyle(icon)
    const stroke = style.stroke !== "none" ? style.stroke : style.fill
    const color = rgba(stroke && stroke !== "none" ? stroke : style.color)
    const { layers, fade, overImage } = backdrop(icon)
    samples.push({
      name: name(icon, ""),
      kind: "icon",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fontSize: 0,
      fontWeight: 400,
      color: [color[0], color[1], color[2], color[3] * fade],
      layers,
      overImage,
    })
  }
  return samples
}

export function scaleTextInPage(scale) {
  const root = document.documentElement
  if (scale === 1) {
    root.style.fontSize = root.dataset.higFontSize ?? ""
    delete root.dataset.higFontSize
    return
  }
  root.dataset.higFontSize = root.style.fontSize
  const base = parseFloat(getComputedStyle(root).fontSize)
  root.style.fontSize = `${base * scale}px`
}

export function textClipsInPage({ phase, limit }) {
  const CUT = /(hidden|clip)/
  const store = (window.__higClips ??= {
    clipped: new WeakSet(),
    sizes: new WeakMap(),
    sideways: false,
  })
  const label = (element) => {
    const text = (
      element.getAttribute("aria-label") ||
      element.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
    return text ? `"${text}"` : element.tagName.toLowerCase()
  }
  const shown = (element) =>
    element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    !element.closest('[aria-hidden="true"],[inert]')
  const sideways =
    document.documentElement.scrollWidth >
    document.documentElement.clientWidth + 1
  const found = []
  const elements = document.body.querySelectorAll("*")
  let looked = 0
  for (const element of elements) {
    if (looked >= limit) break
    if (!element.textContent.trim() || !shown(element)) continue
    looked += 1
    const style = getComputedStyle(element)
    const ownText = [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    )
    if (phase === "base") {
      if (ownText) store.sizes.set(element, parseFloat(style.fontSize))
    }
    const cutsX =
      CUT.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2
    const cutsY =
      CUT.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 2
    const cuts = cutsX || cutsY
    if (phase === "base") {
      if (cuts) store.clipped.add(element)
      continue
    }
    const box = element.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue
    const rect = { x: box.x, y: box.y, width: box.width, height: box.height }
    if (cuts && !store.clipped.has(element)) {
      const truncated =
        style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none"
      found.push({
        name: label(element),
        how: truncated ? "truncated" : "clipped",
        measured: cutsX
          ? `content ${element.scrollWidth}px wide in a ${element.clientWidth}px box`
          : `content ${element.scrollHeight}px tall in a ${element.clientHeight}px box`,
        ...rect,
      })
      continue
    }
    const before = store.sizes.get(element)
    const now = parseFloat(style.fontSize)
    const inDocument = Boolean(element.closest('[contenteditable="true"]'))
    const onPaperPage = Boolean(
      element.closest(".paper-line")?.closest(".paper-editor-page[data-page]")
    )
    if (ownText && !inDocument && !onPaperPage && before && now < before * 1.5)
      found.push({
        name: label(element),
        how: "did not grow",
        measured: `font size ${before}px became ${now}px`,
        ...rect,
      })
  }
  if (phase === "base") {
    store.sideways = sideways
    return []
  }
  if (sideways && !store.sideways)
    found.unshift({
      name: "page",
      how: "page scrolls sideways",
      measured: `content ${document.documentElement.scrollWidth}px wide in a ${document.documentElement.clientWidth}px window`,
      x: 0,
      y: 0,
      width: innerWidth,
      height: 8,
    })
  delete window.__higClips
  return found
}

export function ringBaseInPage() {
  const CONTROLS =
    'button,a[href],input:not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable="true"],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],[role="menuitem"],[role="combobox"]'
  const look = (element) => {
    const style = getComputedStyle(element)
    return [
      style.outlineStyle,
      style.outlineWidth,
      style.outlineColor,
      style.boxShadow,
      style.borderColor,
      style.backgroundColor,
    ].join("|")
  }
  if (document.activeElement && document.activeElement !== document.body)
    document.activeElement.blur()
  const base = new WeakMap()
  for (const element of document.querySelectorAll(CONTROLS))
    for (let at = element, up = 0; at && up < 3; at = at.parentElement, up += 1)
      if (!base.has(at)) base.set(at, look(at))
  window.__higRings = { base }
}

export function ringOfFocusedInPage() {
  const focused = document.activeElement
  if (!focused || focused === document.body) return null
  const store = window.__higRings
  const look = (element) => {
    const style = getComputedStyle(element)
    return [
      style.outlineStyle,
      style.outlineWidth,
      style.outlineColor,
      style.boxShadow,
      style.borderColor,
      style.backgroundColor,
    ].join("|")
  }
  const outlined = (element) => {
    const style = getComputedStyle(element)
    return (
      style.outlineStyle !== "none" &&
      parseFloat(style.outlineWidth) >= 1 &&
      !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(style.outlineColor)
    )
  }
  let ring = false
  for (let at = focused, up = 0; at && up < 3; at = at.parentElement, up += 1) {
    const before = store?.base.get(at)
    if (outlined(at) || (before !== undefined && before !== look(at))) {
      ring = true
      break
    }
  }
  const box = focused.getBoundingClientRect()
  const text = (
    focused.getAttribute("aria-label") ||
    focused.textContent ||
    focused.getAttribute("placeholder") ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
  const role = focused.getAttribute("role") ?? focused.tagName.toLowerCase()
  if (!focused.dataset.higRingKey)
    focused.dataset.higRingKey = String(Math.random()).slice(2)
  return {
    key: focused.dataset.higRingKey,
    name: text ? `${role} "${text}"` : role,
    ring,
    editor: focused.isContentEditable,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  }
}

export function motionInPage() {
  const PROGRESS =
    '[role="progressbar"],[role="status"],[aria-busy="true"],[data-slot="spinner"],[data-slot="skeleton"]'
  const META = new Set(["offset", "easing", "composite", "computedOffset"])
  return document
    .getAnimations()
    .filter((animation) => animation.playState === "running")
    .map((animation) => {
      const target = animation.effect?.target ?? null
      const timing = animation.effect?.getComputedTiming() ?? {}
      const properties = [
        ...new Set(
          (animation.effect?.getKeyframes?.() ?? []).flatMap((frame) =>
            Object.keys(frame).filter((key) => !META.has(key))
          )
        ),
      ]
      if (animation.transitionProperty)
        properties.push(animation.transitionProperty)
      const box = target?.getBoundingClientRect?.()
      const label = target
        ? `${target.tagName.toLowerCase()}${target.dataset?.slot ? ` [data-slot="${target.dataset.slot}"]` : ""}`
        : "document"
      return {
        name: `${animation.animationName ?? animation.transitionProperty ?? "animation"} on ${label}`,
        rect: box
          ? { x: box.x, y: box.y, width: box.width, height: box.height }
          : null,
        iterations: Number.isFinite(timing.iterations)
          ? timing.iterations
          : null,
        duration: Number(timing.duration) || 0,
        properties,
        progress: Boolean(
          target?.closest?.(PROGRESS) ||
          String(target?.getAttribute?.("class") ?? "").includes("animate-spin")
        ),
      }
    })
}
