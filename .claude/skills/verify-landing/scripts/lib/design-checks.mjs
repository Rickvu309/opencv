// Checks 27 to 30: the benefit art, the nav lockup and the call-to-action buttons against the pen. Every number
// they hold lives in landing.spec.json (scripts/design-spec.mjs records it from the app). 27 and 30 go STALE only
// when #benefits is missing (a benefit card without its art is a FAIL). 28 is STALE when the lockup is not found.
// 29 judges every CTA it found and names the others as not judged.
import { decodeDataUrl, decodePng, pngMismatch } from "./art-diff.mjs"
import { readDesignFile } from "./spec.mjs"
import { judged, staleIf, verdict } from "./verdict.mjs"

export function designChecks(desktop, spec) {
  const out = []

  const s27 = spec["27"]
  const art = desktop.benefitArt
  const artBoxes = art?.viewBoxes ?? []
  const artMatches =
    art?.count === s27.cards &&
    artBoxes.length === s27.cards &&
    artBoxes.every((box) => box === s27.viewBox) &&
    art.shapes === s27.shapes &&
    art.hex === s27.inlineHex &&
    art.perCard?.length === s27.cards &&
    art.perCard.every((n) => n === 1)
  out.push(
    staleIf(
      art?.section ? null : "no #benefits section on the page",
      verdict(
        "27",
        "benefit-art-from-design",
        `Each of the ${s27.cards} benefit cards contains one svg with viewBox ${s27.viewBox}, together they hold ${s27.shapes} paths and ellipses (the design art), and no element inside uses an inline hex colour`,
        artMatches,
        `${art?.count ?? 0} svg (per card ${art?.perCard?.join("/") ?? "none"}), viewBox ${artBoxes.join(" | ") || "none"}, ${art?.shapes ?? 0} shapes, ${art?.hex ?? 0} hex`
      )
    )
  )

  const s28 = spec["28"]
  const lockup = desktop.navLockup
  const gap = lockup?.gap
  const lockupMatches =
    Boolean(lockup) &&
    gap >= s28.gapMin &&
    gap <= s28.gapMax &&
    lockup.fontSize === `${s28.fontSize}px` &&
    Number(lockup.fontWeight) === s28.fontWeight
  out.push(
    staleIf(
      lockup ? null : "no nav mark and wordmark matched in the header",
      verdict(
        "28",
        "nav-lockup-spacing",
        `At 1440 the visible gap from the nav mark's right edge to the wordmark is ${s28.gapMin} to ${s28.gapMax} px (the mark box has ${s28.markInset} px of inner padding) and the wordmark is ${s28.fontSize}px at weight ${s28.fontWeight}`,
        lockupMatches,
        lockup
          ? `gap ${gap.toFixed(2)}px, font ${lockup.fontSize} weight ${lockup.fontWeight}`
          : "nav lockup not found"
      )
    )
  )

  const s29 = spec["29"]
  const near = (value, target) =>
    typeof value === "number" && Math.abs(value - target) <= s29.tolerance
  // A pill's computed radius is at least half the button height.
  const pill = (button) => button.radius + s29.tolerance >= button.h / 2
  const matches = (button, want) =>
    near(button.h, want.height) &&
    button.fontSize === `${want.fontSize}px` &&
    Number(button.fontWeight) === s29.fontWeight &&
    near(button.padInline, want.padInline) &&
    button.inset === want.inset &&
    button.outer === want.outer &&
    (want.borderVisible === undefined ||
      button.borderVisible === want.borderVisible) &&
    (!want.pill || pill(button))
  const wanted = Object.entries(s29.buttons)
  const found = (key) => desktop.ctas?.[key]
  const ctaMatches = wanted.every(
    ([key, want]) => !found(key) || matches(found(key), want)
  )
  const missingCtas = wanted
    .filter(([key]) => !found(key))
    .map(([, want]) => `${want.label} in ${want.scope}`)
  const fmtCta = (button) =>
    button
      ? `${button.h.toFixed(1)}px ${button.fontSize}/${button.fontWeight} pad ${button.padInline} r ${Number(button.radius).toFixed(1)} ${button.inset ? "inset" : "no-inset"} ${button.outer ? "outer" : "no-outer"} border ${button.borderVisible ? "yes" : "no"}`
      : "missing"
  const describe = ([key, want]) =>
    `${key} "${want.label}" ${want.height}px, ${want.fontSize}px at weight ${s29.fontWeight}, ${want.padInline}px inline padding, ${want.inset ? "an" : "no"} inset ring, ${want.outer ? "an" : "no"} outer shadow${want.borderVisible === false ? ", no visible border" : ""}${want.pill ? ", a border-radius of at least half its height" : ""}`
  out.push(
    judged(
      "29",
      "cta-buttons-match-design",
      `At 1440 each call-to-action matches the design: ${wanted.map(describe).join("; ")}`,
      ctaMatches,
      wanted.map(([key]) => `${key} ${fmtCta(found(key))}`).join("; "),
      missingCtas.map((name) => `no button matched ${name}`)
    )
  )

  const s30 = spec["30"]
  const rasters = desktop.benefitRasters ?? []
  const coach = rasters.find((item) => item.title === s30.title)
  let artMatchesPen = false
  let artMeasured = "coach raster missing"
  if (!coach?.png) {
    artMeasured = coach?.error
      ? `coach raster failed: ${coach.error}`
      : `coach raster missing (${rasters.length} cards)`
  } else if (rasters.length < s27.cards || rasters.some((item) => !item.png)) {
    artMeasured = `rasterised ${rasters.filter((item) => item.png).length} of ${rasters.length} benefit svgs`
  } else {
    try {
      const diff = pngMismatch(
        decodeDataUrl(coach.png),
        decodePng(readDesignFile(s30.reference)),
        s30.channelDelta
      )
      artMatchesPen = diff.reason === "" && diff.ratio <= s30.maxRatio
      artMeasured = diff.reason
        ? diff.reason
        : `${(diff.ratio * 100).toFixed(2)}% of pixels differ by more than ${s30.channelDelta} (limit ${(s30.maxRatio * 100).toFixed(2)}%), ${rasters.length} svgs rasterised`
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
        `Each benefit card's svg is rasterised in the page. The Coach art matches the reference image (${s30.reference}): at most ${(s30.maxRatio * 100).toFixed(2)}% of pixels may differ by more than ${s30.channelDelta} on any RGB channel. This catches a whole-art regression, not a single wrong mark`,
        artMatchesPen,
        artMeasured
      )
    )
  )
  return out
}
