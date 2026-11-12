import { dirname, join, relative, resolve } from "node:path"
import { UsageError, parseArgs, positiveIntegers } from "./args.mjs"
import {
  compareDir,
  manifestProblems,
  pruneBases,
  runCompare,
} from "./before-after.mjs"
import { measure, openScreen, slotSelectors } from "./capture.mjs"
import { baseChecker, checkScreen } from "./check-screen.mjs"
import { baseCheckFor, staleBaseLine } from "./known-drift.mjs"
import { mergeBaseWithMain, readManifest } from "./manifest-file.mjs"
import {
  screensToCheck,
  summarize,
  allScreenLines,
  totalLine,
} from "./check-all.mjs"
import { DESIGN_MAP, rowsForScreen } from "./design-map.mjs"
import { unmappedMessage } from "./shot-only.mjs"
import { CHANGES_PER_SCREEN, draftSpec, rankChanges } from "./changes.mjs"
import { compositeFiles, SPLIT_ABOVE } from "./annotate-split.mjs"
import { readSpec, renderComposite } from "./composite.mjs"
import { ZOOM } from "./zoom.mjs"
import { diffImages } from "./diff.mjs"
import {
  findFrames,
  framePath,
  frameGeometry,
  indexPen,
  penPath,
} from "./pen.mjs"
import {
  attachUrls,
  checkSummary,
  linksFromShot,
  picturesToUpload,
  renderPrSection,
} from "./pr-section.mjs"
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

function penOrNull(ctx, flag) {
  try {
    return loadPen(ctx, flag)
  } catch {
    return null
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
  "prune-bases": {
    usage: "prune-bases",
    about:
      "Delete base copies left by compare runs whose process has ended. Copies of a running compare stay.",
    run: async (ctx) => ({ code: EXIT.ok, lines: [json(pruneBases(ctx))] }),
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
    usage:
      "check <screen...> | --all [--json] [--tolerance 1] [--pen file] [--known manifest]",
    about:
      "Compare rendered elements with their composed-screen pen frames, and same-box rows with another screen, through scripts/ui/design-map.mjs. --all checks every reachable mapped screen and prints one line per screen and a total; --json prints one JSON result. --known reads the base results compare stored in its manifest and marks each failure new since main or already failing on main. Exit 1 on any mismatch.",
    options: {
      valued: ["tolerance", "pen", "known"],
      switches: ["all", "json"],
    },
    run: async (ctx, { positional, flags }) => {
      const started = ctx.clock.now()
      const mapped = screensToCheck(DESIGN_MAP, SCREENS)
      const screens = flags.all
        ? [...mapped.reachable, ...mapped.unreachable]
        : requireScreens(positional)
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
      if (unmapped.length) throw new UsageError(unmappedMessage(unmapped))
      const index = loadPen(ctx, flags.pen)
      const known = flags.known ? readManifest(ctx, flags.known).manifest : null
      const baseNotice = known
        ? staleBaseLine(known, mergeBaseWithMain(ctx))
        : null
      const notices = baseNotice ? [baseNotice] : []
      const state = await requireStack(ctx)
      const detail = [...notices]
      const outcomes = []
      await withBrowser(ctx, async (browser) => {
        for (const { screen, rows } of plans) {
          if (screen.unreachable) {
            detail.push(unreachableLine(screen))
            outcomes.push({
              result: { screen: screen.id, error: "unreachable" },
            })
            continue
          }
          try {
            const outcome = await checkScreen({
              browser,
              state,
              index,
              screen,
              rows,
              tolerance,
              onMain: known ? baseCheckFor(known, screen.id) : undefined,
            })
            detail.push(...outcome.lines)
            outcomes.push(outcome)
          } catch (error) {
            const message = error.message.split("\n")[0]
            detail.push(json({ screen: screen.id, error: message }))
            outcomes.push({ result: { screen: screen.id, error: message } })
          }
        }
      })
      const results = outcomes.map((outcome) => outcome.result)
      const total = summarize(
        results,
        Math.round((ctx.clock.now() - started) / 1000)
      )
      const code = total.ok ? EXIT.ok : EXIT.failed
      if (flags.json)
        return {
          code,
          lines: [
            json({ ...total, results, ...(baseNotice ? { baseNotice } : {}) }),
          ],
        }
      if (!flags.all) return { code, lines: detail }
      return {
        code,
        lines: [...notices, ...allScreenLines(outcomes), totalLine(total)],
      }
    },
  },
  compare: {
    usage:
      "compare <screen...> [--base main] [--width 1440,390] [--out dir] [--selector css...] [--pen file]",
    about:
      "Capture each screen from a throwaway checkout of the base and from this worktree, same viewport and steps. Writes <screen>-<width>.before.png, .after.png and manifest.json with every data-slot box and style, and the check result of every mapped screen on the base for check --known.",
    options: {
      valued: ["base", "out", "pen"],
      repeated: ["width", "selector"],
    },
    run: async (ctx, { positional, flags }) => {
      const screens = requireScreens(positional)
      const widths = positiveIntegers(flags.width ?? ["1440"], "--width")
      const out = resolve(flags.out ?? compareDir(ctx.scratchRoot, ctx.repo))
      const { manifest, file } = await runCompare(ctx, {
        screens,
        widths,
        base: flags.base ?? "origin/main",
        out,
        selectors: flags.selector ?? [],
        checkBase: baseChecker(penOrNull(ctx, flags.pen)),
      })
      const problems = manifestProblems(manifest)
      return {
        code: problems.length ? EXIT.failed : EXIT.ok,
        lines: [
          ...manifest.captures.map((capture) =>
            json({
              screen: capture.screen,
              width: capture.width,
              before: capture.before.file ?? capture.before.error,
              after: capture.after.file ?? capture.after.error,
            })
          ),
          json({ manifest: file, base: manifest.baseSha, problems }),
        ],
      }
    },
  },
  changes: {
    usage: "changes <screen...> [--manifest file] [--spec out.json]",
    about: `List up to ${CHANGES_PER_SCREEN} elements per screen whose box or style differs between before and after, largest first, with a draft note. --spec writes a starting annotate spec with the top 5.`,
    options: { valued: ["manifest", "spec"] },
    run: async (ctx, { positional, flags }) => {
      const { file, manifest } = readManifest(ctx, flags.manifest)
      const wanted = new Set(positional)
      const ranked = manifest.captures
        .filter((capture) => !wanted.size || wanted.has(capture.screen))
        .filter(
          (capture) => capture.before?.elements && capture.after?.elements
        )
        .map((capture) => ({
          capture,
          result: rankChanges(capture.before.elements, capture.after.elements),
        }))
      if (ranked.length === 0)
        throw new UsageError(
          "no screen in the manifest has both sides captured; check compare's problems"
        )
      const lines = ranked.map(({ capture, result }) =>
        json({ screen: capture.screen, width: capture.width, ...result })
      )
      if (flags.spec) {
        const specFile = resolve(flags.spec)
        const spec = draftSpec(ranked, {
          manifestPath: relative(dirname(specFile), file),
        })
        ctx.fs.write(specFile, JSON.stringify(spec, null, 2))
        lines.push(json({ spec: specFile }))
      }
      return { code: EXIT.ok, lines }
    },
  },
  annotate: {
    usage: "annotate --spec <file.json> --out <png or dir> [--single]",
    about: `Render dark composites: per section a title, the before and after images, numbered callouts with arrows to the same target in both, and a legend with ${ZOOM.factor}x before and after crops for small changes. A spec with more than ${SPLIT_ABOVE} sections writes one composite per section named from its title, unless --single.`,
    options: { valued: ["spec", "out"], switches: ["single"] },
    run: async (ctx, { flags }) => {
      if (!flags.spec || !flags.out)
        throw new UsageError("give --spec <file.json> and --out <png>")
      const specFile = resolve(flags.spec)
      const { spec } = readSpec(ctx, specFile)
      const files = compositeFiles(spec.sections, resolve(flags.out), {
        single: flags.single === true,
      })
      const lines = []
      let bad = false
      for (const file of files) {
        ctx.fs.mkdir(dirname(file.out))
        const sections = await renderComposite(
          ctx,
          specFile,
          file.out,
          file.sections
        )
        bad ||= sections.some(
          (section) =>
            section.missing.before.length || section.missing.after.length
        )
        lines.push(...sections.map(json), json({ out: file.out }))
      }
      return { code: bad ? EXIT.failed : EXIT.ok, lines }
    },
  },
  "pr-section": {
    usage:
      "pr-section --annotated <png,...> [--manifest file] [--check] [--pr n | --issue n]",
    about:
      "Upload the composite and every before and after through scripts/ocv-tools.mjs shot (no comment) and print the ## Before / after markdown: every composite in the order given, a | main | this PR | table and, with --check, the check summary per screen.",
    options: {
      valued: ["manifest", "pr", "issue"],
      repeated: ["annotated"],
      switches: ["check"],
    },
    run: async (ctx, { flags }) => {
      if (!flags.annotated) throw new UsageError("give --annotated <png>")
      const { file, manifest } = readManifest(ctx, flags.manifest)
      const pictures = picturesToUpload(
        manifest,
        flags.annotated.map((file) => resolve(file))
      ).map((picture) => ({
        ...picture,
        file: resolve(dirname(file), picture.file),
      }))
      const checks = []
      if (flags.check)
        for (const screen of [
          ...new Set(manifest.captures.map((capture) => capture.screen)),
        ])
          checks.push(
            checkSummary(
              screen,
              await runUi(
                [
                  "check",
                  screen,
                  ...(manifest.baseChecks ? ["--known", file] : []),
                ],
                ctx
              )
            )
          )
      const target = {
        "--no-comment": true,
        ...(flags.pr ? { "--pr": flags.pr } : {}),
        ...(flags.issue ? { "--issue": flags.issue } : {}),
      }
      const shotLines = await ctx.upload(
        pictures.map((picture) => picture.file),
        target
      )
      const uploaded = attachUrls(pictures, linksFromShot(shotLines))
      return {
        code: EXIT.ok,
        lines: [renderPrSection({ manifest, uploaded, checks })],
      }
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
