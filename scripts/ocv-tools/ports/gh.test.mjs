import assert from "node:assert/strict"
import test from "node:test"
import { claimMarker, holderOf } from "../claim-marker.mjs"
import { COMMENT_PAGE_CAP, ghAdapter } from "./gh.mjs"
import { NOW, minutesAgo } from "./fake.mjs"

const DATE = "Date: Thu, 29 Oct 2026 12:00:00 GMT\r\n\r\n{}"

function page(nodes, pageInfo) {
  return {
    ok: true,
    out: JSON.stringify({
      data: {
        repository: {
          owner: { login: "owner" },
          issue: {
            number: 90,
            title: "feat: Keep my search",
            state: "OPEN",
            body: "",
            createdAt: "2026-10-01T00:00:00Z",
            lastEditedAt: null,
            labels: { nodes: [{ name: "risk:normal" }] },
            assignees: { nodes: [] },
            comments: { pageInfo, nodes },
          },
        },
      },
    }),
    err: "",
  }
}

function scripted(onGraphql) {
  const calls = []
  const run = (cmd, args) => {
    const line = `${cmd} ${args.join(" ")}`
    calls.push(line)
    if (line.includes("repo view"))
      return {
        ok: true,
        out: '{"owner":{"login":"owner"},"name":"opencv"}',
        err: "",
      }
    if (line.includes("rate_limit")) return { ok: true, out: DATE, err: "" }
    if (line.includes("api graphql")) return onGraphql(line)
    return { ok: false, out: "", err: `unmocked: ${line}` }
  }
  return { gh: ghAdapter(run), calls }
}

const graphqlCalls = (calls) => calls.filter((c) => c.includes("api graphql"))

test("a live claim older than 100 later comments is still the holder", () => {
  const all = [
    {
      databaseId: 1,
      createdAt: minutesAgo(30),
      updatedAt: minutesAgo(5),
      author: { login: "holder" },
      body: claimMarker({
        agent: "holder",
        at: minutesAgo(400),
        branch: "feat/90-x",
      }),
    },
  ]
  for (let i = 2; i <= 150; i++)
    all.push({
      databaseId: i,
      createdAt: minutesAgo(1),
      updatedAt: minutesAgo(1),
      author: { login: "x" },
      body: `note ${i}`,
    })
  const { gh, calls } = scripted((line) => {
    const cursor = /cursor=(\S+)/.exec(line)?.[1]
    const nodes = cursor ? all.slice(0, 50) : all.slice(50)
    return page(nodes, {
      hasPreviousPage: !cursor,
      startCursor: cursor ? null : "p1",
    })
  })
  const loaded = gh.issue(90)
  assert.equal(loaded.history, "complete")
  assert.equal(loaded.record.comments.length, 150)
  const h = holderOf(loaded.record.comments, loaded.serverNow)
  assert.equal(h.agent, "holder")
  assert.equal(h.state, "live")
  assert.ok(graphqlCalls(calls).length >= 2)
  assert.equal(loaded.serverNow, NOW)
})

test("a comment history that never ends is cap, not complete", () => {
  let pages = 0
  const { gh } = scripted(() => {
    pages += 1
    return page(
      [
        {
          databaseId: pages,
          createdAt: minutesAgo(1),
          updatedAt: minutesAgo(1),
          author: { login: "x" },
          body: `note ${pages}`,
        },
      ],
      { hasPreviousPage: true, startCursor: `c${pages}` }
    )
  })
  const loaded = gh.issue(90)
  assert.equal(loaded.history, "cap")
  assert.equal(loaded.record, null)
  assert.equal(pages, COMMENT_PAGE_CAP)
  assert.equal(loaded.pageCap, COMMENT_PAGE_CAP)
})

test("a comment page that does not advance is stuck", () => {
  let pages = 0
  const { gh } = scripted(() => {
    pages += 1
    return page(
      [
        {
          databaseId: 1,
          createdAt: minutesAgo(1),
          updatedAt: minutesAgo(1),
          author: { login: "x" },
          body: "note",
        },
      ],
      { hasPreviousPage: true, startCursor: "stuck" }
    )
  })
  const loaded = gh.issue(90)
  assert.equal(loaded.history, "stuck")
  assert.equal(loaded.record, null)
  assert.equal(pages, 2)
})

test("a failed first page is not an issue", () => {
  const { gh } = scripted(() => ({
    ok: false,
    out: "",
    err: "Could not resolve",
  }))
  const loaded = gh.issue(91)
  assert.equal(loaded.record, null)
  assert.equal(loaded.history, "complete")
})

test("editComment returns the PATCH updated_at", () => {
  const run = () => ({
    ok: true,
    out: 'Date: Thu, 29 Oct 2026 12:00:05 GMT\r\n\r\n{"updated_at":"2026-10-29T12:00:05Z"}',
    err: "",
  })
  assert.equal(
    ghAdapter(run).editComment(7, "body"),
    "2026-10-29T12:00:05.000Z"
  )
})
