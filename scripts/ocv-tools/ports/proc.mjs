// The process runner every real adapter sits on. Jobs never spawn a process themselves.
import { spawnSync } from "node:child_process"

// Prompt locks go to every child. GIT_EDITOR=true only for git, and only when
// the caller has not chosen an editor, so a commit or rebase cannot open one.
export function childEnv(cmd, options = {}, base = process.env) {
  const env = { ...base, ...(options.env ?? {}) }
  env.GH_PROMPT_DISABLED = "1"
  env.GIT_TERMINAL_PROMPT = "0"
  if (cmd === "git" && !env.GIT_EDITOR) env.GIT_EDITOR = "true"
  return env
}

export function realRunner() {
  return function run(cmd, args, options = {}) {
    const r = spawnSync(cmd, args, {
      encoding: "utf8",
      cwd: options.cwd,
      env: childEnv(cmd, options),
      input: options.input,
      // inherit streams the child's output to the terminal and captures none.
      stdio: options.inherit ? ["ignore", "inherit", "inherit"] : undefined,
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
