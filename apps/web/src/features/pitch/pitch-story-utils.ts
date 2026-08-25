import type { PitchStoryHighlight } from "@/features/pitch/pitch-types.ts"

export type StoryViewerState = {
  highlightId: string
  slideIndex: number
} | null

export function findHighlight(highlights: PitchStoryHighlight[], id: string) {
  return highlights.find((h) => h.id === id)
}

export function nextSlideIndex(
  highlight: PitchStoryHighlight,
  slideIndex: number
) {
  if (slideIndex < highlight.slides.length - 1) return slideIndex + 1
  return null
}

export function prevSlideIndex(slideIndex: number) {
  if (slideIndex > 0) return slideIndex - 1
  return null
}

export function nextHighlightId(
  highlights: PitchStoryHighlight[],
  currentId: string
) {
  const i = highlights.findIndex((h) => h.id === currentId)
  if (i < 0 || i >= highlights.length - 1) return null
  return highlights[i + 1]!.id
}

export function prevHighlightId(
  highlights: PitchStoryHighlight[],
  currentId: string
) {
  const i = highlights.findIndex((h) => h.id === currentId)
  if (i <= 0) return null
  return highlights[i - 1]!.id
}
