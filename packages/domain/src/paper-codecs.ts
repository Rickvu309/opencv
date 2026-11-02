import { z } from "zod"

import { cvBlockDocumentSchema } from "./paper-blocks/document.js"
import type { CvBlockDocument } from "./paper-blocks/document.js"
import {
  PAPER_CONTENT_VERSION,
  paperPhotoValueSchema,
  type PaperContentKind,
} from "./paper.js"

const cvTemplateIdSchema = z.enum([
  "internship",
  "product",
  "service",
  "academic",
  "photo",
])

const cvContactSchema = z
  .object({
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string().optional(),
  })
  .strict()

const cvEducationSchema = z
  .object({
    school: z.string(),
    degree: z.string(),
    period: z.string(),
    detail: z.string().optional(),
  })
  .strict()

const cvExperienceSchema = z
  .object({
    role: z.string(),
    company: z.string(),
    period: z.string(),
    location: z.string().optional(),
    bullets: z.array(z.string()),
  })
  .strict()

const cvSkillGroupSchema = z
  .object({
    label: z.string(),
    items: z.array(z.string()),
  })
  .strict()

const cvProjectSchema = z
  .object({
    name: z.string(),
    detail: z.string(),
  })
  .strict()

export const cvDocumentV1Schema = z
  .object({
    templateId: cvTemplateIdSchema,
    name: z.string(),
    headline: z.string(),
    contact: cvContactSchema,
    summary: z.string(),
    experience: z.array(cvExperienceSchema),
    education: z.array(cvEducationSchema),
    skills: z.array(cvSkillGroupSchema),
    projects: z.array(cvProjectSchema).optional(),
    languages: z.array(z.string()).optional(),
    photoUrl: paperPhotoValueSchema.optional(),
  })
  .strict()

/**
 * `markdown` holds the letter body as plain text, paragraphs separated by a
 * blank line. The other parts are optional and written only when filled.
 */
export const letterDocumentV1Schema = z
  .object({
    markdown: z.string(),
    sender: z.string().optional(),
    contact: z.string().optional(),
    date: z.string().optional(),
    recipient: z.string().optional(),
    salutation: z.string().optional(),
    closing: z.string().optional(),
    signature: z.string().optional(),
  })
  .strict()

const proofViewModeSchema = z.enum(["chain", "timeline"])
const proofStepTypeSchema = z.enum(["context", "action", "outcome", "note"])

const proofPhotoSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    caption: z.string().optional(),
  })
  .strict()

const proofStepSchema = z
  .object({
    id: z.string(),
    type: proofStepTypeSchema,
    title: z.string(),
    body: z.string(),
    time: z.string().optional(),
    date: z.string().optional(),
    photos: z.array(proofPhotoSchema),
  })
  .strict()

const proofDocumentV1Schema = z
  .object({
    viewMode: proofViewModeSchema,
    title: z.string(),
    subtitle: z.string().optional(),
    steps: z.array(proofStepSchema),
  })
  .strict()

export type CvTemplateId = z.infer<typeof cvTemplateIdSchema>
export type CvContact = z.infer<typeof cvContactSchema>
export type CvEducation = z.infer<typeof cvEducationSchema>
export type CvExperience = z.infer<typeof cvExperienceSchema>
export type CvSkillGroup = z.infer<typeof cvSkillGroupSchema>
export type CvProject = z.infer<typeof cvProjectSchema>
export type CvDocument = z.infer<typeof cvDocumentV1Schema>
export type LetterDocument = z.infer<typeof letterDocumentV1Schema>
export type ProofViewMode = z.infer<typeof proofViewModeSchema>
export type ProofStepType = z.infer<typeof proofStepTypeSchema>
export type ProofPhoto = z.infer<typeof proofPhotoSchema>
export type ProofStep = z.infer<typeof proofStepSchema>
export type ProofDocument = z.infer<typeof proofDocumentV1Schema>

type PaperDocument =
  CvDocument | CvBlockDocument | LetterDocument | ProofDocument

type PaperContentDecode =
  { ok: true; data: PaperDocument } | { ok: false; message: string }

const schemaByKind = {
  letter: letterDocumentV1Schema,
  proof: proofDocumentV1Schema,
} as const

/** Prototype transport leftovers. Importer-only — never a write path. */
export function emptyCvDocument(): CvDocument {
  return {
    templateId: "internship",
    name: "",
    headline: "",
    contact: { email: "", phone: "", location: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
  }
}

export function emptyLetterDocument(): LetterDocument {
  return { markdown: "" }
}

export const LETTER_PARTS = [
  "sender",
  "contact",
  "date",
  "recipient",
  "salutation",
  "closing",
  "signature",
] as const

export type LetterPart = (typeof LETTER_PARTS)[number]

/** The letter as a writer saves it: empty or blank parts are left out. */
export function compactLetterDocument(letter: LetterDocument): LetterDocument {
  const next: LetterDocument = { markdown: letter.markdown }
  for (const part of LETTER_PARTS) {
    const value = letter[part]
    if (value !== undefined && value.trim() !== "") next[part] = value
  }
  return next
}

export function emptyProofDocument(): ProofDocument {
  return {
    viewMode: "chain",
    title: "",
    steps: [],
  }
}

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid content"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function decodeCvContent(content: unknown): PaperContentDecode {
  if (isRecord(content) && "version" in content) {
    const parsed = cvBlockDocumentSchema.safeParse(content)
    if (!parsed.success) return { ok: false, message: "Invalid content" }
    return { ok: true, data: parsed.data }
  }
  const parsed = cvDocumentV1Schema.safeParse(content)
  if (!parsed.success) {
    return { ok: false, message: firstIssueMessage(parsed.error) }
  }
  return { ok: true, data: parsed.data }
}

export function decodePaperContent(
  kind: PaperContentKind,
  version: number,
  content: unknown
): PaperContentDecode {
  if (version !== PAPER_CONTENT_VERSION) {
    return { ok: false, message: "Unsupported content version" }
  }
  if (kind === "cv") return decodeCvContent(content)

  const parsed = schemaByKind[kind].safeParse(content)
  if (!parsed.success) {
    return { ok: false, message: firstIssueMessage(parsed.error) }
  }

  return { ok: true, data: parsed.data }
}

export function isCvDocument(value: unknown): value is CvDocument {
  return cvDocumentV1Schema.safeParse(value).success
}

export function isLetterDocument(value: unknown): value is LetterDocument {
  return letterDocumentV1Schema.safeParse(value).success
}

export function isProofDocument(value: unknown): value is ProofDocument {
  return proofDocumentV1Schema.safeParse(value).success
}
