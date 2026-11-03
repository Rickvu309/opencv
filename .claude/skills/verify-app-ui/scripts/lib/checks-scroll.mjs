import { judged } from "./check-util.mjs"

export const WIDE_PAGES = [
  "coach",
  "palette",
  "thread",
  "paper",
  "cv",
  "cvCoach",
  "apply",
  "pitch",
  "pitchStory",
  "pitchEdit",
  "coachError",
  "coachNet",
  "paperLoading",
  "applyEmpty",
  "settings",
  "settingsReduced",
]

export function sidewaysScroll(d) {
  const pages = [
    ...WIDE_PAGES.map((key) => [`${key} 1440`, d[key]]),
    ...(d.inbox ? [["inbox 1440", d.inbox]] : []),
    ...Object.entries(d.reduced ?? {}).map(([k, s]) => [
      `${k} reduced 1440`,
      s,
    ]),
    ...Object.entries(d.mobile ?? {}).map(([k, s]) => [`${k} 390`, s]),
    ["settings 390", d.settingsMobile],
  ]
  const sizes = pages.map(([label, s]) => [label, s?.docScroll])
  const unread = sizes.filter(
    ([, size]) => typeof size?.sw !== "number" || typeof size?.cw !== "number"
  )
  const over = sizes.filter(([, size]) => size?.sw > size?.cw)
  return judged(
    "45",
    "no-sideways-scroll",
    "no toured page scrolls sideways at 1440x900 or 390x844 (the document is no wider than the window)",
    over.length === 0,
    over.length
      ? `scrolls sideways: ${over.map(([label, size]) => `${label} ${size.sw}>${size.cw}`).join(", ")}`
      : `${pages.length - unread.length} pages fit their width`,
    unread.length
      ? [`no scroll size for ${unread.map(([label]) => label).join(", ")}`]
      : []
  )
}

export const badFixture = [
  {
    name: "a toured page wider than its window",
    fails: () =>
      sidewaysScroll({ coach: { docScroll: { sw: 2000, cw: 1440 } } })
        .status === "FAIL",
  },
]
