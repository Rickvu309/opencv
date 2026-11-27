import type { Pos } from "@workspace/domain/paper-doc"
import {
  caret,
  type Layout,
  type Metrics,
  type PagePoint,
} from "@workspace/paper-engine"

const STEP_MPT = 6000

export function verticalTarget(
  metrics: Metrics,
  layout: Layout,
  from: Pos,
  goal: number,
  dir: -1 | 1,
  locateAt: (point: PagePoint) => Pos
): Pos | null {
  const rect = caret(metrics, layout, from)
  const differs = (pos: Pos) => {
    const moved = caret(metrics, layout, pos)
    return moved.page !== rect.page || moved.y !== rect.y
  }
  const scan = (page: number, start: number) => {
    const area = layout.pages[page]!.content
    for (
      let y = start;
      y >= area.y && y < area.y + area.h;
      y += dir * STEP_MPT
    ) {
      const pos = locateAt({ page, x: goal, y })
      if (differs(pos)) return pos
    }
    return null
  }
  const here = scan(rect.page, dir > 0 ? rect.y + rect.h + 1 : rect.y - 1)
  if (here) return here
  const next = layout.pages[rect.page + dir]
  if (!next) return null
  return scan(
    next.index,
    dir > 0 ? next.content.y : next.content.y + next.content.h - 1
  )
}
