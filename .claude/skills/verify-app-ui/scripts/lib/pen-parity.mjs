import { readFileSync } from "node:fs"
import { join } from "node:path"

const PEN_TOLERANCE = Object.freeze({
  oklchLightness: 0.02,
  oklchChroma: 0.02,
  fontSizePx: 0.5,
  lineHeight: 0.03,
  letterSpacingPx: 0.15,
  markSizePx: 2,
})
const PEN_GREYS_UNDER_AA_ON_WHITE = new Set([
  "#969799",
  "#A0A0A2",
  "#9C9D9F",
  "#8A8F98",
  "#C9C9CC",
])
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const unit = c / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const onWhite = (rgb) => 1.05 / (luminance(rgb) + 0.05)
const neutral = (rgb) => Math.max(...rgb) - Math.min(...rgb) <= 4
const neutralGreyBetweenAaAndMutedForeground = (rgb) =>
  neutral(rgb) && onWhite(rgb) >= 4.3 && onWhite(rgb) <= 7.1

function selfContainedPenProbe(selector) {
  const roots = [...document.querySelectorAll(selector)].filter(
    (el) => el.getBoundingClientRect().width > 0
  )
  if (!roots.length) return null
  const ctx = document.createElement("canvas").getContext("2d")
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = "#000"
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const nearestOpaqueSurface = (el) => {
    for (let up = el; up; up = up.parentElement) {
      const bg = rgba(getComputedStyle(up).backgroundColor)
      if (bg[3] > 0.99) return bg
    }
    return [255, 255, 255, 1]
  }
  const shown = (el, css) => {
    const [r, g, b, a] = rgba(css)
    if (a > 0.99) return [r, g, b]
    const under = nearestOpaqueSurface(el)
    return [r, g, b].map((c, i) => Math.round(c * a + under[i] * (1 - a)))
  }
  const norm = (s) => s.replace(/[‘']/g, "’").replace(/\s+/g, " ").trim()
  const box = (el) => el.getBoundingClientRect()
  const visible = (el) =>
    box(el).width > 0 &&
    box(el).height > 0 &&
    getComputedStyle(el).visibility !== "hidden"
  const readable = (el) =>
    visible(el) && !el.closest(".sr-only,[aria-hidden='true']")
  const measure = (el, pseudo) => {
    const s = getComputedStyle(el, pseudo)
    const size = parseFloat(s.fontSize)
    return {
      color: shown(el, s.color),
      fontSize: size,
      fontWeight: s.fontWeight,
      lineHeight:
        s.lineHeight === "normal" ? "normal" : parseFloat(s.lineHeight) / size,
      letterSpacing:
        s.letterSpacing === "normal" ? 0 : parseFloat(s.letterSpacing),
    }
  }
  const texts = []
  const marks = []
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (!readable(el)) continue
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim()
      )
      const text = norm(el.textContent)
      const field = el.tagName === "INPUT" || el.tagName === "TEXTAREA"
      if (field && el.placeholder)
        texts.push({
          text: norm(el.placeholder),
          ...measure(el, "::placeholder"),
        })
      if (field && el.value)
        texts.push({ text: norm(el.value), ...measure(el) })
      if (own) texts.push({ text, ...measure(el) })
      else if (text && el.childElementCount > 0)
        texts.push({ text, container: true, ...measure(el) })
    }
    for (const el of root.querySelectorAll("button, [role=button]"))
      if (visible(el) && !norm(el.textContent) && el.querySelector("svg"))
        marks.push({ w: box(el).width, h: box(el).height })
    for (const el of root.querySelectorAll("svg, img"))
      if (visible(el) && !el.closest(".sr-only"))
        marks.push({ w: box(el).width, h: box(el).height })
  }
  return { texts, marks }
}

export const penProbeSource = (selector) =>
  `(${selfContainedPenProbe.toString()})(${JSON.stringify(selector)})`

function oklch([r, g, b]) {
  const lin = (c) => {
    const unit = c / 255
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(a, bb),
  }
}
const hex = (rgb) =>
  `#${rgb
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`
const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const weight = (w) => {
  const text = String(w).toLowerCase()
  if (text === "normal") return "400"
  if (text === "bold") return "700"
  return String(parseInt(text, 10))
}
const norm = (s) => s.replace(/[‘']/g, "’").replace(/\s+/g, " ").trim()

export function comparePen(
  stylesFile,
  measured,
  { notShown = {}, marksNotDrawn = 0, penLayoutAaRuleOwnsColour = false } = {}
) {
  const styles = JSON.parse(readFileSync(stylesFile, "utf8"))
  const pen = styles.sections.flatMap((section) =>
    section.texts.map((text) => ({ ...text, section: section.name }))
  )
  const failures = []
  const used = new Map()
  let compared = 0
  for (const spec of pen) {
    const want = norm(spec.content)
    const exact = measured.texts.filter((t) => t.text === want)
    const pool = exact.some((t) => !t.container)
      ? exact.filter((t) => !t.container)
      : exact
    if (!pool.length) {
      if (!(want in notShown))
        failures.push(`[${spec.section}] "${want.slice(0, 40)}" missing`)
      continue
    }
    const seen = used.get(want) ?? 0
    used.set(want, seen + 1)
    const found = pool[Math.min(seen, pool.length - 1)]
    compared += 1
    const problems = []
    if (!penLayoutAaRuleOwnsColour && /^#[0-9A-F]{6}$/.test(spec.fill ?? "")) {
      const a = oklch(found.color)
      const b = oklch(fromHex(spec.fill))
      const close =
        Math.abs(a.L - b.L) <= PEN_TOLERANCE.oklchLightness &&
        Math.abs(a.C - b.C) <= PEN_TOLERANCE.oklchChroma
      const floor =
        PEN_GREYS_UNDER_AA_ON_WHITE.has(spec.fill) &&
        neutralGreyBetweenAaAndMutedForeground(found.color)
      if (!close && !floor)
        problems.push(`colour ${hex(found.color)} pen ${spec.fill}`)
    }
    if (
      typeof spec.fontSize === "number" &&
      Math.abs(found.fontSize - spec.fontSize) > PEN_TOLERANCE.fontSizePx
    )
      problems.push(`size ${found.fontSize} pen ${spec.fontSize}`)
    if (
      spec.fontWeight != null &&
      weight(found.fontWeight) !== weight(spec.fontWeight)
    )
      problems.push(`weight ${found.fontWeight} pen ${spec.fontWeight}`)
    if (
      typeof spec.lineHeight === "number" &&
      (found.lineHeight === "normal" ||
        Math.abs(found.lineHeight - spec.lineHeight) > PEN_TOLERANCE.lineHeight)
    )
      problems.push(`line height ${found.lineHeight} pen ${spec.lineHeight}`)
    if (
      typeof spec.letterSpacing === "number" &&
      Math.abs(found.letterSpacing - spec.letterSpacing) >
        PEN_TOLERANCE.letterSpacingPx
    )
      problems.push(`tracking ${found.letterSpacing} pen ${spec.letterSpacing}`)
    if (problems.length)
      failures.push(
        `[${spec.section}] "${want.slice(0, 40)}" ${problems.join(", ")}`
      )
  }
  const boxes = [...measured.marks]
  const penMarks = styles.sections.flatMap((section) => section.marks)
  const missingMarks = []
  for (const mark of penMarks) {
    const index = boxes.findIndex(
      (b) =>
        Math.abs(b.w - mark.width) <= PEN_TOLERANCE.markSizePx &&
        Math.abs(b.h - mark.height) <= PEN_TOLERANCE.markSizePx
    )
    if (index >= 0) boxes.splice(index, 1)
    else missingMarks.push(`${mark.name} ${mark.width}x${mark.height}`)
  }
  if (missingMarks.length > marksNotDrawn)
    failures.push(
      `${missingMarks.length} marks missing (${marksNotDrawn} allowed): ${missingMarks.slice(0, 4).join(", ")}`
    )
  return {
    texts: pen.length,
    compared,
    marks: penMarks.length,
    missingMarks: missingMarks.length,
    failures,
  }
}

export const stylesPath = (repo, feature, slug) =>
  join(repo, "apps/web/src/features", feature, "design", `${slug}.styles.json`)

const BAD_STYLES = new URL("./fixtures/bad-pen-styles.json", import.meta.url)
const saveText = (text, color) => ({
  text,
  color,
  fontSize: 14,
  fontWeight: "400",
  lineHeight: 20,
  letterSpacing: 0,
})
const saveIcon = { w: 16, h: 16 }
const failures = (texts, marks = [saveIcon]) =>
  comparePen(BAD_STYLES, { texts, marks }).failures
export const badFixture = [
  {
    name: "white text where the pen draws grey",
    fails: () => failures([saveText("Save", [255, 255, 255])]).length > 0,
  },
  {
    name: "a pen text the screen does not show",
    fails: () => failures([]).length > 0,
  },
  {
    name: "a longer text that only contains the pen text",
    fails: () => failures([saveText("Save draft", [160, 160, 162])]).length > 0,
  },
  {
    name: "a pen icon the screen does not draw",
    fails: () => failures([saveText("Save", [160, 160, 162])], []).length > 0,
  },
]
