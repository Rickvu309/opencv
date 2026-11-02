import { SEL } from "./assumes.mjs"

async function designProbe(SEL, spec) {
  const cs = (el) => getComputedStyle(el)
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
  const readText = (el) => {
    const clone = el.cloneNode(true)
    clone
      .querySelectorAll("[aria-hidden='true'],style")
      .forEach((n) => n.remove())
    return clone.textContent.replace(/\s+/g, " ").trim()
  }
  const header = document.querySelector("header")

  const benefitSection = document.querySelector(SEL.benefits)
  const benefitSvgs = benefitSection
    ? [...benefitSection.querySelectorAll("svg")]
    : []
  const hexRe = /#[0-9a-fA-F]{3,8}\b/
  let benefitShapes = 0
  let benefitHex = 0
  const benefitViewBoxes = []
  for (const svg of benefitSvgs) {
    benefitViewBoxes.push(svg.getAttribute("viewBox"))
    benefitShapes += svg.querySelectorAll("path, ellipse").length
    for (const el of [svg, ...svg.querySelectorAll("*")]) {
      for (const attr of [...el.attributes]) {
        if (hexRe.test(attr.value)) benefitHex += 1
      }
    }
  }
  const cards = [
    ...document.querySelectorAll(`${SEL.benefits} ${SEL.benefitCard}`),
  ]
  const benefitArt = {
    section: Boolean(benefitSection),
    count: benefitSvgs.length,
    viewBoxes: benefitViewBoxes,
    shapes: benefitShapes,
    hex: benefitHex,
    perCard: cards.map((card) => card.querySelectorAll("svg").length),
  }

  const mark = header?.querySelector("a svg")
  const word = mark?.parentElement?.querySelector(":scope > span")
  let navLockup = null
  if (mark && word) {
    const markBox = mark.getBoundingClientRect()
    const wordBox = word.getBoundingClientRect()
    const wordStyle = cs(word)
    navLockup = {
      gap: wordBox.left - (markBox.right - spec["28"].markInset),
      fontSize: wordStyle.fontSize,
      fontWeight: wordStyle.fontWeight,
    }
  }
  const shadowParts = (shadow) => {
    if (!shadow || shadow === "none") return []
    const parts = []
    let depth = 0
    let start = 0
    for (let i = 0; i < shadow.length; i++) {
      const ch = shadow[i]
      if (ch === "(") depth++
      else if (ch === ")") depth--
      else if (ch === "," && depth === 0) {
        parts.push(shadow.slice(start, i).trim())
        start = i + 1
      }
    }
    parts.push(shadow.slice(start).trim())
    return parts.filter(Boolean)
  }
  const shadowLive = (part) =>
    [...part.matchAll(/-?[\d.]+px/g)].some(
      (match) => Math.abs(parseFloat(match[0])) > 0.5
    )
  const buttonOf = (root, name) => {
    if (!root) return null
    const el = [...root.querySelectorAll("a,button")].find(
      (node) => readText(node) === name
    )
    if (!el) return null
    const s = cs(el)
    const box = el.getBoundingClientRect()
    const parts = shadowParts(s.boxShadow)
    const borderW = Math.max(
      parseFloat(s.borderTopWidth) || 0,
      parseFloat(s.borderRightWidth) || 0,
      parseFloat(s.borderBottomWidth) || 0,
      parseFloat(s.borderLeftWidth) || 0
    )
    const axisPx = (token, axis) => {
      const raw = String(token ?? "").trim()
      if (raw.endsWith("%")) {
        return (parseFloat(raw) / 100) * (axis === "x" ? box.width : box.height)
      }
      return parseFloat(raw) || 0
    }
    const cornerPx = (value) => {
      const bits = String(value || "0")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      return Math.min(
        axisPx(bits[0] || "0", "x"),
        axisPx(bits[1] || bits[0] || "0", "y")
      )
    }
    const radius = Math.min(
      cornerPx(s.borderTopLeftRadius),
      cornerPx(s.borderTopRightRadius),
      cornerPx(s.borderBottomRightRadius),
      cornerPx(s.borderBottomLeftRadius)
    )
    return {
      h: box.height,
      fontSize: s.fontSize,
      fontWeight: String(s.fontWeight),
      padInline: parseFloat(s.paddingInlineStart || s.paddingLeft) || 0,
      inset: parts.some((part) => part.includes("inset") && shadowLive(part)),
      outer: parts.some((part) => !part.includes("inset") && shadowLive(part)),
      borderVisible: borderW >= 0.5 && rgba(s.borderTopColor)[3] > 0.05,
      radius,
    }
  }
  const roots = { nav: header, close: document.querySelector(SEL.close) }
  const ctas = Object.fromEntries(
    Object.entries(spec["29"].buttons).map(([key, b]) => [
      key,
      buttonOf(roots[b.scope], b.label),
    ])
  )

  const size = spec["30"].raster
  const rasterCard = async (card) => {
    const svg = card.querySelector("svg")
    const titleEl = card.querySelector("h2")
    const title = titleEl ? readText(titleEl) : ""
    if (!svg) return { title, png: null, error: "no svg" }
    const shot = card.querySelector(SEL.benefitShot)
    const bg = shot ? cs(shot).backgroundColor : "rgb(240, 240, 240)"
    const clone = svg.cloneNode(true)
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    clone.setAttribute("width", String(size))
    clone.setAttribute("height", String(size))
    const orig = [svg, ...svg.querySelectorAll("*")]
    const copy = [clone, ...clone.querySelectorAll("*")]
    for (let i = 0; i < orig.length; i++) {
      const style = cs(orig[i])
      for (const name of ["fill", "stroke"]) {
        const attr = orig[i].getAttribute(name)
        if (attr && attr !== "none") copy[i].setAttribute(name, style[name])
      }
    }
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("benefit svg raster failed"))
        img.src = url
      })
      const raster = document.createElement("canvas")
      raster.width = size
      raster.height = size
      const context = raster.getContext("2d")
      context.fillStyle = bg
      context.fillRect(0, 0, size, size)
      context.drawImage(image, 0, 0, size, size)
      return { title, png: raster.toDataURL("image/png") }
    } catch (error) {
      return { title, png: null, error: String(error && error.message) }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const benefitRasters = await Promise.all(cards.map(rasterCard))
  return { benefitArt, navLockup, ctas, benefitRasters }
}

export const designProbeSource = (spec) =>
  `(${designProbe})(${JSON.stringify(SEL)}, ${JSON.stringify(spec)})`
