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
