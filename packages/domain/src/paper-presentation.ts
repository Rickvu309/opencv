export {
  ok,
  refuse,
  parse,
  canonical,
  overlay,
  paragraphSchema,
  inlineSchema,
  inlineOperationsSchema,
} from "./paper-doc/presentation-values.js"
export type { Result } from "./paper-doc/presentation-values.js"
export {
  documentPresentationSchema,
  isWellFormed,
  rangeSchema,
  checkSnapshot,
  validatePresentationPatch,
  validatedPatchSchema,
} from "./paper-doc/presentation-edit.js"
export type {
  DocumentPresentation,
  BodyTextRange,
  PresentationSnapshot,
  ValidatedPresentationPatch,
  PropertyChange,
} from "./paper-doc/presentation-edit.js"
export {
  inlinePatchSchema,
  paragraphPatchSchema,
  fontIdSchema,
  styleIdSchema,
} from "./paper-doc/presentation-values.js"
export type {
  InlinePresentation,
  ParagraphPresentation,
} from "./paper-doc/presentation-values.js"
export {
  formattedDocumentSchema,
  formatRunSchema,
  formatRunsSchema,
  mergeFormatRuns,
} from "./paper-doc/native-formatting.js"
export type {
  FormatRun,
  FormatNode,
  FormatBody,
  FormatOwner,
  FormatField,
  PrivateFormattedDocument,
} from "./paper-doc/native-formatting.js"
export {
  formatTargetSchema,
  formatChangeSchema,
} from "./paper-doc/native-formatting-patch.js"
export type {
  FormatTarget,
  FormatChange,
} from "./paper-doc/native-formatting-patch.js"
export {
  styleSchema,
  resolveStyles,
  resolveInline,
  resolveParagraph,
} from "./paper-doc/presentation-styles.js"
