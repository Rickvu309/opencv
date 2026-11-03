function selfContainedProbeColors() {
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
  const shown = (el) =>
    el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim()
  const root = cs(document.documentElement)
  const bodyBg = rgba(cs(document.body).backgroundColor)
  const near = (a, b, t = 3) =>
    Math.abs(a[0] - b[0]) <= t &&
    Math.abs(a[1] - b[1]) <= t &&
    Math.abs(a[2] - b[2]) <= t
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const visible = [...document.body.querySelectorAll("*")].filter(
    (el) =>
      !(el instanceof SVGElement) &&
      !["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) &&
      shown(el) &&
      el.getBoundingClientRect().width > 0 &&
      el.getBoundingClientRect().height > 0
  )
  const out = {}
  const tokenRgb = []
  const names = new Set()
  const TAILWIND_PALETTE_VARIABLE_NOT_A_DESIGN_TOKEN =
    /^--color-(black|white|(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive)(-\d+)?)$/
  const dark = document.documentElement.classList.contains("dark")
  const scan = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.style) scan(rule.cssRules)
      else if (rule.style) {
        const sel = rule.selectorText ?? ""
        const hit =
          /(^|,)\s*(:root|html)\b/.test(sel) ||
          (dark && /(^|,)\s*\.dark\b/.test(sel))
        if (!hit) continue
        for (const n of rule.style)
          if (
            n.startsWith("--") &&
            !TAILWIND_PALETTE_VARIABLE_NOT_A_DESIGN_TOKEN.test(n)
          )
            names.add(n)
      }
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      scan(sheet.cssRules)
    } catch {}
  }
  for (const n of names) {
    const v = root.getPropertyValue(n).trim()
    if (/^(oklch|oklab|rgb|hsl|lab|lch|color|#)/.test(v) && !v.includes("var("))
      tokenRgb.push(rgba(v))
  }
  const rawColors = {}
  const fills = []
  for (const el of visible) {
    const s = cs(el)
    const own = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim()
    )
    const list = [["bg", s.backgroundColor]]
    if (own) list.push(["text", s.color])
    if (parseFloat(s.borderTopWidth) > 0)
      list.push(["border", s.borderTopColor])
    for (const [kind, css] of list) {
      const c = rgba(css)
      if (c[3] === 0) continue
      if (tokenRgb.some((t) => near(t, c, c[3] < 1 ? 12 : 6))) continue
      if (c[0] === 0 && c[1] === 0 && c[2] === 0 && c[3] < 1) continue
      const key = `${kind} rgb(${c[0]},${c[1]},${c[2]})`
      rawColors[key] = (rawColors[key] ?? 0) + 1
    }
    const r = el.getBoundingClientRect()
    if (
      s.backgroundImage.includes("gradient(") &&
      r.width * r.height >= 6000 &&
      !el.closest("button")
    ) {
      const stops = (
        s.backgroundImage.match(
          /(rgba?\([^)]*\)|color\([^)]*\)|okl(?:ch|ab)\([^)]*\))/g
        ) ?? []
      ).map(rgba)
      const noStopFadesToTransparentLikeAPhotoScrim = stops.every(
        (c) => c[3] > 0.5
      )
      if (stops.length && noStopFadesToTransparentLikeAPhotoScrim) {
        const mean = [0, 1, 2].map(
          (i) => stops.reduce((n, c) => n + c[i], 0) / stops.length
        )
        const mx = Math.max(...mean),
          mn = Math.min(...mean)
        fills.push({
          c: "gradient",
          chroma: Math.round(((mx - mn) / 255) * 100) / 100,
          lum: Math.round(lum(mean) * 100) / 100,
          area: Math.round(r.width * r.height),
          t: clean(el.textContent).slice(0, 28),
          token: false,
        })
      }
    }
    const bg = rgba(s.backgroundColor)
    if (
      bg[3] > 0.5 &&
      r.width * r.height >= 6000 &&
      !el.closest("img, button, [role=dialog]") &&
      el.tagName !== "IMG"
    ) {
      const mx = Math.max(bg[0], bg[1], bg[2]),
        mn = Math.min(bg[0], bg[1], bg[2])
      fills.push({
        c: `rgb(${bg[0]},${bg[1]},${bg[2]})`,
        chroma: Math.round(((mx - mn) / 255) * 100) / 100,
        lum: Math.round(lum(bg) * 100) / 100,
        area: Math.round(r.width * r.height),
        t: clean(el.textContent).slice(0, 28),
        token: tokenRgb.some((t) => near(t, bg, 2)),
      })
    }
  }
  out.rawColors = rawColors
  out.fills = fills.slice(0, 80)
  out.bodyBgLum = Math.round(lum(bodyBg) * 100) / 100

  const SPACING_SIDES_WITHOUT_MARGINS_AS_AUTO_MARGINS_RESOLVE_TO_ODD_PIXELS = [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "rowGap",
    "columnGap",
  ]
  const spacing = { total: 0, off: {} }
  for (const el of visible) {
    const s = cs(el)
    for (const p of SPACING_SIDES_WITHOUT_MARGINS_AS_AUTO_MARGINS_RESOLVE_TO_ODD_PIXELS) {
      const v = parseFloat(s[p])
      if (!v || Number.isNaN(v)) continue
      spacing.total++
      const px = Math.round(v * 10) / 10
      if (!(px % 4 === 0 || [2, 6, 10, 14].includes(px)))
        spacing.off[`${px}px`] = (spacing.off[`${px}px`] ?? 0) + 1
    }
  }
  out.spacing = spacing

  return out
}

export const colorsSource = `(${selfContainedProbeColors.toString()})()`
