import { basename, join } from "node:path"
import { renderComposite } from "./composite.mjs"

export const CHECK_ARROWS = 12
export const CHECK_VIEWPORT = Object.freeze({ width: 1440, height: 900 })

const shown = (value) =>
  value === null || value === undefined
    ? "missing"
    : typeof value === "number"
      ? `${value}px`
      : String(value)

function rowFor(rows, label) {
  return rows.findIndex(
    (row) => row.label === label || `${row.label} vs ${row.against}` === label
  )
}

function sourceOf(row) {
  if (row?.frame) return `pen frame ${row.frame}`
  if (row?.against) return `screen ${row.against}`
  return "the design map"
}

const isKnown = (failure) => failure.onMain && !failure.onMain.changed

function visible(box) {
  return (
    !!box &&
    box.width > 0 &&
    box.height > 0 &&
    box.x < CHECK_VIEWPORT.width &&
    box.y < CHECK_VIEWPORT.height &&
    box.x + box.width > 0 &&
    box.y + box.height > 0
  )
}

export function failureGroups({ rows, rendered, result }) {
  const groups = new Map()
  for (const failure of result.failures ?? []) {
    const list = groups.get(failure.element) ?? []
    list.push(failure)
    groups.set(failure.element, list)
  }
  return [...groups].map(([label, failures]) => {
    const at = rowFor(rows, label)
    const known = failures.every(isKnown)
    const measures = failures
      .map(
        (failure) =>
          `${failure.property} expected ${shown(failure.design)}, measured ${shown(failure.rendered)}`
      )
      .join("; ")
    return {
      label,
      known,
      box: at === -1 ? null : rendered[at],
      note: `${label}: ${measures}, source ${sourceOf(rows[at])}${known ? " (already failing on main)" : ""}`,
    }
  })
}

export function failureSpec({ screen, rows, rendered, result, image }) {
  const groups = failureGroups({ rows, rendered, result }).sort(
    (a, b) => Number(a.known) - Number(b.known)
  )
  const pointed = groups
    .filter((group) => visible(group.box))
    .slice(0, CHECK_ARROWS)
  const also = groups
    .filter((group) => !pointed.includes(group))
    .map((group) =>
      visible(group.box)
        ? group.note
        : `${group.note} (not on the first screen)`
    )
  return {
    sections: [
      {
        title: `${screen} at ${CHECK_VIEWPORT.width}: ${groups.length} failing element${groups.length === 1 ? "" : "s"} against the design`,
        image,
        callouts: pointed.map((group, at) => ({
          n: at + 1,
          note: group.note,
          target: {
            x: group.box.x,
            y: group.box.y,
            width: group.box.width,
            height: group.box.height,
          },
        })),
        ...(also.length ? { also } : {}),
      },
    ],
  }
}

export const checkShotFile = (dir, screen) =>
  join(dir, `${screen}-check.screen.png`)

export async function writeFailureImages(ctx, dir, outcomes) {
  const written = []
  for (const outcome of outcomes) {
    if (!outcome.rows || !outcome.result?.failures?.length) continue
    const screen = outcome.result.screen
    const specFile = join(dir, `${screen}-check.json`)
    const out = join(dir, `${screen}-check.png`)
    const spec = failureSpec({
      screen,
      rows: outcome.rows,
      rendered: outcome.rendered,
      result: outcome.result,
      image: basename(checkShotFile(dir, screen)),
    })
    ctx.fs.write(specFile, JSON.stringify(spec, null, 2))
    await renderComposite(ctx, specFile, out)
    written.push({ screen, annotated: out, spec: specFile })
  }
  return written
}
