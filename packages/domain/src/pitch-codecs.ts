import { z } from "zod"

import { PITCH_CONTENT_KIND, PITCH_CONTENT_VERSION } from "./pitch.js"
import {
  pitchIdentityCopyCleared,
  restoreWipedStarterMoments,
} from "./pitch-heal.js"

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

const pitchDocumentV1Shape = {
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
  /** Signup sample — never a real identity. Omitted on a User-owned Pitch. */
  demo: z.boolean().optional(),
}

export const pitchDocumentV1Schema = z.object(pitchDocumentV1Shape).strict()

/** Extra keys from older client seeds must not fail decode (QVE-221 wipe). */
const pitchDocumentV1LooseSchema = z.object(pitchDocumentV1Shape)

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
    blocks: DEFAULT_PITCH_BLOCKS.map((block) =>
      block.kind === "moments" || block.kind === "github"
        ? { ...block, hidden: true }
        : block
    ),
    achievements: [],
    experience: [],
    storyHighlights: [],
    bento: [],
    gallery: [],
    files: [],
    links: [],
    workDocs: [],
    /** Clear demo / never-filled — not the signup sample. */
    demo: false,
  }
}

/** Pre-QVE-225 starter headline that read as a real UIT/PM identity. */
export const LEGACY_FAKE_PITCH_HEADLINE =
  "Aspiring product manager · UIT Information Systems"

/** Honest starter headline. Sample, not the User. */
export const STARTER_PITCH_HEADLINE = "Sample Pitch · replace with your story"

/** Lead sentence of the signup About block — the live-walk hint to clear. */
export const STARTER_PITCH_ABOUT_LEAD =
  "This is sample copy. Clear the demo when you want the page to be yours."

/** Demo names that used to be baked into Pitch. Never identity. */
export const LEFTOVER_PITCH_PERSONA_NAMES = [
  "Alex Tran",
  "Eric Nguyen",
] as const

/** Moments card titles from the pre-honest starter. */
export const LEFTOVER_STORY_CHIP_TITLES = ["my sacred space"] as const

/** Moments card bodies from the pre-honest starter. */
export const LEFTOVER_STORY_CHIP_BODIES = [
  "Hallway test · late night Figma",
] as const

const LEFTOVER_GITHUB_HANDLE = /^(alex-tran|eric-nguyen)(-uit)?$/i

function normalizeCompare(value: string) {
  return value.trim().toLowerCase()
}

export function isLeftoverPitchPersonaName(value: string) {
  const normalized = normalizeCompare(value)
  return LEFTOVER_PITCH_PERSONA_NAMES.some(
    (name) => normalizeCompare(name) === normalized
  )
}

export function isLegacyFakePitchHeadline(headline: string) {
  return headline.trim() === LEGACY_FAKE_PITCH_HEADLINE
}

export function isStarterPitchAbout(about: string) {
  return about.includes(STARTER_PITCH_ABOUT_LEAD)
}

/** Signup sample (or leftover / unlabeled sample copy) — never a real identity. */
export function isDemoPitchDocument(doc: PitchDocument) {
  return (
    doc.demo === true ||
    isLegacyFakePitchHeadline(doc.headline) ||
    isStarterPitchAbout(doc.about)
  )
}

/**
 * QVE-221 wipe restore is only honest while sample About is still on the page.
 * A leaked `demo: true` plus a real About (QVE-250 live path) is User-owned.
 */
export function isStarterSampleIdentity(doc: PitchDocument) {
  return isStarterPitchAbout(doc.about)
}

/**
 * Clear demo residue: identity copy is gone but starter Moments / bento
 * still make the page look like a campus-club portfolio.
 */
export function hasLeftoverStarterMoments(doc: PitchDocument) {
  return (
    pitchIdentityCopyCleared(doc) &&
    (doc.storyHighlights.length > 0 || doc.bento.length > 0)
  )
}

/**
 * Stamp Demo content on leftover fake-me seeds and unlabeled sample About
 * so a fresh or persisted starter always offers Clear demo.
 */
export function markDemoPitch(doc: PitchDocument): PitchDocument {
  const legacy = isLegacyFakePitchHeadline(doc.headline)
  const needsDemo =
    legacy || isStarterPitchAbout(doc.about) || doc.demo === true
  if (!needsDemo) return doc
  const headline = legacy ? STARTER_PITCH_HEADLINE : doc.headline
  if (doc.demo === true && headline === doc.headline) return doc
  return {
    ...doc,
    demo: true,
    headline,
  }
}

export function isLeftoverPitchGithubUsername(value: string) {
  return LEFTOVER_GITHUB_HANDLE.test(value.replace(/^@/, "").trim())
}

export function isLeftoverStoryChipTitle(value: string) {
  const normalized = normalizeCompare(value)
  return LEFTOVER_STORY_CHIP_TITLES.some(
    (title) => normalizeCompare(title) === normalized
  )
}

export function isLeftoverStoryChipBody(value: string | undefined) {
  if (!value) return false
  const normalized = normalizeCompare(value)
  return LEFTOVER_STORY_CHIP_BODIES.some(
    (body) => normalizeCompare(body) === normalized
  )
}

function checkoutOrFirstHighlight(doc: PitchDocument) {
  return (
    doc.storyHighlights.find((highlight) => highlight.id === "sh-checkout") ??
    doc.storyHighlights[0]
  )
}

/**
 * Story chips must advertise the highlight they open. Persisted starter copy
 * used a fake personal label on the Checkout reel — rewrite that at decode
 * so existing Pitch docs stay honest without a content-version bump.
 *
 * Also rewrites leftover demo-persona placeholders so session overlay can
 * stamp the real User (QVE-134 / QVE-215).
 */
export function alignStoryChipIdentity(doc: PitchDocument): PitchDocument {
  const highlights = new Map(doc.storyHighlights.map((h) => [h.id, h]))
  const fallbackHighlight = checkoutOrFirstHighlight(doc)
  let changed = false

  const bento = doc.bento.map((card) => {
    const leftoverStory =
      isLeftoverStoryChipTitle(card.title) || isLeftoverStoryChipBody(card.body)
    const highlight =
      (card.storyHighlightId
        ? highlights.get(card.storyHighlightId)
        : undefined) ?? (leftoverStory ? fallbackHighlight : undefined)

    if (!highlight) {
      if (card.kind === "visual" && isLeftoverPitchPersonaName(card.title)) {
        changed = true
        return { ...card, title: "Your name" }
      }
      if (card.kind === "link" && isLeftoverPitchGithubUsername(card.title)) {
        changed = true
        return { ...card, title: "@github" }
      }
      return card
    }

    const caption = highlight.slides[0]?.caption
    const titleMismatch = card.title !== highlight.label
    const bodyMismatch = caption != null && card.body !== caption
    const needsHighlightId = leftoverStory && !card.storyHighlightId

    if (!titleMismatch && !bodyMismatch && !needsHighlightId) {
      return card
    }

    changed = true
    return {
      ...card,
      storyHighlightId: card.storyHighlightId ?? highlight.id,
      title: highlight.label,
      body: caption ?? card.body,
    }
  })

  let next: PitchDocument = changed ? { ...doc, bento } : doc

  if (isLeftoverPitchGithubUsername(next.github.username)) {
    next = {
      ...next,
      github: { ...next.github, username: "" },
    }
    changed = true
  }

  return changed ? next : doc
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
  if (parsed.success) {
    return { ok: true, data: healPitchDocument(parsed.data) }
  }

  const loose = pitchDocumentV1LooseSchema.safeParse(content)
  if (!loose.success) {
    return { ok: false, message: firstIssueMessage(parsed.error) }
  }

  return { ok: true, data: healPitchDocument(loose.data) }
}

/** Decode-time repair: restore wiped sample Moments, never after Clear demo. */
export function healPitchDocument(doc: PitchDocument): PitchDocument {
  if (pitchIdentityCopyCleared(doc)) {
    return { ...emptyPitchDocument(), published: doc.published }
  }
  return markDemoPitch(alignStoryChipIdentity(restoreWipedStarterMoments(doc)))
}

export function isPitchDocument(value: unknown): value is PitchDocument {
  return pitchDocumentV1Schema.safeParse(value).success
}
