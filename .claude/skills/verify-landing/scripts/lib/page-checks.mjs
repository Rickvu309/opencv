import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { decodeDataUrl, decodePng, pngMismatch } from "./art-diff.mjs"
import { textStyleVerdict } from "./text-style-check.mjs"
import { isSignUpLink } from "./text-rules.mjs"

// Pixels whose max RGB channel delta exceeds this are a mismatch.
// The corrected Coach art stays under COACH_ART_MAX. The old centre-rotated
// art (ellipses spun around their own centre) sits well above it.
// One wrong ellipse moves about 150 pixels, inside this band. Check 30 is the
// whole-art smoke test. landing-art-rotation.test.ts pins each ellipse.
const COACH_ART_CHANNEL = 48
// Corrected art measured 1.05% (943/90000) on three identical runs. The old
// centre-rotated art measured 1.47% (1327/90000). 1.25% (1125/90000) sits
// between them. Leave the limit here: it is not a single-mark check.
const COACH_ART_MAX = 0.0125
const coachReferencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../reference/coach-art.png"
)

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
  mobileFirst,
  reduced,
  deep,
  reducedDeep,
  penSections,
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
      "hero-photo-in-first-view-1440",
      "At 1440x900 the H1 and 120px or more of the hero visual (an image or a [role=img] figure) share the first view",
      desktop.h1Bottom !== null &&
        desktop.h1Bottom <= desktop.vh &&
        visibleH >= 120,
      `h1 bottom ${px(desktop.h1Bottom)}px, frame visible ${px(visibleH)}px of ${img ? px(img.h) : 0} (390x844: ${px(mVisible)}px)`
    )
  )

  const names = ["product", "stories", "pricing"]
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
      "nav-links-before-fold-390",
      "At 390x844 Product, Stories and Pricing are visible as links without scrolling, in the page or in a menu the checker opens with one click",
      seen.length === names.length,
      `${seen.length} of ${names.length} visible without scrolling: ${seen.join(", ") || "none"} (${mobileOpen ? "menu opened" : "no menu button found"})`
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
      "hero-has-no-button",
      "The hero is the headline and the photo, with no button. The action is in the nav and the close",
      heroButtons.length === 0 && !(signIn && signIn.buttonLike),
      `${heroButtons.length} button(s) in hero: ${heroButtons.map((b) => `"${b.text}"`).join(", ") || "none"}`
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

  // App logos and customer portraits are named by app or person, not by a product surface.
  // A [role=img] figure has no file; its aria-label is the alt.
  const named = (i) =>
    /^\/landing\/(logo|story)-/.test(i.src ?? "")
      ? Boolean(i.alt)
      : (i.alt ?? "").length >= 20 &&
        /coach|paper|apply|proof|pitch|cv|letter/i.test(i.alt)
  const bad = desktop.imgs.filter(
    (i) => !(i.figure || i.src?.startsWith("/landing/")) || !named(i)
  )
  const figureCount = desktop.imgs.filter((i) => i.figure).length
  out.push(
    verdict(
      "19",
      "images-named-and-local",
      "Every marketing image is from /landing/ and its alt names Coach, Paper, Apply, Proof, Pitch, a CV or a letter (app logos and customer portraits need only an alt)",
      desktop.imgs.length > 0 && bad.length === 0,
      `${desktop.imgs.length} images (${figureCount} figures), ${bad.length} without a surface-naming alt${bad[0] ? `: ${bad[0].src ?? bad[0].alt}` : ""}`
    )
  )

  const describe = (list) =>
    list.length
      ? `${list.length} elements, e.g. ${list
          .slice(0, 2)
          .map(
            (a) =>
              `${a.region} "${a.text}" (${a.why.join("+")}${a.y === undefined ? "" : ` at ${px(a.y)}px`})`
          )
          .join("; ")}`
      : "none"
  const lead = first.animatedText.filter((a) => a.lead)
  // 2026-10-28, #491: the operator asked for the scroll text reveal. Text whose top is below the
  // first view of its run may start hidden and reveal on scroll; reduced motion settles it (21).
  const inFirstView = (snap) => snap.animatedText.filter((a) => a.y < snap.vh)
  const rest = [
    ...inFirstView(first).filter((a) => !a.lead),
    ...inFirstView(mobileFirst),
  ]
  const belowFold = first.animatedText.length - inFirstView(first).length
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
      "No other text inside the first view at 1440x900 or 390x844 starts hidden, blurred or animated. Text below the first view may play a one-time reveal on scroll (2026-10-28, #491); 21 requires it settled under reduced motion",
      rest.length === 0,
      `${describe(rest)}; ${belowFold} text element(s) below the 1440x900 first view reveal on scroll`
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
  // 2026-10-28, #491: the operator asked for the logo marquee. #logos may hold one marquee whose
  // duplicate copy is aria-hidden and which stops under reduced motion. Nothing else is exempt.
  const marquee = deep.marquee
  const marqueeOk =
    marquee.tracks === 1 &&
    marquee.copyHidden &&
    reducedDeep.marquee.tracks === 0
  const carousels = m.carousel.filter((c) => !(c.marquee && marqueeOk))
  const marqueeBad = marquee.tracks > 0 && !marqueeOk
  // NN/g 5.2
  out.push(
    verdict(
      "22",
      "no-video-or-carousel",
      "No video, audio, iframe, autoplay or carousel on the page, except one marquee in #logos whose duplicate copy is aria-hidden and which stops under reduced motion (2026-10-28, #491)",
      m.media.length + m.autoplay + carousels.length === 0 && !marqueeBad,
      `media=${m.media.join(",") || "none"} autoplay=${m.autoplay} carousel-like=${carousels.length}${carousels[0] ? ` ${JSON.stringify(carousels.slice(0, 2))}` : ""}; #logos marquee: ${marquee.tracks} track(s), duplicate aria-hidden=${marquee.copyHidden}, still running under reduced motion=${reducedDeep.marquee.tracks}`
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
  const smallPrimary = small.filter((t) => isSignUpLink(t))
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
  // width, height, fetchpriority and loading belong to <img>. A figure is DOM, so it needs a box
  // at first paint instead (its aspect ratio holds the space) and must not start at opacity 0.
  if (first.heroImg?.figure) {
    if (!(first.heroImg.w > 0 && first.heroImg.h > 0)) miss.push("box")
  } else {
    if (!hi?.width) miss.push("width")
    if (!hi?.height) miss.push("height")
    if (hi?.fetchpriority !== "high") miss.push("fetchpriority=high")
    if (hi?.loading === "lazy") miss.push("loading=lazy")
  }
  const invisible =
    first.heroImg?.startsInvisible || (first.heroImg?.opacity ?? 1) < 0.95
  // web.dev CLS and LCP
  out.push(
    verdict(
      "25",
      "hero-image-attrs-and-paint",
      "Hero image has width, height, fetchpriority=high, is not lazy, and does not start at opacity 0. A [role=img] hero figure instead has a non-zero box at first paint and does not start at opacity 0",
      miss.length === 0 && !invisible,
      `${first.heroImg?.figure ? "figure" : "img"} missing=${miss.join(",") || "none"}, starts invisible=${Boolean(invisible)} (opacity ${first.heroImg?.opacity})`
    )
  )

  const wide = (snap, label) =>
    snap.pageWidth > snap.viewWidth + 1
      ? `${label} scroll ${px(snap.pageWidth)} > view ${px(snap.viewWidth)}`
      : null
  const overflow = [wide(desktop, "1440"), wide(mobile, "390")].filter(Boolean)
  out.push(
    verdict(
      "26",
      "no-sideways-scroll",
      "The page does not scroll sideways at 1440 or 390",
      overflow.length === 0,
      overflow.join("; ") || "none"
    )
  )

  // 94 = paths + ellipses in the Benefits art frames UfIKe (11), PLjP0 (37) and oWS4Z (46).
  const art = desktop.benefitArt
  const artBoxes = art?.viewBoxes ?? []
  const artMatches =
    art?.count === 3 &&
    artBoxes.length === 3 &&
    artBoxes.every((box) => box === "0 0 300 300") &&
    art.shapes === 94 &&
    art.hex === 0 &&
    art.perCard?.length === 3 &&
    art.perCard.every((n) => n === 1)
  out.push(
    verdict(
      "27",
      "benefit-art-from-design",
      "Each of the three benefit cards contains one svg with viewBox 0 0 300 300, together they hold 94 paths and ellipses (the design art), and no element inside uses an inline hex colour",
      artMatches,
      `${art?.count ?? 0} svg (per card ${art?.perCard?.join("/") ?? "none"}), viewBox ${artBoxes.join(" | ") || "none"}, ${art?.shapes ?? 0} shapes, ${art?.hex ?? 0} hex`
    )
  )

  const lockup = desktop.navLockup
  const gap = lockup?.gap
  const lockupMatches =
    Boolean(lockup) &&
    gap >= 9 &&
    gap <= 13 &&
    lockup.fontSize === "16px" &&
    Number(lockup.fontWeight) === 600
  out.push(
    verdict(
      "28",
      "nav-lockup-spacing",
      "At 1440 the visible gap from the nav mark's right edge to the wordmark is 9 to 13 px (the mark box has 2 px of inner padding) and the wordmark is 16px at weight 600",
      lockupMatches,
      lockup
        ? `gap ${gap.toFixed(2)}px, font ${lockup.fontSize} weight ${lockup.fontWeight}`
        : "nav lockup not found"
    )
  )

  const near = (value, target) =>
    typeof value === "number" && Math.abs(value - target) <= 0.6
  const sized = (button, height, font, pad) =>
    Boolean(button) &&
    near(button.h, height) &&
    button.fontSize === font &&
    Number(button.fontWeight) === 500 &&
    near(button.padInline, pad)
  // A pill's computed radius is at least half the button height. 0.6 matches near().
  const pill = (button) =>
    Boolean(button) && button.radius + 0.6 >= button.h / 2
  const navCta = desktop.ctas?.nav
  const closeCta = desktop.ctas?.close
  const sampleCta = desktop.ctas?.sample
  const ctaMatches =
    sized(navCta, 32, "13px", 12) &&
    navCta.inset &&
    navCta.outer &&
    pill(navCta) &&
    sized(closeCta, 44, "16px", 20) &&
    closeCta.inset &&
    closeCta.outer &&
    pill(closeCta) &&
    sized(sampleCta, 44, "16px", 20) &&
    sampleCta.inset === false &&
    sampleCta.outer === false &&
    sampleCta.borderVisible === false &&
    pill(sampleCta)
  const fmtCta = (button) =>
    button
      ? `${button.h.toFixed(1)}px ${button.fontSize}/${button.fontWeight} pad ${button.padInline} r ${Number(button.radius).toFixed(1)} ${button.inset ? "inset" : "no-inset"} ${button.outer ? "outer" : "no-outer"} border ${button.borderVisible ? "yes" : "no"}`
      : "missing"
  out.push(
    verdict(
      "29",
      "cta-buttons-match-design",
      "At 1440 the nav Get started is 32px tall, 13px at weight 500, with 12px inline padding, an inset ring, an outer shadow, and a border-radius of at least half its height; the close Get started is 44px tall, 16px at weight 500, with 20px inline padding, an inset ring, an outer shadow, and a border-radius of at least half its height; See a sample is the same size with a border-radius of at least half its height, no inset ring, no outer shadow, and no visible border",
      ctaMatches,
      `nav ${fmtCta(navCta)}; close ${fmtCta(closeCta)}; sample ${fmtCta(sampleCta)}`
    )
  )

  const rasters = desktop.benefitRasters ?? []
  const coach = rasters.find(
    (item) => item.title === "A coach that does the work"
  )
  let artMatchesPen = false
  let artMeasured = "coach raster missing"
  if (!coach?.png) {
    artMeasured = coach?.error
      ? `coach raster failed: ${coach.error}`
      : `coach raster missing (${rasters.length} cards)`
  } else if (rasters.length < 3 || rasters.some((item) => !item.png)) {
    artMeasured = `rasterised ${rasters.filter((item) => item.png).length} of ${rasters.length} benefit svgs`
  } else {
    try {
      const diff = pngMismatch(
        decodeDataUrl(coach.png),
        decodePng(readFileSync(coachReferencePath)),
        COACH_ART_CHANNEL
      )
      artMatchesPen = diff.reason === "" && diff.ratio <= COACH_ART_MAX
      artMeasured = diff.reason
        ? diff.reason
        : `${(diff.ratio * 100).toFixed(2)}% of pixels differ by more than ${COACH_ART_CHANNEL} (limit ${(COACH_ART_MAX * 100).toFixed(2)}%), ${rasters.length} svgs rasterised`
    } catch (error) {
      artMeasured = `compare failed: ${error.message}`
    }
  }
  out.push(
    verdict(
      "30",
      "benefit-art-matches-pen",
      `Each benefit card's svg is rasterised in the page. The Coach art matches the pen.dev ground truth (reference/coach-art.png, cropped from a pen.dev screenshot): at most ${(COACH_ART_MAX * 100).toFixed(2)}% of pixels may differ by more than ${COACH_ART_CHANNEL} on any RGB channel. This catches a whole-art regression, not a single wrong mark`,
      artMatchesPen,
      artMeasured
    )
  )

  out.push(textStyleVerdict(penSections))
  return out
}
