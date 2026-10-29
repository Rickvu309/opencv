// The process runner every real adapter sits on. Jobs never spawn a process themselves.
import { spawnSync } from "node:child_process"

export function realRunner() {
  return function run(cmd, args, options = {}) {
    const r = spawnSync(cmd, args, {
      encoding: "utf8",
      cwd: options.cwd,
      maxBuffer: 32 * 1024 * 1024,
    })
    const stdout = r.stdout ?? ""
    return {
      ok: r.status === 0,
      // raw keeps patch bytes. trim() drops a trailing context line that is
      // only a space, and git apply then rejects the hunk.
      out: options.raw ? stdout : stdout.trim(),
      err: (r.stderr ?? r.error?.message ?? "").trim(),
    }
  }
}

export function procAdapter(run) {
  return {
    run,
    // True when something is already listening on the TCP port.
    listening(port) {
      const ss = run("ss", ["-ltnH"])
      if (ss.ok)
        return ss.out
          .split("\n")
          .some((line) =>
            new RegExp(`[:.]${port}$`).test(line.trim().split(/\s+/)[3] ?? "")
          )
      const lsof = run("lsof", [`-iTCP:${port}`, "-sTCP:LISTEN"])
      return lsof.ok && lsof.out !== ""
    },
  }
}
