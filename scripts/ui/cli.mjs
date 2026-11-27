import { SWEEP_COMMAND } from "./sweep/command.mjs"
import { join, resolve } from "node:path"
import { UsageError, parseArgs, positiveIntegers } from "./args.mjs"
import { measure, openScreen, slotSelectors } from "./capture.mjs"
import { SCREENS, pickScreens, shotName } from "./screens.mjs"
import { down, liveState, up } from "./stack.mjs"

export const EXIT = Object.freeze({ ok: 0, failed: 1, usage: 2 })
export const json = (value) => JSON.stringify(value)

export async function withBrowser(ctx, work) {
  const browser = await ctx.browser.launch()
  try {
    return await work(browser)
  } finally {
    await browser.close()
  }
}

async function requireStack(ctx) {
  const state = await liveState(ctx)
  if (!state)
    throw new UsageError(
      "no running app for this worktree: run node scripts/ui.mjs up"
    )
  return state
}

function requireScreens(ids) {
  if (ids.length === 0)
    throw new UsageError(
      "name at least one screen; see node scripts/ui.mjs screens"
    )
  const { found, missing } = pickScreens(SCREENS, ids)
  if (missing.length)
    throw new UsageError(
      `unknown screen ${missing.join(", ")}; see node scripts/ui.mjs screens`
    )
  return found
}

const unreachableLine = (screen) =>
  json({ screen: screen.id, unreachable: screen.unreachable })

export const COMMANDS = {
  up: {
    usage: "up [--port N]",
    about:
      "Start a throwaway app for this worktree (pglite, fake Coach, fake mail) with a signed-in test account. Reuses a running one.",
    options: { valued: ["port"] },
    run: async (ctx, { flags }) => {
      const port = flags.port
        ? positiveIntegers([flags.port], "--port")[0]
        : undefined
      const { reused, state } = await up(ctx, { port })
      return {
        code: EXIT.ok,
        lines: [
          json({
            reused,
            web: state.webOrigin,
            api: state.apiOrigin,
            email: state.email,
            pool: state.pool?.dir,
            dir: state.dir,
          }),
        ],
      }
    },
  },
  down: {
    usage: "down",
    about: "Stop everything up started and delete its database.",
    run: async (ctx) => {
      const result = await down(ctx)
      return {
        code: EXIT.ok,
        lines: [
          json(
            result.stopped.length
              ? result
              : { stopped: [], note: "nothing running" }
          ),
        ],
      }
    },
  },
  screens: {
    usage: "screens",
    about:
      "List the named screens, their route and whether they can be reached.",
    run: async () => ({
      code: EXIT.ok,
      lines: SCREENS.map((screen) =>
        json({
          id: screen.id,
          route: screen.route,
          ...(screen.unreachable
            ? { unreachable: screen.unreachable }
            : { steps: screen.steps.length }),
        })
      ),
    }),
  },
  shot: {
    usage: "shot <screen...> [--width 1440,390] [--scale 1|2] [--out dir]",
    about:
      "Capture PNGs with fonts loaded and motion stopped. One JSON line per file.",
    options: { valued: ["out", "scale"], repeated: ["width"] },
    run: async (ctx, { positional, flags }) => {
      const screens = requireScreens(positional)
      const widths = positiveIntegers(flags.width ?? ["1440"], "--width")
      const scale = positiveIntegers([flags.scale ?? "1"], "--scale")[0]
      const state = await requireStack(ctx)
      const out = resolve(flags.out ?? join(state.dir, "shots"))
      ctx.fs.mkdir(out)
      const lines = []
      let code = EXIT.ok
      await withBrowser(ctx, async (browser) => {
        for (const screen of screens) {
          if (screen.unreachable) {
            lines.push(unreachableLine(screen))
            code = EXIT.failed
            continue
          }
          for (const width of widths) {
            const { page, close } = await openScreen(browser, state, screen, {
              width,
              scale,
            })
            const file = join(out, shotName(screen.id, width, scale))
            await page.screenshot({ path: file, fullPage: false })
            await close()
            lines.push(json({ screen: screen.id, width, scale, file }))
          }
        }
      })
      return { code, lines }
    },
  },
  measure: {
    usage:
      "measure <screen> [--slot name...] [--selector css...] [--width 1440]",
    about:
      "Print box, radius, padding, gap, type and colors for data-slot elements or selectors.",
    options: { valued: ["width"], repeated: ["slot", "selector"] },
    run: async (ctx, { positional, flags }) => {
      const [screen] = requireScreens(positional.slice(0, 1))
      if (screen.unreachable)
        return { code: EXIT.failed, lines: [unreachableLine(screen)] }
      const width = positiveIntegers([flags.width ?? "1440"], "--width")[0]
      const state = await requireStack(ctx)
      const targets = slotSelectors({
        slots: flags.slot,
        selectors: flags.selector,
      })
      const results = await withBrowser(ctx, async (browser) => {
        const { page, close } = await openScreen(browser, state, screen, {
          width,
        })
        const measured = await measure(page, targets)
        await close()
        return measured
      })
      return {
        code: EXIT.ok,
        lines: results.map((result) =>
          json({ screen: screen.id, width, ...result })
        ),
      }
    },
  },
  sweep: SWEEP_COMMAND,
}

export function renderHelp() {
  return [
    "ui: see any app screen in a known state, measure it and sweep it for fit and guideline problems.",
    "",
    "Usage: node scripts/ui.mjs <command>",
    "",
    ...Object.values(COMMANDS).flatMap((command) => [
      `  ${command.usage}`,
      `      ${command.about}`,
    ]),
    "",
    "Skill: .agents/skills/verify-ui/SKILL.md",
  ]
}

export async function runUi(argv, ctx) {
  const [name, ...rest] = argv
  if (!name || name === "help" || name === "--help")
    return { code: EXIT.ok, lines: renderHelp() }
  const command = COMMANDS[name]
  if (!command)
    return {
      code: EXIT.usage,
      lines: [`unknown command ${name}`, ...renderHelp()],
    }
  try {
    return await command.run(ctx, parseArgs(rest, command.options))
  } catch (error) {
    if (error instanceof UsageError)
      return { code: EXIT.usage, lines: [`ui ${name}: ${error.message}`] }
    return { code: EXIT.failed, lines: [`ui ${name} failed: ${error.message}`] }
  }
}
