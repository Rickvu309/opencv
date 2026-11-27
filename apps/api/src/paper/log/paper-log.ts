import {
  changeSchema,
  type Change,
  type Document,
  type Origin,
  type Refusal,
} from "@workspace/domain/paper-doc"
import type { PaperEngine } from "@workspace/paper-engine"

import { releasedPhotos } from "./photo-references.js"
import type { OpenLog, PaperLogStore, StoredChange } from "./store.js"

export const SNAPSHOT_EVERY = 200
export const NEW_ENGINE = 2
export const MAX_STEPS_PER_CHANGE = 1000
export const MAX_CHANGE_BYTES = 512 * 1024

type Missing = { missing: true }
type Refused = { refusal: Refusal }

export type Appended = {
  ok: true
  head: number
  duplicate: boolean
  released: string[]
}

export type AtVersion = { doc: Document; later: Change[]; head: Document }

export type Since =
  | { changes: Change[]; head: number }
  | { compacted: { doc: Document; version: number; head: number } }

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
          )
        )
      : entry
  )
}

function asChange(stored: StoredChange): Change {
  return {
    edit: stored.edit,
    origin: stored.origin,
    base: stored.base,
    steps: stored.steps,
    inverse: stored.inverse,
    commands: stored.commands,
  }
}

function tooLarge(limit: string): Refused {
  return { refusal: { code: "too-large", limit } }
}

export function createPaperLog({
  store,
  engine,
}: {
  store: PaperLogStore
  engine: PaperEngine
}) {
  async function headDoc(log: OpenLog): Promise<Document | Refused> {
    const { snapshot, snapshotVersion } = log.head
    if (!snapshot)
      return {
        refusal: { code: "schema", detail: "This Paper has no log yet" },
      }
    const later = await log.changesFrom(snapshotVersion)
    const result = engine.apply(
      snapshot,
      later.flatMap((change) => change.steps)
    )
    return "refusal" in result ? result : result.doc
  }

  async function docAt(
    log: OpenLog,
    version: number
  ): Promise<Document | Refused> {
    const { snapshot, snapshotVersion } = log.head
    if (!snapshot || version < snapshotVersion)
      return { refusal: { code: "stale", head: log.head.headVersion } }
    const later = await log.changesFrom(snapshotVersion)
    const result = engine.apply(
      snapshot,
      later
        .filter((change) => change.to <= version)
        .flatMap((change) => change.steps)
    )
    return "refusal" in result ? result : result.doc
  }

  async function atVersion(
    log: OpenLog,
    version: number
  ): Promise<AtVersion | Refused> {
    const headVersion = log.head.headVersion
    if (!Number.isInteger(version) || version < 0 || version > headVersion)
      return { refusal: { code: "stale", head: headVersion } }
    const later = await log.changesFrom(version)
    if (version < headVersion && later[0]?.base !== version)
      return { refusal: { code: "stale", head: headVersion } }
    const doc = await docAt(log, version)
    if ("refusal" in doc) return doc
    const head = await headDoc(log)
    if ("refusal" in head) return head
    return { doc, later: later.map(asChange), head }
  }

  async function write(
    log: OpenLog,
    change: Change,
    activity: string | null
  ): Promise<Appended | Refused> {
    const known = await log.byEdit(change.edit)
    if (known) {
      if (
        canonical(asChange(known)) !==
        canonical({ ...change, inverse: known.inverse })
      )
        return {
          refusal: {
            code: "schema",
            detail: `Edit ${change.edit} was already saved with other steps`,
          },
        }
      return {
        ok: true,
        head: log.head.headVersion,
        duplicate: true,
        released: known.released,
      }
    }
    const head = log.head.headVersion
    if (change.base !== head) return { refusal: { code: "stale", head } }
    const before = await headDoc(log)
    if ("refusal" in before) return before
    const applied = engine.apply(before, change.steps)
    if ("refusal" in applied) return applied
    const to = head + change.steps.length
    const released = releasedPhotos(before, applied.doc)
    await log.add({
      ...change,
      inverse: applied.inverse,
      to,
      released,
      activity,
    })
    const snapshotDue = to - log.head.snapshotVersion >= SNAPSHOT_EVERY
    await log.moveHead({
      headVersion: to,
      ...(snapshotDue ? { snapshot: applied.doc, snapshotVersion: to } : {}),
    })
    return { ok: true, head: to, duplicate: false, released }
  }

  function admit(input: unknown): Change | Refused {
    const parsed = changeSchema.safeParse(input)
    if (!parsed.success)
      return {
        refusal: { code: "schema", detail: parsed.error.issues[0]!.message },
      }
    const change = parsed.data
    if (change.steps.length === 0)
      return {
        refusal: { code: "schema", detail: "A change needs at least one step" },
      }
    if (change.steps.length > MAX_STEPS_PER_CHANGE)
      return tooLarge(`${MAX_STEPS_PER_CHANGE} steps per change`)
    if (Buffer.byteLength(JSON.stringify(change)) > MAX_CHANGE_BYTES)
      return tooLarge(`${MAX_CHANGE_BYTES / 1024} KiB per change`)
    return change
  }

  return {
    async start(
      docId: string,
      doc: Document
    ): Promise<{ ok: true } | Refused | Missing> {
      const checked = engine.apply(doc, [])
      if ("refusal" in checked) return checked
      const result = await store.open(docId, "write", async (log) => {
        if (log.head.snapshot)
          return {
            refusal: { code: "schema", detail: "This Paper already has a log" },
          } satisfies Refused
        await log.moveHead({
          engine: NEW_ENGINE,
          headVersion: 0,
          snapshot: checked.doc,
          snapshotVersion: 0,
        })
        return { ok: true } as const
      })
      return result ?? { missing: true }
    },

    async append(
      docId: string,
      input: unknown,
      activity: string | null = null
    ): Promise<Appended | Refused | Missing> {
      const change = admit(input)
      if ("refusal" in change) return change
      const result = await store.open(docId, "write", (log) =>
        write(log, change, activity)
      )
      return result ?? { missing: true }
    },

    async at(
      docId: string,
      version: number
    ): Promise<AtVersion | Refused | Missing> {
      const result = await store.open(docId, "read", (log) =>
        atVersion(log, version)
      )
      return result ?? { missing: true }
    },

    async appendAt(
      docId: string,
      version: number,
      make: (at: AtVersion) => unknown,
      activity: string | null = null
    ): Promise<Appended | Refused | Missing> {
      const result = await store.open(docId, "write", async (log) => {
        const at = await atVersion(log, version)
        if ("refusal" in at) return at
        const made = make(at)
        if (made && typeof made === "object" && "refusal" in made)
          return made as Refused
        const change = admit(made)
        if ("refusal" in change) return change
        return write(log, change, activity)
      })
      return result ?? { missing: true }
    },

    async head(
      docId: string
    ): Promise<{ doc: Document; version: number } | Refused | Missing> {
      const result = await store.open(docId, "read", async (log) => {
        const doc = await headDoc(log)
        return "refusal" in doc ? doc : { doc, version: log.head.headVersion }
      })
      return result ?? { missing: true }
    },

    async since(
      docId: string,
      version: number
    ): Promise<Since | Refused | Missing> {
      const result = await store.open(
        docId,
        "read",
        async (log): Promise<Since | Refused> => {
          const head = log.head.headVersion
          if (!Number.isInteger(version) || version < 0 || version > head)
            return { refusal: { code: "stale", head } }
          const first = (await log.firstVersion()) ?? head
          if (version < first) {
            const doc = await headDoc(log)
            return "refusal" in doc
              ? doc
              : { compacted: { doc, version: head, head } }
          }
          const changes = await log.changesFrom(version)
          if (version < head && changes[0]?.base !== version)
            return { refusal: { code: "stale", head } }
          return { changes: changes.map(asChange), head }
        }
      )
      return result ?? { missing: true }
    },

    async compact(
      docId: string,
      through: number
    ): Promise<{ ok: true; through: number } | Refused | Missing> {
      const result = await store.open(docId, "write", async (log) => {
        const { headVersion, snapshotVersion } = log.head
        if (!Number.isInteger(through) || through < 0 || through > headVersion)
          return {
            refusal: { code: "stale", head: headVersion },
          } satisfies Refused
        if (through > snapshotVersion) {
          const doc = await docAt(log, through)
          if ("refusal" in doc) return doc
          const boundary = (await log.changesFrom(snapshotVersion)).find(
            (change) => change.base < through && change.to > through
          )
          if (boundary)
            return {
              refusal: { code: "stale", head: headVersion },
            } satisfies Refused
          await log.moveHead({ snapshot: doc, snapshotVersion: through })
        }
        await log.dropThrough(through)
        return { ok: true, through } as const
      })
      return result ?? { missing: true }
    },

    async revert(
      docId: string,
      edit: string,
      as: { edit: string; origin: Origin }
    ): Promise<Appended | Refused | Missing> {
      const result = await store.open(docId, "write", async (log) => {
        const repeated = await log.byEdit(as.edit)
        if (repeated)
          return {
            ok: true,
            head: log.head.headVersion,
            duplicate: true,
            released: repeated.released,
          } satisfies Appended
        const target = await log.byEdit(edit)
        if (!target)
          return {
            refusal: { code: "unmappable", edit: edit as Change["edit"] },
          } satisfies Refused
        const doc = await headDoc(log)
        if ("refusal" in doc) return doc
        const later = await log.changesFrom(target.to)
        const reverted = engine.revert(
          doc,
          asChange(target),
          later.map(asChange)
        )
        if ("refusal" in reverted) return reverted
        const change = admit({
          edit: as.edit,
          origin: as.origin,
          base: log.head.headVersion,
          steps: reverted.steps,
          inverse: [],
          commands: [],
        })
        if ("refusal" in change) return change
        return write(log, change, null)
      })
      return result ?? { missing: true }
    },
  }
}

export type PaperLog = ReturnType<typeof createPaperLog>
