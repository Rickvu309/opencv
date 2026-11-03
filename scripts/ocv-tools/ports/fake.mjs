import { existsSync, readFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { EXAMPLES } from "../issue.mjs"
import { createFacts } from "../facts.mjs"

export const NOW = Date.parse("2026-10-29T12:00:00Z")

export const minutesAgo = (m, now = NOW) =>
  new Date(now - m * 60000).toISOString()

export function issue(n, over = {}) {
  return {
    n,
    title: over.title ?? "feat: Keep my search",
    state: over.state ?? "OPEN",
    body: over.body ?? "### Type\n\nfeat\n\n### Risk\n\nnormal\n",
    createdAt: over.createdAt ?? "2026-10-01T00:00:00Z",
    updatedAt: over.updatedAt ?? over.createdAt ?? "2026-10-01T00:00:00Z",
    lastEditedAt: over.lastEditedAt ?? null,
    labels: over.labels ?? ["risk:normal"],
    assignees: over.assignees ?? [],
    comments: over.comments ?? [],
  }
}

export function pr(n, over = {}) {
  return {
    number: n,
    state: over.state ?? "OPEN",
    isDraft: Boolean(over.isDraft),
    headRefName: over.head ?? over.headRefName ?? "feat/1-x",
  }
}

const copy = (value) => JSON.parse(JSON.stringify(value))

export function fakePorts(world = {}) {
  const effects = []
  const written = {}
  const files = new Map(Object.entries(world.files ?? {}))
  if (!files.has(EXAMPLES)) files.set(EXAMPLES, readFileSync(EXAMPLES, "utf8"))
  const dirs = new Set()
  const counts = { issue: 0, worktrees: 0, prs: 0, remoteHeads: 0 }
  const env = {
    PR_RESULT_REPO: "opencv",
    PR_RESULT_DIR: world.resultDir ?? "/tmp/opencv-fake-results",
    ...(world.env ?? {}),
  }
  const main = world.main ?? "/tmp/opencv"
  const root = world.root ?? "/tmp/opencv.worktrees"
  const state = {
    issues: new Map(
      (world.issues ?? [issue(90)]).map((item) => [item.n, copy(item)])
    ),
    prs: (world.prs ?? []).map((item) => ({ ...item })),
    worktrees: (world.worktrees ?? []).map((item) => ({ ...item })),
    local: new Set(world.localBranches ?? []),
    remote: new Set(world.remoteBranches ?? []),
    relation: { ...(world.relation ?? {}) },
    dirty: { ...(world.dirty ?? {}) },
    ahead: { ...(world.ahead ?? {}) },
    places: world.places ?? {},
    branch: world.branch ?? "feat/90-keep-my-search",
    cwd: world.cwd ?? join(root, "90-keep-my-search"),
    main,
    root,
    owner: world.owner ?? "owner",
    ownerType: world.ownerType ?? "User",
    admins: world.admins ?? [],
    login: world.login ?? "me",
    serverNow: world.serverNow ?? NOW,
    now: world.now ?? NOW,
    hooks: world.hooksPath ?? ".githooks",
    labels: world.labels ?? ["risk:low", "risk:normal", "risk:high"],
    authed: world.authed !== false,
    labelsOk: world.labelsOk !== false,
    history: world.history ?? "complete",
    diskFreeMb: world.diskFreeMb ?? 100000,
    writeFail: world.writeFail ?? null,
    fetchOk: world.fetchOk !== false,
    fetchErr: world.fetchErr ?? "fetch failed",
    addOk: world.addOk !== false,
    failAdd: Boolean(world.failAdd),
    addErr: world.addErr ?? "add broke",
    failDiff: Boolean(world.failDiff),
    diffErr: world.diffErr ?? "diff broke",
    patch: world.patch ?? "diff --git a/file\n",
    commitOk: world.commitOk !== false,
    commitErr: world.commitErr ?? "commit failed",
    pushOk: world.pushOk !== false,
    pushErr: world.pushErr ?? "push failed",
    head: world.head ?? "abc1234",
    nextIssue: world.nextIssue ?? 77,
    nextCommentId: world.nextCommentId ?? 1000,
    commentUpdatedAt: world.commentUpdatedAt ?? "2026-10-29T12:00:05.000Z",
    releases: new Set(world.releases ?? []),
    uploadErr: world.uploadErr ?? null,
    nameWithOwner: world.nameWithOwner ?? null,
    checks: { ...(world.checks ?? {}) },
    listening: new Set(world.listening ?? []),
    assignOk: world.assignOk !== false,
    notRepo: Boolean(world.notRepo),
    onIssue: world.onIssue ?? null,
    onComment: world.onComment ?? null,
    onCommit: world.onCommit ?? null,
    onPush: world.onPush ?? null,
    gitDirs: {},
  }
  const effect = (op, extra = {}) => {
    effects.push({ op, ...extra })
  }
  const home = env.HOME || homedir()
  for (const dir of [
    main,
    root,
    dirname(root),
    join(home, "tmp"),
    env.TMPDIR || tmpdir(),
  ])
    dirs.add(dir)
  for (const dir of world.dirs ?? []) dirs.add(dir)

  function remember(path, text) {
    files.set(path, text)
    written[path] = text
    let dir = dirname(path)
    while (dir && dir !== "/" && dir !== ".") {
      dirs.add(dir)
      dir = dirname(dir)
    }
  }

  function serverNow() {
    return typeof state.serverNow === "function"
      ? state.serverNow()
      : state.serverNow
  }

  const fs = {
    read(path) {
      if (files.has(path)) return files.get(path)
      if (existsSync(path)) return readFileSync(path, "utf8")
      throw new Error(`ENOENT ${path}`)
    },
    write(path, text) {
      remember(path, text)
    },
    exists(path) {
      return files.has(path) || dirs.has(path)
    },
    list(dir) {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`
      const names = new Set()
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue
        names.add(path.slice(prefix.length).split("/")[0])
      }
      for (const path of dirs) {
        if (!path.startsWith(prefix)) continue
        const rest = path.slice(prefix.length)
        if (rest) names.add(rest.split("/")[0])
      }
      return [...names]
    },
    mkdir(path) {
      dirs.add(path)
    },
    rmdir(path) {
      const prefix = `${path}/`
      for (const file of files.keys())
        if (file.startsWith(prefix)) throw new Error("ENOTEMPTY")
      for (const dir of dirs)
        if (dir.startsWith(prefix)) throw new Error("ENOTEMPTY")
      dirs.delete(path)
    },
    scratch(name, text) {
      const path = `/tmp/${name}`
      remember(path, text)
      written[name] = text
      return path
    },
    diskFree() {
      return state.diskFreeMb
    },
    writeProbe(dir) {
      if (!state.writeFail) return null
      return {
        full: state.writeFail.full !== false,
        message: state.writeFail.message,
      }
    },
  }

  const gh = {
    repo: () => ({
      owner: state.owner,
      ownerType: state.ownerType,
      name: "opencv",
      nameWithOwner: state.nameWithOwner ?? `${state.owner}/opencv`,
    }),
    approvers() {
      if (world.approversError) throw new Error(world.approversError)
      return [
        ...(state.ownerType === "User" ? [state.owner] : []),
        ...state.admins,
      ]
        .map((login) => String(login).toLowerCase())
        .filter((login, index, all) => all.indexOf(login) === index)
    },
    serverNow,
    issue(n) {
      counts.issue += 1
      const found = state.issues.get(Number(n))
      state.onIssue?.(n, counts.issue, found)
      const now = serverNow()
      if (state.history !== "complete")
        return {
          record: null,
          history: state.history,
          owner: state.owner,
          serverNow: now,
          pageCap: 100,
        }
      if (!found)
        return {
          record: null,
          history: "complete",
          owner: state.owner,
          serverNow: now,
          pageCap: 100,
        }
      return {
        record: copy(found),
        history: "complete",
        owner: state.owner,
        serverNow: now,
        pageCap: 100,
      }
    },
    comments(n) {
      return gh.issue(n).record?.comments ?? []
    },
    login: () => state.login,
    comment(n, body) {
      const item = state.issues.get(Number(n))
      const at = new Date(serverNow()).toISOString()
      const row = {
        databaseId: state.nextCommentId++,
        author: { login: state.login },
        createdAt: at,
        lastEditedAt: null,
        updatedAt: at,
        body,
      }
      if (item) item.comments.push(row)
      effect("comment", { n: Number(n), body })
      state.onComment?.(n, body, item)
      return { id: row.databaseId }
    },
    editComment(id, body) {
      effect("editComment", { id, body })
      if (state.commentEditError) throw new Error(state.commentEditError)
      const stamp = state.commentUpdatedAt
      let found = false
      for (const item of state.issues.values()) {
        const row = item.comments.find((c) => c.databaseId === id)
        if (!row) continue
        found = true
        row.body = body
        row.lastEditedAt = stamp
        row.updatedAt = stamp
      }
      if (!found)
        throw new Error(`gh api --include failed: comment ${id} was not found`)
      return stamp
    },
    assignMe(n) {
      effect("assign", { n: Number(n) })
      return state.assignOk !== false
    },
    createIssue({ title, bodyPath, labels }) {
      const n = state.nextIssue++
      effect("createIssue", { n, title, bodyPath, labels })
      state.issues.set(
        n,
        issue(n, {
          title,
          labels,
          body: files.get(bodyPath) ?? "",
          comments: [],
        })
      )
      return { n, url: `https://github.com/quanvu309/opencv/issues/${n}` }
    },
    openIssues() {
      return [...state.issues.values()]
        .filter((item) => item.state === "OPEN")
        .map((item) => ({ number: item.n, title: item.title }))
    },
    prs({ state: want = "all", head, limit = 200 } = {}) {
      counts.prs += 1
      let list = state.prs
      if (want !== "all")
        list = list.filter(
          (item) =>
            String(item.state).toLowerCase() === String(want).toLowerCase()
        )
      if (head) list = list.filter((item) => item.headRefName === head)
      return list.slice(0, limit).map((item) => ({ ...item }))
    },
    labels() {
      if (!state.labelsOk) return { ok: false, names: [] }
      return { ok: true, names: [...state.labels] }
    },
    authed: () => state.authed,
    openBoard() {
      const issues = [...state.issues.values()]
        .filter((item) => String(item.state).toUpperCase() === "OPEN")
        .map((item) => ({
          number: item.n,
          title: item.title,
          state: item.state,
          body: item.body ?? "",
          createdAt: item.createdAt,
          lastEditedAt: item.lastEditedAt,
          labels: [...(item.labels ?? [])],
          assignees: [...(item.assignees ?? [])],
          comments: (item.comments ?? []).map((c) => ({
            lastEditedAt: null,
            ...c,
          })),
        }))
      const pulls = state.prs
        .filter((item) => String(item.state).toUpperCase() === "OPEN")
        .map((item) => ({ ...item }))
      return {
        owner: state.owner,
        approvers: [
          ...(state.ownerType === "User" ? [state.owner] : []),
          ...state.admins,
        ],
        name: "opencv",
        nameWithOwner: state.nameWithOwner ?? `${state.owner}/opencv`,
        serverNow: serverNow(),
        issues,
        pulls,
      }
    },
    checkRuns(sha) {
      return state.checks[sha] ?? []
    },
    releaseView(tag) {
      effect("releaseView", { tag })
      return state.releases.has(tag)
    },
    releaseCreate(tag, { title, notes, target }) {
      effect("releaseCreate", {
        tag,
        title,
        notes,
        target,
        prerelease: true,
      })
      state.releases.add(tag)
    },
    releaseUpload(tag, files) {
      effect("releaseUpload", { tag, files: [...files], clobber: true })
      if (state.uploadErr) throw new Error(state.uploadErr)
    },
    viewIssue(n) {
      return state.issues.has(Number(n))
    },
    viewPr(n) {
      return state.prs.some((item) => item.number === Number(n))
    },
    commentPr(n, body) {
      effect("prComment", { n: Number(n), body })
    },
    closeIssue(n, pr) {
      const item = state.issues.get(Number(n))
      if (!item || item.state !== "OPEN") return false
      item.state = "CLOSED"
      effect("closeIssue", { n: Number(n), pr })
      return true
    },
  }

  const git = {
    repo() {
      if (state.notRepo) return null
      return { main: state.main, root: state.root }
    },
    here(cwd) {
      const top = cwd ?? state.cwd
      if (state.places[top]) return state.places[top]
      const under = String(top).startsWith(`${state.root}/`)
      return {
        topOk: true,
        top,
        branch: state.branch,
        gitDirOk: true,
        gitDir: under
          ? `${state.main}/.git/worktrees/90-keep`
          : `${state.main}/.git`,
        commonOk: true,
        common: `${state.main}/.git`,
      }
    },
    worktrees() {
      counts.worktrees += 1
      return state.worktrees.map((item) => ({ ...item }))
    },
    remoteHeads() {
      counts.remoteHeads += 1
      return [...state.remote]
    },
    localHead(_cwd, branch) {
      return state.local.has(branch)
    },
    remoteHead(_cwd, branch) {
      return state.remote.has(branch)
    },
    branchFacts(_cwd, branch) {
      const relation = state.relation[branch] ?? "same"
      if (relation === "missing")
        return { local: null, remote: null, relation, err: "missing" }
      const same = relation === "same"
      return {
        local: same ? "same" : "local",
        remote: same ? "same" : "remote",
        relation,
        err: "",
      }
    },
    fastForward(_cwd, branch, sha) {
      effect("fast-forward", { branch, sha })
      return { ok: true, out: "", err: "" }
    },
    fetch(_cwd, ref, { prune = false } = {}) {
      effect("fetch", { ref: ref ?? null, prune })
      if (!state.fetchOk) return { ok: false, out: "", err: state.fetchErr }
      return { ok: true, out: "", err: "" }
    },
    addWorktree(_cwd, { path, branch, mode, start }) {
      effect("addWorktree", { path, branch, mode, start })
      if (!state.addOk) return { ok: false, out: "", err: "add failed" }
      state.worktrees.push({ path, branch })
      state.local.add(branch)
      const gitDir = `${state.main}/.git/worktrees/${branch.replaceAll("/", "-")}`
      state.gitDirs[path] = gitDir
      return { ok: true, out: "", err: "", gitDir }
    },
    config(_cwd, key) {
      return key === "core.hooksPath" ? state.hooks : ""
    },
    setConfig(_cwd, key, value) {
      effect("config", { key, value })
      if (key === "core.hooksPath") state.hooks = value
      return { ok: true, out: "", err: "" }
    },
    status(cwd) {
      return { ok: true, out: state.dirty[cwd] ?? "", err: "" }
    },
    ahead(cwd) {
      const n = state.ahead[cwd] ?? 0
      return { ok: true, n, out: String(n), err: "" }
    },
    verify(cwd, ref) {
      const ok = state.remote.has(ref.replace(/^origin\//, ""))
      return { ok, out: ok ? "remote" : "", err: ok ? "" : "missing" }
    },
    shortHead: () => state.head,
    add(cwd) {
      effect("add", { cwd })
      if (state.failAdd) return { ok: false, out: "", err: state.addErr }
      return { ok: true, out: "", err: "" }
    },
    diffCached(cwd, against) {
      effect("diff", { cwd, against })
      if (state.failDiff) return { ok: false, out: "", err: state.diffErr }
      return { ok: true, out: state.patch, err: "" }
    },
    commit(cwd, message) {
      effect("commit", { cwd, message })
      if (!state.commitOk) return { ok: false, out: "", err: state.commitErr }
      state.dirty[cwd] = ""
      state.onCommit?.(cwd)
      return { ok: true, out: "", err: "" }
    },
    push(cwd) {
      effect("push", { cwd })
      state.onPush?.(cwd)
      if (!state.pushOk) return { ok: false, out: "", err: state.pushErr }
      state.ahead[cwd] = 0
      return { ok: true, out: "", err: "" }
    },
    removeWorktree(_cwd, path, force) {
      effect("removeWorktree", { path, force })
      const at = state.worktrees.findIndex((item) => item.path === path)
      if (at >= 0) state.worktrees.splice(at, 1)
      const prefix = `${path}/`
      for (const file of [...files.keys()])
        if (file === path || file.startsWith(prefix)) files.delete(file)
      for (const dir of [...dirs])
        if (dir === path || dir.startsWith(prefix)) dirs.delete(dir)
      return { ok: true, out: "", err: "" }
    },
    deleteBranch(_cwd, branch) {
      effect("deleteBranch", { branch })
      state.local.delete(branch)
      return { ok: true, out: "", err: "" }
    },
    deleteRemoteBranch(_cwd, branch) {
      effect("deleteRemoteBranch", { branch })
      return { ok: true, out: "", err: "" }
    },
    prune() {
      effect("prune")
      return { ok: true, out: "", err: "" }
    },
  }

  const ports = {
    gh,
    git,
    fs,
    proc: {
      run(cmd, args, options) {
        effect("proc", { cmd, args })
        if (world.run) return world.run(cmd, args, options)
        return { ok: true, out: "", err: "" }
      },
      listening(port) {
        return state.listening.has(port)
      },
    },
    clock: {
      now: () => (typeof state.now === "function" ? state.now() : state.now),
      pause: (seconds) => {
        state.paused = (state.paused ?? 0) + seconds
        world.onPause?.(state.paused)
      },
    },
    env,
    effects,
    written,
    counts,
    state,
  }
  return ports
}

export function ctxFor(ports, extra = {}) {
  return {
    ports,
    facts: createFacts(ports, () => extra.cwd ?? ports.state.cwd),
    env: ports.env,
    now: () => ports.clock.now(),
    pause: (seconds) => ports.clock.pause(seconds),
    nodeVersion: extra.nodeVersion ?? "v22.1.0",
    cwd: extra.cwd ?? ports.state.cwd,
    readStdin: () => extra.stdin ?? "",
    readFile: (path) => ports.fs.read(path),
    writeFile: (path, text) => ports.fs.write(path, text),
    writeScratch: (name, text) => ports.fs.scratch(name, text),
    effects: ports.effects,
    written: ports.written,
  }
}
