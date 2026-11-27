import type { Viewport } from "./dialog-fit"

type Rect = { x: number; y: number; width: number; height: number }

export type MeasuredBox =
  | { kind: "document"; name: string; width: number; height: number }
  | (Rect & {
      kind: "surface"
      name: string
      pinned: boolean
      reachable: boolean
    })
  | (Rect & {
      kind: "control"
      name: string
      pinned: boolean
      hit: boolean
      coveredBy?: string
      clippedBy?: string
      sideways?: "scrolls" | "stuck"
      inModal: boolean
      inline: boolean
      textEntry?: boolean
    })

export const PHONE_WIDTH = 430
export const TARGET_MIN = 44
const SLACK = 0.5

const round = (value: number) => Math.round(value)
const hundredths = (value: number) => Math.round(value * 100) / 100

function outsideEdges(box: Rect, { width, height }: Viewport): string[] {
  const edges: string[] = []
  if (box.y < -SLACK) edges.push(`top ${round(box.y)} < 0`)
  if (box.x < -SLACK) edges.push(`left ${round(box.x)} < 0`)
  if (box.y + box.height > height + SLACK)
    edges.push(`bottom ${round(box.y + box.height)} > ${height}`)
  if (box.x + box.width > width + SLACK)
    edges.push(`right ${round(box.x + box.width)} > ${width}`)
  return edges
}

const centre = (box: Rect) =>
  `(${round(box.x + box.width / 2)}, ${round(box.y + box.height / 2)})`

export function fitProblems(
  viewport: Viewport,
  boxes: MeasuredBox[],
  modalOpen: boolean
): string[] {
  const problems: string[] = []
  for (const box of boxes) {
    if (box.kind === "document") {
      if (box.width > viewport.width + 1)
        problems.push(
          `the page scrolls sideways: content is ${round(box.width)}px wide in a ${viewport.width}px window`
        )
      continue
    }
    if (box.kind === "surface") {
      if (box.height < 1)
        problems.push(
          `${box.name} has collapsed to ${round(box.height)}px tall`
        )
      const edges = box.pinned ? outsideEdges(box, viewport) : []
      if (edges.length && !box.reachable)
        problems.push(
          `${box.name} runs off the window and cannot be scrolled into view: ${edges.join(", ")}`
        )
      continue
    }
    if (box.sideways === "scrolls") continue
    if (box.clippedBy && !(modalOpen && !box.inModal))
      problems.push(
        `${box.name} cannot be reached: ${box.clippedBy} cuts it off at its centre ${centre(box)} and does not scroll`
      )
    else if (!box.hit && !(modalOpen && !box.inModal))
      problems.push(
        box.sideways === "stuck"
          ? `${box.name} is past the ${box.x < 0 ? "left" : "right"} edge of the ${viewport.width}px window at ${centre(box)} and nothing scrolls sideways to reach it`
          : box.coveredBy === "outside the window"
            ? `${box.name} is off screen: its centre ${centre(box)} is outside the ${viewport.width}x${viewport.height} window`
            : `${box.name} cannot be clicked: ${box.coveredBy ?? "something else"} covers its centre ${centre(box)}`
      )
    if (
      viewport.width <= PHONE_WIDTH &&
      !box.inline &&
      !box.textEntry &&
      (hundredths(box.width) < TARGET_MIN ||
        hundredths(box.height) < TARGET_MIN) &&
      !(modalOpen && !box.inModal)
    )
      problems.push(
        `${box.name} is ${hundredths(box.width)}x${hundredths(box.height)}, under the ${TARGET_MIN}x${TARGET_MIN} phone target`
      )
  }
  return problems
}
