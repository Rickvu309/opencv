export const FLAT_TOOLBAR_CONTROLS = [
  "Undo",
  "Redo",
  "Text style",
  "Font",
  "More",
  "Bold",
  "Italic",
  "Underline",
  "Link",
  "Bulleted list",
  "Numbered list",
  "Align",
]

export const PHONE_FOLDS = [
  "Redo",
  "Link",
  "Undo",
  "Align",
  "Numbered list",
  "Underline",
]

const PHONE_BELOW = 640
const PHONE_TAP = 36

const rowsOf = (controls) =>
  [...new Set(controls.map((control) => Math.round(control.top)))].length

const overlaps = (a, b) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5

export function detect(measure) {
  const {
    viewport,
    scrollWidth,
    clientWidth,
    controls,
    folded = [],
    labels = [],
    escape = [],
  } = measure
  const problems = []
  const shown = controls.filter((control) => control.visible)
  const inMore = (label) =>
    viewport < PHONE_BELOW &&
    PHONE_FOLDS.includes(label) &&
    folded.includes(label)
  for (const label of FLAT_TOOLBAR_CONTROLS)
    if (!shown.some((control) => control.label === label) && !inMore(label))
      problems.push(`${label} is missing at ${viewport}px`)
  for (const label of labels)
    if (label.scrollWidth > label.clientWidth + 1)
      problems.push(`${label.label} cuts its text at ${viewport}px`)
  for (const closed of escape)
    if (closed.focused !== closed.menu)
      problems.push(
        `Escape from ${closed.menu} moves focus to ${closed.focused || "nothing"} at ${viewport}px`
      )
  for (const control of shown)
    if (control.left < 0 || control.right > viewport)
      problems.push(`${control.label} clips at ${viewport}px`)
  for (let a = 0; a < shown.length; a += 1)
    for (let b = a + 1; b < shown.length; b += 1)
      if (overlaps(shown[a], shown[b]))
        problems.push(
          `${shown[a].label} overlaps ${shown[b].label} at ${viewport}px`
        )
  if (scrollWidth > clientWidth)
    problems.push(`the page scrolls sideways at ${viewport}px`)
  const rows = rowsOf(shown)
  if (viewport >= PHONE_BELOW && rows > 1)
    problems.push(`the toolbar wraps to ${rows} rows at ${viewport}px`)
  if (viewport < PHONE_BELOW && rows > 2)
    problems.push(`the toolbar takes ${rows} rows at ${viewport}px`)
  if (viewport < PHONE_BELOW)
    for (const control of shown)
      if (control.bottom - control.top < PHONE_TAP)
        problems.push(
          `${control.label} is shorter than ${PHONE_TAP}px at ${viewport}px`
        )
  return problems
}
