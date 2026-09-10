import { z } from "zod"

import { PITCH_COMMANDS } from "./commands.js"

export { PITCH_COMMANDS }

export const PITCH_CONTENT_VERSION = 1
export const PITCH_CONTENT_KIND = "pitch" as const

export const pitchContentKindSchema = z.literal(PITCH_CONTENT_KIND)

export const pitchContentVersionSchema = z
  .number()
  .int()
  .positive("Content version must be a positive integer")

export const pitchUpdateInputSchema = z
  .object({
    content: z.unknown(),
    contentVersion: pitchContentVersionSchema,
  })
  .strict()

export const pitchGetInputSchema = z.object({}).strict()

export type PitchUpdateInput = z.infer<typeof pitchUpdateInputSchema>
export type PitchGetInput = z.infer<typeof pitchGetInputSchema>

export type PitchDoc = {
  id: string
  kind: typeof PITCH_CONTENT_KIND
  content: unknown
  contentVersion: number
  createdAt: string
  updatedAt: string
}

export type PublicPitchAuthor = {
  name: string
  email: string
  image: string | null
}

/** Published Pitch a recruiter can load without a session. */
export type PublicPitch = {
  slug: string
  author: PublicPitchAuthor
  kind: typeof PITCH_CONTENT_KIND
  content: unknown
  contentVersion: number
}

const PITCH_PUBLIC_SLUG_MAX = 64

/** Handle used in `/u/{slug}` — derived from the User's name, not a stored column. */
export function pitchHandle(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function isPitchPublicSlug(slug: string) {
  return (
    slug.length > 0 &&
    slug.length <= PITCH_PUBLIC_SLUG_MAX &&
    slug === pitchHandle(slug)
  )
}
