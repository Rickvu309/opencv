// Disk preflight (scripts/lib/disk.sh behavior): enough free space and a working 64 KiB write in
// the main checkout, the worktree root's parent, the root, ~/tmp and the temp dir.
// Limits in MiB: PR_DISK_MIN_MB (default 2048), PR_TMP_MIN_MB (default 256).
import {
  existsSync,
  mkdtempSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"

function probe(dir, minMb) {
  let free
  try {
    const s = statfsSync(dir)
    free = Math.floor((Number(s.bavail) * Number(s.bsize)) / 1048576)
  } catch (e) {
    return {
      cause: "env",
      text: `cannot read the free space of ${dir}: ${e.message}`,
    }
  }
  if (free < minMb)
    return {
      cause: "disk",
      text: `only ${free} MiB free on the filesystem of ${dir}, need ${minMb} MiB`,
    }
  let tmp
  try {
    tmp = mkdtempSync(join(dir, ".disk-probe-"))
    writeFileSync(join(tmp, "probe"), Buffer.alloc(65536))
  } catch (e) {
    const full = /quota|no space|disk full|too large/i.test(e.message)
    return {
      cause: full ? "disk" : "env",
      text: `cannot write in ${dir}: ${e.message}`,
    }
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true })
  }
  return null
}

// Returns null when fine, else { cause, text }.
export function diskProblem(env, { main, root }) {
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
    if (!existsSync(dir) || seen.has(dir)) continue
    seen.add(dir)
    const p = probe(dir, mb)
    if (p) return p
  }
  return null
}
