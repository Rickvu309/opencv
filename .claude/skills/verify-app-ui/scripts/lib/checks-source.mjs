// Checks 24 to 27: motion and live regions. Each judges every part it could find; a missing source folder, banner
// file or silent Coach stub makes only that part unjudged, so a found FAIL still FAILs and otherwise the check is STALE.
import { join } from "node:path"
import { existsSync } from "node:fs"

import { SOURCE_FILES } from "./assumes.mjs"
import {
  SURFACES,
  appSourceDirs,
  judged,
  list,
  paletteScan,
  read,
  rel,
  repo,
  scanProblem,
  sourceFiles,
  stubSilent,
} from "./check-util.mjs"

const BANNER = SOURCE_FILES.conflictBanner

export function motionChecks(
  d,
  { allSnaps, screens },
  { dirs = appSourceDirs(), paletteDir, banner = BANNER } = {}
) {
  const r = []
  const appScan = sourceFiles(dirs)
  const dur = {}
  for (const s of allSnaps)
    for (const [k, n] of Object.entries(s.durations))
      if (!["150ms", "280ms"].includes(k)) dur[k] = (dur[k] ?? 0) + n
  const examples = allSnaps
    .flatMap((s) => s.durationSamples)
    .filter((x) => !["150ms", "280ms"].includes(x.k))
  const srcMotion = []
  for (const f of appScan.files) {
    for (const m of read(f).matchAll(
      /\bduration-(\d+|fast|slow)\b|\bduration-\[(\d+)ms\]|\b(\d+)ms\b/g
    )) {
      const ms =
        m[1] === "fast"
          ? 100
          : m[1] === "slow"
            ? 200
            : Number(m[1] ?? m[2] ?? m[3])
      if (![0, 150, 280].includes(ms))
        srcMotion.push(`${rel(f).split("/").pop()}: ${m[0]}`)
    }
  }
  const rule24 =
    "every transition and animation runs 150ms or 280ms, measured on the toured screens and as duration-N classes or Nms values in the signed-in feature folders and routes (looping spinners and skeletons skipped)"
  const why24 = scanProblem(appScan)
  r.push(
    judged(
      "24",
      "motion-tokens",
      rule24,
      Object.keys(dur).length === 0 && srcMotion.length === 0,
      `computed off-token durations: ${
        Object.entries(dur)
          .map(([k, n]) => `${k} x${n}`)
          .join(", ") || "none"
      }${examples[0] ? ` e.g. ${examples[0].t}.${examples[0].c.slice(0, 40)}` : ""}; in feature source: ${list([...new Set(srcMotion)], 3) || "none"}`,
      [why24 && `source scan (${why24})`]
    )
  )

  const reducedBad = Object.entries(d.reduced).flatMap(([k, s]) => [
    ...Object.keys(s.durations)
      .filter((v) => parseFloat(v) > 1)
      .map((v) => `${k}:${v}`),
    ...(s.runningAnimations ? [`${k}:${s.runningAnimations} running`] : []),
    ...(s.scrollBehavior.includes("smooth") ? [`${k}:smooth scroll`] : []),
  ])
  const palette = paletteScan(paletteDir)
  const why25 = scanProblem(palette.scan)
  r.push(
    judged(
      "25",
      "reduced-motion",
      "with prefers-reduced-motion nothing runs over 1ms, scroll is not smooth, and the command palette open transition uses the panel duration token (source read)",
      reducedBad.length === 0 && (why25 !== null || palette.uses),
      `with reduce: ${reducedBad.length ? list(reducedBad) : "no motion over 1ms"}; palette panel duration: ${why25 ? "not read" : palette.uses}`,
      [why25 && `palette source scan (${why25})`]
    )
  )

  const reveal = appScan.files.filter((f) =>
    /text-reveal|TextReveal/.test(read(f))
  )
  r.push(
    judged(
      "26",
      "no-text-reveal",
      "no app screen imports text-reveal (source read)",
      reveal.length === 0,
      reveal.length ? list(reveal.map(rel)) : "no import",
      [why24 && `source scan (${why24})`]
    )
  )

  const bannerFile = existsSync(join(repo, banner))
  const bannerRole = bannerFile && /role="alert"/.test(read(join(repo, banner)))
  const coachQuiet = stubSilent(d.coachError)
  const errText = d.coachError.alerts.some((t) =>
    /not found|Retry|wrong|unavailable|reach/i.test(t)
  )
  const red = SURFACES.flatMap((k) => screens[k].redOutsideAlert)
  r.push(
    judged(
      "27",
      "alerts-have-role",
      "the Coach error and the Paper conflict banner expose a live region role",
      (coachQuiet !== null || errText) &&
        red.length === 0 &&
        (!bannerFile || bannerRole),
      `Coach error inside a live region: ${coachQuiet ? "not judged" : errText}; red text outside one: ${red.length ? list(red, 2) : "none"}; conflict banner role=alert: ${bannerFile ? bannerRole : "not read"}`,
      [
        coachQuiet && `Coach error (${coachQuiet})`,
        !bannerFile && `conflict banner (source file missing: ${banner})`,
      ]
    )
  )
  return r
}
