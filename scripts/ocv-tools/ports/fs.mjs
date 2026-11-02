// Files and disk. Jobs ask for these verbs; the statfs probe stays here.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  statfsSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { withTempDir } from "../../lib/temp-dir.mjs"

export const SCRATCH = join(homedir(), "tmp", "ocv-tools")

export function fsAdapter() {
  return {
    read(path) {
      return readFileSync(path, "utf8")
    },
    write(path, text) {
      writeFileSync(path, text)
    },
    exists(path) {
      return existsSync(path)
    },
    list(dir) {
      return readdirSync(dir)
    },
    mkdir(path) {
      mkdirSync(path, { recursive: true })
    },
    rmdir(path) {
      rmdirSync(path)
    },
    scratch(name, text) {
      const path = join(SCRATCH, name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
      return path
    },
    // Free mebibytes, or { error } when statfs fails.
    diskFree(dir) {
      try {
        const s = statfsSync(dir)
        return Math.floor((Number(s.bavail) * Number(s.bsize)) / 1048576)
      } catch (error) {
        return { error: error.message }
      }
    },
    // null when a 64 KiB write works, else { full, message }.
    writeProbe(dir) {
      try {
        withTempDir(
          ".disk-probe-",
          (tmp) => {
            writeFileSync(join(tmp, "probe"), Buffer.alloc(65536))
          },
          dir,
          { create: false }
        )
        return null
      } catch (error) {
        return {
          full: /quota|no space|disk full|too large/i.test(error.message),
          message: error.message,
        }
      }
    },
  }
}
