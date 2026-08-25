import { z } from "zod"

/** Same public fields the User sees on GET /api/session. */
export const profileGetInputSchema = z.object({}).strict()

export type ProfileGetInput = z.infer<typeof profileGetInputSchema>

export type UserProfile = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: string
  updatedAt: string
}