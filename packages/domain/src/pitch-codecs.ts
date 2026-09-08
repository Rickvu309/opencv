import { z } from "zod"

import { PITCH_CONTENT_KIND, PITCH_CONTENT_VERSION } from "./pitch.js"

export const pitchBlockKindSchema = z.enum([
  "about",
  "achievements",
  "experience",
  "work",
  "github",
  "contact",
  "moments",
  "gallery",
])

export const pitchBlockSchema = z
  .object({
    id: z.string(),
    kind: pitchBlockKindSchema,
    hidden: z.boolean().optional(),
  })
  .strict()

export const pitchAchievementSchema = z
  .object({
    id: z.string(),
    year: z.string(),
    title: z.string(),
    context: z.string(),
    description: z.string(),
    link: z.string().optional(),
    linkLabel: z.string().optional(),
    /** Key of a real Proof shown on Pitch — never a dead href. */
    proofId: z.string().optional(),
    tag: z.string().optional(),
  })
  .strict()

export const pitchExperienceSchema = z
  .object({
    id: z.string(),
    period: z.string(),
    title: z.string(),
    org: z.string(),
    summary: z.string(),
  })
  .strict()

export const pitchToneSchema = z.enum([
  "warm",
  "cool",
  "neutral",
  "emerald",
  "dark",
])

export const pitchGalleryItemSchema = z
  .object({
    id: z.string(),
    caption: z.string(),
    tone: pitchToneSchema,
  })
  .strict()

export const pitchStorySlideSchema = z
  .object({
    id: z.string(),
    caption: z.string(),
    detail: z.string().optional(),
    tone: pitchToneSchema,
    durationMs: z.number().optional(),
    image: z.string().optional(),
  })
  .strict()

export const pitchStoryHighlightSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    coverTone: pitchToneSchema,
    coverImage: z.string().optional(),
    slides: z.array(pitchStorySlideSchema),
  })
  .strict()

export const pitchBentoCardSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["quote", "stat", "link", "story", "visual"]),
    title: z.string(),
    body: z.string().optional(),
    meta: z.string().optional(),
    tone: pitchToneSchema.optional(),
    span: z.enum(["tall", "wide", "normal"]).optional(),
    storyHighlightId: z.string().optional(),
    image: z.string().optional(),
  })
  .strict()

export const pitchFileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    meta: z.string(),
    kind: z.enum(["pdf", "fig", "sheet", "zip"]),
  })
  .strict()

export const pitchLinkSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    icon: z.enum(["github", "linkedin", "mail", "link"]),
  })
  .strict()

export const pitchWorkDocSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["cv", "letter", "proof"]),
    status: z.enum(["draft", "ready", "published"]),
    updated: z.string(),
  })
  .strict()

export const pitchGithubSchema = z
  .object({
    username: z.string(),
    connected: z.boolean(),
  })
  .strict()

export const pitchDocumentV1Schema = z
  .object({
    headline: z.string(),
    location: z.string(),
    status: z.string(),
    about: z.string(),
    published: z.boolean(),
    github: pitchGithubSchema,
    blocks: z.array(pitchBlockSchema),
    achievements: z.array(pitchAchievementSchema),
    experience: z.array(pitchExperienceSchema),
    storyHighlights: z.array(pitchStoryHighlightSchema),
    bento: z.array(pitchBentoCardSchema),
    gallery: z.array(pitchGalleryItemSchema),
    files: z.array(pitchFileSchema),
    links: z.array(pitchLinkSchema),
    workDocs: z.array(pitchWorkDocSchema),
  })
  .strict()

export type PitchBlockKind = z.infer<typeof pitchBlockKindSchema>
export type PitchBlock = z.infer<typeof pitchBlockSchema>
export type PitchAchievement = z.infer<typeof pitchAchievementSchema>
export type PitchExperience = z.infer<typeof pitchExperienceSchema>
export type PitchTone = z.infer<typeof pitchToneSchema>
export type PitchGalleryItem = z.infer<typeof pitchGalleryItemSchema>
export type PitchStorySlide = z.infer<typeof pitchStorySlideSchema>
export type PitchStoryHighlight = z.infer<typeof pitchStoryHighlightSchema>
export type PitchBentoCard = z.infer<typeof pitchBentoCardSchema>
export type PitchFile = z.infer<typeof pitchFileSchema>
export type PitchLink = z.infer<typeof pitchLinkSchema>
export type PitchWorkDoc = z.infer<typeof pitchWorkDocSchema>
export type PitchDocument = z.infer<typeof pitchDocumentV1Schema>

export type PitchContentDecode =
  | { ok: true; data: PitchDocument }
  | { ok: false; message: string }

export const DEFAULT_PITCH_BLOCKS: PitchBlock[] = [
  { id: "b-moments", kind: "moments" },
  { id: "b-about", kind: "about" },
  { id: "b-achievements", kind: "achievements" },
  { id: "b-experience", kind: "experience" },
  { id: "b-work", kind: "work" },
  { id: "b-github", kind: "github" },
  { id: "b-contact", kind: "contact" },
]

export function emptyPitchDocument(): PitchDocument {
  return {
    headline: "",
    location: "",
    status: "",
    about: "",
    published: false,
    github: { username: "", connected: false },
    blocks: DEFAULT_PITCH_BLOCKS,
    achievements: [],
    experience: [],
    storyHighlights: [],
    bento: [],
    gallery: [],
    files: [],
    links: [],
    workDocs: [],
  }
}

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid content"
}

export function decodePitchContent(
  kind: string,
  version: number,
  content: unknown
): PitchContentDecode {
  if (kind !== PITCH_CONTENT_KIND) {
    return { ok: false, message: "Unsupported content kind" }
  }
  if (version !== PITCH_CONTENT_VERSION) {
    return { ok: false, message: "Unsupported content version" }
  }

  const parsed = pitchDocumentV1Schema.safeParse(content)
  if (!parsed.success) {
    return { ok: false, message: firstIssueMessage(parsed.error) }
  }

  return { ok: true, data: parsed.data }
}

export function isPitchDocument(value: unknown): value is PitchDocument {
  return pitchDocumentV1Schema.safeParse(value).success
}
