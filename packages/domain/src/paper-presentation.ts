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
  paperParagraphStyles,
  paperParagraphStyle,
  paragraphStyleValues,
  paragraphInlineValues,
  wordParagraphStyleId,
} from "./paper-doc/paragraph-styles.js"
export type { PaperParagraphStyle } from "./paper-doc/paragraph-styles.js"
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
export {
  privateLayoutSchema,
  privatePhotoLayoutSchema,
  layoutDocumentSchema,
  photoLayoutTableSchema,
  photoLayoutRowSchema,
  photoLayoutCellSchema,
  layoutTableSchema,
} from "./paper-doc/native-layout.js"
export type {
  PrivateLayoutDocument,
  LayoutDocument,
  LayoutTable,
  LayoutRow,
  LayoutCell,
} from "./paper-doc/native-layout.js"
export {
  prepareLayoutEdit,
  reverseLayoutEdit,
  layoutReceiptSchema,
} from "./paper-doc/native-layout-edit.js"
export type { LayoutReceipt } from "./paper-doc/native-layout-edit.js"

export { layoutPhotoSchema, photoBounds } from "./paper-doc/native-photo.js"
export type { LayoutPhoto } from "./paper-doc/native-photo.js"
export {
  prepareLayoutPhotoEdit,
  reverseLayoutPhotoEdit,
  layoutPhotoReceiptSchema,
  layoutPhotoEditSchema,
} from "./paper-doc/native-photo-edit.js"
export type { LayoutPhotoReceipt } from "./paper-doc/native-photo-edit.js"
export {
  flowDocumentSchema,
  flowSectionSchema,
} from "./paper-doc/native-layout-flow.js"
export type {
  FlowDocument,
  FlowSection,
} from "./paper-doc/native-layout-flow.js"
export {
  flowReceiptSchema,
  prepareFlowEdit,
  reverseFlowEdit,
} from "./paper-doc/native-layout-flow-edit.js"
