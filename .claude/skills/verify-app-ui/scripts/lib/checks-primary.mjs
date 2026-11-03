import { SEL } from "./assumes.mjs"
import { judged } from "./check-util.mjs"

const noMarker = (k) => `${k} (no ${SEL.primary} on the screen)`
const screensWithTwoPrimariesAreAppDefects = (entries) =>
  entries
    .filter(([, snap]) => snap?.primaryMarks > 1)
    .map(([k, snap]) => `${k} has ${snap.primaryMarks} visible ${SEL.primary}`)

export function primaryButtonCheck(d) {
  const labelledPrimarySurfacesCoachIsAnIcon = {
    apply: d.apply,
    paper: d.paper,
    pitch: d.pitchEdit,
  }
  const found = Object.entries(labelledPrimarySurfacesCoachIsAnIcon).map(
    ([k, s]) => {
      const b = s.buttons.find((x) => x.primary)
      return { k, label: b?.label, h: b?.h }
    }
  )
  const many = screensWithTwoPrimariesAreAppDefects(
    Object.entries(labelledPrimarySurfacesCoachIsAnIcon)
  )
  return judged(
    "28",
    "primary-buttons-32",
    "the primary button on Apply, Paper and Pitch is 32px high or more (the kit glow button is h-8), one per screen",
    found.every((f) => !f.label || f.h >= 32) && !many.length,
    [
      ...found.map((f) =>
        f.label ? `${f.k} "${f.label}" ${f.h}px` : `${f.k} none`
      ),
      ...many,
    ].join(", "),
    found.filter((f) => !f.label).map((f) => noMarker(f.k))
  )
}

export function keyboardPrimaryCheck(d) {
  const tabs = Object.entries(d.tabs).map(
    ([k, v]) => `${k}:${v.reached ?? "none in 60"}`
  )
  const lost = Object.keys(d.tabs).filter((k) => !(d[k].primaryMarks > 0))
  const many = screensWithTwoPrimariesAreAppDefects(
    Object.keys(d.tabs).map((k) => [k, d[k]])
  )
  return judged(
    "32",
    "keyboard-reaches-primary",
    "the primary action of each surface takes focus within 30 Tab presses, one per screen",
    Object.entries(d.tabs)
      .filter(([k]) => !lost.includes(k))
      .every(([, v]) => v.reached && v.reached <= 30) && !many.length,
    [`Tab presses to the primary action: ${tabs.join(" ")}`, ...many].join(
      "; "
    ),
    lost.map(noMarker)
  )
}

const snap = (buttons, primaryMarks = 1) => ({ buttons, primaryMarks })
const smallPrimary = snap([{ primary: true, label: "New", h: 20 }])
const wellSized = snap([{ primary: true, label: "New", h: 32 }])
export const badFixture = [
  {
    name: "a primary button under 32px",
    fails: () =>
      primaryButtonCheck({
        apply: smallPrimary,
        paper: wellSized,
        pitchEdit: wellSized,
      }).status === "FAIL",
  },
  {
    name: "two primary actions on one screen",
    fails: () =>
      primaryButtonCheck({
        apply: snap(wellSized.buttons, 2),
        paper: wellSized,
        pitchEdit: wellSized,
      }).status === "FAIL",
  },
  {
    name: "a primary action the keyboard reaches after 45 Tabs",
    fails: () =>
      keyboardPrimaryCheck({
        tabs: { apply: { reached: 45 } },
        apply: wellSized,
      }).status === "FAIL",
  },
]
