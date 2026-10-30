// Disk preflight: enough free space and a working 64 KiB write in
// the main checkout, the worktree root's parent, the root, ~/tmp and the temp dir.
// Limits in MiB: PR_DISK_MIN_MB (default 2048), PR_TMP_MIN_MB (default 256).
// The statfs and write probes go through ports.fs.
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"

function probe(fs, dir, minMb) {
  const free = fs.diskFree(dir)
  if (free && typeof free === "object")
    return {
      cause: "env",
      text: `cannot read the free space of ${dir}: ${free.error}`,
    }
  if (free < minMb)
    return {
      cause: "disk",
      text: `only ${free} MiB free on the filesystem of ${dir}, need ${minMb} MiB`,
    }
  const wrote = fs.writeProbe(dir)
  if (wrote)
    return {
      cause: wrote.full ? "disk" : "env",
      text: `cannot write in ${dir}: ${wrote.message}`,
    }
  return null
}

// Returns null when fine, else { cause, text }.
export function diskProblem(fs, env, { main, root }) {
  const num = (name, dflt) => {
    const v = env[name] ?? String(dflt)
    return /^\d+$/.test(v) ? Number(v) : null
  }
  const min = num("PR_DISK_MIN_MB", 2048)
  const tmpMin = num("PR_TMP_MIN_MB", 256)
  if (min === null || tmpMin === null)
    return {
      cause: "env",
      text: "PR_DISK_MIN_MB and PR_TMP_MIN_MB must be whole numbers of MiB",
    }
  const dirs = [
    [main, min],
    [dirname(root), min],
    [root, min],
    [join(env.HOME || homedir(), "tmp"), min],
    [env.TMPDIR || tmpdir(), tmpMin],
  ]
  const seen = new Set()
  for (const [dir, mb] of dirs) {
    if (!fs.exists(dir) || seen.has(dir)) continue
    seen.add(dir)
    const problem = probe(fs, dir, mb)
    if (problem) return problem
  }
  return null
}
