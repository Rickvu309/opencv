import {
  PAPER_KIND_LABEL,
  decodePaperContent,
  isCvDocument,
  isLetterDocument,
  isProofDocument,
  type CoachFocusDoc,
  type CoachMode,
} from "@workspace/domain"

export const MUST_EDIT_TOOLS = {
  updateContent: "paper_updateContent",
  getDoc: "paper_getDoc",
  listDocs: "paper_listDocs",
} as const

export type MustEditToolName =
  (typeof MUST_EDIT_TOOLS)[keyof typeof MUST_EDIT_TOOLS]

export type MustEditToolChoice = {
  type: "tool"
  toolName: MustEditToolName
}

export type MustEditPrepareStep = {
  toolChoice?: MustEditToolChoice
  activeTools?: MustEditToolName[]
}

const EDIT_VERB =
  /\b(?:rewrite|rewrote|rewriting|shorten|shortened|shortening|tailor|tailored|tailoring|sharpen|sharpened|sharpening|edit|edited|editing|fix(?:ing)?(?:\s+(?:the|this|my|tone|spelling|typo))?|make\s+(?:my|the|this)\s+(?:summary|bullet|opening|cv|letter|proof)|make\b.{0,48}(?:shorter|stronger|better|tighter|less)|add\s+a\s+metric|update\s+(?:the|this|my)\s+(?:summary|bullet|cv|letter|proof|opening)|apply\s+(?:this|the|that)\s+(?:rewrite|edit|change))\b/i

const STRONG_EDIT_VERB =
  /\b(?:rewrite|rewrote|rewriting|shorten|shortened|shortening|tailor|tailored|tailoring|sharpen|sharpened|sharpening|make\s+(?:my|the|this)\s+(?:summary|bullet|opening|cv|letter|proof)|make\b.{0,48}(?:shorter|stronger|better|tighter|less)|add\s+a\s+metric|update\s+(?:the|this|my)\s+(?:summary|bullet|cv|letter|proof|opening)|apply\s+(?:this|the|that)\s+(?:rewrite|edit|change))\b/i

const PAPER_NOUN =
  /\b(?:cv|letter|proof|document|summary|bullet|resume|cover|experience|opening|tone|spelling)\b/i

const PAPER_OR_DEIXIS =
  /\b(?:cv|letter|proof|document|summary|bullet|resume|cover|experience|opening|tone|spelling|this|that)\b/i

const ADVICE_INTERROGATIVE =
  /^(?:how\b|what\b|why\b|do\s+i\b|is\s+(?:it|that)\b)|(?:^|\b)should\s+i\b/i

const POLITE_QUESTION = /^(?:can|could|would|will)\s+you\b/i

const LINE_CAP = 160

/**
 * An edit/rewrite ask on the open Paper doc, or a named Paper artifact.
 * How-to / should-I advice is not that ask — even when a focus doc is open.
 * Home advice without a Paper noun stays out — that is not must-edit.
 */
export function isPaperEditAsk(text: string, hasFocusDoc = false): boolean {
  const trimmed = text.trim()
  if (!trimmed || !EDIT_VERB.test(trimmed)) return false
  if (isAdviceInterrogative(trimmed)) return false
  if (isWeakQuestionWithoutPaper(trimmed)) return false
  if (hasFocusDoc) return true
  return PAPER_NOUN.test(trimmed)
}

function isAdviceInterrogative(text: string): boolean {
  return ADVICE_INTERROGATIVE.test(text)
}

function isQuestion(text: string): boolean {
  return text.endsWith("?") || POLITE_QUESTION.test(text)
}

/** "Can you fix my interview nerves?" — edit/fix in a question, no Paper target. */
function isWeakQuestionWithoutPaper(text: string): boolean {
  if (!isQuestion(text)) return false
  if (STRONG_EDIT_VERB.test(text)) return false
  return !PAPER_OR_DEIXIS.test(text)
}

export function latestUserText(
  messages: readonly { role: string; content?: string }[]
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content
    }
  }
  return ""
}

export function mustEditTurnInstruction(hasFocusDoc: boolean): string {
  if (hasFocusDoc) {
    return [
      "This User message is an edit ask on the open Paper document.",
      "Call paper_updateContent in this turn. The open document's current JSON is in the workspace snapshot — copy it, change only what they asked, and send docId, contentVersion, and the full content object.",
      "Do not call paper_getDoc or paper_listDocs first. Do not write the rewrite as prose first. Never ask whether to apply. Never tell the User to paste.",
      "If a named bullet or section is missing, say that in one line and name what is actually in the document, then update the closest matching section they clearly meant — or give one next step after a failed receipt.",
      "A prose-only reply is allowed only after a failed tool receipt: one plain failure line, then one next step.",
    ].join(" ")
  }
  return [
    "This User message is an edit ask on a Paper document they named.",
    "Find that document with paper_listDocs and paper_getDoc, then call paper_updateContent in this turn.",
    "Do not write the rewrite as prose first. Never ask whether to apply. Never tell the User to paste.",
    "A prose-only reply is allowed only after a failed tool receipt: one plain failure line, then one next step.",
  ].join(" ")
}

/**
 * Force a Command on edit asks so Free models cannot draft-then-ask.
 * After a successful or failed paper_updateContent call, the model may speak.
 */
export function mustEditToolChoice(input: {
  userText: string
  hasFocusDoc: boolean
  calledTools: readonly string[]
}): MustEditToolChoice | undefined {
  if (!isPaperEditAsk(input.userText, input.hasFocusDoc)) return undefined
  if (input.calledTools.includes(MUST_EDIT_TOOLS.updateContent)) return undefined
  if (input.hasFocusDoc) {
    return { type: "tool", toolName: MUST_EDIT_TOOLS.updateContent }
  }
  if (
    !input.calledTools.includes(MUST_EDIT_TOOLS.listDocs) &&
    !input.calledTools.includes(MUST_EDIT_TOOLS.getDoc)
  ) {
    return { type: "tool", toolName: MUST_EDIT_TOOLS.listDocs }
  }
  if (!input.calledTools.includes(MUST_EDIT_TOOLS.getDoc)) {
    return { type: "tool", toolName: MUST_EDIT_TOOLS.getDoc }
  }
  return { type: "tool", toolName: MUST_EDIT_TOOLS.updateContent }
}

/**
 * Hide every other tool while a Command is forced. Free models ignore
 * toolChoice and otherwise stop after paper_getDoc (QVE-189).
 */
export function mustEditPrepareStep(input: {
  userText: string
  hasFocusDoc: boolean
  calledTools: readonly string[]
}): MustEditPrepareStep {
  const toolChoice = mustEditToolChoice(input)
  if (!toolChoice) return {}
  return { toolChoice, activeTools: [toolChoice.toolName] }
}

export function mustEditStillNeedsUpdate(input: {
  userText: string
  hasFocusDoc: boolean
  calledTools: readonly string[]
}): boolean {
  if (!isPaperEditAsk(input.userText, input.hasFocusDoc)) return false
  return !input.calledTools.includes(MUST_EDIT_TOOLS.updateContent)
}

export function toolNamesFromSteps(
  steps: readonly { toolCalls?: readonly { toolName?: string }[] }[]
): string[] {
  return steps.flatMap((step) =>
    (step.toolCalls ?? [])
      .map((call) => call.toolName)
      .filter((name): name is string => typeof name === "string")
  )
}

export function toCoachFocusDoc(row: {
  id: string
  name: string
  contentKind: CoachFocusDoc["kind"]
  status: CoachFocusDoc["status"]
  content: unknown
  contentVersion: number
}): CoachFocusDoc {
  return {
    id: row.id,
    name: row.name,
    kind: row.contentKind,
    status: row.status,
    content: row.content,
    contentVersion: row.contentVersion,
  }
}

export function describeFocusDoc(doc: CoachFocusDoc): string {
  const lines = [
    `Open Paper document: ${doc.name} · ${PAPER_KIND_LABEL[doc.kind]} · ${doc.status} (id: ${doc.id}). contentVersion: ${doc.contentVersion}.`,
    "Do not call paper_getDoc — the current JSON is below. To change it, run paper_updateContent with this docId, contentVersion, and the full updated JSON — never claim a silent rewrite, never ask the User to paste the rewrite, and never ask whether to apply.",
  ]

  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (decoded.ok) {
    const outline = outlinePaperContent(decoded.data)
    if (outline.length > 0) {
      lines.push(
        "Section outline (use this when the User names a section or bullet and there is no selection):"
      )
      lines.push(...outline)
    }
  }

  lines.push(
    "Current content JSON (copy this object, change only the asked fields, send it as paper_updateContent.content):"
  )
  lines.push(JSON.stringify(doc.content))
  return lines.join("\n")
}

function outlinePaperContent(content: unknown): string[] {
  if (isCvDocument(content)) {
    const lines = [`- Summary: ${clip(content.summary)}`]
    content.experience.forEach((role, index) => {
      lines.push(
        `- Experience[${index}] ${role.role} · ${role.company}${
          role.location ? ` · ${role.location}` : ""
        }`
      )
      for (const bullet of role.bullets) {
        lines.push(`  - ${clip(bullet)}`)
      }
    })
    content.education.forEach((row, index) => {
      lines.push(
        `- Education[${index}] ${row.degree} · ${row.school}${
          row.period ? ` · ${row.period}` : ""
        }`
      )
      if (row.detail) lines.push(`  - ${clip(row.detail)}`)
    })
    content.skills.forEach((group, index) => {
      lines.push(
        `- Skills[${index}] ${group.label}: ${clip(group.items.join(", "))}`
      )
    })
    content.projects?.forEach((project, index) => {
      lines.push(`- Projects[${index}] ${project.name}: ${clip(project.detail)}`)
    })
    if (content.headline) {
      lines.push(`- Headline: ${clip(content.headline)}`)
    }
    if (content.languages && content.languages.length > 0) {
      lines.push(`- Languages: ${clip(content.languages.join(", "))}`)
    }
    return lines
  }
  if (isLetterDocument(content)) {
    return [`- Letter: ${clip(content.markdown, 240)}`]
  }
  if (isProofDocument(content)) {
    return [
      `- Proof: ${clip(content.title)}`,
      ...content.steps.map(
        (step) => `- ${step.type} · ${clip(step.title)}: ${clip(step.body)}`
      ),
    ]
  }
  return []
}

function clip(text: string, cap = LINE_CAP): string {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed.length <= cap) return trimmed
  return `${trimmed.slice(0, cap - 1).trimEnd()}…`
}

const EXPERIENCE_OR_BULLET = /\bexperience\b|\bbullet\b/i

const OTHER_CV_SECTIONS = [
  { name: "Education", pattern: /\beducation\b/i },
  { name: "Skills", pattern: /\bskills\b/i },
  { name: "Projects", pattern: /\bprojects\b/i },
  { name: "Headline", pattern: /\bheadline\b/i },
  { name: "Contact", pattern: /\bcontact\b/i },
  { name: "Languages", pattern: /\blanguages\b/i },
] as const

type OtherCvSectionName = (typeof OTHER_CV_SECTIONS)[number]["name"]

const REWRITE_STOP =
  /^(?:rewrite|rewrote|rewriting|shorten|shortened|shortening|tailor|tailored|tailoring|sharpen|sharpened|sharpening|edit|edited|editing|fix|fixing|make|update|apply|the|this|that|my|a|an|for|to|of|on|in|and|or|be|it|please|can|you|bullet|bullets|section|document|doc|open|named|one|sentence|experience|summary|opening|proof|letter|resume|cover|internship|education|skill|skills|project|projects|headline|contact|language|languages)$/i

export function namesExperienceOrBullet(userText: string): boolean {
  return EXPERIENCE_OR_BULLET.test(userText)
}

/** A real CV section that is not Summary or Experience — do not fall through to Summary. */
export function namedOtherCvSection(
  userText: string
): OtherCvSectionName | null {
  for (const section of OTHER_CV_SECTIONS) {
    if (section.pattern.test(userText)) return section.name
  }
  return null
}

/** Role labels already on the CV — used when an Experience ask cannot target a bullet. */
export function describeExperienceRoles(doc: CoachFocusDoc): string[] {
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !isCvDocument(decoded.data)) return []
  return decoded.data.experience.map((role) =>
    role.location
      ? `${role.role} · ${role.company} · ${role.location}`
      : `${role.role} · ${role.company}`
  )
}

const TOOL_NAME_DUMP = /paper[_\s.]*updatecontent/i

/**
 * Raw tool-call / tool-result text Free models sometimes stream instead of
 * a receipt. Never show this in the Thread.
 */
export function isToolDumpText(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (!trimmed) return false
  if (TOOL_NAME_DUMP.test(trimmed)) return true
  if (/"docId"/.test(trimmed) && /contentVersion/i.test(trimmed)) return true
  if (/invalid input for tool/i.test(trimmed)) return true
  if (/<(?:tool_call|function_call|invoke)\b/i.test(trimmed)) return true
  if (
    trimmed.includes("{") &&
    /"content"\s*:/.test(trimmed) &&
    /"summary"\s*:/.test(trimmed)
  ) {
    return true
  }
  if (/"ok"\s*:/.test(trimmed) && /"(?:error|data)"\s*:/.test(trimmed)) {
    return true
  }
  return false
}

/** Drop tool-call JSON / paper_updateContent dumps; keep human prose. */
export function stripToolDumpText(text: string): string {
  if (!text) return ""
  let next = text.replace(/```[\s\S]*?```/g, " ")
  next = next.replace(/paper[_\s.]*updatecontent/gi, " ")
  next = next.replace(
    /<(?:tool_call|function_call|invoke)\b[\s\S]*?(?:<\/(?:tool_call|function_call|invoke)>|\/>)/gi,
    " "
  )
  next = next.replace(/invalid input for tool[\s\S]{0,400}/gi, " ")
  next = removeJsonObjects(next, looksLikeToolJson)
  return next.replace(/\s+/g, " ").trim()
}

function looksLikeToolJson(json: string): boolean {
  return (
    /"docId"/.test(json) ||
    /contentVersion/i.test(json) ||
    (/"content"\s*:/.test(json) && /"experience"/.test(json)) ||
    /"toolName"|"tool_name"|"arguments"/.test(json) ||
    (/"ok"\s*:/.test(json) && /"(?:error|data)"\s*:/.test(json))
  )
}

function removeJsonObjects(
  text: string,
  predicate: (json: string) => boolean
): string {
  let result = ""
  let index = 0
  while (index < text.length) {
    if (text[index] !== "{") {
      result += text[index]
      index += 1
      continue
    }
    const end = findMatchingBrace(text, index)
    if (end < 0) {
      result += text.slice(index)
      break
    }
    const object = text.slice(index, end + 1)
    if (!predicate(object)) result += object
    index = end + 1
  }
  return result
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escape = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escape) escape = false
      else if (char === "\\") escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === "{") depth += 1
    else if (char === "}") {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/** True when the reply already names a role or company from Experience. */
export function textNamesExperienceRole(
  text: string,
  doc: CoachFocusDoc | undefined
): boolean {
  if (!doc || !text.trim()) return false
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !isCvDocument(decoded.data)) return false
  const lower = text.toLowerCase()
  return decoded.data.experience.some((role) => {
    const labels = [role.role, ...role.role.split(/\s*·\s*/), role.company]
      .map((label) => label.trim())
      .filter((label) => label.length >= 4)
    return labels.some((label) => lower.includes(label.toLowerCase()))
  })
}

/** Named Experience/bullet ask with no scoring bullet — fail closed. */
export function isExperienceNamedMiss(
  doc: CoachFocusDoc | undefined,
  userText: string,
  selectionText?: string
): boolean {
  if (!namesExperienceOrBullet(userText)) return false
  if (!doc) return true
  return findFocusRewriteOriginal(doc, userText, selectionText) === null
}

function describeNamedSection(
  doc: CoachFocusDoc,
  section: OtherCvSectionName
): string[] {
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok || !isCvDocument(decoded.data)) return []
  const content = decoded.data
  switch (section) {
    case "Education":
      return content.education.map((row) =>
        row.degree ? `${row.degree} · ${row.school}` : row.school
      )
    case "Skills":
      return content.skills.map((group) => group.label)
    case "Projects":
      return (content.projects ?? []).map((project) => project.name)
    case "Headline":
      return content.headline ? [content.headline] : []
    case "Contact": {
      const contact = [
        content.contact.location,
        content.contact.email,
        content.contact.phone,
      ].filter((value) => value.length > 0)
      return contact
    }
    case "Languages":
      return content.languages ?? []
  }
}

export function mustEditMissCopy(
  doc: CoachFocusDoc | undefined,
  userText: string
): { receipt: string; nextStep: string } {
  if (doc && namesExperienceOrBullet(userText)) {
    const roles = describeExperienceRoles(doc)
    if (roles.length > 0) {
      return {
        receipt: "Could not match a bullet in Experience.",
        nextStep: `Could not match a bullet in Experience. Next step: name ${formatRoleList(roles)}.`,
      }
    }
    return {
      receipt: "Could not match a bullet in Experience.",
      nextStep:
        "Could not match a bullet in Experience. Next step: add a role or name a section that is already on the CV.",
    }
  }
  const other = namedOtherCvSection(userText)
  if (doc && other) {
    const items = describeNamedSection(doc, other)
    if (items.length > 0) {
      return {
        receipt: `Could not rewrite ${other}.`,
        nextStep: `Could not rewrite ${other}. Next step: name ${formatRoleList(items)}.`,
      }
    }
    return {
      receipt: `Could not rewrite ${other}.`,
      nextStep: `Could not rewrite ${other}. Next step: add ${other.toLowerCase()} or name a section that is already on the CV.`,
    }
  }
  return {
    receipt: "Could not apply the rewrite to the open document.",
    nextStep:
      "Could not update the open document. Next step: name the section or bullet to change.",
  }
}

/** Model produced no real rewrite — do not invent scout or canned CV copy. */
export function mustEditNoRewriteCopy(): { receipt: string; nextStep: string } {
  return {
    receipt: "Could not rewrite the line.",
    nextStep:
      "Could not rewrite the line. Next step: try sending the ask again.",
  }
}

function formatRoleList(roles: string[]): string {
  if (roles.length === 1) return roles[0] ?? ""
  if (roles.length === 2) return `${roles[0]} or ${roles[1]}`
  return `${roles.slice(0, -1).join(", ")}, or ${roles[roles.length - 1]}`
}

type LocatedRewrite =
  | { kind: "cv-summary"; original: string }
  | {
      kind: "cv-bullet"
      roleIndex: number
      bulletIndex: number
      original: string
    }
  | { kind: "letter"; original: string }
  | { kind: "proof-step"; index: number; original: string }

export function findFocusRewriteOriginal(
  doc: CoachFocusDoc,
  userText: string,
  selectionText?: string
): string | null {
  return locateRewrite(doc, userText, selectionText)?.original ?? null
}

export function applyRewriteToFocusContent(
  doc: CoachFocusDoc,
  userText: string,
  replacement: string,
  selectionText?: string
): unknown | null {
  const located = locateRewrite(doc, userText, selectionText)
  if (!located) return null
  const next = sanitizeMustEditLine(replacement)
  if (!next || next === located.original) return null

  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok) return null
  const content = structuredClone(decoded.data)

  if (located.kind === "cv-summary" && isCvDocument(content)) {
    content.summary = next
    return content
  }
  if (located.kind === "cv-bullet" && isCvDocument(content)) {
    const bullets = content.experience[located.roleIndex]?.bullets
    if (!bullets || bullets[located.bulletIndex] === undefined) return null
    bullets[located.bulletIndex] = next
    return content
  }
  if (located.kind === "letter" && isLetterDocument(content)) {
    content.markdown = next
    return content
  }
  if (located.kind === "proof-step" && isProofDocument(content)) {
    const step = content.steps[located.index]
    if (!step) return null
    step.body = next
    return content
  }
  return null
}

/**
 * Generic last-resort rewrite only. Scout / preview-smoke phrases are not
 * a production strategy — return null so the guarantee can emit a failed receipt.
 */
export function localRewriteText(
  original: string,
  userText: string
): string | null {
  const trimmed = original.replace(/\s+/g, " ").trim()
  if (!trimmed) return null
  if (/shorten|shorter|one sentence/i.test(userText)) {
    const first = trimmed.split(/(?<=\.)\s+/)[0] ?? trimmed
    if (first.length > 0 && first !== trimmed) return first
    if (trimmed.length > 140) return `${trimmed.slice(0, 139).trimEnd()}.`
  }
  return null
}

export function isRealRewrite(
  original: string,
  replacement: string | null | undefined
): replacement is string {
  if (typeof replacement !== "string") return false
  const next = replacement.replace(/\s+/g, " ").trim()
  const prev = original.replace(/\s+/g, " ").trim()
  return next.length > 0 && next !== prev
}

/**
 * Free Paper must-edit after QVE-196: do not send tools / tool_choice to
 * `openrouter/free`. That request shape filters the Free Models Router onto
 * the tool-calling pool, which 429s under café/Scout load and dies as a
 * quota wall before paper_updateContent (QVE-197).
 */
export function shouldUseFreeTextMustEdit(input: {
  mode?: CoachMode
  userText: string
  hasFocusDoc: boolean
}): boolean {
  return (
    input.mode === "free" &&
    input.hasFocusDoc &&
    isPaperEditAsk(input.userText, true)
  )
}

/** One-line rewrite prompt — no tools, no full CV JSON, no next-step speech. */
export function freeMustEditLinePrompt(input: {
  original: string
  userText: string
  docName: string
}): string {
  return [
    "You are rewriting one line on a Paper document for an early-career User.",
    "Reply with only the rewritten line. No quotes, no preamble, no thinking, no chain of thought, no next step, no markdown.",
    "Never tell the User to paste. Never ask whether to apply.",
    "Do not invent scout or canned CV copy. Change only the line they asked about.",
    `Document: ${input.docName}`,
    `Ask: ${input.userText}`,
    `Current line:\n${input.original}`,
  ].join("\n")
}

const PASTE_OR_ASK =
  /\bpaste\b|\bapply\??$|\bshould i apply\b|\bwant me to apply\b/i

const THINKING_BLOCK =
  /<(?:think|thinking|thought|reasoning)\b[^>]*>[\s\S]*?<\/(?:think|thinking|thought|reasoning)>/gi

const THINKING_LINE =
  /^(?:[-*•]\s+|\d+[.)]\s+)?(?:#{1,6}\s*)?(?:\*{0,2}|_{0,2})(?:a\s+)?(?:thinking(?:\s+process)?|reasoning|chain of thought|internal monologue)(?:\*{0,2}|_{0,2})?\s*:?\s*$/i

const META_LINE =
  /^(?:[-*•]\s+|\d+[.)]\s+)?(?:let me think|okay[,.]?|alright[,.]?|the user (?:wants|asked|is asking)|i (?:need|will|should|'ll|am going) to|here(?:'s| is) my (?:thinking|reasoning|analysis))\b/i

const THINKING_PREFIX =
  /^(?:[-*•]\s+|\d+[.)]\s+)?(?:a\s+)?thinking(?:\s+process)?\s*:\s*/i

/**
 * Drop model thinking / chain-of-thought / meta lines so they cannot land
 * on Paper via paper.updateContent (QVE-198).
 */
export function stripMustEditThinking(text: string): string {
  const next = text.replace(/\r\n/g, "\n").replace(THINKING_BLOCK, "\n")
  const kept: string[] = []
  for (const line of next.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) {
      kept.push("")
      continue
    }
    if (THINKING_LINE.test(trimmed) || META_LINE.test(trimmed)) continue
    const withoutPrefix = trimmed.replace(THINKING_PREFIX, "").trim()
    if (
      !withoutPrefix ||
      THINKING_LINE.test(withoutPrefix) ||
      META_LINE.test(withoutPrefix)
    ) {
      continue
    }
    kept.push(withoutPrefix)
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * One clean rewrite line, or null if the text is thinking / meta / a dump.
 */
export function sanitizeMustEditLine(text: string): string | null {
  const stripped = stripMustEditThinking(text)
  if (!stripped) return null
  const next = polishReplacementLine(stripped)
  if (!next || PASTE_OR_ASK.test(next)) return null
  if (next.length > 400) return null
  if (looksLikeThinkingResidue(next)) return null
  if (looksLikePaperDump(next)) return null
  return next
}

/**
 * Turn a Free-model one-line reply into a Command replacement.
 * Empty, unchanged, thinking/meta, paste/ask-to-apply, or a document dump
 * fail closed. Prefer the last remaining line so leaked chain-of-thought
 * before the rewrite is dropped (QVE-198).
 */
export function extractMustEditReplacement(
  modelText: string,
  original: string
): string | null {
  const stripped = stripMustEditThinking(modelText)
  if (!stripped) return null
  if (
    looksLikePaperDump(stripped) ||
    looksLikePaperDump(polishReplacementLine(stripped))
  ) {
    return null
  }

  for (const candidate of replacementCandidates(stripped)) {
    const cleaned = sanitizeMustEditLine(candidate)
    if (cleaned && isRealRewrite(original, cleaned)) return cleaned
  }
  return null
}

function replacementCandidates(text: string): string[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
  const pool = blocks.length > 0 ? blocks : [text.trim()]
  const last = pool[pool.length - 1] ?? ""
  const lastLines = last
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const ordered = [
    lastLines[lastLines.length - 1],
    last,
    ...pool.slice().reverse(),
    text,
  ].filter((item): item is string => Boolean(item?.trim()))
  return [...new Set(ordered)]
}

function polishReplacementLine(text: string): string {
  let next = text.replace(/\s+/g, " ").trim()
  next = next.replace(/^["'`]+|["'`]+$/g, "").trim()
  next = next.replace(/^\*\*(.+)\*\*$/s, "$1").trim()
  next = next.replace(
    /^(?:here(?:'s| is)(?: the)?(?: rewritten)?(?: line| bullet)?[:\s]*)/i,
    ""
  ).trim()
  next = next.replace(/^[-*•]\s+/, "").trim()
  return next
}

function looksLikeThinkingResidue(text: string): boolean {
  const lower = text.toLowerCase()
  if (/^(?:a\s+)?thinking(?:\s+process)?\b/.test(lower)) return true
  if (/\bchain of thought\b/.test(lower)) return true
  if (/\b(?:let me think|here is my thinking)\b/.test(lower)) return true
  return false
}

function looksLikePaperDump(text: string): boolean {
  if (
    /"experience"\s*:/.test(text) &&
    /"(?:summary|education|skills)"\s*:/.test(text)
  ) {
    return true
  }
  if (/"docId"/.test(text) && /contentVersion/i.test(text)) return true
  if ((text.match(/(?:^|\s)[-•]\s/g) ?? []).length >= 2) return true
  if (/Experience\[\d+\]/.test(text)) return true
  return false
}

function locateRewrite(
  doc: CoachFocusDoc,
  userText: string,
  selectionText?: string
): LocatedRewrite | null {
  const decoded = decodePaperContent(doc.kind, doc.contentVersion, doc.content)
  if (!decoded.ok) return null
  const content = decoded.data
  const selected = selectionText?.replace(/\s+/g, " ").trim()

  if (isCvDocument(content)) {
    if (selected) {
      if (content.summary.includes(selected) || selected.includes(content.summary)) {
        return { kind: "cv-summary", original: content.summary }
      }
      for (const [roleIndex, role] of content.experience.entries()) {
        for (const [bulletIndex, bullet] of role.bullets.entries()) {
          if (bullet.includes(selected) || selected.includes(bullet)) {
            return { kind: "cv-bullet", roleIndex, bulletIndex, original: bullet }
          }
        }
      }
    }

    const wantsSummary = /\bsummary\b/i.test(userText)
    const wantsExperience = namesExperienceOrBullet(userText)
    const tokens = significantTokens(userText)

    if (wantsExperience) {
      return bestExperienceBullet(content, tokens)
    }
    if (wantsSummary) {
      return { kind: "cv-summary", original: content.summary }
    }
    if (namedOtherCvSection(userText)) {
      return null
    }
    const hit = bestExperienceBullet(content, tokens)
    if (hit) return hit
    return content.summary
      ? { kind: "cv-summary", original: content.summary }
      : null
  }

  if (isLetterDocument(content)) {
    return { kind: "letter", original: content.markdown }
  }
  if (isProofDocument(content) && content.steps[0]) {
    return {
      kind: "proof-step",
      index: 0,
      original: content.steps[0].body,
    }
  }
  return null
}

function bestExperienceBullet(
  content: { experience: { role: string; company: string; bullets: string[] }[] },
  tokens: string[]
): Extract<LocatedRewrite, { kind: "cv-bullet" }> | null {
  let best:
    | (Extract<LocatedRewrite, { kind: "cv-bullet" }> & { score: number })
    | null = null
  for (const [roleIndex, role] of content.experience.entries()) {
    const roleHay = `${role.role} ${role.company}`
    for (const [bulletIndex, bullet] of role.bullets.entries()) {
      const score = scoreHaystack(`${roleHay} ${bullet}`, tokens)
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = {
          kind: "cv-bullet",
          roleIndex,
          bulletIndex,
          original: bullet,
          score,
        }
      }
    }
  }
  return best
}

function significantTokens(text: string): string[] {
  return [...text.toLowerCase().matchAll(/[a-z][a-z0-9'+-]{2,}/g)]
    .map((match) => match[0])
    .filter((word) => !REWRITE_STOP.test(word))
}

function scoreHaystack(haystack: string, tokens: string[]): number {
  const lower = haystack.toLowerCase()
  return tokens.reduce((count, token) => {
    if (!lower.includes(token)) return count
    return count + (token.length >= 8 ? 4 : 1)
  }, 0)
}
