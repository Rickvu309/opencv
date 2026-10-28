// Runs inside the page. Self-contained: it is serialised with toString(), so it cannot close over anything.
// Measures the landing sections property 31 reads, including whether a text starts a line.
function penProbe() {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = "#000"
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const cs = (el) => getComputedStyle(el)
  const visible = (el) => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && cs(el).visibility !== "hidden"
  }
  const normText = (value) =>
    value
      .replace(/\u2018/g, "\u2019")
      .replace(/'/g, "\u2019")
      .replace(/\s+/g, " ")
      .trim()
  const hiddenText = (el) =>
    el.closest("[aria-hidden='true'], .sr-only") || !visible(el)
  const establishesLines = (el) => {
    const display = cs(el).display
    return (
      display === "block" ||
      display === "flex" ||
      display === "grid" ||
      display === "list-item" ||
      display === "flow-root" ||
      display === "inline-flex" ||
      display === "inline-grid" ||
      display.startsWith("table")
    )
  }
  const blockOf = (el) => {
    if (establishesLines(el)) return el
    let node = el.parentElement
    while (node) {
      if (establishesLines(node)) return node
      node = node.parentElement
    }
    return el
  }
  const charCache = new WeakMap()
  const charsIn = (block) => {
    const cached = charCache.get(block)
    if (cached) return cached
    const chars = []
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const parent = node.parentElement
      if (
        parent &&
        parent.tagName !== "STYLE" &&
        parent.tagName !== "SCRIPT" &&
        !hiddenText(parent)
      ) {
        const text = node.textContent
        for (let index = 0; index < text.length; index += 1) {
          const ch = text[index]
          if (/\s/.test(ch)) continue
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + 1)
          const rect = range.getClientRects()[0]
          if (!rect || rect.width < 0.1 || rect.height < 0.1) continue
          chars.push({
            node,
            offset: index,
            top: rect.top,
            height: rect.height,
          })
        }
      }
      node = walker.nextNode()
    }
    for (let index = 0; index < chars.length; index += 1) {
      const previous = chars[index - 1]
      const current = chars[index]
      current.starts =
        !previous || current.top > previous.top + previous.height * 0.5
    }
    charCache.set(block, chars)
    return chars
  }
  const lineStartsFor = (el) => {
    const lookup = new Map()
    for (const item of charsIn(blockOf(el))) {
      let marks = lookup.get(item.node)
      if (!marks) {
        marks = new Map()
        lookup.set(item.node, marks)
      }
      marks.set(item.offset, item.starts)
    }
    const starts = []
    let normIndex = 0
    let pendingSpace = false
    let started = false
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const raw = node.textContent
        .replace(/\u2018/g, "\u2019")
        .replace(/'/g, "\u2019")
      const marks = lookup.get(node)
      for (let index = 0; index < raw.length; index += 1) {
        if (/\s/.test(raw[index])) {
          if (started) pendingSpace = true
          continue
        }
        if (pendingSpace) {
          normIndex += 1
          pendingSpace = false
        }
        if (marks && marks.get(index)) starts.push(normIndex)
        normIndex += 1
        started = true
      }
      node = walker.nextNode()
    }
    return starts
  }
  const SECTION_SELECTOR = {
    Nav: "header.landing-nav",
    Hero: "#hero",
    Logos: "#logos",
    Statement: "#product",
    Benefits: "#benefits",
    "Paper Wrap": "#paper",
    "Apply Wrap": "#apply",
    "Coach Wrap": "#coach",
    "Integrations Wrap": "#integrations",
    "Coming next Wrap": "#coming-next",
    Customers: "#stories",
    Prefooter: "#close",
    "Footer Wrap": "footer",
  }
  const penSections = {}
  for (const [name, selector] of Object.entries(SECTION_SELECTOR)) {
    const rootEl = document.querySelector(selector)
    if (!rootEl) {
      penSections[name] = null
      continue
    }
    const texts = [...rootEl.querySelectorAll("*")]
      .filter((el) => !hiddenText(el) && normText(el.textContent) !== "")
      .map((el) => {
        const measure = (node) => {
          const style = cs(node)
          const fontSize = parseFloat(style.fontSize)
          return {
            color: rgba(style.color).slice(0, 3),
            fontSize,
            lineHeight:
              style.lineHeight === "normal"
                ? "normal"
                : parseFloat(style.lineHeight) / fontSize,
            fontWeight: String(style.fontWeight),
            letterSpacing:
              style.letterSpacing === "normal"
                ? 0
                : parseFloat(style.letterSpacing),
          }
        }
        const runs = []
        const walk = (node) => {
          if (node.nodeType === 3) {
            if (!node.textContent.trim()) return
            const parent = node.parentElement
            if (parent && !hiddenText(parent)) runs.push(measure(parent))
            return
          }
          if (node.nodeType !== 1 || (node !== el && hiddenText(node))) return
          for (const child of node.childNodes) walk(child)
        }
        walk(el)
        return {
          text: normText(el.textContent),
          ...measure(el),
          runs,
          lineStarts: lineStartsFor(el),
        }
      })
    const marks = [...rootEl.querySelectorAll("svg, img")]
      .filter((el) => visible(el))
      .map((el) => {
        const box = el.getBoundingClientRect()
        return { tag: el.tagName.toLowerCase(), w: box.width, h: box.height }
      })
    penSections[name] = { texts, marks }
  }
  return penSections
}

export const penProbeSource = `(${penProbe})()`
