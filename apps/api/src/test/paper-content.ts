import { personActor } from "@workspace/domain"

import { eq } from "drizzle-orm"

import { paperDocs, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { createMigratedTestDb } from "./harness.js"

export async function openStore(userId: string) {
  const { db, client } = await createMigratedTestDb()
  await db
    .insert(user)
    .values({ id: userId, name: "Ada", email: `${userId}@example.com` })
  const registry = installRegistry()
  const execute = registry.execute.bind(registry)
  registry.execute = async (call) => {
    const input = call.input as {
      docId?: string
      update?: string
      basedOn?: number
    }
    const pushes =
      call.name === "paper.sync" &&
      input.basedOn === undefined &&
      input.update !== undefined &&
      input.update !== "" &&
      input.update !== EMPTY_UPDATE
    if (!pushes) return execute(call)
    const rows = await db
      .select({ revision: paperDocs.contentVersion })
      .from(paperDocs)
      .where(eq(paperDocs.id, input.docId!))
    return execute({
      ...call,
      input: { ...input, basedOn: rows[0]?.revision ?? 0 },
    })
  }
  return { db, client, registry, actor: personActor(userId) }
}

const EMPTY_UPDATE = "AAA="

export function bytesOf(encoded: string) {
  return new Uint8Array(Buffer.from(encoded, "base64"))
}

export function encoded(bytes: Uint8Array | null) {
  return Buffer.from(bytes ?? new Uint8Array()).toString("base64")
}
