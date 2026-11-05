import { spawnSync } from "node:child_process"

const RUN_TIMEOUT_MS = 30 * 60 * 1000

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
      stdio: options.inherit ? ["ignore", "inherit", "inherit"] : undefined,
      maxBuffer: 32 * 1024 * 1024,
      timeout: options.timeout ?? RUN_TIMEOUT_MS,
    })
    const stdout = r.stdout ?? ""
    return {
      ok: r.status === 0,
      out: options.raw ? stdout : stdout.trim(),
      err: (r.stderr ?? r.error?.message ?? "").trim(),
    }
  }
}

export function procAdapter(run) {
  return {
    run,
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
