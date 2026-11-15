import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
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
      lastEditedAt: null,
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
      lastEditedAt: null,
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
          lastEditedAt: null,
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
          lastEditedAt: null,
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

test("the real adapter rejects comment nodes without lastEditedAt", () => {
  const { gh } = scripted(() =>
    page(
      [
        {
          databaseId: 7,
          author: { login: "owner" },
          body: "note",
          createdAt: "2026-10-29T11:00:00Z",
        },
      ],
      { hasPreviousPage: false, startCursor: null }
    )
  )
  assert.throws(
    () => gh.issue(90),
    (error) => error.constructor === Error && /lastEditedAt/.test(error.message)
  )
})

test("every GraphQL query with comments requests lastEditedAt", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./gh.mjs", import.meta.url)),
    "utf8"
  )
  const commentQueries = source.match(/const \w+ = `[^`]*comments[^`]*`/g) ?? []
  assert.ok(commentQueries.length > 0)
  for (const query of commentQueries) assert.match(query, /lastEditedAt/)
})

test("shot releases and check runs use the flags GitHub requires", () => {
  const calls = []
  const run = (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`)
    if (args.some((arg) => String(arg).includes("check-runs")))
      return { ok: true, out: '{"check_runs":[]}', err: "" }
    return { ok: true, out: "", err: "" }
  }
  const gh = ghAdapter(run)
  assert.equal(gh.releaseView("screenshots"), true)
  gh.releaseCreate("screenshots", {
    title: "screenshots",
    notes: "n",
    target: "main",
  })
  gh.releaseUpload("screenshots", ["/tmp/a.png"])
  gh.releaseUpload("screenshots-2", ["/tmp/b.png"], { clobber: false })
  gh.checkRuns("abc")
  assert.equal(gh.viewIssue(90), true)
  assert.equal(gh.viewPr(12), true)
  const create = calls.find((c) => c.includes("release create"))
  assert.match(create, /--prerelease/)
  assert.match(create, /--target main/)
  const upload = calls.find((c) => c.includes("release upload"))
  assert.match(upload, /--clobber/)
  assert.match(upload, /\/tmp\/a\.png/)
  assert.equal(
    calls
      .find((c) => c.includes("release upload screenshots-2"))
      .includes("--clobber"),
    false
  )
  const checks = calls.find((c) => c.includes("check-runs"))
  assert.match(checks, /--method GET/)
  assert.match(checks, /check_name=ci/)
  assert.match(checks, /filter=latest/)
  assert.match(checks, /commits\/abc\/check-runs/)
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

test("release assets preserve count, names and hashes and distinguish absence from failure", () => {
  const calls = []
  const gh = ghAdapter((cmd, args) => {
    calls.push(args)
    return { ok: true, out: '[{"name":"old.png","digest":"sha256:abc"}]' }
  })
  assert.deepEqual(gh.releaseAssets("screenshots"), [
    { name: "old.png", digest: "sha256:abc" },
  ])
  assert.deepEqual(calls[0], [
    "api",
    "repos/{owner}/{repo}/releases/tags/screenshots",
    "--jq",
    "[.assets[] | {name, digest}]",
  ])
  assert.equal(
    ghAdapter(() => ({ ok: false, err: "HTTP 404" })).releaseAssets(
      "screenshots"
    ),
    null
  )
  assert.throws(
    () =>
      ghAdapter(() => ({ ok: false, err: "HTTP 403" })).releaseAssets(
        "screenshots"
      ),
    /HTTP 403/
  )
})
