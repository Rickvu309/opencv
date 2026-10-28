// Checks 27 to 30: the benefit art, the nav lockup and the call-to-action buttons against the pen. 27 and 30
// go STALE only when #benefits is missing (a benefit card without its art is a FAIL). 28 is STALE when the
// lockup is not found. 29 judges every CTA it found and names the others as not judged.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { decodeDataUrl, decodePng, pngMismatch } from "./art-diff.mjs"
import { judged, staleIf, verdict } from "./verdict.mjs"

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

export function designChecks(desktop) {
  const out = []

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
    staleIf(
      art?.section ? null : "no #benefits section on the page",
      verdict(
        "27",
        "benefit-art-from-design",
        "Each of the three benefit cards contains one svg with viewBox 0 0 300 300, together they hold 94 paths and ellipses (the design art), and no element inside uses an inline hex colour",
        artMatches,
        `${art?.count ?? 0} svg (per card ${art?.perCard?.join("/") ?? "none"}), viewBox ${artBoxes.join(" | ") || "none"}, ${art?.shapes ?? 0} shapes, ${art?.hex ?? 0} hex`
      )
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
    staleIf(
      lockup ? null : "no nav mark and wordmark matched in the header",
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
    (!navCta ||
      (sized(navCta, 32, "13px", 12) &&
        navCta.inset &&
        navCta.outer &&
        pill(navCta))) &&
    (!closeCta ||
      (sized(closeCta, 44, "16px", 20) &&
        closeCta.inset &&
        closeCta.outer &&
        pill(closeCta))) &&
    (!sampleCta ||
      (sized(sampleCta, 44, "16px", 20) &&
        sampleCta.inset === false &&
        sampleCta.outer === false &&
        sampleCta.borderVisible === false &&
        pill(sampleCta)))
  const missingCtas = [
    navCta ? null : "Get started in the header",
    closeCta ? null : "Get started in #close",
    sampleCta ? null : "See a sample in #close",
  ].filter(Boolean)
  const fmtCta = (button) =>
    button
      ? `${button.h.toFixed(1)}px ${button.fontSize}/${button.fontWeight} pad ${button.padInline} r ${Number(button.radius).toFixed(1)} ${button.inset ? "inset" : "no-inset"} ${button.outer ? "outer" : "no-outer"} border ${button.borderVisible ? "yes" : "no"}`
      : "missing"
  out.push(
    judged(
      "29",
      "cta-buttons-match-design",
      "At 1440 the nav Get started is 32px tall, 13px at weight 500, with 12px inline padding, an inset ring, an outer shadow, and a border-radius of at least half its height; the close Get started is 44px tall, 16px at weight 500, with 20px inline padding, an inset ring, an outer shadow, and a border-radius of at least half its height; See a sample is the same size with a border-radius of at least half its height, no inset ring, no outer shadow, and no visible border",
      ctaMatches,
      `nav ${fmtCta(navCta)}; close ${fmtCta(closeCta)}; sample ${fmtCta(sampleCta)}`,
      missingCtas.map((name) => `no button matched ${name}`)
    )
  )

  const rasters = desktop.benefitRasters ?? []
  const COACH_TITLE = "A coach that does the work"
  const coach = rasters.find((item) => item.title === COACH_TITLE)
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
    staleIf(
      art?.section ? null : "no #benefits section on the page",
      verdict(
        "30",
        "benefit-art-matches-pen",
        `Each benefit card's svg is rasterised in the page. The Coach art matches the pen.dev ground truth (reference/coach-art.png, cropped from a pen.dev screenshot): at most ${(COACH_ART_MAX * 100).toFixed(2)}% of pixels may differ by more than ${COACH_ART_CHANNEL} on any RGB channel. This catches a whole-art regression, not a single wrong mark`,
        artMatchesPen,
        artMeasured
      )
    )
  )
  return out
}
