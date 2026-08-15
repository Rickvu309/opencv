// The Paper module's public surface. Callers see `Paper` and a few helpers.
// CV theme, section defaults, and paragraph splitting stay next to the layouts.

export type {
  Paper,
  PaperType,
  LetterType,
  CvPaper,
  LetterPaper,
} from "./types";
export {
  paperTypes,
  letterTypes,
  paperTypeLabels,
  isCvPaper,
  isLetterPaper,
  cvsOf,
  lettersOf,
} from "./types";
export { migrateStateShape, papersFromLegacy } from "./migrate";
export { photoUrl, visiblePhotoUrl } from "./photo-url";
export { letterTargets, openingForPaper, type LetterTarget } from "./opening";
