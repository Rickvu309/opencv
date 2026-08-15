import { templateHasPhoto, type CvPaper } from "./types";

export function photoUrl(paper: CvPaper): string | null {
  if (!paper.photoStamp) return null;
  return `/api/paper-photo?paperId=${encodeURIComponent(paper.id)}&v=${encodeURIComponent(paper.photoStamp)}`;
}

export function visiblePhotoUrl(paper: CvPaper): string | null {
  return templateHasPhoto(paper.theme.template) ? photoUrl(paper) : null;
}
