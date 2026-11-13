export const CHANGES_PER_SCREEN = 8
export const ARROWS_PER_IMAGE = 6
export const PIXEL_TOLERANCE = 0.5
const STYLE_WEIGHT = 12

const px = (value) => `${Math.round(value * 100) / 100}px`
const numbers = (list) =>
  list.map((value) => Math.round(value * 100) / 100).join(" ")

function offset(element, parentKey, byKey) {
  const parent = parentKey ? byKey.get(parentKey) : null
  return parent
    ? { x: element.x - parent.x, y: element.y - parent.y }
    : { x: element.x, y: element.y }
}

export function shorthand([top, right, bottom, left]) {
  if (top === bottom && right === left)
    return numbers(top === right ? [top] : [top, right])
  if (right === left) return numbers([top, right, bottom])
  return numbers([top, right, bottom, left])
}

const differs = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) > PIXEL_TOLERANCE

function numericChange(label, before, after) {
  if (!differs(before, after)) return null
  return {
    label,
    score: Math.abs(after - before),
    note: `${label} ${px(before)} to ${px(after)}`,
  }
}

function styleChange(label, before, after) {
  if (String(before ?? "") === String(after ?? "")) return null
  return { label, score: STYLE_WEIGHT, note: `${label} ${before} to ${after}` }
}

export function elementChanges(before, after, context) {
  const found = []
  const shared = before.parent === after.parent ? after.parent : null
  const from = offset(before, shared, context.before)
  const to = offset(after, shared, context.after)
  if (differs(from.x, to.x) || differs(from.y, to.y))
    found.push({
      label: "position",
      score: Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)),
      note: `position ${numbers([before.x, before.y])} to ${numbers([after.x, after.y])}`,
    })
  if (
    differs(before.width, after.width) ||
    differs(before.height, after.height)
  )
    found.push({
      label: "size",
      score: Math.max(
        Math.abs(after.width - before.width),
        Math.abs(after.height - before.height)
      ),
      note: `size ${numbers([before.width, before.height])} to ${numbers([after.width, after.height])}`,
    })
  const pad = (element) => element.padding ?? [0, 0, 0, 0]
  if (pad(before).some((value, at) => differs(value, pad(after)[at])))
    found.push({
      label: "padding",
      score: Math.max(
        ...pad(before).map((value, at) => Math.abs(pad(after)[at] - value))
      ),
      note: `padding ${shorthand(pad(before))} to ${shorthand(pad(after))}`,
    })
  for (const [label, key] of [
    ["radius", "radius"],
    ["gap", "gap"],
    ["font size", "fontSize"],
  ]) {
    const change = numericChange(label, before[key], after[key])
    if (change) found.push(change)
  }
  for (const [label, key] of [
    ["weight", "fontWeight"],
    ["color", "color"],
    ["background", "background"],
    ["border", "border"],
    ["opacity", "opacity"],
  ]) {
    const change = styleChange(label, before[key], after[key])
    if (change) found.push(change)
  }
  return found
}

const boxOf = (element) => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
})

function appeared(list, other) {
  const keys = new Set(list.map((element) => element.key))
  return list
    .filter((element) => !other.has(element.key))
    .filter(
      (element) =>
        !element.parent ||
        other.has(element.parent) ||
        !keys.has(element.parent)
    )
    .map((element) => ({
      key: element.key,
      selector: element.selector,
      score: Math.max(element.width, element.height),
      box: boxOf(element),
      slot: element.slot ?? element.key,
    }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
}

export function rankChanges(before, after, limit = CHANGES_PER_SCREEN) {
  const index = (list) => new Map(list.map((element) => [element.key, element]))
  const context = { before: index(before), after: index(after) }
  const changed = []
  for (const element of after) {
    const old = context.before.get(element.key)
    if (!old) continue
    const found = elementChanges(old, element, context)
    if (!found.length) continue
    changed.push({
      key: element.key,
      selector: element.selector,
      score: found.reduce((sum, change) => sum + change.score, 0),
      before: boxOf(old),
      after: boxOf(element),
      note: `${element.slot ?? element.key}: ${found.map((change) => change.note).join("; ")}`,
    })
  }
  changed.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
  const added = appeared(after, context.before)
  const removed = appeared(before, context.after)
  return {
    changes: changed.slice(0, limit),
    more: Math.max(0, changed.length - limit),
    onlyBefore: before.filter((element) => !context.after.has(element.key))
      .length,
    onlyAfter: after.filter((element) => !context.before.has(element.key))
      .length,
    added: added.slice(0, limit),
    removed: removed.slice(0, limit),
  }
}

const sizeText = (box) => `${Math.round(box.width)}x${Math.round(box.height)}px`

function findings(result) {
  return [
    ...result.changes.map((change) => ({
      score: change.score,
      note: change.note,
      target: { selector: change.selector },
    })),
    ...(result.added ?? []).map((item) => ({
      score: item.score,
      note: `${item.slot}: new, ${sizeText(item.box)}`,
      target: { after: { selector: item.selector } },
    })),
    ...(result.removed ?? []).map((item) => ({
      score: item.score,
      note: `${item.slot}: removed, was ${sizeText(item.box)}`,
      target: { before: { selector: item.selector } },
    })),
  ].sort((a, b) => b.score - a.score)
}

export function draftSpec(ranked, { picks = ARROWS_PER_IMAGE, manifestPath }) {
  return {
    manifest: manifestPath,
    sections: ranked.map(({ capture, result }) => {
      const all = findings(result)
      const also = all.slice(picks).map((item) => item.note)
      if (result.more)
        also.push(`${result.more} more changed elements not listed`)
      return {
        title: `${capture.screen} at ${capture.width}`,
        screen: capture.screen,
        width: capture.width,
        callouts: all.slice(0, picks).map((item, at) => ({
          n: at + 1,
          note: item.note,
          target: item.target,
        })),
        ...(also.length ? { also } : {}),
      }
    }),
  }
}
