#!/usr/bin/env node
import { writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { parseArgs } from "node:util"

import { launchBrowser } from "./lib/cdp.mjs"
import { FILES } from "./lib/assumes.mjs"
import {
  decodeDataUrl,
  decodePng,
  fractionOfPixelsOverDelta,
} from "./lib/art-diff.mjs"
import { designProbeSource } from "./lib/design-probe.mjs"
import { probeSource } from "./lib/probe.mjs"
import { loadSpec, readDesignFile, repo } from "./lib/spec.mjs"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const outside = (what, value, low, high, unit = "") =>
  `${what} ${value}${unit} is outside the committed ${low} to ${high}${unit}`

export function outsideToleranceProblems(prior, measured) {
  const { navLockup: lockup, ctas } = measured
  const problems = []
  const s28 = prior["28"]
  if (lockup && !(lockup.gap >= s28.gapMin && lockup.gap <= s28.gapMax))
    problems.push(
      outside("28 nav gap", lockup.gap.toFixed(2), s28.gapMin, s28.gapMax, "px")
    )
  const tol = prior["29"].tolerance
  for (const [key, was] of Object.entries(prior["29"].buttons)) {
    const b = ctas[key]
    if (!b) continue
    for (const [field, now] of [
      ["height", b.h],
      ["padInline", b.padInline],
    ]) {
      if (
        Math.abs(now - was[field]) > tol ||
        Math.abs(Math.round(now) - was[field]) > tol
      )
        problems.push(
          outside(
            `29 ${key} ${field}`,
            now.toFixed(2),
            was[field] - tol,
            was[field] + tol,
            "px"
          )
        )
    }
  }
  return problems
}

export function artProblem(prior, measured, readReference = readDesignFile) {
  const s30 = prior["30"]
  const coach = (measured.benefitRasters ?? []).find(
    (item) => item.title === s30.title
  )
  if (!coach?.png) return `30 no raster for the "${s30.title}" card`
  const diff = fractionOfPixelsOverDelta(
    decodeDataUrl(coach.png),
    decodePng(readReference(s30.reference)),
    s30.channelDelta
  )
  if (diff.reason) return `30 ${diff.reason}`
  return diff.ratio <= s30.maxRatio
    ? null
    : `30 the Coach art differs from ${s30.reference} in ${(diff.ratio * 100).toFixed(2)}% of pixels, over the committed ${(s30.maxRatio * 100).toFixed(2)}%`
}

export function recordSpec(prior, measured) {
  const { benefitArt: art, navLockup: lockup, ctas } = measured
  const same = (values, what) => {
    if (new Set(values).size !== 1)
      throw new Error(`${what} differ across the page: ${values.join(" | ")}`)
    return values[0]
  }
  if (!art.section || art.count === 0) throw new Error("no benefit art found")
  if (!lockup) throw new Error("no nav mark and wordmark found")
  const buttons = Object.fromEntries(
    Object.entries(prior["29"].buttons).map(([key, was]) => {
      const b = ctas[key]
      if (!b) throw new Error(`no ${key} button "${was.label}" found`)
      return [
        key,
        {
          scope: was.scope,
          label: was.label,
          height: Math.round(b.h),
          fontSize: parseFloat(b.fontSize),
          padInline: Math.round(b.padInline),
          inset: b.inset,
          outer: b.outer,
          borderVisible: b.borderVisible,
          pill: b.radius + prior["29"].tolerance >= b.h / 2,
        },
      ]
    })
  )
  return {
    27: {
      viewBox: same(art.viewBoxes, "benefit viewBoxes"),
      cards: art.count,
      shapes: art.shapes,
    },
    28: {
      gapMin: prior["28"].gapMin,
      gapMax: prior["28"].gapMax,
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

const leaves = (value, path = []) =>
  value !== null && typeof value === "object"
    ? Object.entries(value).flatMap(([key, inner]) =>
        leaves(inner, [...path, key])
      )
    : [[path.join("."), value]]

export function diffLines(committed, recorded) {
  const before = new Map(leaves(committed))
  const after = new Map(leaves(recorded))
  const show = (value) => (value === undefined ? "none" : JSON.stringify(value))
  return [...new Set([...before.keys(), ...after.keys()])].map((key) =>
    before.get(key) === after.get(key)
      ? `${key}: unchanged`
      : `${key}: ${show(before.get(key))} -> ${show(after.get(key))}`
  )
}

export function recorderDecision(
  prior,
  measured,
  { accept = false, readReference } = {}
) {
  const spec = recordSpec(prior, measured)
  const problems = [
    ...outsideToleranceProblems(prior, measured),
    artProblem(prior, measured, readReference),
  ].filter(Boolean)
  const lines = diffLines(prior, spec)
  const differs = lines.some((line) => !line.endsWith(": unchanged"))
  if (!accept)
    return {
      lines: [...lines, ...problems.map((p) => `outside tolerance: ${p}`)],
      exit: differs || problems.length ? 1 : 0,
      write: null,
    }
  if (problems.length)
    return {
      lines: [
        ...lines,
        `refusing to record, the page is outside the committed tolerances (edit the spec by hand first):`,
        ...problems.map((p) => `  ${p}`),
      ],
      exit: 2,
      write: null,
    }
  return { lines, exit: 0, write: spec }
}

export function finish(decision, out, write = writeFileSync) {
  console.log(decision.lines.join("\n"))
  if (decision.write) {
    write(out, `${JSON.stringify(decision.write, null, 2)}\n`)
    console.log(`wrote ${out}`)
  }
  return decision.exit
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      "from-app": { type: "string" },
      accept: { type: "boolean" },
      out: { type: "string" },
    },
  })
  if (
    process.argv[2] !== "record" ||
    !values["from-app"] ||
    (values.out && !values.accept)
  )
    throw new Error(
      "usage: design-spec.mjs record --from-app <origin> [--accept [--out <path>]]"
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
      process.exitCode = finish(
        recorderDecision(prior, measured, { accept: values.accept }),
        values.out ?? join(repo, FILES.spec)
      )
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
