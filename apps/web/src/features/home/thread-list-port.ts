export type ThreadListItem = {
  id: string
  title: string
}

export type ThreadListPort = {
  threads: ThreadListItem[]
  activeThreadId: string | null
  openThread: (id: string) => void
  newThread: () => void
}

export function toThreadListItems(
  threads: ReadonlyArray<{ id: string; title: string }>
): ThreadListItem[] {
  return threads.map(({ id, title }) => ({ id, title }))
}
