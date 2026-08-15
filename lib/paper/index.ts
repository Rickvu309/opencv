// The Paper module's public surface. Callers see `Paper` and the helpers they
// actually use. Theme, section defaults, and layout stay next to the layouts.

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
export { cvCompleteness } from "./cv";
export { paragraphsOf } from "./letter";
