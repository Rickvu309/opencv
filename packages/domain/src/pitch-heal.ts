import type { PitchDocument } from "./pitch-codecs.js"
import { starterPitchDocument } from "./starter.js"

/** Non-Moments fields that mean this is a real Pitch, not the empty schema default. */
export function pitchHasSurvivingBody(doc: PitchDocument): boolean {
  return (
    doc.headline.trim() !== "" ||
    doc.location.trim() !== "" ||
    doc.status.trim() !== "" ||
    doc.about.trim() !== "" ||
    doc.achievements.length > 0 ||
    doc.experience.length > 0 ||
    doc.gallery.length > 0 ||
    doc.files.length > 0 ||
    doc.links.length > 0 ||
    doc.workDocs.length > 0
  )
}

/**
 * QVE-221: starter Moments cannot be emptied in the UI (add chip/card is
 * coming soon). Empty arrays on a Pitch that still has body are a wipe —
 * restore the honest starter highlights + bento so heal write-back cannot
 * persist `[]`. The empty schema default stays empty.
 */
export function restoreWipedStarterMoments(doc: PitchDocument): PitchDocument {
  const missingHighlights = doc.storyHighlights.length === 0
  const missingBento = doc.bento.length === 0
  if (!missingHighlights && !missingBento) return doc
  if (!pitchHasSurvivingBody(doc)) return doc

  const starter = starterPitchDocument()
  return {
    ...doc,
    storyHighlights: missingHighlights
      ? starter.storyHighlights
      : doc.storyHighlights,
    bento: missingBento ? starter.bento : doc.bento,
  }
}

/**
 * Persist guard: leftover-persona heal must not write empty Moments arrays
 * over a document that still had them.
 */
export function preservePitchMoments(
  previous: PitchDocument | undefined,
  next: PitchDocument
): PitchDocument {
  if (!previous) return next
  const storyHighlights =
    next.storyHighlights.length === 0 && previous.storyHighlights.length > 0
      ? previous.storyHighlights
      : next.storyHighlights
  const bento =
    next.bento.length === 0 && previous.bento.length > 0
      ? previous.bento
      : next.bento
  if (storyHighlights === next.storyHighlights && bento === next.bento) {
    return next
  }
  return { ...next, storyHighlights, bento }
}
