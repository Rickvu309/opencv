import { z } from "zod"

export const coachModeSchema = z.enum(["free", "light", "max"])
export type CoachMode = z.infer<typeof coachModeSchema>
