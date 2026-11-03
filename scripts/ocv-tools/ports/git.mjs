import { basename, dirname, join } from "node:path"

export function gitAdapter(run) {
  const git = (cwd, args, options = {}) => run("git", args, { ...options, cwd })

  return {
    repo(cwd) {
      const common = git(cwd, [
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ])
      if (!common.ok) return null
      if (basename(common.out) !== ".git") return { bare: common.out }
      const main = dirname(common.out)
      return { main, root: join(dirname(main), `${basename(main)}.worktrees`) }
    },
    here(cwd) {
      const top = git(cwd, ["rev-parse", "--show-toplevel"])
      const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
      const gitDir = git(cwd, ["rev-parse", "--absolute-git-dir"])
      const common = git(cwd, [
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ])
      return {
        topOk: top.ok,
        top: top.out,
        branch: branch.out,
        gitDirOk: gitDir.ok,
        gitDir: gitDir.out,
        commonOk: common.ok,
        common: common.out,
      }
    },
    worktrees(cwd) {
      const out = git(cwd, ["worktree", "list", "--porcelain"]).out
      const found = []
      let path = null
      for (const line of `${out}\n`.split("\n")) {
        if (line.startsWith("worktree ")) path = line.slice(9)
        else if (line.startsWith("branch ") && path) {
          found.push({ path, branch: line.slice(18) })
          path = null
        } else if (line === "") path = null
      }
      return found
    },
    remoteHeads(cwd) {
      const out = git(cwd, ["ls-remote", "--heads", "origin"])
      const names = []
      for (const line of out.out.split("\n")) {
        const name = line.split("\t")[1]?.replace("refs/heads/", "")
        if (name) names.push(name)
      }
      return names
    },
    localHead(cwd, branch) {
      return git(cwd, [
        "show-ref",
        "--verify",
        "--quiet",
        `refs/heads/${branch}`,
      ]).ok
    },
    remoteHead(cwd, branch) {
      return git(cwd, ["ls-remote", "--exit-code", "--heads", "origin", branch])
        .ok
    },
    branchFacts(cwd, branch) {
      const local = git(cwd, ["rev-parse", "--verify", `refs/heads/${branch}`])
      const remote = git(cwd, [
        "rev-parse",
        "--verify",
        `refs/remotes/origin/${branch}`,
      ])
      if (!local.ok || !remote.ok)
        return {
          local: local.ok ? local.out : null,
          remote: remote.ok ? remote.out : null,
          relation: "missing",
          err: local.err || remote.err,
        }
      if (local.out === remote.out)
        return {
          local: local.out,
          remote: remote.out,
          relation: "same",
          err: "",
        }
      if (git(cwd, ["merge-base", "--is-ancestor", local.out, remote.out]).ok)
        return {
          local: local.out,
          remote: remote.out,
          relation: "behind",
          err: "",
        }
      if (git(cwd, ["merge-base", "--is-ancestor", remote.out, local.out]).ok)
        return {
          local: local.out,
          remote: remote.out,
          relation: "ahead",
          err: "",
        }
      return {
        local: local.out,
        remote: remote.out,
        relation: "diverged",
        err: "",
      }
    },
    fastForward(cwd, branch, sha) {
      return git(cwd, ["update-ref", `refs/heads/${branch}`, sha])
    },
    fetch(cwd, ref, { prune = false } = {}) {
      const args = ["fetch", "--quiet"]
      if (prune) args.push("--prune")
      args.push("origin")
      if (ref) args.push(ref)
      return git(cwd, args)
    },
    addWorktree(cwd, { path, branch, mode, start }) {
      const args =
        mode === "local"
          ? ["worktree", "add", "--quiet", path, branch]
          : mode === "track"
            ? [
                "worktree",
                "add",
                "--quiet",
                "--track",
                "-b",
                branch,
                path,
                start,
              ]
            : [
                "worktree",
                "add",
                "--quiet",
                "--no-track",
                "-b",
                branch,
                path,
                start,
              ]
      const added = git(cwd, args)
      if (!added.ok) return added
      const gitDir = git(path, ["rev-parse", "--absolute-git-dir"]).out
      return { ok: true, out: "", err: "", gitDir }
    },
    config(cwd, key) {
      return git(cwd, ["config", "--get", key]).out
    },
    setConfig(cwd, key, value) {
      return git(cwd, ["config", key, value])
    },
    status(cwd) {
      return git(cwd, ["status", "--porcelain"])
    },
    ahead(cwd, range) {
      const r = git(cwd, ["rev-list", "--count", range])
      return { ok: r.ok, n: Number(r.out), out: r.out, err: r.err }
    },
    verify(cwd, ref) {
      return git(cwd, ["rev-parse", "--verify", ref])
    },
    shortHead(cwd) {
      return git(cwd, ["rev-parse", "--short", "HEAD"]).out
    },
    add(cwd) {
      return git(cwd, ["add", "-A"])
    },
    diffCached(cwd, against) {
      return git(cwd, ["diff", "--cached", "--binary", against], { raw: true })
    },
    commit(cwd, message) {
      return git(cwd, ["commit", "-m", message])
    },
    push(cwd) {
      return git(cwd, ["push", "-u", "origin", "HEAD"])
    },
    removeWorktree(cwd, path, force) {
      return git(cwd, [
        "worktree",
        "remove",
        ...(force ? ["--force"] : []),
        path,
      ])
    },
    deleteBranch(cwd, branch) {
      return git(cwd, ["branch", "-D", branch])
    },
    deleteRemoteBranch(cwd, branch) {
      return git(cwd, ["push", "origin", "--delete", branch])
    },
    prune(cwd) {
      return git(cwd, ["worktree", "prune"])
    },
  }
}
