import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import ts from "typescript"

import { parseJobId } from "@workspace/domain"
import { QueryClient } from "@tanstack/react-query"
import { undoActivity } from "@/lib/contract-client.ts"

import { ownerIdFromRouteMatches } from "@/routes/apply.tsx"
import {
  calendarJobs,
  getJob,
  listActivity,
  listJobs,
  listPaper,
  previewJob,
} from "./apply-api.ts"

const JOB = "01900000-0000-7000-8000-000000000010"
const ACTIVITY = "01900000-0000-7000-8000-000000000020"

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
      return Response.json({ ok: true, data: { id: JOB } })
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

  it("reads each job resource from its path", async () => {
    const calls = installFetch()

    await listJobs()
    expect(last(calls).method).toBe("GET")
    expect(new URL(last(calls).url).pathname).toBe("/api/jobs")

    await getJob(parseJobId(JOB))
    expect(new URL(last(calls).url).pathname).toBe(`/api/jobs/${JOB}`)

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

    await listActivity(JOB)
    const activity = new URL(last(calls).url)
    expect(activity.pathname).toBe("/api/activity")
    expect(activity.searchParams.get("subjectKind")).toBe("job")
    expect(activity.searchParams.get("subjectId")).toBe(JOB)

    await undoActivity(new QueryClient(), ACTIVITY)
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/activity.undo"
    )
    expect(last(calls).body).toMatchObject({
      input: { activityId: ACTIVITY },
    })

    await listPaper("cv")
    const paper = new URL(last(calls).url)
    expect(paper.pathname).toBe("/api/paper")
    expect(paper.searchParams.get("kind")).toBe("cv")
  })

  it("takes the priority count owner from the route session", () => {
    expect(ownerIdFromRouteMatches([])).toBe("")
    expect(
      ownerIdFromRouteMatches([{ context: { session: null } }, { context: {} }])
    ).toBe("")
    expect(
      ownerIdFromRouteMatches([
        { context: { session: { user: { id: "owner-1" } } } },
      ])
    ).toBe("owner-1")
    const page = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../routes/apply.tsx"
      ),
      "utf8"
    )
    expect(useReadNonNullArguments(page)).toEqual([])
    expect(
      useReadNonNullArguments(
        `catalogClient.useRead(session!.user.id, "job.priorityCounts", {})`
      )
    ).toEqual([1])
    expect(
      useReadNonNullArguments(
        `const ownerId = ownerIdFromRouteMatches(matches)\ncatalogClient.useRead(ownerId, "job.priorityCounts", {})`
      )
    ).toEqual([])
  })
})

function useReadNonNullArguments(source: string) {
  const file = ts.createSourceFile(
    "apply.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const lines: number[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "useRead" &&
      node.arguments[0] &&
      hasNonNull(node.arguments[0])
    )
      lines.push(file.getLineAndCharacterOfPosition(node.getStart()).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return lines
}

function hasNonNull(node: ts.Node): boolean {
  if (ts.isNonNullExpression(node)) return true
  let found = false
  ts.forEachChild(node, (child) => {
    if (!found && hasNonNull(child)) found = true
  })
  return found
}
