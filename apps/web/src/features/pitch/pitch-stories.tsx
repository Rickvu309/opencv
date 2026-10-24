/** Story highlights row and the fullscreen viewer. */
import { useCallback, useEffect, useState, type ImgHTMLAttributes } from "react"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeft, ChevronRight, Pause, Play, Plus, X } from "lucide-react"

import { ComingSoon } from "@/components/coming-soon.tsx"
import { comingSoonLabel } from "@/components/coming-soon-label.ts"
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
  type PitchProfile,
  type PitchStoryHighlight,
  type PitchStorySlide,
} from "@/features/pitch/pitch-types.ts"

export function StoryPhoto({
  src,
  alt,
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "object-cover outline outline-1 outline-black/10",
        className
      )}
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
    <div className="-mx-1 mb-10 overflow-x-auto px-1 pb-1">
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
                  <StoryPhoto src={h.coverImage} alt="" className="size-full" />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-full items-center justify-center rounded-full border-2 border-background text-xs font-bold tracking-tight",
                    pitchToneClass(h.coverTone)
                  )}
                >
                  {h.label.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>
            <span className="max-w-full truncate text-xs font-normal text-muted-foreground">
              {h.label}
            </span>
          </Button>
        ))}
        {editing ? (
          <Button
            type="button"
            disabled
            variant="ghost"
            aria-label={comingSoonLabel("New highlight")}
            className="h-auto w-[4.5rem] shrink-0 flex-col items-center gap-1.5 px-0 py-0"
          >
            <span className="flex size-[4.25rem] items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
              <Plus className="size-5 text-muted-foreground" />
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              New
            </span>
            <ComingSoon silent />
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap a highlight to play it.
      </p>
    </div>
  )
}

const VIEWER_SELECTOR =
  '[data-slot="dialog-content"][aria-label="Work story viewer"]'

function trapTab(e: KeyboardEvent) {
  const viewer = document.querySelector<HTMLElement>(VIEWER_SELECTOR)
  if (!viewer) return
  const stops = [
    ...viewer.querySelectorAll<HTMLButtonElement>("button"),
  ].filter((b) => !b.disabled && b.getClientRects().length > 0)
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  const outside = !viewer.contains(active)
  if (e.shiftKey && (outside || active === first)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (outside || active === last)) {
    e.preventDefault()
    first.focus()
  }
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
      if (e.key === "Tab") trapTab(e)
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state, goNext, goPrev])

  if (!state || !highlight || !slide) return null

  const prevH = prevHighlightId(highlights, state.highlightId)
  const nextH = nextHighlightId(highlights, state.highlightId)
  const prevPreview = prevH ? findHighlight(highlights, prevH) : null
  const nextPreview = nextH ? findHighlight(highlights, nextH) : null

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        aria-label="Work story viewer"
        showCloseButton={false}
        overlayClassName="bg-black/92 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
        className="top-0 left-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 rounded-none bg-transparent p-0 shadow-none ring-0 sm:max-w-none"
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
      </DialogContent>
    </Dialog>
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
  const [userPaused, setUserPaused] = useState(false)
  const paused = reduceMotion || userPaused
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (paused) return
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
  }, [paused, slideDuration, onNext])

  function onTogglePause() {
    if (reduceMotion) return
    setUserPaused((p) => !p)
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
              className="h-full rounded-full bg-white"
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
          <p className="truncate text-xs text-white/60">{highlight.label}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onTogglePause}
          className="rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
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
                "absolute inset-0 scale-110 opacity-60 blur-2xl",
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
                <p className="text-center text-lg font-semibold tracking-tight">
                  {slide.caption}
                </p>
                {slide.detail ? (
                  <p className="mt-2 text-center text-xs leading-relaxed opacity-80">
                    {slide.detail}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>

      {slide.image ? (
        <div className="relative z-20 p-4 pt-2">
          <p className="inline-block max-w-full rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
            {slide.caption}
          </p>
          {slide.detail ? (
            <p className="mt-1.5 max-w-[90%] text-xs leading-snug text-white/70">
              {slide.detail}
            </p>
          ) : null}
        </div>
      ) : null}
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
