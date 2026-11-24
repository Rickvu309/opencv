import { parseUserId } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { implementation as deleteAccount } from "../account/operations/account/delete/server.js"
import { implementation as requestEmailChange } from "../account/operations/account/request-email-change/server.js"
import { implementation as notify } from "../account/operations/notify/request/server.js"
import { implementation as markWelcomed } from "../account/operations/profile/mark-welcomed/server.js"
import { implementation as setPhoto } from "../account/operations/profile/set-photo/server.js"
import { implementation as update } from "../account/operations/profile/update/server.js"
import { notifyRequests, user } from "../db/schema.js"
import { saveFile } from "../paper/index.js"
import {
  flag,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"

export function accountCases(tools: CoverageTools): CoverageCase[] {
  const { ctx, db, run, profileOf, userId } = tools
  return [
    {
      name: update.operation.name,
      arrange: async () => {},
      act: () => run("profile.update", { agentCvs: false }),
      assert: async () => {
        expect(flag(await profileOf(), "agentCvs")).toBe(false)
      },
    },
    {
      name: setPhoto.operation.name,
      arrange: async () => {
        const file = await saveFile({
          userId: parseUserId(userId),
          name: "face.png",
          mediaType: "image/png",
          bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
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
      name: markWelcomed.operation.name,
      arrange: async () => {},
      act: () => run("profile.markWelcomed", {}),
      assert: async (result) => {
        const welcomedAt = text(result.output, "welcomedAt")
        expect(welcomedAt).toMatch(/\d{4}-\d{2}-\d{2}T/)
        const again = await run("profile.markWelcomed", {})
        expect(text(again.output, "welcomedAt")).toBe(welcomedAt)
      },
    },
    {
      name: requestEmailChange.operation.name,
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
      name: notify.operation.name,
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
      name: deleteAccount.operation.name,
      arrange: async () => {},
      act: () => run("account.delete", { confirm: "DELETE" }),
      assert: async () => {
        const rows = await db.select().from(user).where(eq(user.id, userId))
        expect(rows).toHaveLength(0)
      },
    },
  ]
}
