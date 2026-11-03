import { readFileSync } from "node:fs"

import {
  bodyGapMismatches,
  SIGN_OFF_GAP_DEVIATION,
} from "./letter-layout-exceptions.mjs"

const layout = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../apps/web/src/features/paper/design/letter-editor.layout.json",
      import.meta.url
    ),
    "utf8"
  )
)

const recorded = () => {
  const measured = layout.texts.map((t) => ({ y: t.y }))
  const sign = SIGN_OFF_GAP_DEVIATION.index
  measured[sign] = { y: measured[sign - 1].y + SIGN_OFF_GAP_DEVIATION.appGap }
  return measured
}

const bodyStart = layout.texts.findIndex((t) =>
  t.text.startsWith("I'm applying")
)

export const badFixture = [
  {
    name: "a body paragraph sits 6px lower than the frame's block gap",
    fails: () => {
      const measured = recorded()
      measured[bodyStart + 1] = { y: measured[bodyStart + 1].y + 6 }
      return bodyGapMismatches(layout.texts, measured, "2026-11-03").length > 0
    },
  },
  {
    name: "the sign-off gap drifts away from the recorded deviation",
    fails: () => {
      const measured = recorded()
      const sign = SIGN_OFF_GAP_DEVIATION.index
      measured[sign] = { y: measured[sign - 1].y + 40 }
      return bodyGapMismatches(layout.texts, measured, "2026-11-03").length > 0
    },
  },
  {
    name: "the sign-off deviation is past its expiry",
    fails: () =>
      bodyGapMismatches(layout.texts, recorded(), "2099-01-01").length > 0,
  },
]
