import { list, result } from "./check-util.mjs"

export function contrastCheck(allSnaps) {
  const fails = allSnaps.flatMap((s) => s.contrast.fails)
  const failCount = allSnaps.reduce((n, s) => n + s.contrast.failCount, 0)
  const checked = allSnaps.reduce((n, s) => n + s.contrast.checked, 0)
  return result(
    "20",
    "text-contrast",
    failCount === 0,
    `${failCount} of ${checked} text nodes fail${
      fails.length
        ? `: ${list(
            fails.map((f) => `"${f.text}" ${f.ratio}:1 needs ${f.need}`),
            3
          )}`
        : ""
    }`,
    "text is 4.5:1, or 3:1 at 24px (18.66px bold); text over images and gradients, disabled controls, aria-hidden text and svg are skipped"
  )
}

const snapshotWith = (fails) => ({
  contrast: { checked: 1, failCount: fails.length, fails },
})

export const badFixture = [
  {
    name: "white text on a white background",
    fails: () =>
      contrastCheck([
        snapshotWith([
          {
            text: "Save",
            ratio: 1,
            need: 4.5,
            color: "#ffffff",
            bg: "#ffffff",
          },
        ]),
      ]).status === "FAIL",
  },
  {
    name: "pale grey text on a white background",
    fails: () =>
      contrastCheck([snapshotWith([{ text: "Hint", ratio: 1.7, need: 4.5 }])])
        .status === "FAIL",
  },
]
