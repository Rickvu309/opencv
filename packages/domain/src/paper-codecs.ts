import { z } from "zod"

import { cvBlockDocumentSchema } from "./paper-blocks/document.js"
import type { CvBlockDocument } from "./paper-blocks/document.js"
import { PAPER_CONTENT_VERSION, type PaperContentKind } from "./paper.js"

export const cvTemplateIdSchema = z.enum([
  "internship",
  "product",
  "service",
  "academic",
  "photo",
])

export const cvContactSchema = z
  .object({
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string().optional(),
  })
  .strict()

export const cvEducationSchema = z
  .object({
    school: z.string(),
    degree: z.string(),
    period: z.string(),
    detail: z.string().optional(),
  })
  .strict()

export const cvExperienceSchema = z
  .object({
    role: z.string(),
    company: z.string(),
    period: z.string(),
    location: z.string().optional(),
    bullets: z.array(z.string()),
  })
  .strict()

export const cvSkillGroupSchema = z
  .object({
    label: z.string(),
    items: z.array(z.string()),
  })
  .strict()

export const cvProjectSchema = z
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
    photoUrl: z.string().optional(),
  })
  .strict()

export const letterDocumentV1Schema = z
  .object({
    markdown: z.string(),
  })
  .strict()

export const proofViewModeSchema = z.enum(["chain", "timeline"])
export const proofStepTypeSchema = z.enum([
  "context",
  "action",
  "outcome",
  "note",
])

export const proofPhotoSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    caption: z.string().optional(),
  })
  .strict()

export const proofStepSchema = z
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

export const proofDocumentV1Schema = z
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

export type PaperDocument =
  CvDocument | CvBlockDocument | LetterDocument | ProofDocument

export type PaperContentDecode =
  { ok: true; data: PaperDocument } | { ok: false; message: string }

const schemaByKind = {
  letter: letterDocumentV1Schema,
  proof: proofDocumentV1Schema,
} as const

/** Prototype transport leftovers. Importer-only — never a write path. */
export const LEGACY_CV_PREFIX = "cv:v1:"
export const LEGACY_PROOF_PREFIX = "proof:v1:"

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

export function emptyProofDocument(): ProofDocument {
  return {
    viewMode: "chain",
    title: "",
    steps: [],
  }
}

export function emptyPaperDocument(kind: PaperContentKind): PaperDocument {
  switch (kind) {
    case "cv":
      return emptyCvDocument()
    case "letter":
      return emptyLetterDocument()
    case "proof":
      return emptyProofDocument()
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

function parseLegacyJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error(`Legacy ${label} content is not valid JSON`)
  }
}

/**
 * One-way importer from the prototype's prefixed strings (and plain
 * markdown Letters). Used to seed jsonb documents. Not a write path.
 */
export function importLegacyPaperContent(raw: string): {
  kind: PaperContentKind
  contentVersion: number
  content: PaperDocument
} {
  if (raw.startsWith(LEGACY_CV_PREFIX)) {
    const decoded = decodePaperContent(
      "cv",
      PAPER_CONTENT_VERSION,
      parseLegacyJson(raw.slice(LEGACY_CV_PREFIX.length), "CV")
    )
    if (!decoded.ok) {
      throw new Error(decoded.message)
    }
    return {
      kind: "cv",
      contentVersion: PAPER_CONTENT_VERSION,
      content: decoded.data,
    }
  }

  if (raw.startsWith(LEGACY_PROOF_PREFIX)) {
    const decoded = decodePaperContent(
      "proof",
      PAPER_CONTENT_VERSION,
      parseLegacyJson(raw.slice(LEGACY_PROOF_PREFIX.length), "Proof")
    )
    if (!decoded.ok) {
      throw new Error(decoded.message)
    }
    return {
      kind: "proof",
      contentVersion: PAPER_CONTENT_VERSION,
      content: decoded.data,
    }
  }

  const decoded = decodePaperContent("letter", PAPER_CONTENT_VERSION, {
    markdown: raw,
  })
  if (!decoded.ok) {
    throw new Error(decoded.message)
  }
  return {
    kind: "letter",
    contentVersion: PAPER_CONTENT_VERSION,
    content: decoded.data,
  }
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
