import { cn } from "cn"

type Stage = "saved" | "applied" | "interview" | "offer" | "closed"

const STAGE_CLASS: Record<Stage, string> = {
  saved: "text-chart-5",
  applied: "text-chart-4",
  interview: "text-chart-2",
  offer: "text-chart-3",
  closed: "text-chart-5",
}

const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
}

function StageIcon({
  stage,
  size = 14,
  className,
  decorative = false,
}: {
  stage: Stage
  size?: number
  className?: string
  decorative?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : STAGE_LABEL[stage]}
      aria-hidden={decorative ? true : undefined}
      data-slot="stage-icon"
      className={cn("shrink-0", STAGE_CLASS[stage], className)}
    >
      {stage === "saved" && (
        <circle
          cx="7"
          cy="7"
          r="5.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
      {stage === "applied" && (
        <>
          <circle
            cx="7"
            cy="7"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z" fill="currentColor" />
        </>
      )}
      {stage === "interview" && (
        <>
          <circle
            cx="7"
            cy="7"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M7 3.5A3.5 3.5 0 1 1 3.5 7H7Z" fill="currentColor" />
        </>
      )}
      {stage === "offer" && (
        <>
          <circle cx="7" cy="7" r="6.5" fill="currentColor" />
          <path
            d="M4.4 7.2 6.2 9 9.7 5.3"
            stroke="var(--background)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {stage === "closed" && (
        <>
          <circle cx="7" cy="7" r="6.5" fill="currentColor" />
          <path
            d="M5 5 9 9M9 5 5 9"
            stroke="var(--background)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}

export { StageIcon, STAGE_LABEL, type Stage }
