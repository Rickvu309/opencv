import { join } from "node:path"

import { GRID, parseSize } from "../../../packages/ui/src/lib/viewport-grid.ts"
import { UsageError } from "../args.mjs"
import { SCREENS, pickScreens } from "../screens.mjs"
import { liveState } from "../stack.mjs"
import { ACCOUNT_SOURCES, accountSource } from "./accounts.mjs"
import { browserWorld } from "./browser-world.mjs"
import { hasShot, higFound, higLine, higSpec } from "./hig.mjs"
import { LOOP_FILES, coreLoop } from "./loop.mjs"
import { routeScreens, staticRoutes } from "./routes.mjs"
import { failureLine, summaryLine, sweepScreen } from "./runner.mjs"

const EXIT = { ok: 0, failed: 1 }
const MODES = ["screen", "all", "loop"]

export function sweepTargets({ mode, ids, routes, file }) {
  const recipes = SCREENS.filter((screen) => !screen.unreachable)
  const smokes = routeScreens(routes, SCREENS)
  const skipped = SCREENS.filter((screen) => screen.unreachable)
  if (mode === "loop") {
    if (file && !LOOP_FILES[file])
      throw new UsageError(
        `--file takes ${Object.keys(LOOP_FILES).join(" or ")}, got ${file}`
      )
    return {
      screens: [],
      skipped: [],
      files: file ? [file] : Object.keys(LOOP_FILES),
    }
  }
  if (mode === "all")
    return {
      screens: [...recipes, ...smokes],
      skipped,
      files: Object.keys(LOOP_FILES),
    }
  if (ids.length === 0)
    throw new UsageError(
      "name at least one screen; see node scripts/ui.mjs screens, or use sweep all"
    )
  const known = [...SCREENS, ...smokes]
  const { found, missing } = pickScreens(known, ids)
  if (missing.length)
    throw new UsageError(
      `unknown screen ${missing.join(", ")}; see node scripts/ui.mjs screens or a route:/path from sweep all`
    )
  return {
    screens: found.filter((screen) => !screen.unreachable),
    skipped: found.filter((screen) => screen.unreachable),
    files: [],
  }
}

export const SWEEP_COMMAND = {
  usage:
    "sweep screen <id...> | all | loop [--size WxH] [--file cv-formatted.docx|cv-text.pdf] [--accounts seeded|pooled]",
  about:
    "Open screens at ten window sizes and fail on a box that does not fit, a control that cannot be clicked, requests that do not settle, focus lost after Escape or a console error; report without failing the Apple interface guideline rules (contrast, 200% text, focus ring, reduced motion) at 1440 and 390 as HIG lines; loop runs the Paper core loop (import, open, type, Coach edit, approve, download Word).",
  options: { valued: ["size", "file", "accounts"] },
  run: async (ctx, { positional, flags }) => {
    const [mode, ...ids] = positional
    if (!MODES.includes(mode))
      throw new UsageError(
        `sweep takes ${MODES.join(", ")}, got ${mode ?? "nothing"}`
      )
    const routes = staticRoutes(
      ctx.fs.read(join(ctx.repo, "apps/web/src/router.tsx")),
      ctx.fs.read(join(ctx.repo, "apps/web/src/lib/product-paths.ts"))
    )
    const targets = sweepTargets({ mode, ids, routes, file: flags.file })
    const accountKind = flags.accounts ?? "seeded"
    if (!ACCOUNT_SOURCES.includes(accountKind))
      throw new UsageError(
        `--accounts takes ${ACCOUNT_SOURCES.join(" or ")}, got ${accountKind}`
      )
    const grid = flags.size ? [parseSize(flags.size)] : GRID
    const state = await liveState(ctx)
    if (!state)
      throw new UsageError(
        "no running app for this worktree: run node scripts/ui.mjs up"
      )
    const say = ctx.say ?? ((line) => process.stderr.write(`${line}\n`))
    const started = ctx.clock.now()
    const lines = targets.skipped.map(
      (screen) => `skip ${screen.id}: ${screen.unreachable}`
    )
    const cases = []
    const browser = await ctx.browser.launch()
    try {
      const world = browserWorld({
        browser,
        state,
        accounts: accountSource(accountKind, state),
        shotsDir: join(state.dir, "sweep"),
        now: ctx.clock.now,
      })
      for (const screen of targets.screens) {
        const found = await sweepScreen(world, screen, grid).catch((error) => [
          {
            screen: screen.id,
            size: "1440x900",
            ok: false,
            rule: "opens",
            problem: `does not open: ${error.message.split("\n")[0]}`,
            repro: `node scripts/ui.mjs sweep screen ${screen.id}`,
            ms: 0,
          },
        ])
        cases.push(...found)
        const higLines = higFound(found).map((item) => {
          if (!hasShot(item)) return higLine(item, null)
          const spec = join(
            state.dir,
            "sweep",
            "hig",
            `${item.screen}-${item.size}-${item.rule}.spec.json`
          )
          ctx.fs.write(spec, JSON.stringify(higSpec(item), null, 2))
          return higLine(item, spec)
        })
        const block = [
          summaryLine(screen.id, found),
          ...found.filter((item) => !item.ok).map(failureLine),
          ...higLines,
        ]
        block.forEach((line) => say(line))
        lines.push(...block)
      }
      for (const file of targets.files) {
        const result = await coreLoop(world, file)
        cases.push(result)
        const line = result.ok
          ? `loop ${file}: every step passed · ${Math.round(result.ms / 100) / 10} s`
          : failureLine(result)
        say(line)
        lines.push(line)
      }
    } finally {
      await browser.close()
    }
    const failed = cases.filter((item) => !item.ok)
    const report = join(state.dir, "sweep", "report.json")
    ctx.fs.write(report, JSON.stringify({ cases }, null, 2))
    lines.push(
      JSON.stringify({
        screens: targets.screens.length,
        loops: targets.files.length,
        cases: cases.length,
        failed: failed.length,
        higFindings: higFound(cases).reduce(
          (total, item) => total + item.findings.length,
          0
        ),
        seconds: Math.round((ctx.clock.now() - started) / 1000),
        report,
      })
    )
    return { code: failed.length ? EXIT.failed : EXIT.ok, lines }
  },
}
