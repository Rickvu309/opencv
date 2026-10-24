/**
 * GitHub contribution graph — renders mock contribution data only.
 */
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
} from "@workspace/ui/components/kibo-ui/contribution-graph/index"
import { cn } from "@workspace/ui/lib/utils"

import type { GithubContribution } from "@/features/pitch/pitch-github-mock.ts"

const LEVEL_FILL = [
  'data-[level="0"]:fill-muted',
  'data-[level="1"]:fill-primary/25',
  'data-[level="2"]:fill-primary/50',
  'data-[level="3"]:fill-primary/75',
  'data-[level="4"]:fill-primary',
] as const

const BLOCK_SIZE = 8
const BLOCK_MARGIN = 2
const FONT_SIZE = 12

type Props = {
  contributions: GithubContribution[]
  total?: number
  className?: string
}

export function PitchGithubHeatmap({ contributions, total, className }: Props) {
  if (contributions.length === 0) {
    return (
      <div
        className={cn(
          "flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground",
          className
        )}
      >
        No contribution data
      </div>
    )
  }

  const count = total ?? contributions.reduce((sum, day) => sum + day.count, 0)

  return (
    <ContributionGraph
      data={contributions}
      blockSize={BLOCK_SIZE}
      blockMargin={BLOCK_MARGIN}
      fontSize={FONT_SIZE}
      maxLevel={4}
      totalCount={count}
      className={cn("w-full text-muted-foreground", className)}
    >
      <ContributionGraphCalendar
        role="img"
        tabIndex={0}
        aria-label={`Contribution graph, ${count} contributions in the last year`}
        className="pb-0.5 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {({ activity, dayIndex, weekIndex }) => (
          <ContributionGraphBlock
            activity={activity}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
            className={LEVEL_FILL.join(" ")}
          >
            <title>{`${activity.count} contribution${activity.count === 1 ? "" : "s"} on ${activity.date}`}</title>
          </ContributionGraphBlock>
        )}
      </ContributionGraphCalendar>
      <ContributionGraphFooter>
        <ContributionGraphLegend>
          {({ level }) => (
            <svg
              width={BLOCK_SIZE}
              height={BLOCK_SIZE}
              aria-hidden
              className="shrink-0"
            >
              <rect
                width={BLOCK_SIZE}
                height={BLOCK_SIZE}
                rx={2}
                data-level={level}
                className={cn("stroke-border", LEVEL_FILL.join(" "))}
              />
            </svg>
          )}
        </ContributionGraphLegend>
      </ContributionGraphFooter>
    </ContributionGraph>
  )
}
