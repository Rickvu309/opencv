export type {
  Clash,
  ClashId,
  CvPaper,
  LetterPaper,
  PaperDocument,
  LegacyPaperDocument,
  NativePaperDocument,
  SectionGroup,
} from "./document.js"
export {
  blankPaper,
  blankCv,
  blankLetter,
  clashSchema,
  paperDocumentSchema,
  legacyPaperDocumentSchema,
  nativePaperDocumentSchema,
  nativePaperFromLegacy,
  sectionsOf,
} from "./document.js"

export type {
  Bullet,
  CvPaperBlock,
  CvHeader,
  CvSectionKind,
  CvSectionMarker,
  Divider,
  EducationEntry,
  EntryBlock,
  ExperienceEntry,
  Heading,
  ListItem,
  NodeFieldSet,
  NodeId,
  NodeSpec,
  Numbered,
  PaperNode,
  PaperNodeType,
  Paragraph,
  ProseBlock,
  SkillsGroup,
} from "./nodes.js"
export { HEADER_NODE_ID, nodeFieldSetSchema, paperNodeSpecs } from "./nodes.js"

export type { RichText, SafeHref, TextRun } from "./rich-text.js"
export {
  inlineMarkdownOf,
  isSafeHref,
  normalizeRuns,
  plainTextOfRuns,
  richTextFromInlineMarkdown,
  richTextOf,
  richTextSchema,
  safeHrefSchema,
} from "./rich-text.js"

export type {
  CvContact,
  CvDocument,
  CvEducation,
  CvExperience,
  CvPrintModel,
  CvProject,
  CvSkillGroup,
  CvTemplateId,
  LetterFragment,
  LetterPrintItem,
  LetterPrintList,
  LetterPrintModel,
} from "./print.js"
export {
  cvPrintModel,
  emptyCvDocument,
  letterPrintModel,
  paperPlainText,
} from "./print.js"

export type { StoredShape, Upgraded, UpgradeRefusalReason } from "./upgrade.js"
export { paragraphPaper, upgradeStoredPaper } from "./upgrade.js"

export { mergeLegacyEdit } from "./merge.js"

export { paperSyncInputSchema, paperSyncOutputSchema } from "./sync.js"

export type { PaperEdit, PaperEditOutcome } from "./edits-schema.js"
export { paperEditOutcomeSchema, paperEditSchema } from "./edits-schema.js"
export type { AppliedEdits, EditEffect } from "./edits.js"
export { applyPaperEdits } from "./edits.js"
export type { PaperOutline } from "./outline.js"
export { paperOutline } from "./outline.js"
export type { PaperChange } from "./changes.js"
export { paperChanges } from "./changes.js"

export { effectsMissing, personWorkLost, undoProblems } from "./safety.js"
export type { UndoPlan } from "./undo.js"
export { undoCoachEdit } from "./undo.js"

export { canonical as canonicalPaper, rebuiltBy } from "./tree.js"

export type { PaperRepair, RepairHints } from "./repair.js"
export { nodeFingerprint, repairPaper } from "./repair.js"
export { rebasePending } from "./rebase.js"

export type { NativeBasis, NativeProvenance, NativeWriter } from "./native.js"
export {
  NATIVE_WRITER,
  RICH_NATIVE_WRITER,
  nativeAdmission,
  nativeBasisSchema,
  nativeMigrateInputSchema,
  nativeProvenance,
  nativeProvenanceSchema,
  nativeSyncInputSchema,
  nativeSyncOutputSchema,
  nativeWriterSchema,
  sameNativeProvenance,
} from "./native.js"
export { retainUnderline } from "./merge-text.js"
export {
  richPaperDocumentSchema,
  storedPaperDocumentSchema,
  requirePaperDocument,
  storedPaperPhotoIds,
} from "./stored-document.js"
export type {
  RichPaperDocument,
  StoredPaperDocument,
} from "./stored-document.js"

export { cvSlots, cvFieldSchema, cvRichTextSchema } from "./cv-fields.js"
export type {
  CvField,
  CvFieldKey,
  CvFieldTarget,
  CvFieldRange,
} from "./cv-fields.js"
export { nativeCvDocumentSchema, cvBodySchema, cvOwners } from "./native-cv.js"
export type {
  NativeCvDocument,
  CvOwner,
  CvOwnerType,
  CvBody,
} from "./native-cv.js"
export {
  resolveCvField,
  replaceCvFieldRange,
  formatCvFieldRange,
} from "./cv-field-edits.js"
export type { CvFieldEdit, CvFieldMarks } from "./cv-field-edits.js"
export { projectCvDocument } from "./cv-projection.js"
export type { CvProjection } from "./cv-projection.js"
