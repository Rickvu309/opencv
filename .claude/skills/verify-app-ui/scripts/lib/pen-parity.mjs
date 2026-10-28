// Compares measured screens with <feature>/design/<slug>.styles.json, written by
// scripts/pen-snapshot.mjs --styles. A pen text must be on the screen with the
// pen's colour (OKLCH within 0.02 lightness and chroma), size (0.5px), weight,
// line height (0.03) and tracking (0.15px). Each pen icon or drawn mark needs an
// svg, img or icon-only button of the same size within 2px.
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Pen greys under 4.5:1 on white. The app keeps muted-foreground there, as the
// landing does (verify-landing 31), so text-contrast (check 20) still holds.
const CONTRAST_FLOOR = new Set([
  "#969799",
  "#A0A0A2",
  "#9C9D9F",
  "#8A8F98",
  "#C9C9CC",
])
const MUTED_FOREGROUND = "#59595B"

// Runs inside the page; serialised with toString().
function penProbe(selector) {
  const roots = [...document.querySelectorAll(selector)].filter(
    (el) => el.getBoundingClientRect().width > 0
  )
  if (!roots.length) return null
  const ctx = document.createElement("canvas").getContext("2d")
  const rgb = (css) => {
    ctx.fillStyle = "#000"
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
  }
  const norm = (s) =>
    s
      .replace(/[‘']/g, "’")
      .replace(/\s+/g, " ")
      .trim()
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
      color: rgb(s.color),
      fontSize: size,
      fontWeight: s.fontWeight,
      lineHeight:
        s.lineHeight === "normal" ? "normal" : parseFloat(s.lineHeight) / size,
      letterSpacing: s.letterSpacing === "normal" ? 0 : parseFloat(s.letterSpacing),
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
      if (field && el.value) texts.push({ text: norm(el.value), ...measure(el) })
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
  `(${penProbe.toString()})(${JSON.stringify(selector)})`

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
  `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`
const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const weight = (w) => {
  const text = String(w).toLowerCase()
  if (text === "normal") return "400"
  if (text === "bold") return "700"
  return String(parseInt(text, 10))
}
const norm = (s) =>
  s
    .replace(/[‘']/g, "’")
    .replace(/\s+/g, " ")
    .trim()

// notShown: { text: reason } for pen texts the product cannot show.
// marksNotDrawn: how many pen marks belong to data the product does not have.
export function comparePen(
  stylesFile,
  measured,
  { notShown = {}, marksNotDrawn = 0 } = {}
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
    if (/^#[0-9A-F]{6}$/.test(spec.fill ?? "")) {
      const a = oklch(found.color)
      const b = oklch(fromHex(spec.fill))
      const close = Math.abs(a.L - b.L) <= 0.02 && Math.abs(a.C - b.C) <= 0.02
      const floor =
        CONTRAST_FLOOR.has(spec.fill) && hex(found.color) === MUTED_FOREGROUND
      if (!close && !floor)
        problems.push(`colour ${hex(found.color)} pen ${spec.fill}`)
    }
    if (
      typeof spec.fontSize === "number" &&
      Math.abs(found.fontSize - spec.fontSize) > 0.5
    )
      problems.push(`size ${found.fontSize} pen ${spec.fontSize}`)
    if (spec.fontWeight != null && weight(found.fontWeight) !== weight(spec.fontWeight))
      problems.push(`weight ${found.fontWeight} pen ${spec.fontWeight}`)
    if (
      typeof spec.lineHeight === "number" &&
      (found.lineHeight === "normal" ||
        Math.abs(found.lineHeight - spec.lineHeight) > 0.03)
    )
      problems.push(`line height ${found.lineHeight} pen ${spec.lineHeight}`)
    if (
      typeof spec.letterSpacing === "number" &&
      Math.abs(found.letterSpacing - spec.letterSpacing) > 0.15
    )
      problems.push(`tracking ${found.letterSpacing} pen ${spec.letterSpacing}`)
    if (problems.length)
      failures.push(`[${spec.section}] "${want.slice(0, 40)}" ${problems.join(", ")}`)
  }
  const boxes = [...measured.marks]
  const penMarks = styles.sections.flatMap((section) => section.marks)
  const missingMarks = []
  for (const mark of penMarks) {
    const index = boxes.findIndex(
      (b) => Math.abs(b.w - mark.width) <= 2 && Math.abs(b.h - mark.height) <= 2
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
