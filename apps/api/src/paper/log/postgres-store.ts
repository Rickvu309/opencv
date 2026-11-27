import { and, asc, eq, gte, lte, min } from "drizzle-orm"
import type { Change, Document } from "@workspace/domain/paper-doc"

import { getDb, transaction } from "../../db/context.js"
import { paperChanges, paperDocs } from "../../db/schema.js"
import type { LogHead, OpenLog, PaperLogStore, StoredChange } from "./store.js"

type ChangeRow = typeof paperChanges.$inferSelect

function stored(row: ChangeRow): StoredChange {
  return {
    edit: row.editId as Change["edit"],
    origin: {
      kind: row.originKind as Change["origin"]["kind"],
      actor: row.originActor,
      client: row.clientId,
      ...(row.proposalId === null ? {} : { proposal: row.proposalId }),
    },
    base: row.fromVersion,
    steps: row.steps as Change["steps"],
    inverse: row.inverse as Change["inverse"],
    commands: row.commands as unknown as Change["commands"],
    to: row.toVersion,
    released: row.releasedFileIds,
    activity: row.activityId,
  }
}

function openLog(docId: string, head: LogHead): OpenLog {
  return {
    head,
    async changesFrom(version) {
      const rows = await getDb()
        .select()
        .from(paperChanges)
        .where(
          and(
            eq(paperChanges.docId, docId),
            gte(paperChanges.fromVersion, version),
            lte(paperChanges.toVersion, head.headVersion)
          )
        )
        .orderBy(asc(paperChanges.fromVersion))
      return rows.map(stored)
    },
    async firstVersion() {
      const rows = await getDb()
        .select({ first: min(paperChanges.fromVersion) })
        .from(paperChanges)
        .where(eq(paperChanges.docId, docId))
      return rows[0]?.first ?? null
    },
    async byEdit(edit) {
      const rows = await getDb()
        .select()
        .from(paperChanges)
        .where(
          and(eq(paperChanges.docId, docId), eq(paperChanges.editId, edit))
        )
        .limit(1)
      return rows[0] ? stored(rows[0]) : null
    },
    async add(change) {
      await getDb()
        .insert(paperChanges)
        .values({
          docId,
          fromVersion: change.base,
          toVersion: change.to,
          editId: change.edit,
          clientId: change.origin.client,
          originKind: change.origin.kind,
          originActor: change.origin.actor,
          proposalId: change.origin.proposal ?? null,
          activityId: change.activity,
          steps: change.steps,
          inverse: change.inverse,
          commands: change.commands as unknown as Record<string, unknown>[],
          releasedFileIds: change.released,
        })
    },
    async moveHead(next) {
      Object.assign(head, next)
      await getDb()
        .update(paperDocs)
        .set({
          engine: head.engine,
          headVersion: head.headVersion,
          snapshot: head.snapshot as unknown as Record<string, unknown> | null,
          snapshotVersion: head.snapshotVersion,
        })
        .where(eq(paperDocs.id, docId))
    },
    async dropThrough(version) {
      await getDb()
        .delete(paperChanges)
        .where(
          and(
            eq(paperChanges.docId, docId),
            lte(paperChanges.toVersion, version)
          )
        )
    },
  }
}

export const postgresLogStore: PaperLogStore = {
  async open(docId, mode, work) {
    return transaction(async () => {
      const query = getDb()
        .select({
          engine: paperDocs.engine,
          headVersion: paperDocs.headVersion,
          snapshot: paperDocs.snapshot,
          snapshotVersion: paperDocs.snapshotVersion,
        })
        .from(paperDocs)
        .where(eq(paperDocs.id, docId))
        .limit(1)
      const rows = mode === "write" ? await query.for("update") : await query
      const row = rows[0]
      if (!row) return null
      return work(
        openLog(docId, {
          engine: row.engine,
          headVersion: row.headVersion,
          snapshot: row.snapshot as Document | null,
          snapshotVersion: row.snapshotVersion,
        })
      )
    })
  },
}
