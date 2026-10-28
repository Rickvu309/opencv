// Checks 28 and 32: the primary action of each surface, found by SEL.primary, the data-primary-action marker the app
// sets on it. Each judges every surface whose marker was found; a surface with no marker is named as not judged, so it
// never hides a small or unreachable action elsewhere.
import { SEL } from "./assumes.mjs"
import { judged } from "./check-util.mjs"

const noMarker = (k) => `${k} (no ${SEL.primary} on the screen)`

// The Paper primary is New on the library; the CV editor has had no Save or Make mine since #396. Coach's primary is
// the composer's Add icon control, so only the labelled button surfaces are measured here.
export function primaryButtonCheck(d) {
  const need = { apply: d.apply, paper: d.paper, pitch: d.pitchEdit }
  const found = Object.entries(need).map(([k, s]) => {
    const b = s.buttons.find((x) => x.primary)
    return { k, label: b?.label, h: b?.h }
  })
  return judged(
    "28",
    "primary-buttons-32",
    "the primary button on Apply, Paper and Pitch is 32px high or more (the kit glow button is h-8)",
    found.every((f) => !f.label || f.h >= 32),
    found
      .map((f) => (f.label ? `${f.k} "${f.label}" ${f.h}px` : `${f.k} none`))
      .join(", "),
    found.filter((f) => !f.label).map((f) => noMarker(f.k))
  )
}

export function keyboardPrimaryCheck(d) {
  const tabs = Object.entries(d.tabs).map(
    ([k, v]) => `${k}:${v.reached ?? "none in 60"}`
  )
  const lost = Object.keys(d.tabs).filter((k) => !(d[k].primaryMarks > 0))
  return judged(
    "32",
    "keyboard-reaches-primary",
    "the primary action of each surface takes focus within 30 Tab presses",
    Object.entries(d.tabs)
      .filter(([k]) => !lost.includes(k))
      .every(([, v]) => v.reached && v.reached <= 30),
    `Tab presses to the primary action: ${tabs.join(" ")}`,
    lost.map(noMarker)
  )
}
