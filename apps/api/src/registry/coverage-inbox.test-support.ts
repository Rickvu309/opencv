import { catalog } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { expect } from "vitest"

import { activity, inboxMessages, inboxThreads } from "../db/schema.js"
import {
  flag,
  list,
  text,
  type CoverageCase,
  type CoverageTools,
} from "./coverage-helpers.test-support.js"

type ScannedThread = {
  id?: string
  role?: string
}

async function threadByRole(run: CoverageTools["run"], role: string) {
  const scanned = await run("inbox.scan", {})
  const threads = list(scanned.output, "threads") as ScannedThread[]
  const row = threads.find((thread) => thread.role === role)
  if (!row?.id) throw new Error(`missing ${role}`)
  return row.id
}

export function inboxCases(tools: CoverageTools): CoverageCase[] {
  const { db, run, undo, jobOf } = tools
  let doneId = ""
  let snoozeId = ""
  let acceptId = ""
  let clearId = ""
  let draftId = ""
  let sendId = ""
  let calendarId = ""

  return [
    {
      name: catalog["inbox.skip"].name,
      arrange: async () => {},
      act: () => run("inbox.skip", {}),
      assert: async (result) => {
        expect(flag(result.output, "skipped")).toBe(true)
      },
    },
    {
      name: catalog["inbox.scan"].name,
      arrange: async () => {},
      act: () => run("inbox.scan", {}),
      assert: async (result) => {
        expect(list(result.output, "threads")).toHaveLength(6)
        const output = result.output as {
          emailCount?: number
          companyCount?: number
        }
        expect(output.emailCount).toBe(6)
        expect(output.companyCount).toBe(6)
      },
    },
    {
      name: catalog["inbox.markDone"].name,
      arrange: async () => {
        doneId = await threadByRole(run, "Marketing Executive")
      },
      act: () => run("inbox.markDone", { threadId: doneId }),
      assert: async () => {
        const rows = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.id, doneId))
        expect(rows[0]?.status).toBe("done")
      },
      undoAssert: async (result) => {
        await undo(result)
        const rows = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.id, doneId))
        expect(rows[0]?.status).toBe("open")
      },
    },
    {
      name: catalog["inbox.snooze"].name,
      arrange: async () => {
        snoozeId = await threadByRole(run, "Growth Marketer")
      },
      act: () =>
        run("inbox.snooze", {
          threadId: snoozeId,
          until: "2026-10-28T00:00:00.000Z",
        }),
      assert: async () => {
        const rows = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.id, snoozeId))
        expect(rows[0]?.status).toBe("snoozed")
      },
      undoAssert: async (result) => {
        await undo(result)
        const rows = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.id, snoozeId))
        expect(rows[0]?.status).toBe("open")
        expect(rows[0]?.snoozeUntil).toBeNull()
      },
    },
    {
      name: catalog["inbox.acceptSuggestion"].name,
      arrange: async () => {
        await run("job.create", {
          title: "Associate PM",
          company: "Local startup",
          stage: "applied",
        })
        acceptId = await threadByRole(run, "Associate PM")
      },
      act: () => run("inbox.acceptSuggestion", { threadId: acceptId }),
      assert: async (result) => {
        const jobId = text(result.output, "jobId")
        const activityId = text(result.output, "activityId")
        if (!jobId || !activityId) throw new Error("missing move")
        expect(text(await jobOf(jobId), "stage")).toBe("interview")
        const rows = await db
          .select()
          .from(activity)
          .where(eq(activity.id, activityId))
        expect(rows[0]?.command).toBe("job.move")
        expect(result.activityId).toBeNull()
        const own = await db
          .select()
          .from(activity)
          .where(eq(activity.command, "inbox.acceptSuggestion"))
        expect(own).toHaveLength(0)
      },
    },
    {
      name: catalog["inbox.clearSuggestion"].name,
      arrange: async () => {
        clearId = await threadByRole(run, "Associate PM")
      },
      act: () => run("inbox.clearSuggestion", { threadId: clearId }),
      assert: async () => {
        const rows = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.id, clearId))
        expect(rows[0]?.suggestedStage).toBeNull()
      },
    },
    {
      name: catalog["inbox.draftReply"].name,
      arrange: async () => {
        draftId = await threadByRole(run, "Business Analyst")
      },
      act: () => run("inbox.draftReply", { threadId: draftId }),
      assert: async (result) => {
        expect(text(result.output, "body")).toMatch(/14:30/)
      },
    },
    {
      name: catalog["inbox.updateDraft"].name,
      arrange: async () => {
        draftId = await threadByRole(run, "Business Analyst")
      },
      act: () =>
        run("inbox.updateDraft", {
          threadId: draftId,
          body: "Thursday at 14:30 works.",
        }),
      assert: async () => {
        const rows = await db
          .select()
          .from(inboxThreads)
          .where(eq(inboxThreads.id, draftId))
        expect(rows[0]?.draftBody).toBe("Thursday at 14:30 works.")
      },
    },
    {
      name: catalog["inbox.send"].name,
      arrange: async () => {
        sendId = await threadByRole(run, "Business Analyst")
        await run("inbox.updateDraft", {
          threadId: sendId,
          body: "Thursday at 14:30 works.",
        })
      },
      act: () => run("inbox.send", { threadId: sendId }),
      assert: async () => {
        const rows = await db
          .select()
          .from(inboxMessages)
          .where(eq(inboxMessages.threadId, sendId))
        expect(
          rows.some((row) => row.bodyText.includes("Thursday at 14:30 works."))
        ).toBe(true)
      },
    },
    {
      name: catalog["inbox.addToCalendar"].name,
      arrange: async () => {
        calendarId = await threadByRole(run, "Business Analyst")
      },
      act: () =>
        run("inbox.addToCalendar", {
          threadId: calendarId,
          start: "2026-10-29T07:30:00.000Z",
        }),
      assert: async (result) => {
        expect(text(result.output, "start")).toBe("2026-10-29T07:30:00.000Z")
        expect(text(result.output, "id")).toMatch(/^event-/)
      },
    },
  ]
}
