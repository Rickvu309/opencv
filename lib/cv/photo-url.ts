import { templateHasPhoto, type Resume } from "./types";

export type { Resume };

/**
 * Where this CV's photo is fetched from, or null when it has none.
 *
 * One definition, used by the editor, the preview and the printed copy, so the
 * three cannot disagree about whether a photo exists.
 *
 * The stamp is in the query string on purpose. Without it, replacing a photo
 * leaves the browser showing the old one from its cache, and the user is left
 * clicking upload again on a picture that did upload.
 */
export function photoUrl(resume: Resume): string | null {
  if (!resume.photoStamp) return null;
  return `/api/cv-photo?resumeId=${encodeURIComponent(resume.id)}&v=${encodeURIComponent(resume.photoStamp)}`;
}

/**
 * Should this CV show a photo right now?
 *
 * Two conditions, and both matter: the user has uploaded one, and the template
 * they have chosen has somewhere to put it. Switching to the international
 * template hides the photo rather than deleting it, so switching back brings it
 * straight home. AC-PAPERS-010.4.
 */
export function visiblePhotoUrl(resume: Resume): string | null {
  return templateHasPhoto(resume.theme.template) ? photoUrl(resume) : null;
}
