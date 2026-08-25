export const THREAD_COMMANDS = {
  create: "threads.create",
  rename: "threads.rename",
  delete: "threads.delete",
  postMessage: "threads.postMessage",
} as const

export type ThreadCommandName =
  (typeof THREAD_COMMANDS)[keyof typeof THREAD_COMMANDS]

export type ReversalDescriptor = {
  possible: boolean
  description: string
  command?: string
}
