import { comparePenLayout } from "./pen-layout-compare.mjs"

const text = (over = {}) => ({
  text: "Sign in",
  x: 65,
  y: 338,
  width: 120,
  height: 20,
  fontSize: 14,
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: 20,
  color: "rgba(17, 17, 17, 1)",
  background: "rgba(255, 255, 255, 1)",
  textAlign: "left",
  ...over,
})
const mismatches = (want, measured, exceptions = []) =>
  comparePenLayout({
    layout: { frameId: "BAD1", route: "/bad", texts: [want] },
    measured,
    exceptions,
    today: "2026-11-03",
  }).mismatches

export const badFixture = [
  {
    name: "white text on a white background where the pen draws near-white",
    fails: () =>
      mismatches(text({ color: "rgba(240, 240, 240, 1)" }), [
        text({ color: "rgba(255, 255, 255, 1)" }),
      ]).length > 0,
  },
  {
    name: "a pen text the screen did not measure",
    fails: () => mismatches(text(), []).length > 0,
  },
  {
    name: "an exception whose property now matches",
    fails: () =>
      mismatches(
        text(),
        [text()],
        [
          {
            frameId: "BAD1",
            text: "Sign in",
            property: "x",
            reason: "old drift",
            until: "2099-01-01",
          },
        ]
      ).length > 0,
  },
  {
    name: "an expired exception",
    fails: () =>
      mismatches(
        text(),
        [text({ x: 300 })],
        [
          {
            frameId: "BAD1",
            text: "Sign in",
            property: "x",
            reason: "old drift",
            until: "2026-01-01",
          },
        ]
      ).length > 0,
  },
]
