import { describe, expect, it } from "vitest"

import {
  authHeaders,
  createMigratedTestDb,
  createTestApp,
  signUp,
} from "../test/harness.js"

async function jsonOf(res: Response) {
  return (await res.json()) as {
    ok: boolean
    data?: Record<string, unknown>
    error?: { message: string }
  }
}

describe("job reads", () => {
  it("returns checklist, linked paper, calendar rows, and activity ids", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-376-reads@example.com",
    })
    const headers = authHeaders(cookie)

    const createdRes = await app.request("/api/commands/job.create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { title: "Intern", company: "Northwind", location: "Hanoi" },
        idempotencyKey: "376-create",
      }),
    })
    expect(createdRes.status).toBe(200)
    const created = await jsonOf(createdRes)
    const jobId = String(created.data?.id)
    expect(created.data?.activityId).toEqual(expect.any(String))

    const otherRes = await app.request("/api/commands/job.create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { title: "Other", company: "Contoso" },
        idempotencyKey: "376-other",
      }),
    })
    const other = await jsonOf(otherRes)
    const otherId = String(other.data?.id)

    await app.request("/api/commands/job.addChecklistItem", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { jobId, label: "Practise three PM questions" },
      }),
    })

    const paperRes = await app.request("/api/commands/paper.create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { kind: "cv", name: "Junior Marketing CV" },
      }),
    })
    const paper = await jsonOf(paperRes)
    const docId = String(paper.data?.id)
    await app.request("/api/commands/paper.create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { kind: "letter", name: "A letter" },
      }),
    })

    await app.request("/api/commands/job.linkPaper", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { jobId, docId, kind: "cv" } }),
    })

    const detailRes = await app.request("/api/reads/job.get", {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId }),
    })
    const detail = await jsonOf(detailRes)
    const checklist = detail.data?.checklist as { label: string }[]
    expect(checklist.map((item) => item.label)).toEqual([
      "Practise three PM questions",
    ])
    expect(detail.data?.linked).toEqual({
      cv: { id: docId, name: "Junior Marketing CV" },
      letter: null,
    })
    expect(detail.data?.note).toBe("")

    const interviewAt = "2026-11-03T03:00:00.000Z"
    await app.request("/api/commands/job.update", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          jobId,
          patch: { interviewAt, deadline: "2026-11-08" },
        },
      }),
    })

    const calendarRes = await app.request("/api/reads/job.calendar", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-30T23:59:59.000Z",
      }),
    })
    const calendar = await jsonOf(calendarRes)
    const rows = calendar.data as unknown as { id: string }[]
    expect(rows.map((row) => row.id)).toContain(jobId)
    expect(rows.map((row) => row.id)).not.toContain(otherId)

    const outside = await jsonOf(
      await app.request("/api/reads/job.calendar", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-01-31T00:00:00.000Z",
        }),
      })
    )
    expect(outside.data).toEqual([])

    const bad = await jsonOf(
      await app.request("/api/reads/job.calendar", {
        method: "POST",
        headers,
        body: JSON.stringify({ from: "nope", to: "also" }),
      })
    )
    expect(bad.ok).toBe(false)
    expect(bad.error?.message).toBe("Use a from and to date.")

    const cvs = await jsonOf(
      await app.request("/api/reads/paper.list", {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "cv" }),
      })
    )
    const cvRows = cvs.data as unknown as { name: string; kind: string }[]
    expect(cvRows.map((row) => row.name)).toEqual(["Junior Marketing CV"])
    expect(cvRows.every((row) => row.kind === "cv")).toBe(true)

    const feed = await jsonOf(
      await app.request("/api/reads/activity.list", {
        method: "POST",
        headers,
        body: JSON.stringify({ subjectKind: "job", subjectId: jobId }),
      })
    )
    const feedRows = feed.data as unknown as {
      summary: string
      subjectId: string
    }[]
    const summaries = feedRows.map((row) => row.summary)
    expect(
      summaries.some(
        (line) => line.includes("Northwind") || line.includes("added")
      )
    ).toBe(true)
    expect(feedRows.every((row) => row.subjectId === jobId)).toBe(true)

    const movedRes = await app.request("/api/commands/job.move", {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: { jobId, stage: "applied" },
        idempotencyKey: "376-move",
      }),
    })
    const moved = await jsonOf(movedRes)
    expect(moved.data?.stage).toBe("applied")
    const activityId = String(moved.data?.activityId)
    expect(activityId.length).toBeGreaterThan(10)

    const undone = await app.request("/api/commands/activity.undo", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { activityId } }),
    })
    expect(undone.status).toBe(200)
    const after = await jsonOf(
      await app.request("/api/reads/job.get", {
        method: "POST",
        headers,
        body: JSON.stringify({ jobId }),
      })
    )
    expect(after.data?.stage).toBe("saved")

    await client.close()
  })

  it("previews a posting as filled, company-missing, duplicate, or unreadable", async () => {
    const { db, client } = await createMigratedTestDb()
    const app = createTestApp(db)
    const { cookie } = await signUp(app, {
      name: "Ada",
      email: "ada-376-preview@example.com",
    })
    const headers = authHeaders(cookie)

    const filled = await jsonOf(
      await app.request("/api/reads/job.preview", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: "Northwind Labs is hiring an associate product manager intern in Hanoi.",
        }),
      })
    )
    expect(filled.data).toMatchObject({
      status: "filled",
      fields: {
        title: "associate product manager intern",
        company: "Northwind Labs",
        location: "Hanoi",
      },
    })

    const missing = await jsonOf(
      await app.request("/api/reads/job.preview", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "A role with no company pattern." }),
      })
    )
    expect(missing.data?.status).toBe("company-missing")

    const unreadable = await jsonOf(
      await app.request("/api/reads/job.preview", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      })
    )
    expect(unreadable.data?.status).toBe("unreadable")

    const created = await jsonOf(
      await app.request("/api/commands/job.create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: {
            title: "Intern",
            company: "Northwind",
            stage: "interview",
            jobUrl: "https://careers.example.com/intern",
          },
          idempotencyKey: "376-preview-create",
        }),
      })
    )
    const duplicate = await jsonOf(
      await app.request("/api/reads/job.preview", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: "https://careers.example.com/intern",
          text: "Northwind Labs is hiring an associate product manager intern in Hanoi.",
        }),
      })
    )
    expect(duplicate.data).toMatchObject({
      status: "duplicate",
      jobId: created.data?.id,
      stage: "interview",
    })

    await client.close()
  })
})
