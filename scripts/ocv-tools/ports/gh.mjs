// GitHub adapter. Domain verbs over `gh`. Callers get plain records, not argv.
import { readServerNow, parseUpdatedAt } from "../clock.mjs"

// Stop rather than treat a cut-off comment list as the whole claim history.
export const COMMENT_PAGE_CAP = 100

const QUERY = `query($owner:String!,$name:String!,$n:Int!,$cursor:String){repository(owner:$owner,name:$name){owner{login} issue(number:$n){number title state body createdAt updatedAt lastEditedAt labels(first:50){nodes{name}} assignees(first:20){nodes{login}} comments(last:100, before:$cursor){pageInfo{hasPreviousPage startCursor} nodes{databaseId author{login} body createdAt updatedAt}}}}}`

export function ghAdapter(run) {
  const gh = (...args) => {
    const r = run("gh", args)
    if (!r.ok)
      throw new Error(
        `gh ${args.slice(0, 2).join(" ")} failed: ${r.err || r.out}`
      )
    return r.out
  }

  function repo() {
    const data = JSON.parse(gh("repo", "view", "--json", "owner,name"))
    return { owner: data.owner.login, name: data.name }
  }

  // One issue plus every comment page. history is complete, stuck, or cap.
  // record is null when the number is not an issue.
  function issue(n) {
    const view = JSON.parse(gh("repo", "view", "--json", "owner,name"))
    const serverNow = readServerNow({ run })
    let owner = view.owner.login
    const pages = []
    let cursor = null
    let raw = null
    for (let page = 0; page < COMMENT_PAGE_CAP; page++) {
      const args = [
        "api",
        "graphql",
        "-f",
        `query=${QUERY}`,
        "-f",
        `owner=${view.owner.login}`,
        "-f",
        `name=${view.name}`,
        "-F",
        `n=${n}`,
      ]
      if (cursor) args.push("-f", `cursor=${cursor}`)
      const q = run("gh", args)
      if (!q.ok) {
        if (raw)
          throw new Error(
            `gh api graphql failed: ${q.err || q.out}`.slice(0, 400)
          )
        break
      }
      const data = JSON.parse(q.out).data.repository
      raw = data.issue
      owner = data.owner?.login ?? owner
      if (!raw) break
      const conn = raw.comments ?? {}
      pages.push(conn.nodes ?? [])
      const info = conn.pageInfo ?? {}
      if (!info.hasPreviousPage) break
      const prev = info.startCursor
      if (!prev || prev === cursor)
        return {
          record: null,
          history: "stuck",
          owner,
          serverNow,
          pageCap: COMMENT_PAGE_CAP,
        }
      if (page === COMMENT_PAGE_CAP - 1)
        return {
          record: null,
          history: "cap",
          owner,
          serverNow,
          pageCap: COMMENT_PAGE_CAP,
        }
      cursor = prev
    }
    if (!raw)
      return {
        record: null,
        history: "complete",
        owner,
        serverNow,
        pageCap: COMMENT_PAGE_CAP,
      }
    const comments = pages
      .toReversed()
      .flat()
      .map((c) => ({
        databaseId: c.databaseId,
        author: c.author,
        body: c.body,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    return {
      record: {
        n: raw.number,
        title: raw.title,
        state: raw.state,
        body: raw.body ?? "",
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        lastEditedAt: raw.lastEditedAt,
        labels: (raw.labels?.nodes ?? []).map((l) => l.name),
        assignees: (raw.assignees?.nodes ?? []).map((a) => a.login),
        comments,
      },
      history: "complete",
      owner,
      serverNow,
      pageCap: COMMENT_PAGE_CAP,
    }
  }

  return {
    repo,
    serverNow() {
      return readServerNow({ run })
    },
    issue,
    comments(n) {
      return issue(n).record?.comments ?? []
    },
    login() {
      return run("gh", ["api", "user", "--jq", ".login"]).out
    },
    comment(n, body) {
      gh("issue", "comment", String(n), "--body", body)
      return { id: null }
    },
    // The lease instant GitHub stored on the claim comment, or null.
    editComment(id, body) {
      const out = gh(
        "api",
        "--include",
        "-X",
        "PATCH",
        `repos/{owner}/{repo}/issues/comments/${id}`,
        "-f",
        `body=${body}`
      )
      return parseUpdatedAt(out)
    },
    assignMe(n) {
      return run("gh", ["issue", "edit", String(n), "--add-assignee", "@me"]).ok
    },
    createIssue({ title, bodyPath, labels }) {
      const args = [
        "issue",
        "create",
        "--title",
        title,
        "--body-file",
        bodyPath,
      ]
      for (const label of labels) args.push("--label", label)
      const url = gh(...args)
      return { n: Number(String(url).split("/").pop()), url }
    },
    openIssues() {
      return JSON.parse(
        gh(
          "issue",
          "list",
          "--state",
          "open",
          "--limit",
          "200",
          "--json",
          "number,title"
        ) || "[]"
      )
    },
    prs({ state = "all", head, limit = 200 } = {}) {
      const args = ["pr", "list", "--state", state]
      if (head) args.push("--head", head)
      else args.push("--limit", String(limit))
      args.push("--json", head ? "number" : "number,state,isDraft,headRefName")
      return JSON.parse(gh(...args) || "[]")
    },
    labels() {
      const names = run("gh", [
        "label",
        "list",
        "--json",
        "name",
        "--limit",
        "200",
      ])
      if (!names.ok) return { ok: false, names: [] }
      return {
        ok: true,
        names: JSON.parse(names.out || "[]").map((l) => l.name),
      }
    },
    authed() {
      return run("gh", ["auth", "status"]).ok
    },
  }
}
