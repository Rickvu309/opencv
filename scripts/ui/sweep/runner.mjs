import { fitProblems } from "../../../packages/ui/src/lib/fit-rules.ts"
import { sizeLabel } from "../../../packages/ui/src/lib/viewport-grid.ts"
import { higFound, higRingCase, higSampleCases } from "./hig.mjs"
import { budgetFor, requestProblems } from "./requests.mjs"

export const HOME_SIZE = { width: 1440, height: 900 }

export const screenRepro = (id, size) =>
  `node scripts/ui.mjs sweep screen ${id}${size ? ` --size ${size}` : ""}`

const joined = (problems) => (problems.length ? problems.join("; ") : undefined)

export const clearUnderOpenMenu = (box) =>
  box.kind === "control" && box.underMenu ? { ...box, hit: true } : box

export async function sweepScreen(world, screen, grid) {
  const started = world.now()
  const home = sizeLabel(HOME_SIZE)
  const base = (size, extra) => ({
    screen: screen.id,
    size,
    repro: screenRepro(screen.id, size === home ? undefined : size),
    ...extra,
  })
  const session = await world.openScreen(screen)
  try {
    const refused = await session.runSteps()
    if (refused)
      return [
        base(home, {
          ok: false,
          rule: "opens",
          problem: `does not open: ${refused}`,
          shot: await session.screenshot(`${screen.id}-open`),
          ms: world.now() - started,
        }),
      ]
    const budget = budgetFor(screen.id)
    await session.settle()
    await session.idle(budget.idleMs)
    const log = session.requests()
    const cases = []
    const requestLines = requestProblems(log, budget)
    cases.push(
      base(home, {
        ok: requestLines.length === 0,
        rule: "requests",
        problem: joined(requestLines),
        requests: log.length,
        idleRequests: log.filter((record) => record.phase === "idle").length,
        log,
      })
    )
    for (const viewport of grid) {
      const size = sizeLabel(viewport)
      await session.resize(viewport)
      const { boxes, modalOpen } = await session.measure()
      const problems = fitProblems(
        viewport,
        boxes.map(clearUnderOpenMenu),
        modalOpen
      ).map((problem) => `does not fit: ${problem}`)
      cases.push(
        base(size, {
          ok: problems.length === 0,
          rule: "fits",
          problem: joined(problems),
          measured: { modalOpen, boxes },
          ...(problems.length
            ? { shot: await session.screenshot(`${screen.id}-${size}`) }
            : {}),
        })
      )
    }
    cases.push(...(await higSampleCases(session, screen, grid, base)))
    await session.resize(HOME_SIZE)
    const focus = await session.escapeReturnsFocus()
    if (focus.checked)
      cases.push(
        base(home, {
          ok: !focus.problem,
          rule: "focus",
          problem: focus.problem && `focus after Escape: ${focus.problem}`,
          ...(focus.problem
            ? { shot: await session.screenshot(`${screen.id}-focus`) }
            : {}),
        })
      )
    cases.push(await higRingCase(session, screen, home, base))
    const errors = session.consoleErrors()
    cases.push(
      base(home, {
        ok: errors.length === 0,
        rule: "console",
        problem: errors.length
          ? `console error: ${errors.slice(0, 3).join(" | ")}${errors.length > 3 ? ` (and ${errors.length - 3} more)` : ""}`
          : undefined,
      })
    )
    const ms = world.now() - started
    return cases.map((item) => ({ ...item, ms }))
  } finally {
    await session.close()
  }
}

export function summaryLine(screenId, cases) {
  const failed = cases.filter((item) => !item.ok)
  const ms = cases[0]?.ms ?? 0
  const seconds = `${Math.round(ms / 100) / 10} s`
  const opened = cases.find((item) => item.rule === "opens")
  if (opened) return `${screenId}: does not open, ${seconds}`
  const fits = cases.filter((item) => item.rule === "fits")
  const requests = cases.find((item) => item.rule === "requests")
  const focus = cases.find((item) => item.rule === "focus")
  const hig = higFound(cases).reduce(
    (total, item) => total + item.findings.length,
    0
  )
  return [
    `${screenId}: opens`,
    `${fits.filter((item) => item.ok).length}/${fits.length} sizes fit`,
    focus ? (focus.ok ? "focus returns" : "focus lost") : "no layer to close",
    `${requests?.requests ?? 0} requests, idle ${requests?.idleRequests ?? 0} in 3 s`,
    `${failed.length ? `${failed.length} failing` : "ok"}`,
    ...(hig ? [`${hig} HIG findings`] : []),
    seconds,
  ].join(", ")
}

export function failureLine(item) {
  return `FAIL ${item.screen} at ${item.size}: ${item.problem}${item.shot ? `, screenshot ${item.shot}` : ""}, repro: ${item.repro}`
}
