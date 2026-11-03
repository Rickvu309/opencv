export type {
  Clash,
  ClashId,
  CvPaper,
  LetterPaper,
  PaperDocument,
  SectionGroup,
} from "./document.js"
export {
  blankCv,
  blankLetter,
  clashSchema,
  paperDocumentSchema,
  sectionsOf,
} from "./document.js"

export type {
  Bullet,
  CvPaperBlock,
  CvHeader,
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
  CvPrintModel,
  LetterFragment,
  LetterPrintItem,
  LetterPrintList,
  LetterPrintModel,
} from "./print.js"
export { cvPrintModel, letterPrintModel, paperPlainText } from "./print.js"

export type { StoredShape, Upgraded, UpgradeRefusalReason } from "./upgrade.js"
export { upgradeStoredPaper } from "./upgrade.js"

export { legacyPaperOf } from "./legacy.js"
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
