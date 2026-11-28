export type {
  CvPaper,
  LetterPaper,
  PaperDocument,
  NativePaperDocument,
} from "./document.js"
export {
  blankCv,
  blankLetter,
  paperDocumentSchema,
  legacyPaperDocumentSchema,
  nativePaperDocumentSchema,
} from "./document.js"
export { emptyRichPaper } from "./blank-canvas.js"

export type {
  Bullet,
  CvPaperBlock,
  CvSectionKind,
  Divider,
  Heading,
  ListItem,
  NodeId,
  Numbered,
  Paragraph,
  ProseBlock,
} from "./nodes.js"
export { HEADER_NODE_ID } from "./nodes.js"

export type { RichText, SafeHref, TextRun } from "./rich-text.js"
export { isSafeHref, normalizeRuns, plainTextOfRuns } from "./rich-text.js"

export type {
  CvContact,
  CvDocument,
  CvEducation,
  CvExperience,
  CvPrintModel,
  CvProject,
  CvSkillGroup,
  CvTemplateId,
  LetterPrintList,
} from "./print.js"
export { cvPrintModel, letterPrintModel } from "./print.js"

export type { PaperChange } from "./changes.js"

export type { NativeBasis, NativeProvenance } from "./native.js"
export {
  nativeBasisSchema,
  nativeProvenance,
  nativeProvenanceSchema,
  sameNativeProvenance,
} from "./native.js"
export {
  richPaperDocumentSchema,
  storedPaperDocumentSchema,
} from "./stored-document.js"
export type { RichPaperDocument } from "./stored-document.js"

export { cvRichTextSchema, cvSlots } from "./cv-fields.js"
export type { CvField } from "./cv-fields.js"
export { nativeCvDocumentSchema } from "./native-cv.js"
export type { NativeCvDocument, CvOwner, CvBody } from "./native-cv.js"
