import type { LogHead, OpenLog, PaperLogStore, StoredChange } from "./store.js"

type Entry = { head: LogHead; changes: StoredChange[] }

export function memoryLogStore(): PaperLogStore & {
  create(docId: string): void
} {
  const docs = new Map<string, Entry>()
  const queues = new Map<string, Promise<unknown>>()

  function view(entry: Entry): OpenLog {
    return {
      head: entry.head,
      async changesFrom(version) {
        return structuredClone(
          entry.changes.filter(
            (change) =>
              change.base >= version && change.to <= entry.head.headVersion
          )
        )
      },
      async firstVersion() {
        return entry.changes[0]?.base ?? null
      },
      async byEdit(edit) {
        const found = entry.changes.find((change) => change.edit === edit)
        return found ? structuredClone(found) : null
      },
      async add(change) {
        if (entry.changes.some((stored) => stored.edit === change.edit))
          throw new Error("paper_changes_doc_edit_uidx")
        if (entry.changes.some((stored) => stored.base === change.base))
          throw new Error("paper_changes_doc_id_from_version_pk")
        if (change.to <= change.base)
          throw new Error("paper_changes_versions_ascend")
        entry.changes.push(structuredClone(change))
        entry.changes.sort((a, b) => a.base - b.base)
      },
      async moveHead(head) {
        Object.assign(entry.head, structuredClone(head))
      },
      async dropThrough(version) {
        entry.changes = entry.changes.filter((change) => change.to > version)
      },
    }
  }

  return {
    create(docId) {
      docs.set(docId, {
        head: { engine: 1, headVersion: 0, snapshot: null, snapshotVersion: 0 },
        changes: [],
      })
    },
    async open(docId, mode, work) {
      const previous = queues.get(docId) ?? Promise.resolve()
      const run = previous.then(async () => {
        const entry = docs.get(docId)
        if (!entry) return null
        const draft = structuredClone(entry)
        const result = await work(view(draft))
        if (mode === "write") docs.set(docId, draft)
        return result
      })
      queues.set(
        docId,
        run.catch(() => undefined)
      )
      return run
    },
  }
}
