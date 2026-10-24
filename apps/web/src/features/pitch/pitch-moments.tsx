import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Plus } from "lucide-react"

import { ComingSoon } from "@/components/coming-soon.tsx"
import { StoryPhoto } from "@/features/pitch/pitch-stories.tsx"
import {
  pitchToneClass,
  type PitchBentoCard,
} from "@/features/pitch/pitch-types.ts"

export function MomentsBentoSection({
  cards,
  editing,
  onHide,
  onOpenStory,
}: {
  cards: PitchBentoCard[]
  editing?: boolean
  onHide?: () => void
  onOpenStory: (highlightId: string) => void
}) {
  return (
    <section className="group relative">
      {editing ? (
        <div className="absolute -top-1 right-0 flex gap-1">
          <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-2xs text-muted-foreground shadow-sm">
            Moments
          </span>
          {onHide ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onHide}
              className="h-auto px-1.5 py-0.5 text-2xs"
            >
              Hide
            </Button>
          ) : null}
        </div>
      ) : null}

      <h2 className="mb-4 text-micro font-medium tracking-widest text-muted-foreground uppercase">
        Moments
      </h2>

      <div className="grid auto-rows-[minmax(7rem,auto)] grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <BentoCard
            key={card.id}
            card={card}
            onOpenStory={
              card.storyHighlightId
                ? () => onOpenStory(card.storyHighlightId!)
                : undefined
            }
          />
        ))}
        {editing ? (
          <Button
            type="button"
            disabled
            variant="ghost"
            className="flex h-auto min-h-[7rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-muted-foreground"
          >
            <Plus className="size-4" />
            <span className="text-2xs">Add card</span>
            <ComingSoon />
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function BentoCard({
  card,
  onOpenStory,
}: {
  card: PitchBentoCard
  onOpenStory?: () => void
}) {
  const span =
    card.span === "tall"
      ? "row-span-2"
      : card.span === "wide"
        ? "col-span-2 sm:col-span-2"
        : ""

  const hasPhoto = Boolean(card.image)
  const isPhotoCard =
    hasPhoto && (card.kind === "story" || card.kind === "visual")

  const inner = (
    <div
      className={cn(
        "relative flex h-full min-h-[7rem] flex-col justify-end overflow-hidden rounded-2xl shadow-[0_2px_12px_oklch(0_0_0/0.06)] ring-1 ring-black/[0.04] transition-transform active:scale-[0.98]",
        !isPhotoCard && "justify-between p-4",
        !isPhotoCard && pitchToneClass(card.tone),
        !isPhotoCard &&
          (card.tone === "dark" ? "text-white" : "text-foreground"),
        onOpenStory && "cursor-pointer hover:shadow-md"
      )}
    >
      {isPhotoCard ? (
        <>
          <StoryPhoto
            src={card.image!}
            alt={card.title}
            className="absolute inset-0 size-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="relative p-4 text-white">
            {card.kind === "story" ? (
              <Plus className="mb-2 size-4 opacity-80" />
            ) : null}
            <p className="text-sm font-semibold">{card.title}</p>
            {card.body ? (
              <p className="mt-1 text-xs text-white/80">{card.body}</p>
            ) : null}
          </div>
        </>
      ) : card.kind === "stat" ? (
        <>
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {card.title}
          </p>
          <div>
            <p className="text-sm font-medium">{card.body}</p>
            {card.meta ? (
              <p className="mt-0.5 text-2xs opacity-70">{card.meta}</p>
            ) : null}
          </div>
        </>
      ) : card.kind === "link" ? (
        <>
          <p className="font-mono text-sm font-semibold">{card.title}</p>
          <p className="text-xs opacity-70">{card.meta ?? card.body}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">{card.title}</p>
          {card.body ? (
            <p className="text-xs leading-relaxed opacity-75">{card.body}</p>
          ) : null}
        </>
      )}
    </div>
  )

  if (onOpenStory) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onOpenStory}
        aria-label={`${card.title} story`}
        className={cn("h-auto p-0 text-left hover:bg-transparent", span)}
      >
        {inner}
      </Button>
    )
  }

  return <div className={span}>{inner}</div>
}
