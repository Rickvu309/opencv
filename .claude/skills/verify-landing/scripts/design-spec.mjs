#!/usr/bin/env node
// design-spec record: measures the landing at 1440x900 with the checker's own probes and writes the spec the
// design checks (27 to 30) read.
//   node scripts/design-spec.mjs record --from-app <origin> [--out <path>] [--reference]
// It records whatever the app renders, so look at the screenshots first (VERIFY_LANDING_SHOTS) and review the diff.
// Measured: the art shape counts and viewBox (27), the nav gap and wordmark type (28), each button's height, type,
// padding, shadows and pill radius (29). Carried from the committed spec because no page measurement can state them:
// the locators (button labels and scopes, the Coach card title, the mark inset, the raster size) and the tolerances
// (the gap band, the CTA tolerance, the art channel delta and pixel ratio). The art ratio 1.25% sits between the
// corrected art (1.05%) and the old centre-rotated art (1.47%). --reference also writes the Coach art raster to the
// spec's reference image, which makes the current picture the baseline.
import { mkdirSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { parseArgs } from "node:util"

import { launchBrowser } from "./lib/cdp.mjs"
import { FILES } from "./lib/assumes.mjs"
import { designProbeSource } from "./lib/design-probe.mjs"
import { probeSource } from "./lib/probe.mjs"
import { loadSpec, repo } from "./lib/spec.mjs"

const GAP_BAND = 2
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function recordSpec(prior, measured) {
  const { benefitArt: art, navLockup: lockup, ctas } = measured
  const same = (values, what) => {
    if (new Set(values).size !== 1)
      throw new Error(`${what} differ across the page: ${values.join(" | ")}`)
    return values[0]
  }
  if (!art.section || art.count === 0) throw new Error("no benefit art found")
  if (!lockup) throw new Error("no nav mark and wordmark found")
  const gap = Math.round(lockup.gap)
  const buttons = Object.fromEntries(
    Object.entries(prior["29"].buttons).map(([key, was]) => {
      const b = ctas[key]
      if (!b) throw new Error(`no ${key} button "${was.label}" found`)
      const next = {
        scope: was.scope,
        label: was.label,
        height: Math.round(b.h),
        fontSize: parseFloat(b.fontSize),
        padInline: Math.round(b.padInline),
        inset: b.inset,
        outer: b.outer,
      }
      if ("borderVisible" in was) next.borderVisible = b.borderVisible
      next.pill = b.radius + prior["29"].tolerance >= b.h / 2
      return [key, next]
    })
  )
  return {
    27: {
      viewBox: same(art.viewBoxes, "benefit viewBoxes"),
      cards: art.count,
      shapes: art.shapes,
      inlineHex: art.hex,
    },
    28: {
      gapMin: gap - GAP_BAND,
      gapMax: gap + GAP_BAND,
      fontSize: parseFloat(lockup.fontSize),
      fontWeight: Number(lockup.fontWeight),
      markInset: prior["28"].markInset,
    },
    29: {
      tolerance: prior["29"].tolerance,
      fontWeight: Number(
        same(
          Object.values(ctas)
            .filter(Boolean)
            .map((b) => b.fontWeight),
          "button font weights"
        )
      ),
      buttons,
    },
    30: { ...prior["30"] },
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      "from-app": { type: "string" },
      out: { type: "string" },
      reference: { type: "boolean", default: false },
    },
  })
  if (process.argv[2] !== "record" || !values["from-app"])
    throw new Error(
      "usage: design-spec.mjs record --from-app <origin> [--out <path>] [--reference]"
    )
  const prior = loadSpec()
  const browser = await launchBrowser()
  try {
    const page = await browser.openPage({
      width: 1440,
      height: 900,
      mobile: false,
      reducedMotion: false,
      url: `${values["from-app"].replace(/\/$/, "")}/`,
    })
    try {
      await page.evaluate(probeSource("first"))
      await sleep(1500)
      const measured = await page.evaluate(designProbeSource(prior))
      const spec = recordSpec(prior, measured)
      const out = values.out ?? join(repo, FILES.spec)
      writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`)
      console.log(`wrote ${out}`)
      if (values.reference) {
        const coach = measured.benefitRasters.find(
          (item) => item.title === spec["30"].title
        )
        if (!coach?.png)
          throw new Error(`no raster for the "${spec["30"].title}" card`)
        const ref = join(repo, spec["30"].reference)
        mkdirSync(dirname(ref), { recursive: true })
        writeFileSync(ref, Buffer.from(coach.png.split(",")[1], "base64"))
        console.log(`wrote ${ref}`)
      }
    } finally {
      await page.close()
    }
  } finally {
    await browser.quit()
  }
}

if (basename(process.argv[1]) === "design-spec.mjs") {
  main().catch((error) => {
    console.error(`design-spec error: ${error.message}`)
    process.exit(2)
  })
}
