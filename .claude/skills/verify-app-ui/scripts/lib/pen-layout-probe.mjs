function selfContainedProbeSharedByPenAndApp(args) {
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
  const textRunsBoxIgnoringIcons = (element, root = element) => {
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
      const box = textRunsBoxIgnoringIcons(element)
      if (!box) continue
      const entry = describe(element, box)
      if (entry.text) texts.push(entry)
    }
    const drawn = (selector, label, fits) =>
      [...pane.querySelectorAll(selector)].flatMap((element) => {
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0 || !fits(rect)) return []
        for (let up = element; up; up = up.parentElement) {
          if (getComputedStyle(up).opacity === "0") return []
        }
        return [
          {
            ...label(element),
            x: rect.left - paneRect.left,
            y: rect.top - paneRect.top,
            width: rect.width,
            height: rect.height,
          },
        ]
      })
    const icons = drawn(
      "[data-pen-icon]",
      (element) => ({ icon: element.getAttribute("data-pen-icon") }),
      () => true
    )
    const boxes = drawn(
      "[data-pen-box]",
      (element) => ({ box: element.getAttribute("data-pen-box") }),
      (rect) => rect.width <= 96 && rect.height <= 96
    )
    return { pane: pageSize, texts, icons, boxes }
  }
  const paneAndPortalRoots = [
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
  for (const element of paneAndPortalRoots.flatMap((scope) => [
    ...scope.querySelectorAll("*"),
  ])) {
    if (element.children.length === 0 && !element.textContent.trim()) continue
    add(ownText(element), element, element)
  }
  for (const node of paneAndPortalRoots.flatMap((scope) => textNodes(scope))) {
    if (node.parentElement) add(normalize(node.data), node.parentElement, node)
  }
  const renderedTextBoxInFieldContent = (
    field,
    lineIndex = 0,
    lineText = null
  ) => {
    const rect = field.getBoundingClientRect()
    const style = getComputedStyle(field)
    const line =
      parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
    const contentLeft =
      rect.left +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.paddingLeft)
    const contentWidth = Math.max(
      0,
      rect.width -
        parseFloat(style.borderLeftWidth) -
        parseFloat(style.borderRightWidth) -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
    )
    const top =
      field.tagName === "TEXTAREA"
        ? rect.top +
          parseFloat(style.borderTopWidth) +
          parseFloat(style.paddingTop) +
          lineIndex * line
        : rect.top + (rect.height - line) / 2
    const ctx = document.createElement("canvas").getContext("2d")
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    ctx.letterSpacing = style.letterSpacing
    const text = lineText ?? (field.value || field.placeholder)
    const width = Math.min(ctx.measureText(text).width, contentWidth)
    const align = style.textAlign
    const right =
      align === "right" ||
      (align === "start" && style.direction === "rtl") ||
      (align === "end" && style.direction !== "rtl")
    const left =
      contentLeft +
      (align === "center"
        ? (contentWidth - width) / 2
        : right
          ? contentWidth - width
          : 0)
    return { left, top, right: left + width, bottom: top + line }
  }
  if (args.mode === "app")
    for (const field of paneAndPortalRoots.flatMap((scope) => [
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
      const lines = field.value.split("\n")
      if (field.tagName === "TEXTAREA" && lines.length > 1)
        lines.forEach((raw, line) => {
          const one = normalize(raw)
          if (!one) return
          if (!byText.has(one)) byText.set(one, [])
          byText.get(one).push({
            element: field,
            root: { nodeType: 1, children: [], line, text: raw, owner: field },
            field: "value",
          })
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
      const box = field
        ? renderedTextBoxInFieldContent(
            element,
            root.line ?? 0,
            root.text ?? null
          )
        : textRunsBoxIgnoringIcons(element, root)
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
  const IGNORED_TAGS = ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"]
  const CONTROLS =
    'button, a[href], input:not([type="hidden"]), textarea, select, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="combobox"], [role="option"]'
  const seenOnScreen = (element, rect, hoverRevealed = false) => {
    const style = getComputedStyle(element)
    if (style.visibility === "hidden" || style.display === "none") return false
    if (rect.width <= 0 || rect.height <= 0) return false
    for (let up = element; up && up !== document.body; up = up.parentElement) {
      const upStyle = getComputedStyle(up)
      if (
        upStyle.opacity === "0" &&
        !(hoverRevealed && upStyle.pointerEvents !== "none")
      )
        return false
      const upRect = up.getBoundingClientRect()
      if (
        upRect.width <= 1 &&
        upRect.height <= 1 &&
        getComputedStyle(up).overflow !== "visible"
      )
        return false
    }
    return !clipped(element, rect)
  }
  const accounted = new Set()
  for (const root of used) {
    if (root.owner) accounted.add(root.owner)
    if (!(root instanceof Node)) continue
    if (root.nodeType === Node.TEXT_NODE) accounted.add(root)
    else for (const node of textNodes(root)) accounted.add(node)
  }
  const matchedCentres = measured.filter(Boolean).map((entry) => ({
    x: paneRect.left + entry.x + entry.width / 2,
    y: paneRect.top + entry.y + entry.height / 2,
  }))
  const relative = (rect) => ({
    x: rect.left - paneRect.left,
    y: rect.top - paneRect.top,
    width: rect.width,
    height: rect.height,
  })
  const extras = []
  const extraControls = []
  const inScope = (element) =>
    paneAndPortalRoots.some((scope) => scope.contains(element))
  for (const element of document.querySelectorAll(CONTROLS)) {
    if (!inScope(element)) continue
    const rect = element.getBoundingClientRect()
    if (!seenOnScreen(element, rect, true)) continue
    const holdsMatched =
      accounted.has(element) ||
      matchedCentres.some(
        (centre) =>
          centre.x >= rect.left &&
          centre.x <= rect.right &&
          centre.y >= rect.top &&
          centre.y <= rect.bottom
      ) ||
      textNodes(element).some((node) => accounted.has(node))
    if (holdsMatched) continue
    extraControls.push(element)
    const name = normalize(
      element.getAttribute("aria-label") ||
        ownText(element) ||
        element.getAttribute("title") ||
        element.placeholder ||
        element.value ||
        ""
    )
    extras.push({
      kind: "control",
      text: name || `<${element.tagName.toLowerCase()}>`,
      ...relative(rect),
    })
  }
  const loose = new Map()
  for (const scope of paneAndPortalRoots) {
    for (const node of textNodes(scope)) {
      const parent = node.parentElement
      if (!parent || accounted.has(node)) continue
      if (parent.closest(IGNORED_TAGS.join(","))) continue
      if (extraControls.some((control) => control.contains(node))) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const rects = [...range.getClientRects()].filter(
        (rect) => rect.width > 0 && rect.height > 0
      )
      if (!rects.length || !seenOnScreen(parent, rects[0])) continue
      if (!loose.has(parent)) loose.set(parent, [])
      loose.get(parent).push({ node, rect: rects[0] })
    }
  }
  for (const [parent, pieces] of loose) {
    const text = normalize(pieces.map(({ node }) => node.data).join(" "))
    if (!text) continue
    extras.push({
      kind: parent.closest('h1, h2, h3, h4, h5, h6, [role="heading"]')
        ? "heading"
        : "text",
      text,
      ...relative(pieces[0].rect),
    })
  }
  const rootStyle = getComputedStyle(document.documentElement)
  const tokens = Object.fromEntries(
    args.tokens.map((name) => [
      name,
      toRgba(rootStyle.getPropertyValue(name).trim()),
    ])
  )
  return { pane: pageSize, measured, tokens, extras }
}

export const probeSource = (args) =>
  `(${selfContainedProbeSharedByPenAndApp.toString()})(${JSON.stringify(args)})`
