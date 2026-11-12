import { join, resolve } from "node:path"
import { UsageError, parseArgs, positiveIntegers } from "./args.mjs"
import { measure, openScreen, slotSelectors } from "./capture.mjs"
import {
  checkNotes,
  compareBoxes,
  compareRow,
  failed,
  renderTable,
  specimenRow,
} from "./compare.mjs"
import {
  DESIGN_MAP,
  SPECIMEN_WARNING,
  isSameBox,
  rowsForScreen,
} from "./design-map.mjs"
import { diffImages } from "./diff.mjs"
import {
  composedPlacement,
  findFrames,
  framePath,
  frameGeometry,
  indexPen,
  penPath,
} from "./pen.mjs"
import { SCREENS, pickScreens, shotName } from "./screens.mjs"
import { down, liveState, up } from "./stack.mjs"

const EXIT = { ok: 0, failed: 1, usage: 2 }
const FRAME_MATCH_LIMIT = 5
const json = (value) => JSON.stringify(value)

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

function loadPen(ctx, flag) {
  const found = penPath({
    flag,
    env: ctx.env,
    fallback: ctx.defaultPen,
    exists: ctx.fs.exists,
  })
  if (!found.path)
    throw new UsageError(
      `no pen file at ${found.missing.join(" or ")}. Fetch it with: ${found.fetch}`
    )
  return indexPen(JSON.parse(ctx.fs.read(found.path)))
}

async function withBrowser(ctx, work) {
  const browser = await ctx.browser.launch()
  try {
    return await work(browser)
  } finally {
    await browser.close()
  }
}

const unreachableLine = (screen) =>
  json({ screen: screen.id, unreachable: screen.unreachable })

export const COMMANDS = {
  up: {
    usage: "up [--port N]",
    about:
      "Start a throwaway app for this worktree (pglite, fake Coach, Word pages on) with a signed-in test account. Reuses a running one.",
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
  frame: {
    usage: "frame <id-or-name> [--pen file]",
    about:
      "Print a pen frame's geometry and its children. Never prints the whole file.",
    options: { valued: ["pen"] },
    run: async (ctx, { positional, flags }) => {
      const [query] = positional
      if (!query) throw new UsageError("name a frame id or name")
      const index = loadPen(ctx, flags.pen)
      const ids = findFrames(index, query)
      if (ids.length === 0)
        return { code: EXIT.failed, lines: [json({ frame: query, found: 0 })] }
      return {
        code: EXIT.ok,
        lines: [
          ...ids.slice(0, FRAME_MATCH_LIMIT).map((id) =>
            json({
              path: framePath(index, id),
              ...frameGeometry(index, id),
            })
          ),
          ...(ids.length > FRAME_MATCH_LIMIT
            ? [
                json({
                  frame: query,
                  found: ids.length,
                  shown: FRAME_MATCH_LIMIT,
                }),
              ]
            : []),
        ],
      }
    },
  },
  check: {
    usage: "check <screen...> [--tolerance 1] [--pen file]",
    about:
      "Compare rendered elements with their composed-screen pen frames, and same-box rows with another screen, through scripts/ui/design-map.mjs. Exit 1 on any mismatch.",
    options: { valued: ["tolerance", "pen"] },
    run: async (ctx, { positional, flags }) => {
      const screens = requireScreens(positional)
      const tolerance = Number(flags.tolerance ?? "1")
      if (!Number.isFinite(tolerance) || tolerance < 0)
        throw new UsageError("--tolerance takes a number of pixels")
      const plans = screens.map((screen) => ({
        screen,
        rows: rowsForScreen(DESIGN_MAP, screen.id),
      }))
      const unmapped = plans
        .filter((plan) => plan.rows.length === 0)
        .map((plan) => plan.screen.id)
      if (unmapped.length)
        throw new UsageError(
          `no design rows for ${unmapped.join(", ")}; add rows to scripts/ui/design-map.mjs`
        )
      const index = loadPen(ctx, flags.pen)
      const state = await requireStack(ctx)
      const lines = []
      let code = EXIT.ok
      await withBrowser(ctx, async (browser) => {
        for (const { screen, rows } of plans) {
          if (screen.unreachable) {
            lines.push(unreachableLine(screen))
            code = EXIT.failed
            continue
          }
          const measureOn = async (target, list) => {
            const { page, close } = await openScreen(browser, state, target, {
              width: 1440,
            })
            const measured = await measure(
              page,
              list.map((row) => ({ name: row.label, selector: row.selector }))
            )
            await close()
            return measured.map((result) => result.items[0] ?? null)
          }
          const rendered = await measureOn(screen, rows)
          const againstIds = [
            ...new Set(rows.filter(isSameBox).map((row) => row.against)),
          ]
          const baseline = new Map()
          for (const id of againstIds) {
            const [target] = requireScreens([id])
            if (target.unreachable)
              throw new UsageError(
                `${id} is unreachable: ${target.unreachable}`
              )
            const list = rows.filter((row) => row.against === id)
            const boxes = await measureOn(target, list)
            list.forEach((row, at) => baseline.set(row, boxes[at]))
          }
          const placements = new Map(
            rows
              .filter((row) => !isSameBox(row))
              .map((row) => [row, composedPlacement(index, row)])
          )
          const table = rows.flatMap((row, at) => {
            if (isSameBox(row))
              return compareBoxes({
                label: `${row.label} vs ${row.against}`,
                before: baseline.get(row),
                after: rendered[at],
                props: row.props,
                tolerance,
              })
            const placement = placements.get(row)
            return [
              ...(placement.inScreen ? [] : [specimenRow(row)]),
              ...compareRow({
                label: row.label,
                design: frameGeometry(index, row.frame),
                rendered: rendered[at],
                props: row.props,
                tolerance,
              }),
            ]
          })
          const bad = failed(table)
          if (bad.length) code = EXIT.failed
          lines.push(
            `${screen.id} at 1440x900, tolerance ${tolerance}px`,
            ...renderTable(table),
            ...checkNotes({
              rows,
              failedLabels: new Set(bad.map((row) => row.label)),
              placements,
              warning: SPECIMEN_WARNING,
            })
          )
          lines.push(
            json({
              screen: screen.id,
              compared: table.length,
              failed: bad.length,
            })
          )
        }
      })
      return { code, lines }
    },
  },
  diff: {
    usage: "diff <before.png> <after.png> [--out file]",
    about:
      "Count differing pixels and write a diff image (changed pixels in red).",
    options: { valued: ["out"] },
    run: async (ctx, { positional, flags }) => {
      const [before, after] = positional
      if (!before || !after)
        throw new UsageError("give a before and an after PNG")
      const dataUrl = (path) =>
        `data:image/png;base64,${ctx.fs.readBytes(path).toString("base64")}`
      const result = await withBrowser(ctx, (browser) =>
        diffImages(browser, dataUrl(before), dataUrl(after))
      )
      const out = resolve(
        flags.out ?? after.replace(/\.png$/i, "") + ".diff.png"
      )
      ctx.fs.write(out, Buffer.from(result.png, "base64"))
      return {
        code: result.different === 0 ? EXIT.ok : EXIT.failed,
        lines: [
          json({
            before: result.before,
            after: result.after,
            different: result.different,
            total: result.total,
            diff: out,
          }),
        ],
      }
    },
  },
}

export function renderHelp() {
  return [
    "ui: see any app screen in a known state and check it against the pen design.",
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
