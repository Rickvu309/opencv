import type { QueryCache } from "@tanstack/react-query"
import { undoneActivityRow } from "@/test/control-fixtures.ts"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryObserver } from "@tanstack/react-query"

type BuiltQuery = Parameters<QueryCache["build"]>[1]

import { type ChatTurnEvent } from "@workspace/domain/coach"
import { parseJobId } from "@workspace/domain/kernel"
import { undoActivity, catalogClient } from "@/lib/contract-client.ts"
import { authClient } from "@/lib/auth-client.ts"
import { createToolRefresher } from "@/lib/coach-stream.ts"
import { detect } from "../../../../../scripts/lib/use-read-owner.mjs"

import { ownerIdFromRouteMatches } from "@/lib/owner-id.ts"
import { mockJob } from "@/test/apply-job-fixtures.ts"
import { listJobs, listPaper, previewJob } from "./apply-api.ts"

const JOB = "01900000-0000-7000-8000-000000000010"
const ACTIVITY = "01900000-0000-7000-8000-000000000020"
const here = path.dirname(fileURLToPath(import.meta.url))

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
      return Response.json({
        ok: true,
        data: url.endsWith("/api/commands/activity.undo")
          ? undoneActivityRow()
          : url.endsWith("/api/reads/activity.list") ||
              url.endsWith("/api/reads/job.calendar") ||
              url.endsWith("/api/reads/job.list") ||
              url.endsWith("/api/reads/paper.list")
            ? []
            : url.endsWith("/api/reads/job.get")
              ? {
                  ...mockJob({ id: JOB }),
                  note: "",
                  checklist: [],
                  linked: { cv: null, letter: null },
                }
              : url.endsWith("/api/reads/job.preview")
                ? { status: "unreadable", fields: {}, message: "Unreadable" }
                : { id: JOB },
      })
    }
  )
  return calls
}

function last(calls: Call[]) {
  return calls.at(-1)!
}

function read(relative: string) {
  return readFileSync(path.join(here, relative), "utf8")
}

function routeOwnerMistake(
  session: { user: { id: string } },
  client: {
    useRead: (
      ownerId: string,
      name: string,
      input: Record<string, never>
    ) => string
  }
) {
  return client.useRead(session!.user.id, "job.priorityCounts", {})
}

describe("apply api", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads each job resource from its path", async () => {
    const calls = installFetch()

    await listJobs()
    expect(last(calls).method).toBe("POST")
    expect(new URL(last(calls).url).pathname).toBe("/api/reads/job.list")

    await catalogClient.read("job.get", { jobId: JOB })
    expect(new URL(last(calls).url).pathname).toBe("/api/reads/job.get")
    expect(last(calls).body).toEqual({ jobId: JOB })

    await catalogClient.read("job.calendar", {
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-12-01T00:00:00.000Z",
    })
    const calendar = new URL(last(calls).url)
    expect(calendar.pathname).toBe("/api/reads/job.calendar")
    expect(last(calls).body).toEqual({
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-12-01T00:00:00.000Z",
    })

    await previewJob({ url: "https://careers.verify-posting.dev/role" })
    expect(last(calls).method).toBe("POST")
    expect(new URL(last(calls).url).pathname).toBe("/api/reads/job.preview")
    expect(last(calls).body).toEqual({
      url: "https://careers.verify-posting.dev/role",
    })

    await catalogClient.read("activity.list", {
      subjectKind: "job",
      subjectId: JOB,
    })
    const activity = new URL(last(calls).url)
    expect(activity.pathname).toBe("/api/reads/activity.list")
    expect(last(calls).body).toEqual({ subjectKind: "job", subjectId: JOB })

    await undoActivity(new QueryClient(), ACTIVITY)
    expect(new URL(last(calls).url).pathname).toBe(
      "/api/commands/activity.undo"
    )
    expect(last(calls).body).toMatchObject({
      input: { activityId: ACTIVITY },
    })

    await listPaper("cv")
    const paper = new URL(last(calls).url)
    expect(paper.pathname).toBe("/api/reads/paper.list")
    expect(last(calls).body).toEqual({ kind: "cv" })
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
    const page = read("../../routes/apply.tsx")
    expect(detect(page, "apps/web/src/routes/apply.tsx")).toEqual([])
    expect(
      detect(
        `catalogClient.useRead(session!.user.id, "job.priorityCounts", {})`,
        "apply.tsx"
      ).map((problem) => problem.line)
    ).toEqual([1])
    expect(
      detect(
        `const ownerId = ownerIdFromRouteMatches(matches)\ncatalogClient.useRead(ownerId, "job.priorityCounts", {})`,
        "apply.tsx"
      )
    ).toEqual([])
    expect(
      routeOwnerMistake({ user: { id: "owner-1" } }, { useRead: (id) => id })
    ).toBe("owner-1")
    expect(
      detect(read("apply-api.test.ts"), "apply-api.test.ts").some(
        (problem) => problem.kind === "use-read-non-null"
      )
    ).toBe(true)
  })
})

const bridgeBypass = `
function refresh(event: { name: string }) {
  if (isCommandName(event.name)) {
    void refreshQueries(queryClient, entry.invalidates(input))
    return
  }
}
`
const queryOwner = `
function invalidateCatalogReads(query: { queryKey: unknown[] }) {
  const ownerId = query.queryKey[1]
  return ownerId
}
`
const retiredPriorityUrl = `
export const endpoints = {
  jobsPriorityCounts: "/api/jobs/priority-counts",
}
export const jobPriorityCountsKey = () => null
routes.get("/priority-counts", () => {})
`

const realSessionAtom = authClient.$store.atoms.session

function signIn(ownerId: string) {
  authClient.$store.atoms.session = {
    get: () => ({ data: { user: { id: ownerId } } }),
  } as never
}

function mountCount(queryClient: QueryClient, ownerId: string) {
  const options = catalogClient.options(ownerId, "job.priorityCounts", {})
  queryClient.setQueryData(options.queryKey, [{ priority: "normal", count: 1 }])
  new QueryObserver(queryClient, options).destroy()
  return options.queryKey
}

function event(type: "tool-call" | "tool-result", name: string, extra: object) {
  return { type, name, ...extra } as ChatTurnEvent
}

describe("coach catalog refresh", () => {
  afterEach(() => {
    authClient.$store.atoms.session = realSessionAtom
  })

  it("flags a legacy door that skips the catalog bridge", () => {
    const stream = read("../../lib/coach-stream.ts")
    expect(detect(stream, "apps/web/src/lib/coach-stream.ts")).toEqual([])
    expect(
      detect(bridgeBypass, "apps/web/src/lib/coach-stream.ts").map(
        (problem) => problem.kind
      )
    ).toEqual(["bridge-bypass"])
    expect(
      detect(queryOwner, "apps/web/src/lib/coach-stream.ts").map(
        (problem) => problem.kind
      )
    ).toEqual(["query-owner"])
  })

  it("rejects a retired priority endpoint that nothing calls", () => {
    const retired = ["../../lib/requests.ts", "./apply-api.ts"]
    for (const file of retired) {
      expect(
        detect(read(file), file).filter(
          (problem) => problem.kind === "retired-priority-endpoint"
        )
      ).toEqual([])
    }
    expect(
      detect(retiredPriorityUrl, "requests.ts").map((problem) => problem.kind)
    ).toEqual([
      "retired-priority-endpoint",
      "retired-priority-endpoint",
      "retired-priority-endpoint",
      "retired-priority-endpoint",
    ])
  })

  it("refreshes the signed-in count after committed legacy job writes", async () => {
    signIn("owner-a")
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const owner = mountCount(queryClient, "owner-a")
    const other = mountCount(queryClient, "owner-b")
    const refresh = createToolRefresher(queryClient)
    const jobId = parseJobId(JOB)
    for (const [name, input] of [
      ["job.create", { title: "Role", company: "Acme" }],
      ["job.update", { jobId, patch: { location: "Hanoi" } }],
      ["job.delete", { jobId }],
    ] as const) {
      queryClient.setQueryData(owner, [{ priority: "normal", count: 1 }])
      queryClient.setQueryData(other, [{ priority: "normal", count: 1 }])
      await refresh(event("tool-call", name, { toolCallId: name, input }))
      await refresh(
        event("tool-result", name, {
          toolCallId: name,
          summary: name,
          ok: true,
          result: { ok: true, data: {} },
        })
      )
      expect(queryClient.getQueryState(owner)?.isInvalidated).toBe(true)
      expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    }
  })

  it("leaves every cache fresh for a proposal and refreshes only the signer on approval", async () => {
    signIn("owner-a")
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const owner = mountCount(queryClient, "owner-a")
    const other = mountCount(queryClient, "owner-b")
    const listRead = catalogClient.options("owner-a", "job.list", {})
    const detailRead = catalogClient.options("owner-a", "job.get", {
      jobId: parseJobId(JOB),
    })
    for (const read of [listRead, detailRead])
      queryClient.getQueryCache().build(queryClient, read as BuiltQuery)
    const list = listRead.queryKey
    const detail = detailRead.queryKey
    queryClient.setQueryData(list, [])
    queryClient.setQueryData(detail, { id: JOB } as never)
    const refresh = createToolRefresher(queryClient)
    const input = { jobId: parseJobId(JOB), priority: "high" }
    const call = event("tool-call", "job.setPriority", {
      toolCallId: "priority",
      input,
    })
    await refresh(call)
    await refresh(
      event("tool-result", "job.setPriority", {
        toolCallId: "priority",
        summary: "Set priority",
        ok: true,
        pendingActionId: "pending-1",
        result: { ok: true, data: null },
      })
    )
    expect(queryClient.getQueryState(owner)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(list)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(detail)?.isInvalidated).toBeFalsy()
    await refresh(
      event("tool-result", "job.setPriority", {
        toolCallId: "priority",
        summary: "Set priority",
        ok: true,
        result: { ok: true, data: { id: JOB, priority: "high" } },
      })
    )
    expect(queryClient.getQueryState(owner)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(list)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(detail)?.isInvalidated).toBe(true)
  })
})
