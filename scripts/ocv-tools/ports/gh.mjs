import { readServerNow, parseUpdatedAt } from "../clock.mjs"
import { decide, refusalError } from "../rules/index.mjs"

function editStamp(c) {
  if (c.lastEditedAt === undefined)
    throw new Error(
      "GitHub comment is missing lastEditedAt; the comments query must request it"
    )
  return c.lastEditedAt
}

export const COMMENT_PAGE_CAP = 100

const LIST_CAP = 40
const ISSUE_LIST = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){issues(states:OPEN,first:50,after:$cursor){pageInfo{hasNextPage endCursor} nodes{number title state body createdAt lastEditedAt labels(first:50){nodes{name}} assignees(first:20){nodes{login}} comments(first:100){pageInfo{hasNextPage endCursor} nodes{databaseId author{login} body createdAt lastEditedAt updatedAt}}}}}}`
const COMMENT_AFTER = `query($owner:String!,$name:String!,$n:Int!,$cursor:String){repository(owner:$owner,name:$name){issue(number:$n){comments(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{databaseId author{login} body createdAt lastEditedAt updatedAt}}}}}`
const PR_LIST = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){pullRequests(states:OPEN,first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{number state headRefName headRefOid}}}}`

const QUERY = `query($owner:String!,$name:String!,$n:Int!,$cursor:String){repository(owner:$owner,name:$name){owner{login} issue(number:$n){number title state body createdAt updatedAt lastEditedAt labels(first:50){nodes{name}} assignees(first:20){nodes{login}} comments(last:100, before:$cursor){pageInfo{hasPreviousPage startCursor} nodes{databaseId author{login} body createdAt lastEditedAt updatedAt}}}}}`

export function ghAdapter(run) {
  let repoView
  const gh = (...args) => {
    const r = run("gh", args)
    if (!r.ok)
      throw new Error(
        `gh ${args.slice(0, 2).join(" ")} failed: ${r.err || r.out}`
      )
    return r.out
  }

  function repo() {
    if (repoView) return repoView
    const data = JSON.parse(gh("repo", "view", "--json", "owner,name"))
    const owner = data.owner.login
    const nameWithOwner = `${owner}/${data.name}`
    repoView = {
      owner,
      name: data.name,
      nameWithOwner,
    }
    return repoView
  }

  function graphql(query, vars) {
    const args = ["api", "graphql", "-f", `query=${query}`]
    for (const [key, value] of Object.entries(vars)) {
      if (value == null || value === "") continue
      if (typeof value === "number") args.push("-F", `${key}=${value}`)
      else args.push("-f", `${key}=${value}`)
    }
    const q = run("gh", args)
    if (!q.ok)
      throw new Error(`gh api graphql failed: ${q.err || q.out}`.slice(0, 400))
    return JSON.parse(q.out)
  }

  function refuseHistory(history) {
    const verdict = decide("history", { history })
    throw refusalError(verdict.refusals[0])
  }

  function pageAll({ query, pick, cap, list, repo: view }) {
    const items = []
    const seen = new Set()
    let cursor = null
    for (let page = 0; page < cap; page++) {
      const data = graphql(query, {
        owner: view.owner,
        name: view.name,
        cursor,
      })
      const conn = pick(data)
      if (!conn?.pageInfo || typeof conn.pageInfo.hasNextPage !== "boolean")
        refuseHistory({ kind: "board-stuck", list })
      for (const node of conn.nodes ?? []) {
        if (seen.has(node.number)) continue
        seen.add(node.number)
        items.push(node)
      }
      const info = conn.pageInfo
      if (!info.hasNextPage) return items
      if (!info.endCursor || info.endCursor === cursor)
        refuseHistory({ kind: "board-stuck", list })
      if (page === cap - 1)
        refuseHistory({ kind: "board-cap", list, pageCap: cap })
      cursor = info.endCursor
    }
    return items
  }

  function completeComments(view, issue) {
    const conn = issue.comments ?? {}
    if (!conn.pageInfo || typeof conn.pageInfo.hasNextPage !== "boolean")
      refuseHistory({ kind: "comments-open", n: issue.number })
    const nodes = [...(conn.nodes ?? [])]
    let info = conn.pageInfo
    let cursor = info.endCursor ?? null
    let pages = 1
    while (info.hasNextPage) {
      if (!cursor || pages >= COMMENT_PAGE_CAP)
        refuseHistory(
          pages >= COMMENT_PAGE_CAP
            ? {
                kind: "comments-cap",
                n: issue.number,
                pageCap: COMMENT_PAGE_CAP,
              }
            : { kind: "comments-stuck", n: issue.number }
        )
      const data = graphql(COMMENT_AFTER, {
        owner: view.owner,
        name: view.name,
        n: issue.number,
        cursor,
      })
      const next = data.data?.repository?.issue?.comments ?? {}
      const pageInfo = next.pageInfo ?? {}
      if (
        typeof pageInfo.hasNextPage !== "boolean" ||
        (pageInfo.hasNextPage &&
          (!pageInfo.endCursor || pageInfo.endCursor === cursor))
      )
        refuseHistory({ kind: "comments-stuck", n: issue.number })
      nodes.push(...(next.nodes ?? []))
      info = pageInfo
      cursor = pageInfo.endCursor ?? null
      pages++
    }
    return nodes.map((c) => ({
      databaseId: c.databaseId,
      author: c.author,
      body: c.body,
      createdAt: c.createdAt,
      lastEditedAt: editStamp(c),
      updatedAt: c.updatedAt,
    }))
  }

  function openBoard() {
    const view = repo()
    const serverNow = readServerNow({ run })
    const issues = pageAll({
      query: ISSUE_LIST,
      pick: (data) => data.data?.repository?.issues,
      cap: LIST_CAP,
      list: "issue",
      repo: view,
    })
    const pulls = pageAll({
      query: PR_LIST,
      pick: (data) => data.data?.repository?.pullRequests,
      cap: LIST_CAP,
      list: "pull",
      repo: view,
    })
    return {
      owner: view.owner,
      name: view.name,
      nameWithOwner: view.nameWithOwner,
      serverNow,
      issues: issues
        .filter((issue) => String(issue.state).toUpperCase() === "OPEN")
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          body: issue.body ?? "",
          createdAt: issue.createdAt,
          lastEditedAt: issue.lastEditedAt,
          labels: (issue.labels?.nodes ?? []).map((label) => label.name),
          assignees: (issue.assignees?.nodes ?? []).map((a) => a.login),
          comments: completeComments(view, issue),
        })),
      pulls,
    }
  }

  function checkRuns(sha) {
    const out = gh(
      "api",
      "--method",
      "GET",
      `repos/{owner}/{repo}/commits/${sha}/check-runs`,
      "-f",
      "check_name=ci",
      "-f",
      "filter=latest",
      "-f",
      "per_page=10"
    )
    return JSON.parse(out).check_runs ?? []
  }

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
        lastEditedAt: editStamp(c),
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
      args.push(
        "--json",
        head
          ? "number,title,body,state,labels,headRefName,headRefOid,closingIssuesReferences"
          : "number,state,isDraft,headRefName"
      )
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
    openBoard,
    checkRuns,
    releaseView(tag) {
      return run("gh", ["release", "view", tag]).ok
    },
    releaseAssets(tag) {
      const result = run("gh", [
        "api",
        `repos/{owner}/{repo}/releases/tags/${tag}`,
        "--jq",
        "[.assets[] | {name, digest}]",
      ])
      if (!result.ok) {
        if (/HTTP 404/.test(result.err || result.out)) return null
        throw new Error(
          `Reading screenshot assets failed: ${result.err || result.out}`
        )
      }
      return JSON.parse(result.out)
    },
    releaseCreate(tag, { title, notes, target }) {
      gh(
        "release",
        "create",
        tag,
        "--title",
        title,
        "--notes",
        notes,
        "--prerelease",
        "--target",
        target
      )
    },
    releaseUpload(tag, files, { clobber = true } = {}) {
      gh("release", "upload", tag, ...files, ...(clobber ? ["--clobber"] : []))
    },
    issueLabels(n) {
      return JSON.parse(
        gh("issue", "view", String(n), "--json", "labels")
      ).labels.map((l) => l.name)
    },
    viewIssue(n) {
      return run("gh", ["issue", "view", String(n), "--json", "number"]).ok
    },
    viewPr(n) {
      return run("gh", ["pr", "view", String(n), "--json", "number"]).ok
    },
    commentPr(n, body) {
      gh("pr", "comment", String(n), "--body", body)
    },
    closeIssue(n, pr) {
      const state = run("gh", [
        "issue",
        "view",
        String(n),
        "--json",
        "state",
        "--jq",
        ".state",
      ])
      if (!state.ok || state.out.trim() !== "OPEN") return false
      return run("gh", [
        "issue",
        "close",
        String(n),
        "--comment",
        `Closed by merged PR #${pr}.`,
      ]).ok
    },
  }
}
