// Checks 24 to 27: motion and live regions. 24, 25 and 26 read source, 27 reads a banner file, and each goes
// STALE when what it reads is missing or the Coach stub never fired.
import { join } from "node:path"
import { existsSync } from "node:fs"

import {
  SURFACES,
  appSourceDirs,
  list,
  paletteScan,
  read,
  rel,
  repo,
  result,
  scanProblem,
  sourceFiles,
  stale,
  stubSilent,
} from "./check-util.mjs"

const BANNER = "apps/web/src/features/paper/paper-editor-conflict-banner.tsx"

export function motionChecks(d, { allSnaps, screens }, dirs = appSourceDirs()) {
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
    why24
      ? stale("24", "motion-tokens", why24, rule24)
      : result(
          "24",
          "motion-tokens",
          Object.keys(dur).length === 0 && srcMotion.length === 0,
          `computed off-token durations: ${
            Object.entries(dur)
              .map(([k, n]) => `${k} x${n}`)
              .join(", ") || "none"
          }${examples[0] ? ` e.g. ${examples[0].t}.${examples[0].c.slice(0, 40)}` : ""}; in feature source: ${list([...new Set(srcMotion)], 3) || "none"}`,
          rule24
        )
  )

  const reducedBad = Object.entries(d.reduced).flatMap(([k, s]) => [
    ...Object.keys(s.durations)
      .filter((v) => parseFloat(v) > 1)
      .map((v) => `${k}:${v}`),
    ...(s.runningAnimations ? [`${k}:${s.runningAnimations} running`] : []),
    ...(s.scrollBehavior.includes("smooth") ? [`${k}:smooth scroll`] : []),
  ])
  const palette = paletteScan()
  const rule25 =
    "with prefers-reduced-motion nothing runs over 1ms, scroll is not smooth, and the command palette open transition uses the panel duration token (source read)"
  const why25 = scanProblem(palette.scan)
  r.push(
    why25
      ? stale("25", "reduced-motion", why25, rule25)
      : result(
          "25",
          "reduced-motion",
          reducedBad.length === 0 && palette.uses,
          `with reduce: ${reducedBad.length ? list(reducedBad) : "no motion over 1ms"}; palette panel duration: ${palette.uses}`,
          rule25
        )
  )

  const reveal = appScan.files.filter((f) =>
    /text-reveal|TextReveal/.test(read(f))
  )
  const rule26 = "no app screen imports text-reveal (source read)"
  r.push(
    why24
      ? stale("26", "no-text-reveal", why24, rule26)
      : result(
          "26",
          "no-text-reveal",
          reveal.length === 0,
          reveal.length ? list(reveal.map(rel)) : "no import",
          rule26
        )
  )

  const rule27 =
    "the Coach error and the Paper conflict banner expose a live region role"
  const why27 =
    stubSilent(d.coachError) ??
    (existsSync(join(repo, BANNER)) ? null : `source file missing: ${BANNER}`)
  if (why27) {
    r.push(stale("27", "alerts-have-role", why27, rule27))
    return r
  }
  const bannerRole = /role="alert"/.test(read(join(repo, BANNER)))
  const errText = d.coachError.alerts.some((t) =>
    /not found|Retry|wrong|unavailable|reach/i.test(t)
  )
  const red = SURFACES.flatMap((k) => screens[k].redOutsideAlert)
  r.push(
    result(
      "27",
      "alerts-have-role",
      errText && red.length === 0 && bannerRole,
      `Coach error inside a live region: ${errText}; red text outside one: ${red.length ? list(red, 2) : "none"}; conflict banner role=alert: ${bannerRole}`,
      rule27
    )
  )
  return r
}
