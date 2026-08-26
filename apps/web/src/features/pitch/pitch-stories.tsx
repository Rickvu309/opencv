/**
 * Instagram-style story highlights + fullscreen viewer.
 */
import { useCallback, useEffect, useState, type ImgHTMLAttributes } from "react"
import { Button } from "@workspace/ui/components/button"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeft, ChevronRight, Pause, Play, Plus, X } from "lucide-react"

import { PitchAvatar } from "@/features/pitch/pitch-showcase.tsx"
import {
  findHighlight,
  nextHighlightId,
  nextSlideIndex,
  prevHighlightId,
  prevSlideIndex,
  type StoryViewerState,
} from "@/features/pitch/pitch-story-utils.ts"
import {
  pitchToneClass,
  type PitchBentoCard,
  type PitchProfile,
  type PitchStoryHighlight,
  type PitchStorySlide,
} from "@/features/pitch/pitch-types.ts"

function StoryPhoto({
  src,
  alt,
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover outline outline-1 outline-black/10", className)}
      loading="lazy"
      {...props}
    />
  )
}

export function StoryHighlightsRow({
  highlights,
  editing,
  onOpen,
}: {
  highlights: PitchStoryHighlight[]
  editing?: boolean
  onOpen: (highlightId: string) => void
}) {
  return (
    <div className="mb-10 -mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex gap-4">
        {highlights.map((h) => (
          <Button
            key={h.id}
            type="button"
            variant="ghost"
            aria-label={`${h.label} highlight`}
            onClick={() => onOpen(h.id)}
            className="h-auto w-[4.5rem] shrink-0 flex-col items-center gap-1.5 px-0 py-0 hover:bg-transparent"
          >
            <span
              className={cn(
                "flex size-[4.25rem] items-center justify-center overflow-hidden rounded-full p-[2px]",
                "bg-gradient-to-tr from-chart-1 via-chart-3 to-chart-5"
              )}
            >
              {h.coverImage ? (
                <span className="size-full overflow-hidden rounded-full border-2 border-background">
                  <StoryPhoto
                    src={h.coverImage}
                    alt=""
                    className="size-full"
                  />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-full items-center justify-center rounded-full border-2 border-background text-2xs font-bold tracking-tight text-foreground/70",
                    pitchToneClass(h.coverTone)
                  )}
                >
                  {h.label.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>
            <span className="max-w-full truncate text-micro font-normal text-muted-foreground">
              {h.label}
            </span>
          </Button>
        ))}
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-[4.5rem] shrink-0 flex-col items-center gap-1.5 px-0 py-0 hover:bg-transparent"
          >
            <span className="flex size-[4.25rem] items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
              <Plus className="size-5 text-muted-foreground" />
            </span>
            <span className="text-micro font-normal text-muted-foreground">
              New
            </span>
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-center text-2xs text-muted-foreground/80">
        Tap a highlight to watch work moments · like Instagram Stories
      </p>
    </div>
  )
}

export function PitchStoryViewer({
  highlights,
  profile,
  state,
  onClose,
  onChange,
}: {
  highlights: PitchStoryHighlight[]
  profile: PitchProfile
  state: StoryViewerState
  onClose: () => void
  onChange: (state: StoryViewerState) => void
}) {
  const highlight = state ? findHighlight(highlights, state.highlightId) : null
  const slide = highlight && state ? highlight.slides[state.slideIndex] : null
  const slideDuration = slide?.durationMs ?? 5000

  const goNext = useCallback(() => {
    if (!state || !highlight) return
    const next = nextSlideIndex(highlight, state.slideIndex)
    if (next !== null) {
      onChange({ ...state, slideIndex: next })
      return
    }
    const nextH = nextHighlightId(highlights, state.highlightId)
    if (nextH) onChange({ highlightId: nextH, slideIndex: 0 })
    else onClose()
  }, [state, highlight, highlights, onChange, onClose])

  const goPrev = useCallback(() => {
    if (!state || !highlight) return
    const prev = prevSlideIndex(state.slideIndex)
    if (prev !== null) {
      onChange({ ...state, slideIndex: prev })
      return
    }
    const prevH = prevHighlightId(highlights, state.highlightId)
    if (prevH) {
      const h = findHighlight(highlights, prevH)
      onChange({
        highlightId: prevH,
        slideIndex: Math.max(0, (h?.slides.length ?? 1) - 1),
      })
    }
  }, [state, highlight, highlights, onChange])

  useEffect(() => {
    if (!state) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state, onClose, goNext, goPrev])

  if (!state || !highlight || !slide) return null

  const prevH = prevHighlightId(highlights, state.highlightId)
  const nextH = nextHighlightId(highlights, state.highlightId)
  const prevPreview = prevH ? findHighlight(highlights, prevH) : null
  const nextPreview = nextH ? findHighlight(highlights, nextH) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="Work story viewer"
    >
      {/* Documented exception: photographic overlays on the story viewer — black/white sit on photos, not product chrome. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 size-9 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
        aria-label="Close"
      >
        <X className="size-5" />
      </Button>

      {prevPreview ? (
        <div
          className="pointer-events-none absolute left-[6%] hidden h-[70vh] w-[10rem] overflow-hidden rounded-2xl opacity-30 blur-sm lg:block"
          aria-hidden
        >
          <StoryFramePreview highlight={prevPreview} />
        </div>
      ) : null}
      {nextPreview ? (
        <div
          className="pointer-events-none absolute right-[6%] hidden h-[70vh] w-[10rem] overflow-hidden rounded-2xl opacity-30 blur-sm lg:block"
          aria-hidden
        >
          <StoryFramePreview highlight={nextPreview} />
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={goPrev}
        className="absolute left-3 z-10 hidden size-9 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:flex"
        aria-label="Previous"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={goNext}
        className="absolute right-3 z-10 hidden size-9 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:flex"
        aria-label="Next"
      >
        <ChevronRight className="size-5" />
      </Button>

      <div className="relative mx-4 flex h-[min(85vh,720px)] w-full max-w-[min(100%,380px)] flex-col">
        <StoryFrame
          key={`${state.highlightId}-${state.slideIndex}`}
          profile={profile}
          highlight={highlight}
          slide={slide}
          slideIndex={state.slideIndex}
          slideDuration={slideDuration}
          onNext={goNext}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        className="absolute inset-y-0 left-0 z-[5] h-auto w-1/3 rounded-none bg-transparent hover:bg-transparent sm:hidden"
        aria-label="Previous slide"
        onClick={goPrev}
      />
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-y-0 right-0 z-[5] h-auto w-1/3 rounded-none bg-transparent hover:bg-transparent sm:hidden"
        aria-label="Next slide"
        onClick={goNext}
      />
    </div>
  )
}

function StoryFrame({
  profile,
  highlight,
  slide,
  slideIndex,
  slideDuration,
  onNext,
}: {
  profile: PitchProfile
  highlight: PitchStoryHighlight
  slide: PitchStorySlide
  slideIndex: number
  slideDuration: number
  onNext: () => void
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", false)
  const [paused, setPaused] = useState(reduceMotion)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (reduceMotion) setPaused(true)
  }, [reduceMotion])

  useEffect(() => {
    if (paused || reduceMotion) return
    const start = performance.now()
    let frame = 0
    function tick(now: number) {
      const p = Math.min(1, (now - start) / slideDuration)
      setProgress(p)
      if (p < 1) frame = requestAnimationFrame(tick)
      else onNext()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, reduceMotion, slideDuration, onNext])

  function onTogglePause() {
    setPaused((p) => !p)
  }
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-foreground shadow-2xl ring-1 ring-white/10">
      <div className="absolute top-0 right-0 left-0 z-20 flex gap-1 px-3 pt-3">
        {highlight.slides.map((s, i) => (
          <div
            key={s.id}
            className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
              style={{
                width:
                  i < slideIndex
                    ? "100%"
                    : i === slideIndex
                      ? `${progress * 100}%`
                      : "0%",
              }}
            />
          </div>
        ))}
      </div>

      <div className="relative z-20 flex items-center gap-2 px-3 pt-6 pb-2">
        <PitchAvatar
          src={profile.avatar}
          name={profile.name}
          className="size-8 sm:size-8"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {profile.name}
          </p>
          <p className="truncate text-micro text-white/60">{highlight.label}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onTogglePause}
          className="rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? (
            <Play className="size-4" />
          ) : (
            <Pause className="size-4" />
          )}
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        {slide.image ? (
          <>
            <StoryPhoto
              src={slide.image}
              alt=""
              className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
              aria-hidden
            />
            <div className="absolute inset-0 bg-black/20" aria-hidden />
            <div className="relative flex h-full items-center justify-center p-4 pt-2">
              <StoryPhoto
                src={slide.image}
                alt={slide.caption}
                className="max-h-[min(52vh,420px)] w-full max-w-[280px] rounded-xl object-cover shadow-2xl"
              />
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "absolute inset-0 scale-110 blur-2xl opacity-60",
                pitchToneClass(slide.tone)
              )}
              aria-hidden
            />
            <div className="relative flex h-full flex-col items-center justify-center p-6">
              <div
                className={cn(
                  "flex aspect-[4/5] w-full max-w-[240px] flex-col items-center justify-center rounded-xl p-6 shadow-lg ring-1 ring-black/10",
                  pitchToneClass(slide.tone)
                )}
              >
                <p className="text-center text-lg font-semibold tracking-tight text-foreground/90">
                  {slide.caption}
                </p>
                {slide.detail ? (
                  <p className="mt-2 text-center text-xs leading-relaxed text-foreground/60">
                    {slide.detail}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="relative z-20 p-4 pt-2">
        <p className="inline-block max-w-full rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
          {slide.caption}
        </p>
        {slide.detail && slide.image ? (
          <p className="mt-1.5 max-w-[90%] text-xs leading-snug text-white/70">
            {slide.detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function StoryFramePreview({ highlight }: { highlight: PitchStoryHighlight }) {
  const slide = highlight.slides[0]
  if (!slide) return null
  if (slide.image ?? highlight.coverImage) {
    return (
      <StoryPhoto
        src={slide.image ?? highlight.coverImage!}
        alt={highlight.label}
        className="size-full"
      />
    )
  }
  return (
    <div className={cn("h-full w-full", pitchToneClass(slide.tone))}>
      <div className="flex h-full items-center justify-center p-4 text-center text-xs font-medium opacity-70">
        {highlight.label}
      </div>
    </div>
  )
}

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
            variant="ghost"
            className="flex min-h-[7rem] h-auto flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-muted-foreground hover:bg-muted/30"
          >
            <Plus className="size-4" />
            <span className="text-2xs">Add card</span>
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
          <p className="text-xs opacity-70">
            {card.meta ?? card.body}
            <span className="ml-1">↗</span>
          </p>
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
        className={cn("h-auto p-0 text-left hover:bg-transparent", span)}
      >
        {inner}
      </Button>
    )
  }

  return <div className={span}>{inner}</div>
}
