import { z } from "zod"

export const THREAD_COMMANDS = {
  create: "threads.create",
  rename: "threads.rename",
  delete: "threads.delete",
  postMessage: "threads.postMessage",
} as const

export type ThreadCommandName =
  (typeof THREAD_COMMANDS)[keyof typeof THREAD_COMMANDS]

export const PAPER_COMMANDS = {
  createDoc: "paper.createDoc",
  updateContent: "paper.updateContent",
  renameDoc: "paper.renameDoc",
  setStatus: "paper.setStatus",
  deleteDoc: "paper.deleteDoc",
  linkApplyCard: "paper.linkApplyCard",
} as const

export type PaperCommandName =
  (typeof PAPER_COMMANDS)[keyof typeof PAPER_COMMANDS]

export const APPLY_COMMANDS = {
  createCard: "apply.createCard",
  updateCard: "apply.updateCard",
  moveCard: "apply.moveCard",
  toggleStar: "apply.toggleStar",
  deleteCard: "apply.deleteCard",
} as const

export type ApplyCommandName =
  (typeof APPLY_COMMANDS)[keyof typeof APPLY_COMMANDS]

export const PROFILE_COMMANDS = {
  setCoachMode: "profile.setCoachMode",
} as const

export type ProfileCommandName =
  (typeof PROFILE_COMMANDS)[keyof typeof PROFILE_COMMANDS]

export const PITCH_COMMANDS = {
  update: "pitch.update",
} as const

export type PitchCommandName =
  (typeof PITCH_COMMANDS)[keyof typeof PITCH_COMMANDS]

/**
 * Coach-allowed but excluded from the tool surface: the stream
 * is the Coach's voice, and this Command means the User posted a message.
 */
export const COACH_VOICE_COMMAND = THREAD_COMMANDS.postMessage

export const COACH_READ_TOOLS = {
  paperListDocs: "paper_listDocs",
  paperGetDoc: "paper_getDoc",
  applyListCards: "apply_listCards",
  profileGet: "profile_get",
} as const

export type CoachReadToolName =
  (typeof COACH_READ_TOOLS)[keyof typeof COACH_READ_TOOLS]

export const reversalDescriptorSchema = z.object({
  possible: z.boolean(),
  description: z.string(),
  command: z.string().optional(),
  /** Input for `command` when this descriptor is attached to a receipt. */
  input: z.unknown().optional(),
})

export type ReversalDescriptor = z.infer<typeof reversalDescriptorSchema>
