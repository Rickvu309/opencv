import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addChecklistItem,
  addNote,
  calendarJobs,
  createJob,
  deleteJob,
  getJob,
  linkPaper,
  listActivity,
  listJobs,
  listPaper,
  moveJob,
  previewJob,
  removeChecklistItem,
  setChecklistItem,
  starJob,
  undoActivity,
  unlinkPaper,
  updateJob,
} from "./apply-api.ts"

type Call = { url: string; method: string; body: unknown }

function installFetch() {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({
        url,
        method: (init?.method ?? "GET").toUpperCase(),
        body,
      })
      return Response.json({ ok: true, data: { id: "job-1" } })
    }
  )
  return calls
}

function last(calls: Call[]) {
  return calls.at(-1)!
}

describe("apply api", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts each job call with its path and input", async () => {
    const calls = installFetch()

    await listJobs()
    expect(last(calls).method).toBe("GET")
    expect(new URL(last(calls).url).pathname).toBe("/api/jobs")

    await getJob("job-1")
    expect(new URL(last(calls).url).pathname).toBe("/api/jobs/job-1")

    await calendarJobs("2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z")
    const calendar = new URL(last(calls).url)
    expect(calendar.pathname).toBe("/api/jobs/calendar")
    expect(calendar.searchParams.get("from")).toBe("2026-11-01T00:00:00.000Z")
    expect(calendar.searchParams.get("to")).toBe("2026-12-01T00:00:00.000Z")

    await previewJob({ url: "https://careers.verify-posting.dev/role" })
    expect(last(calls).method).toBe("POST")
    expect(new URL(last(calls).url).pathname).toBe("/api/jobs/preview")
    expect(last(calls).body).toEqual({
      url: "https://careers.verify-posting.dev/role",
    })

    await createJob({ title: "Intern", company: "Northwind", stage: "saved" })
    expect(new URL(last(calls).url).pathname).toBe("/api/commands/job.create")
    expect(last(calls).body).toMatchObject({
      input: { title: "Intern", company: "Northwind", stage: "saved" },
    })
    expect(
      typeof (last(calls).body as { idempotencyKey: string }).idempotencyKey
    ).toBe("string")

    await moveJob({ jobId: "job-1", stage: "applied" })
    expect(new URL(last(calls).url).pathname).toBe("/api/commands/job.move")
    expect((last(calls).body as { input: unknown }).input).toEqual({
      jobId: "job-1",
      stage: "applied",
    })

    await updateJob({ jobId: "job-1", patch: { priority: "high" } })
    expect(new URL(last(calls).url).pathname).toBe("/api/commands/job.update")
    expect((last(calls).body as { input: unknown }).input).toEqual({
      jobId: "job-1",
      patch: { priority: "high" },
    })

    await starJob({ jobId: "job-1", starred: true })
    expect(new URL(last(calls).url).pathname).toBe("/api/commands/job.star")

    await deleteJob({ jobId: "job-1" })
    expect(new URL(last(calls).url).pathname).toBe("/api/commands/job.delete")

    await addChecklistItem({ jobId: "job-1", label: "Practise" })
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/job.addChecklistItem"
    )

    await setChecklistItem({ jobId: "job-1", itemId: "item-1", done: true })
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/job.setChecklistItem"
    )
    expect((last(calls).body as { input: unknown }).input).toEqual({
      jobId: "job-1",
      itemId: "item-1",
      done: true,
    })

    await removeChecklistItem({ jobId: "job-1", itemId: "item-1" })
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/job.removeChecklistItem"
    )

    await addNote({ jobId: "job-1", body: "Bring the checkout study." })
    expect(new URL(last(calls).url).pathname).toBe("/api/commands/job.addNote")
    expect((last(calls).body as { input: unknown }).input).toEqual({
      jobId: "job-1",
      body: "Bring the checkout study.",
    })

    await linkPaper({ jobId: "job-1", docId: "doc-1", kind: "cv" })
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/job.linkPaper"
    )

    await unlinkPaper({ jobId: "job-1", kind: "letter" })
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/job.unlinkPaper"
    )

    await listActivity("job-1")
    const activity = new URL(last(calls).url)
    expect(activity.pathname).toBe("/api/activity")
    expect(activity.searchParams.get("subjectKind")).toBe("job")
    expect(activity.searchParams.get("subjectId")).toBe("job-1")

    await undoActivity({ activityId: "act-1" })
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/activity.undo"
    )
    expect((last(calls).body as { input: unknown }).input).toEqual({
      activityId: "act-1",
    })

    await listPaper("cv")
    const paper = new URL(last(calls).url)
    expect(paper.pathname).toBe("/api/paper")
    expect(paper.searchParams.get("kind")).toBe("cv")
  })
})
