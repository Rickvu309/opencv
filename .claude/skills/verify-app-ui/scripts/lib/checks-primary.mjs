// Checks 28 and 32: the primary action of each surface. Each judges every surface whose primary button was found;
// a surface with no matching button is named as not judged, so it never hides a small or unreachable button elsewhere.
import { judged } from "./check-util.mjs"
import { PRIMARY } from "./tour.mjs"

// The Paper primary is New on the library; the CV editor has had no Save or Make mine since #396.
export function primaryButtonCheck(d) {
  const need = {
    apply: [d.apply, PRIMARY.apply],
    paper: [d.paper, PRIMARY.paper],
    pitch: [d.pitchEdit, PRIMARY.pitch],
  }
  const found = Object.entries(need).map(([k, [s, re]]) => {
    const b = s.buttons.find((x) => re.test(x.label))
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
    found
      .filter((f) => !f.label)
      .map((f) => `${f.k} (no button matched ${need[f.k][1]})`)
  )
}

export function keyboardPrimaryCheck(d) {
  const tabs = Object.entries(d.tabs).map(
    ([k, v]) => `${k}:${v.reached ?? "none in 60"}`
  )
  const lost = Object.entries(d.tabs)
    .filter(
      ([k, v]) =>
        !v.reached && !d[k].buttons.some((b) => PRIMARY[k].test(b.label))
    )
    .map(([k]) => k)
  return judged(
    "32",
    "keyboard-reaches-primary",
    "the primary action of each surface takes focus within 30 Tab presses",
    Object.entries(d.tabs)
      .filter(([k]) => !lost.includes(k))
      .every(([, v]) => v.reached && v.reached <= 30),
    `Tab presses to the primary action: ${tabs.join(" ")}`,
    lost.map((k) => `${k} (no button matched ${PRIMARY[k]})`)
  )
}
