// The Paper module's public surface. Callers see `Paper` and the helpers they
// actually use. Theme, section defaults, and layout stay next to the layouts.

export type {
  Paper,
  PaperType,
  PaperUpload,
  PaperUploadKind,
  PaperWord,
  LetterSituation,
  CvPaper,
  LetterPaper,
  ProofPaper,
  ProofNote,
} from "./types";
export {
  paperTypes,
  paperTypeLabels,
  letterSituations,
  isCvPaper,
  isLetterPaper,
  isProofPaper,
  cvsOf,
  lettersOf,
  proofsOf,
} from "./types";
export { migrateStateShape, papersFromLegacy, uploadsFromLegacy } from "./migrate";
export { photoUrl, visiblePhotoUrl } from "./photo-url";
export { letterTargets, openingForPaper, type LetterTarget } from "./opening";
export { cvCompleteness, wordForTemplate, templates, templateHasPhoto } from "./cv";
export { paragraphsOf, letterScaffold, letterSituationLabels } from "./letter";
