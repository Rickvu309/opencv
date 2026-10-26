import {
  emptyCvDocument,
  personActor,
  coachActor,
  parseUserId,
} from "@workspace/domain"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { saveFile } from "../paper/index.js"
import { withDatabase } from "../db/context.js"
import { idempotency, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "./install.js"
import type { Registry } from "./registry.js"

function idOf(value: unknown) {
  if (!value || typeof value !== "object" || !("id" in value)) {
    throw new Error("missing id")
  }
  const id = (value as { id?: unknown }).id
  if (typeof id !== "string") throw new Error("missing id")
  return id
}

function textOf(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) return ""
  const field = (value as Record<string, unknown>)[key]
  return typeof field === "string" ? field : ""
}

describe("registry command coverage", () => {
  it("runs every command as the person and undoes a reversal", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-coverage"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-coverage@example.com",
    })
    const person = personActor(userId)
    const ran = new Set<string>()

    const run = async (name: string, input: unknown, key?: string) => {
      ran.add(name)
      const result = await registry.execute({
        name,
        input,
        actor: person,
        idempotencyKey: key,
      })
      expect(result.pending).toBe(false)
      return result
    }

    await withDatabase(db as never, async () => {
      const chat = await run("chat.create", { title: "Coverage" })
      const chatId = idOf(chat.output)
      const renamed = await run("chat.rename", {
        chatId,
        title: "Renamed chat",
      })
      const renamePlan = renamed.reversal
      expect(renamePlan?.command).toBe("chat.rename")
      if (!renamePlan) throw new Error("missing reversal")
      await registry.execute({
        name: renamePlan.command,
        input: renamePlan.input,
        actor: person,
        skipConfirm: true,
      })
      const opened = await run("chat.open", {})
      expect(idOf(opened.output)).toBeTruthy()
      const paper = await run("paper.create", {
        kind: "cv",
        name: "Coverage CV",
      })
      const docId = idOf(paper.output)
      await run("chat.setFocus", {
        chatId,
        focus: { kind: "paper", id: docId },
      })
      await run("chat.appendMessage", { chatId, text: "Hello" })
      await run("paper.rename", { docId, name: "Renamed CV" })
      await run("paper.setTemplate", { docId, templateId: "modern" })
      const replaced = await run("paper.replace", {
        docId,
        contentVersion: 1,
        document: emptyCvDocument(),
      })
      expect(replaced.activityId).toBeNull()
      await run("paper.setStatus", { docId, status: "ready" })
      await run("paper.share", { docId })
      await run("paper.unshare", { docId })
      await run("paper.dismissCheck", { docId, checkId: "missing" })
      await run("paper.keepTwoPages", { docId })
      const copy = await run("paper.duplicate", { docId })
      await run("paper.delete", { docId: idOf(copy.output) })

      const importedFile = await saveFile({
        userId: parseUserId(userId),
        name: "cv.txt",
        mediaType: "text/plain",
        bytes: Buffer.from("hello"),
        purpose: "import",
      })
      const imported = await run("paper.import", { fileId: importedFile.id })
      expect(textOf(imported.output, "kind")).toBe("cv")

      const job = await run("job.create", {
        title: "Intern",
        company: "Northwind",
      })
      const jobId = idOf(job.output)
      await run("job.update", { jobId, patch: { location: "Hanoi" } })
      await run("job.star", { jobId, starred: true })
      await run("job.addNote", { jobId, body: "" })
      const note = await registry.read("job.get", { jobId }, person)
      expect(textOf(note, "note")).toBe("")
      const item = await run("job.addChecklistItem", {
        jobId,
        label: "Read the posting",
      })
      const itemId = idOf(item.output)
      await run("job.setChecklistItem", { jobId, itemId, done: true })
      await run("job.removeChecklistItem", { jobId, itemId })
      await run("job.linkPaper", { jobId, docId, kind: "cv" })
      await run("job.unlinkPaper", { jobId, kind: "cv" })
      const moved = await run("job.move", { jobId, stage: "applied" })
      expect(moved.activityId).toBeTruthy()
      expect(moved.reversal?.command).toBe("job.move")
      await run("activity.undo", { activityId: moved.activityId })
      const afterUndo = await registry.read("job.get", { jobId }, person)
      expect(textOf(afterUndo, "stage")).toBe("saved")

      const extra = await run(
        "job.create",
        { title: "Extra", company: "Contoso" },
        "job-extra"
      )
      await run("job.delete", { jobId: idOf(extra.output) })

      const photo = await saveFile({
        userId: parseUserId(userId),
        name: "face.png",
        mediaType: "image/png",
        bytes: Buffer.from("png"),
        purpose: "avatar",
      })
      await run("profile.setPhoto", { fileId: photo.id })
      await run("profile.update", { agentCvs: false, agentInterview: false })
      await run("account.requestEmailChange", { email: "ada-next@example.com" })
      await run("notify.request", { topic: "jobs" })
      await run("coach.stop", { chatId })

      const coach = coachActor(userId, chatId)
      const pending = await registry.execute({
        name: "job.move",
        input: { jobId, stage: "interview" },
        actor: coach,
      })
      expect(pending.pending).toBe(true)
      ran.add("actions.approve")
      const approved = await registry.execute({
        name: "actions.approve",
        input: { pendingActionId: pending.pendingActionId },
        actor: person,
      })
      expect(approved.pending).toBe(false)
      const denied = await registry.execute({
        name: "chat.delete",
        input: { chatId },
        actor: coach,
      })
      expect(denied.pending).toBe(true)
      ran.add("actions.deny")
      await registry.execute({
        name: "actions.deny",
        input: { pendingActionId: denied.pendingActionId },
        actor: person,
      })
      const spare = await run("chat.create", {})
      await run("chat.delete", { chatId: idOf(spare.output) })

      const names = registry
        .commandNames()
        .filter((name) => name !== "account.delete")
        .sort()
      expect([...ran].sort()).toEqual(names)

      await run("account.delete", { confirm: "DELETE" })
      expect([...ran].sort()).toEqual(registry.commandNames().sort())
    })
    await client.close()
  })

  it("stores an idempotency key when a command writes no activity", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-idem"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-idem@example.com",
    })
    const person = personActor(userId)
    await withDatabase(db as never, async () => {
      const created = await registry.execute({
        name: "paper.create",
        input: { kind: "cv", name: "Idem CV" },
        actor: person,
      })
      const docId = idOf(created.output)
      const first = await registry.execute({
        name: "paper.replace",
        input: { docId, contentVersion: 1, document: emptyCvDocument() },
        actor: person,
        idempotencyKey: "replace-1",
      })
      expect(first.activityId).toBeNull()
      const second = await registry.execute({
        name: "paper.replace",
        input: { docId, contentVersion: 1, document: emptyCvDocument() },
        actor: person,
        idempotencyKey: "replace-1",
      })
      expect(second.output).toEqual(first.output)
      const rows = await db
        .select()
        .from(idempotency)
        .where(eq(idempotency.userId, userId))
      expect(rows.map((row) => row.key)).toContain("replace-1")
    })
    await client.close()
  })

  it("hides coach tools when the profile toggles are off", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry: Registry = installRegistry()
    const userId = "user-gates"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-gates@example.com",
    })
    await withDatabase(db as never, async () => {
      const person = personActor(userId)
      const chat = await registry.execute({
        name: "chat.create",
        input: {},
        actor: person,
      })
      const coach = coachActor(userId, idOf(chat.output))
      await db
        .update(user)
        .set({ agentCvs: false, agentInterview: false, agentEmail: false })
        .where(eq(user.id, userId))
      const names = (await registry.tools(coach)).map((entry) => entry.name)
      expect(names).not.toContain("paper.replace")
      expect(names).not.toContain("job.addChecklistItem")
      expect(names).not.toContain("job.setChecklistItem")
      expect(names).not.toContain("job.removeChecklistItem")
    })
    await client.close()
  })
})
