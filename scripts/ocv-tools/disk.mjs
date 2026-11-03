import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"

const DEFAULT_DISK_MIN_MB = 2048
const DEFAULT_TMP_MIN_MB = 256

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

export function diskProblem(fs, env, { main, root }) {
  const num = (name, dflt) => {
    const v = env[name] ?? String(dflt)
    return /^\d+$/.test(v) ? Number(v) : null
  }
  const min = num("PR_DISK_MIN_MB", DEFAULT_DISK_MIN_MB)
  const tmpMin = num("PR_TMP_MIN_MB", DEFAULT_TMP_MIN_MB)
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
