const CONFIRM = /^(?:Start (blank)|Use (.+))$/

const clickOf = (step) => step.click ?? step.clickIfShown

const cardConfirmedBy = (click) => {
  if (click?.role !== "button") return null
  const match = CONFIRM.exec(click.name ?? "")
  if (!match) return null
  return match[1] ? "Blank" : match[2]
}

const opensPicker = (step) =>
  step.goto !== undefined || clickOf(step)?.name === "New"

export function unchosenPickerCards(screens) {
  const problems = []
  for (const screen of screens) {
    let chosen = null
    const steps = [...(screen.steps ?? []), ...(screen.after ?? [])]
    steps.forEach((step, index) => {
      if (opensPicker(step)) chosen = null
      const click = clickOf(step)
      if (click?.role === "radio") chosen = click.name
      const card = cardConfirmedBy(click)
      if (card !== null && card !== chosen)
        problems.push(
          `${screen.id} step ${index + 1} ${JSON.stringify(step)} confirms the picker on whatever card it opened on; click { role: "radio", name: "${card}" } first`
        )
    })
  }
  return problems
}
