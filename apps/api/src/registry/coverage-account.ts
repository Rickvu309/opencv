import { parseUserId } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { notifyRequests, user } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import {
  flag,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.js"

export function accountCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, db, run, profileOf, userId } = tools
  return [
    {
      name: "profile.update",
      arrange: async () => {},
      act: () => run("profile.update", { agentCvs: false }),
      assert: async () => {
        expect(flag(await profileOf(), "agentCvs")).toBe(false)
      },
    },
    {
      name: "profile.setPhoto",
      arrange: async () => {
        const file = await saveFile({
          userId: parseUserId(userId),
          name: "face.png",
          mediaType: "image/png",
          bytes: Buffer.from("png"),
          purpose: "avatar",
        })
        ctx.fileId = file.id
      },
      act: () => run("profile.setPhoto", { fileId: ctx.fileId }),
      assert: async () => {
        expect(text(await profileOf(), "image")).toBe(ctx.fileId)
      },
    },
    {
      name: "account.requestEmailChange",
      arrange: async () => {},
      act: () =>
        run("account.requestEmailChange", { email: "ada-next@example.com" }),
      assert: async (result) => {
        expect(text(result.output, "email")).toBe("ada-next@example.com")
        expect(text(await profileOf(), "email")).toBe(
          "ada-coverage@example.com"
        )
      },
    },
    {
      name: "notify.request",
      arrange: async () => {},
      act: () => run("notify.request", { topic: "jobs" }),
      assert: async () => {
        const rows = await db
          .select()
          .from(notifyRequests)
          .where(eq(notifyRequests.userId, userId))
        expect(rows.map((row) => row.topic)).toEqual(["jobs"])
      },
    },
    {
      name: "account.delete",
      arrange: async () => {},
      act: () => run("account.delete", { confirm: "DELETE" }),
      assert: async () => {
        const rows = await db.select().from(user).where(eq(user.id, userId))
        expect(rows).toHaveLength(0)
      },
    },
  ]
}
