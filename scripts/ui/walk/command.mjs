import { mkdirSync } from "node:fs"
import { join } from "node:path"

import { UsageError } from "../args.mjs"
import { liveState, serveProductionWeb } from "../stack.mjs"
import { accountSource } from "../sweep/accounts.mjs"
import { SURFACES, browserPerson, keystrokeTiming } from "./browser-person.mjs"
import { LAB_ROUTE } from "./lab-surface.mjs"
import { ROWS } from "./rows.mjs"
import { unknownPins, walkRows, walkSummary } from "./run.mjs"

export const WALKS = { paper: { route: "/paper", rows: ROWS } }
export const EXPECTED_FAILURES = "scripts/ui/walk/expected-failures.json"

export function pickRows(rows, ids) {
  if (ids.length === 0) return rows
  const missing = ids.filter((id) => !rows.some((row) => row.id === id))
  if (missing.length)
    throw new UsageError(
      `unknown row ${missing.join(", ")}; rows are ${rows.map((row) => row.id).join(", ")}`
    )
  return rows.filter((row) => ids.includes(row.id))
}

export const WALK_COMMAND = {
  usage:
    "walk paper [--route /paper|/paper-lab] [--row id...] [--production] [--no-keystrokes]",
  about:
    "Use the Paper page like a person with real keys, mouse and clipboard: one line per row (pass, fail, expected-fail pinned in scripts/ui/walk/expected-failures.json, now-passes), then keystroke time on a 3-page CV. --production swaps the dev web for a production build first. Writes walk/<name>.json.",
  options: {
    valued: ["route"],
    repeated: ["row"],
    switches: ["production", "no-keystrokes"],
  },
  run: async (ctx, { positional, flags }) => {
    const [name] = positional
    const walk = WALKS[name]
    if (!walk)
      throw new UsageError(
        `walk takes ${Object.keys(WALKS).join(", ")}, got ${name ?? "nothing"}`
      )
    const rows = pickRows(walk.rows, flags.row ?? [])
    const route = flags.route ?? walk.route
    const surface = route === LAB_ROUTE ? SURFACES.lab : SURFACES.paper
    const pins = JSON.parse(ctx.fs.read(join(ctx.repo, EXPECTED_FAILURES)))
    const expected = pins
    const stale = unknownPins(walk.rows, pins)
    if (stale.length)
      throw new UsageError(
        `${EXPECTED_FAILURES} pins rows that do not exist: ${stale.join(", ")}`
      )
    let state = await liveState(ctx)
    if (!state)
      throw new UsageError(
        "no running app for this worktree: run node scripts/ui.mjs up"
      )
    if (flags.production) state = await serveProductionWeb(ctx)
    const build = state.webBuild ?? "development"
    const say = ctx.say ?? ((line) => process.stderr.write(`${line}\n`))
    const shotsDir = join(state.dir, "walk", name)
    mkdirSync(shotsDir, { recursive: true })
    const browser = await ctx.browser.launch()
    let results
    let keystrokes = null
    try {
      const account = await accountSource("seeded", state).take(`walk ${name}`)
      const person = browserPerson({
        browser,
        state: { ...state, route },
        account,
        shotsDir,
        surface,
      })
      results = await walkRows({
        rows,
        person,
        expected,
        now: ctx.clock.now,
        say,
      })
      if (!flags["no-keystrokes"]) {
        keystrokes = await keystrokeTiming({
          browser,
          state,
          account,
          build,
          shotsDir,
          surface,
        })
        say(`keystrokes ${JSON.stringify(keystrokes)}`)
      }
    } finally {
      await browser.close()
    }
    const summary = walkSummary(results)
    const report = join(state.dir, "walk", `${name}.json`)
    ctx.fs.write(
      report,
      JSON.stringify(
        {
          walk: name,
          route: flags.route ?? walk.route,
          build,
          summary,
          rows: results,
          keystrokes,
        },
        null,
        2
      )
    )
    return {
      code: summary.ok ? 0 : 1,
      lines: [
        JSON.stringify({
          ...summary,
          build,
          keystrokes: keystrokes?.keydownToNextFrame ?? null,
          report,
        }),
      ],
    }
  },
}
