// Layout, craft, motion, accessibility and performance properties. They read the snapshots that
// probe.mjs takes at 1440x900 (desktop), 390x844 (mobile) and 1440x900 with reduced motion.
const verdict = (id, name, rule, pass, measured) => ({
  id,
  name,
  rule,
  pass,
  measured,
})
const px = (n) => Math.round(n)

const luminance = ([r, g, b]) => {
  const f = (v) =>
    (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const chroma = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255
const hue = ([r, g, b]) => {
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (!d) return 0
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const hex = (c) =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`

export function pageChecks({
  desktop,
  mobile,
  mobileOpen,
  first,
  reduced,
  deep,
  reducedDeep,
}) {
  const out = []

  const img = desktop.heroImg
  const visibleH = img
    ? Math.min(img.top + img.h, desktop.vh) - Math.max(img.top, 0)
    : 0
  const mImg = mobile.heroImg
  const mVisible = mImg
    ? Math.min(mImg.top + mImg.h, mobile.vh) - Math.max(mImg.top, 0)
    : 0
  // NN/g 3.1
  out.push(
    verdict(
      "14",
      "coach-frame-in-first-view-1440",
      "At 1440x900 the H1 and 120px or more of the Coach frame share the first view",
      desktop.h1Bottom !== null &&
        desktop.h1Bottom <= desktop.vh &&
        visibleH >= 120,
      `h1 bottom ${px(desktop.h1Bottom)}px, frame visible ${px(visibleH)}px of ${img ? px(img.h) : 0} (390x844: ${px(mVisible)}px)`
    )
  )

  const names = ["coach", "paper", "apply", "pitch"]
  const inView = (snap, n) =>
    snap.links.some(
      (l) =>
        l.visible &&
        l.text.toLowerCase() === n &&
        l.rect.y >= 0 &&
        l.rect.y + l.rect.h <= snap.vh &&
        l.rect.x >= 0 &&
        l.rect.x < snap.vw
    )
  const seenOpen = mobileOpen ? names.filter((n) => inView(mobileOpen, n)) : []
  const seenClosed = names.filter((n) => inView(mobile, n))
  const seen = seenOpen.length > seenClosed.length ? seenOpen : seenClosed
  // NN/g 4.3
  out.push(
    verdict(
      "15",
      "surface-names-before-fold-390",
      "At 390x844 all four surface names are visible as links without scrolling, in the page or in a menu the checker opens with one click",
      seen.length === 4,
      `${seen.length} of 4 visible without scrolling: ${seen.join(", ") || "none"} (${mobileOpen ? "menu opened" : "no menu button found"})`
    )
  )

  const heroButtons = desktop.links.filter(
    (l) => l.region === "hero" && l.visible && l.buttonLike
  )
  const signIn = desktop.links.find(
    (l) => l.region === "hero" && /sign in/i.test(l.text)
  )
  // Baymard, primary button more prominent and separated
  out.push(
    verdict(
      "16",
      "hero-one-primary-button",
      "The hero has one button; Sign in there, if present, is a text link",
      heroButtons.length === 1 && !(signIn && signIn.buttonLike),
      `${heroButtons.length} button(s) in hero: ${heroButtons.map((b) => `"${b.text}"`).join(", ")}; Sign in is ${signIn ? (signIn.buttonLike ? "a button" : "a text link") : "absent"}`
    )
  )

  const light = luminance(desktop.bg) >= 0.85
  const sat = deep.colors.filter((c) => chroma(c.rgb) >= 0.18)
  const hues = sat
    .map((c) => ({ h: hue(c.rgb), hex: hex(c.rgb) }))
    .sort((x, y) => x.h - y.h)
  const clusters = []
  for (const item of hues) {
    const last = clusters[clusters.length - 1]
    if (last && item.h - last[last.length - 1].h <= 25) last.push(item)
    else clusters.push([item])
  }
  if (clusters.length > 1) {
    const head = clusters[0]
    const tail = clusters[clusters.length - 1]
    if (head[0].h + 360 - tail[tail.length - 1].h <= 25) {
      clusters[0] = [...tail, ...head]
      clusters.pop()
    }
  }
  const buckets = {
    size: clusters.length,
    values: () => clusters.map((c) => c[0].hex),
  }
  // Refactoring UI, color palette
  out.push(
    verdict(
      "17",
      "light-field-one-accent",
      "Background luminance 0.85 or more; at most one saturated hue family (hues within 25 degrees count as one) on marketing text and shapes (chroma >= 0.18, product shots excluded)",
      light && buckets.size <= 1,
      `background ${hex(desktop.bg)} (L=${luminance(desktop.bg).toFixed(2)}), ${buckets.size} saturated hue(s)${buckets.size ? `: ${buckets.values().join(" ")}` : ""}`
    )
  )

  const h1 = desktop.blocks.find((b) => b.tag === "h1")
  const letters = h1.text.replace(/[^A-Za-z]/g, "")
  const caps =
    h1.textTransform === "uppercase" ||
    (letters.length > 3 && h1.text === h1.text.toUpperCase())
  const gradient = /gradient/.test(h1.bgImage) || h1.fill === "rgba(0, 0, 0, 0)"
  // Linear homepage H1
  out.push(
    verdict(
      "18",
      "h1-sentence-case-solid",
      "H1 is not all caps and not a gradient or transparent-fill text",
      !caps && !gradient,
      `all caps=${caps}, gradient or clipped fill=${gradient}`
    )
  )

  const bad = desktop.imgs.filter(
    (i) =>
      !i.src?.startsWith("/landing/") ||
      !i.alt ||
      i.alt.length < 20 ||
      !/coach|paper|apply|pitch/i.test(i.alt)
  )
  // NN/g 2.4
  out.push(
    verdict(
      "19",
      "images-are-product-with-alt",
      "Every marketing image is from /landing/ and its alt names a surface (Coach, Paper, Apply or Pitch)",
      desktop.imgs.length > 0 && bad.length === 0,
      `${desktop.imgs.length} images, ${bad.length} without a surface-naming alt${bad[0] ? `: ${bad[0].src}` : ""}`
    )
  )

  const describe = (list) =>
    list.length
      ? `${list.length} elements, e.g. ${list
          .slice(0, 2)
          .map((a) => `${a.region} "${a.text}" (${a.why.join("+")})`)
          .join("; ")}`
      : "none"
  const lead = first.animatedText.filter((a) => a.lead)
  const rest = first.animatedText.filter((a) => !a.lead)
  // NN/g 5.3, the tagline is immediately visible
  out.push(
    verdict(
      "20",
      "headline-visible-at-first-paint",
      "The H1 and subhead are not hidden, blurred or animated at first paint",
      lead.length === 0,
      describe(lead)
    )
  )
  // NN/g 5.3, scroll-triggered text animations delay users (research gap 15, the closing line)
  out.push(
    verdict(
      "20b",
      "other-text-visible-at-first-paint",
      "No other text on the page starts hidden, blurred or animated, so nothing waits for a scroll trigger",
      rest.length === 0,
      describe(rest)
    )
  )

  const motion = [
    ...reducedDeep.running.map((r) => `running: ${r}`),
    ...reducedDeep.configured,
    ...reducedDeep.hidden.map((t) => `still hidden: ${t}`),
    ...reduced.animatedText.map((a) => `first paint: ${a.text}`),
  ]
  const smooth = reducedDeep.scrollBehavior === "smooth"
  // WCAG 2.2 SC 2.3.3
  out.push(
    verdict(
      "21",
      "reduced-motion-disables-animation",
      "With prefers-reduced-motion: reduce no element has a non-zero transition or animation duration (transition: all counts), nothing runs or stays hidden, and scroll is not smooth",
      motion.length === 0 && !smooth,
      motion.length || smooth
        ? `${motion.length} item(s): ${motion.slice(0, 4).join("; ")}; scroll-behavior=${reducedDeep.scrollBehavior}`
        : "none"
    )
  )

  const m = desktop.markup
  // NN/g 5.2
  out.push(
    verdict(
      "22",
      "no-video-or-carousel",
      "No video, audio, iframe, autoplay or carousel on the page",
      m.media.length + m.autoplay + m.carousel === 0,
      `media=${m.media.join(",") || "none"} autoplay=${m.autoplay} carousel-like=${m.carousel}`
    )
  )

  const tests = deep.contrast.map((t) => {
    const large = t.px >= 24 || (t.px >= 18.66 && t.bold)
    return { ...t, need: large ? 3 : 4.5, got: ratio(t.fg, t.bg) }
  })
  const fails = tests.filter((t) => t.got < t.need)
  const worst = [...tests].sort((a, b) => a.got - a.need - (b.got - b.need))[0]
  // WCAG 2.2 SC 1.4.3
  out.push(
    verdict(
      "23",
      "text-contrast",
      "Text has 4.5:1 against its background, 3:1 at 24px or larger (text over images or gradients is skipped)",
      tests.length > 0 && fails.length === 0,
      `${tests.length} text runs, ${fails.length} below, worst ${worst ? `${worst.got.toFixed(2)}:1 (need ${worst.need}) "${worst.text}"` : "n/a"}`
    )
  )

  const small = deep.targets.filter((t) => t.w < 24 || t.h < 24)
  const undersized = new Set(small)
  const crowded = small.filter((t) => {
    const cx = t.x + t.w / 2
    const cy = t.y + t.h / 2
    return deep.targets.some((o) => {
      if (o === t) return false
      if (undersized.has(o)) {
        return Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < 24
      }
      const dx = Math.max(o.x - cx, 0, cx - (o.x + o.w))
      const dy = Math.max(o.y - cy, 0, cy - (o.y + o.h))
      return Math.hypot(dx, dy) < 12
    })
  })
  const smallPrimary = small.filter((t) => t.href === "/sign-up")
  const minSide = Math.min(...deep.targets.map((t) => Math.min(t.w, t.h)))
  // WCAG 2.2 SC 2.5.8
  out.push(
    verdict(
      "24",
      "target-size-24",
      "Every link and button is 24x24 CSS px, or has a 24px circle clear of other targets and circles; the sign-up buttons are always 24x24 (WCAG 2.5.8)",
      crowded.length === 0 && smallPrimary.length === 0,
      `${deep.targets.length} targets, smallest side ${px(minSide)}px, ${small.length} undersized, ${crowded.length} crowded, ${smallPrimary.length} undersized sign-up${crowded[0] ? `: "${crowded[0].text}"` : ""}`
    )
  )

  const hi = desktop.imgs.find((i) => i.region === "hero")
  const miss = []
  if (!hi?.width) miss.push("width")
  if (!hi?.height) miss.push("height")
  if (hi?.fetchpriority !== "high") miss.push("fetchpriority=high")
  if (hi?.loading === "lazy") miss.push("loading=lazy")
  const invisible =
    first.heroImg?.startsInvisible || (first.heroImg?.opacity ?? 1) < 0.95
  // web.dev CLS and LCP
  out.push(
    verdict(
      "25",
      "hero-image-attrs-and-paint",
      "Hero image has width, height, fetchpriority=high, is not lazy, and does not start at opacity 0",
      miss.length === 0 && !invisible,
      `missing=${miss.join(",") || "none"}, starts invisible=${Boolean(invisible)} (opacity ${first.heroImg?.opacity})`
    )
  )
  return out
}
