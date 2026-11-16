export function detect(layout) {
  const problems = []
  if (layout.expected) {
    const labels = layout.controls.map((control) => control.label)
    if (labels.join("\n") !== layout.expected.controls.join("\n"))
      problems.push(`Desktop controls differ from main at ${layout.viewport}px`)
    if (layout.separators !== layout.expected.separators)
      problems.push(
        `Desktop separators differ from main at ${layout.viewport}px`
      )
  }
  for (const control of layout.controls)
    if (control.left < layout.left - 1 || control.right > layout.right + 1)
      problems.push(`${control.label} clips at ${layout.viewport}px`)
  const ordered = [...layout.controls].sort((a, b) => a.left - b.left)
  for (let index = 0; index < ordered.length; index++)
    for (const current of ordered.slice(index + 1)) {
      const previous = ordered[index]
      if (current.left < previous.right - 0.25)
        problems.push(
          `${previous.label} overlaps ${current.label} at ${layout.viewport}px`
        )
    }
  for (const item of layout.candidates) {
    if (item.visible && item.width < item.minimum - 0.25)
      problems.push(`${item.label} is below its floor at ${layout.viewport}px`)
    if (
      item.pair &&
      layout.candidates.some(
        (other) => other.pair === item.pair && other.visible !== item.visible
      )
    )
      problems.push(`${item.pair} pair is split at ${layout.viewport}px`)
  }
  for (const name of ["Undo", "Redo", ...(layout.overflow ? ["More"] : [])])
    if (!layout.controls.some((control) => control.label.startsWith(name)))
      problems.push(`${name} is missing at ${layout.viewport}px`)
  const blockedPair = layout.candidates.findIndex(
    (item) => item.pair && !item.visible
  )
  const eligible =
    blockedPair < 0
      ? layout.candidates
      : layout.candidates.slice(0, blockedPair)
  const next = eligible.find(
    (item) =>
      !item.visible &&
      (item.pair
        ? layout.candidates
            .filter((other) => other.pair === item.pair)
            .reduce((sum, other) => sum + other.width + layout.gap, 0)
        : item.width + layout.gap) <=
        layout.remaining + 0.25
  )
  if (next)
    problems.push(`${next.label} fits but is hidden at ${layout.viewport}px`)
  return problems
}

export function measureToolbar(row) {
  const rect = row.getBoundingClientRect()
  const style = getComputedStyle(row)
  const gap = Number.parseFloat(style.columnGap) || 0
  const left = rect.left + (Number.parseFloat(style.paddingLeft) || 0)
  const right = rect.right - (Number.parseFloat(style.paddingRight) || 0)
  const controls = [...row.querySelectorAll("button")]
    .filter((button) => button.checkVisibility({ visibilityProperty: true }))
    .map((button) => ({
      label: button.getAttribute("aria-label") ?? button.textContent,
      left: button.getBoundingClientRect().left,
      right: button.getBoundingClientRect().right,
      width: button.getBoundingClientRect().width,
    }))
  const candidates = [...row.querySelectorAll("[data-toolbar-item]")].map(
    (item, index) => ({
      label: item.dataset.toolbarItem,
      width: item.getBoundingClientRect().width,
      minimum: item.hasAttribute("data-toolbar-shrink")
        ? Number.parseFloat(getComputedStyle(item).minWidth) || 112
        : 0,
      pair: item.dataset.toolbarPair,
      visible: item.checkVisibility({ visibilityProperty: true }),
      index,
    })
  )
  const emphasis = ["Bold", "Italic", "Underline"]
  const structure = [
    "Paragraph style",
    "Link",
    "Bulleted list",
    "Numbered list",
    "Remove formatting",
  ]
  const rank = (item) => {
    const index = emphasis.indexOf(item.label)
    return index >= 0
      ? index
      : emphasis.length +
          item.index +
          (structure.includes(item.label) ? candidates.length : 0)
  }
  candidates.sort((a, b) => rank(a) - rank(b))
  if (!candidates.length)
    for (const label of emphasis) {
      const control = controls.find((item) => item.label === label)
      candidates.push({
        label,
        width: control?.width ?? (innerWidth < 768 ? 44 : 32),
        visible: !!control,
      })
    }
  const separators = [...row.querySelectorAll('[role="separator"]')].filter(
    (item) => item.checkVisibility({ visibilityProperty: true })
  )
  const used =
    controls.reduce((sum, item) => sum + item.width, 0) +
    separators.reduce(
      (sum, item) => sum + item.getBoundingClientRect().width,
      0
    ) +
    Math.max(0, controls.length + separators.length - 1) * gap
  return {
    viewport: innerWidth,
    separators: separators.length,
    left,
    right,
    gap,
    controls,
    candidates,
    overflow: candidates.some((item) => !item.visible),
    remaining: right - left - used,
  }
}

export function detectMeasurement(source) {
  const problems = []
  const fallback =
    /const unmeasuredLayout[^=]*=\s*\{\s*visible:\s*\["Bold",\s*"Italic",\s*"Underline"\],\s*more:\s*true,\s*iconOnly:\s*false,?\s*\}/
  if (
    !fallback.test(source) ||
    !/useReducer\([\s\S]*?,\s*unmeasuredLayout\s*\)/.test(source)
  )
    problems.push("Unmeasured toolbar must start with main's layout")
  if (!/if \(!\(width > 0\)\) \{\s*update\(unmeasuredLayout\)/.test(source))
    problems.push("Unknown width must restore main's layout")
  if (!/\[host, editor\]/.test(source))
    problems.push("Editor remount must measure the toolbar again")
  return problems
}
