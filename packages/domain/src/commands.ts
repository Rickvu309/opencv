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

export const reversalDescriptorSchema = z.object({
  possible: z.boolean(),
  description: z.string(),
  command: z.string().optional(),
})

export type ReversalDescriptor = z.infer<typeof reversalDescriptorSchema>
