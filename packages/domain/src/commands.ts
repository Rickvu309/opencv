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
} as const

export type PaperCommandName =
  (typeof PAPER_COMMANDS)[keyof typeof PAPER_COMMANDS]

export type ReversalDescriptor = {
  possible: boolean
  description: string
  command?: string
}
