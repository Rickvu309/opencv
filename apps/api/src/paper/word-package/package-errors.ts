import { CommandError } from "../../platform/errors.js"

export type PackageRefusalReason = { code: string; message: string }

const messages: Record<string, string> = {
  EMPTY_TARGET:
    "This text region is empty. Choose a region containing the exact words to replace.",
  EMPTY_BEFORE_TEXT:
    "Choose the exact words to replace. Inserting without selected words is not supported yet.",
  AMBIGUOUS_BEFORE_TEXT:
    "Those words occur more than once in this region. Include enough surrounding text to choose one occurrence.",
  UNSUPPORTED_TARGET_ATTRIBUTE:
    "Paper cannot safely interpret an attribute attached to this text yet.",
  UNSUPPORTED_TARGET_PROPERTY:
    "Paper cannot safely preserve a property attached to this text yet.",
  UNPROVEN_EXTENSION_REACH:
    "This file uses an extension whose effect on the text Paper cannot establish yet.",
  UNPROVEN_STORY_CONSUMER:
    "Another feature in this file may depend on the text. Paper cannot safely change it yet.",
  UNPROVEN_FIELD_CONSUMER:
    "A field in this file may depend on these words. Paper cannot safely update it yet.",
  UNPROVEN_IDENTITY_REACH:
    "Paper cannot safely update this text's version or its references yet.",
  UNPROVEN_BINDING_REACH:
    "This file links text to stored data that Paper cannot safely update yet.",
  UNPROVEN_SETTINGS:
    "Paper cannot establish how a document setting affects this text yet.",
  UNPROVEN_DOCUMENT_PROTECTION:
    "This file has protection or editing settings that Paper will not bypass.",
  UNPROVEN_LABEL_POLICY:
    "Paper cannot establish the editing policy of this file's label yet.",
  UNPROVEN_FONT_REFERENCE:
    "This file has an embedded font reference Paper cannot safely preserve yet.",
  UNPROVEN_STYLE:
    "Paper cannot safely resolve the styles used by this text yet.",
  UNPROVEN_NUMBERING:
    "Paper cannot safely resolve the numbering used by this text yet.",
  UNPROVEN_THEME: "Paper cannot safely resolve a theme used by this text yet.",
  PARAGRAPH_VERSION_HISTORY_MISMATCH:
    "This text's retained version history is unavailable or full. The document has not changed.",
  UNSUPPORTED_STORY_OR_ANCESTOR:
    "This text is in a section or table layout Paper cannot safely edit yet.",
  CROSS_PARAGRAPH_RANGE_OR_FIELD:
    "This text is connected to a field, bookmark or comment. Paper cannot safely change it yet.",
  OPAQUE_OR_SECTION_BOUNDARY:
    "This paragraph contains a section boundary or content Paper does not understand yet.",
  UNSUPPORTED_BIDI:
    "Paper cannot safely preserve this paragraph's text direction yet.",
  UNSUPPORTED_PARAGRAPH_STRUCTURE:
    "This paragraph contains a link, field, tracked change or another structure Paper cannot safely edit yet.",
  UNSUPPORTED_RUN_STRUCTURE:
    "This text includes a break, tab or another structure Paper cannot safely replace yet.",
  MIXED_OR_MISSING_TEXT_NODE:
    "This text is split across text elements that Paper cannot safely replace together yet.",
  MIXED_OR_MISSING_RUN: "This paragraph has no supported text span to replace.",
  TRACKED_TABLE_REVISION:
    "This table row or cell has a pending tracked change. Accept or reject it in Word before editing this text.",
  UNSUPPORTED_TEXT_CONTROL:
    "This text contains a tab or line break that Paper cannot safely replace yet.",
  PARAGRAPH_CONTEXT_TOO_LARGE:
    "This paragraph is too long for Paper to safely offer edit targets yet.",
  TARGET_TOO_LARGE:
    "This text span is too long for one edit. Choose a shorter supported span.",
  STALE_OR_FOREIGN_BASIS:
    "The document changed or this edit belongs to another document. Read it again before editing.",
  STALE_OR_FOREIGN_TARGET:
    "This text span is no longer available in this document revision. Read it again before editing.",
  BEFORE_TEXT_MISMATCH:
    "The text to replace does not exactly match this span. Read it again and use its exact text.",
  DUPLICATE_TARGET:
    "This edit changes the same text span more than once. Send one replacement per span.",
  UNSUPPORTED_REPLACEMENT_TEXT:
    "This replacement contains text controls Paper cannot safely insert. Use plain text without tabs or line breaks.",
  EDIT_TEXT_LIMIT:
    "This edit contains too much text. Send a smaller batch of supported replacements.",
  EDIT_REQUEST_LIMIT:
    "This edit request is too large. Send a smaller batch of supported replacements.",
  READ_ONLY_PACKAGE:
    "Paper can read this Word file but cannot safely change its current features yet.",
  UNPROVEN_PART:
    "This Word file contains a part whose effect on the text Paper cannot yet establish. Editing is unavailable.",
  UNPROVEN_PACKAGE_MARKUP:
    "This Word file uses markup whose effect on the text Paper cannot yet establish. Editing is unavailable.",
  UNPROVEN_RELATIONSHIP:
    "This text depends on a relationship Paper cannot safely prove yet.",
  PRESERVED_NEIGHBOR:
    "This link or line break stays unchanged. Paper can still edit the other text in this paragraph.",
  PROOFING_RANGE:
    "This text sits inside a spelling or grammar mark. Paper leaves that mark and its words unchanged.",
  UNRESOLVED_PROOFING:
    "A spelling or grammar mark in this paragraph is incomplete. Paper cannot safely change this paragraph yet.",
}

export function refusalReason(code: string): PackageRefusalReason {
  const message =
    messages[code] ??
    (code.startsWith("CANDIDATE_") || code.startsWith("UNTOUCHED_")
      ? "Paper could not verify that only the requested text would change. No edit was made."
      : "Paper cannot safely edit this Word file because it has an unsupported or inconsistent feature. No edit was made.")
  return { code, message }
}

export class PaperPackageRefusal extends CommandError {
  readonly reason: PackageRefusalReason
  readonly packageDetail: string

  constructor(code: string, detail = "") {
    const reason = refusalReason(code)
    super(code, `${code}: ${reason.message}`)
    this.name = "PaperPackageRefusal"
    this.reason = reason
    this.packageDetail = detail
  }
}

export function refuse(code: string, detail = ""): never {
  throw new PaperPackageRefusal(code, detail)
}
