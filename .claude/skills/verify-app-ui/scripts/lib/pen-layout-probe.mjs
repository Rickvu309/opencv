// In-page probe shared by scripts/pen-layout.mjs (records the pen render) and verify-pen-layout.mjs
// (measures the app), so both sides normalize text and measure boxes the same way.
function probe(args) {
  const normalize = (text) => text.replace(/\s+/g, " ").trim()
  const ownText = (element) => {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    )
    let out = ""
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!["SCRIPT", "STYLE"].includes(node.parentElement?.tagName))
          out += node.data
      } else if (node.tagName === "BR") out += " "
    }
    return normalize(out)
  }
  const clipped = (element, rect) => {
    let box = rect
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent)
      if (style.overflowX === "visible" && style.overflowY === "visible")
        continue
      const clip = parent.getBoundingClientRect()
      box = {
        left: Math.max(box.left, clip.left),
        top: Math.max(box.top, clip.top),
        right: Math.min(box.right, clip.right),
        bottom: Math.min(box.bottom, clip.bottom),
      }
      if (box.right <= box.left || box.bottom <= box.top) return true
    }
    return false
  }
  const textNodes = (root) => {
    if (root.nodeType === Node.TEXT_NODE) return [root]
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.data.trim()) nodes.push(node)
    }
    return nodes
  }
  // Boxes come from the text runs only, so an icon or dot beside the text
  // inside the same element does not move the measured edge.
  const visibleBox = (element, root = element) => {
    const style = getComputedStyle(element)
    if (style.visibility === "hidden" || style.display === "none") return null
    for (let up = element; up && up !== document.body; up = up.parentElement) {
      if (getComputedStyle(up).opacity === "0") return null
    }
    const rects = textNodes(root)
      .flatMap((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return [...range.getClientRects()]
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
    if (!rects.length) return null
    const box = {
      left: Math.min(...rects.map((rect) => rect.left)),
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right)),
      bottom: Math.max(...rects.map((rect) => rect.bottom)),
    }
    return clipped(element, box) ? null : box
  }
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const paint = canvas.getContext("2d", { willReadFrequently: true })
  const toRgba = (css) => {
    paint.clearRect(0, 0, 1, 1)
    paint.fillStyle = "#000"
    paint.fillStyle = css
    paint.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
  }
  const pane = document.querySelector(args.pane)
  if (!pane) return { error: `pane ${args.pane} not found` }
  const paneRect = pane.getBoundingClientRect()
  const background = (element) => {
    for (let up = element; up; up = up.parentElement) {
      const color = toRgba(getComputedStyle(up).backgroundColor)
      if (!color.endsWith(", 0)")) return color
    }
    return "rgba(255, 255, 255, 1)"
  }
  const describe = (element, box, pseudo = null) => {
    const style = getComputedStyle(element, pseudo)
    const spacing = parseFloat(style.letterSpacing)
    const lineHeight = parseFloat(style.lineHeight)
    return {
      text: pseudo || element.value ? "" : ownText(element),
      x: box.left - paneRect.left,
      y: box.top - paneRect.top,
      width: box.right - box.left,
      height: box.bottom - box.top,
      fontSize: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight),
      letterSpacing: Number.isNaN(spacing) ? 0 : spacing,
      lineHeight: Number.isNaN(lineHeight) ? null : lineHeight,
      color: toRgba(style.color),
      background: background(element),
      textAlign: ["start", "left"].includes(style.textAlign)
        ? "left"
        : ["end", "right"].includes(style.textAlign)
          ? "right"
          : style.textAlign,
    }
  }
  const pageSize = { width: paneRect.width, height: paneRect.height }
  if (args.mode === "record") {
    const texts = []
    for (const element of pane.querySelectorAll("[data-pen-text]")) {
      const box = visibleBox(element)
      if (!box) continue
      const entry = describe(element, box)
      if (entry.text) texts.push(entry)
    }
    return { pane: pageSize, texts }
  }
  // include names extra roots outside the pane (a portal such as a drag
  // overlay); their texts are measured relative to the pane too.
  const scopes = [
    pane,
    ...(args.include ?? []).flatMap((selector) => [
      ...document.querySelectorAll(selector),
    ]),
  ]
  const byText = new Map()
  const add = (text, element, root) => {
    if (!text) return
    if (!byText.has(text)) byText.set(text, [])
    byText.get(text).push({ element, root })
  }
  for (const element of scopes.flatMap((scope) => [
    ...scope.querySelectorAll("*"),
  ])) {
    if (element.children.length === 0 && !element.textContent.trim()) continue
    add(ownText(element), element, element)
  }
  for (const node of scopes.flatMap((scope) => textNodes(scope))) {
    if (node.parentElement) add(normalize(node.data), node.parentElement, node)
  }
  // A field's value or placeholder is drawn as text in the pen. Its box starts
  // at the content edge and is one line high, centred in an input.
  const fieldBox = (field) => {
    const rect = field.getBoundingClientRect()
    const style = getComputedStyle(field)
    const line =
      parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
    const left =
      rect.left +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.paddingLeft)
    const top =
      field.tagName === "TEXTAREA"
        ? rect.top +
          parseFloat(style.borderTopWidth) +
          parseFloat(style.paddingTop)
        : rect.top + (rect.height - line) / 2
    const ctx = document.createElement("canvas").getContext("2d")
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const text = field.value || field.placeholder
    const width = Math.min(ctx.measureText(text).width, rect.width)
    return { left, top, right: left + width, bottom: top + line }
  }
  if (args.mode === "app")
    for (const field of scopes.flatMap((scope) => [
      ...scope.querySelectorAll("input, textarea"),
    ])) {
      const text = normalize(field.value || field.placeholder || "")
      if (!text || field.getBoundingClientRect().width === 0) continue
      if (!byText.has(text)) byText.set(text, [])
      byText.get(text).push({
        element: field,
        root: field,
        field: field.value ? "value" : "placeholder",
      })
    }
  const used = new Set()
  const measured = args.texts.map((want) => {
    const candidates = (byText.get(want.text) ?? []).filter(
      ({ root }) =>
        root.nodeType === Node.TEXT_NODE ||
        ![...root.children].some((child) => ownText(child) === want.text)
    )
    let best = null
    for (const { element, root, field } of candidates) {
      if (used.has(root)) continue
      const box = field ? fieldBox(element) : visibleBox(element, root)
      if (!box) continue
      const away =
        Math.abs(box.left - paneRect.left - want.x) +
        Math.abs(box.top - paneRect.top - want.y)
      if (!best || away < best.away) best = { element, root, box, away, field }
    }
    if (!best) return null
    used.add(best.root)
    const pseudo = best.field === "placeholder" ? "::placeholder" : null
    return { ...describe(best.element, best.box, pseudo), text: want.text }
  })
  const rootStyle = getComputedStyle(document.documentElement)
  const tokens = Object.fromEntries(
    args.tokens.map((name) => [
      name,
      toRgba(rootStyle.getPropertyValue(name).trim()),
    ])
  )
  return { pane: pageSize, measured, tokens }
}

export const probeSource = (args) =>
  `(${probe.toString()})(${JSON.stringify(args)})`
