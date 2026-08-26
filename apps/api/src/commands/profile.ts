import {
  PROFILE_COMMANDS,
  profileSetCoachModeInputSchema,
  type UserProfile,
} from "@workspace/domain"

import { getCoachModeForUser, setCoachModeForUser } from "../profile/queries.js"
import { defineCommand } from "./registry.js"

export const setCoachModeCommand = defineCommand({
  name: PROFILE_COMMANDS.setCoachMode,
  description: "Set the User's preferred Coach mode (Free, Light, or Max).",
  input: profileSetCoachModeInputSchema,
  coachAllowed: false,
  destructive: false,
  reversal: {
    possible: true,
    command: PROFILE_COMMANDS.setCoachMode,
    description: "Undo by choosing the previous Coach mode.",
  },
  captureForReversal(ctx) {
    return getCoachModeForUser(ctx.db, ctx.actor.userId)
  },
  reversalInput({ captured }) {
    return { mode: captured }
  },
  async handler(ctx, input): Promise<UserProfile> {
    return setCoachModeForUser(ctx.db, ctx.actor.userId, input.mode)
  },
})

export const profileCommands = [setCoachModeCommand]
