const HOOK_NAME = /^(pre-push|pre-commit|commit-msg)\b/
const ERROR_LINE =
  /^(?:REFUSED\s|error:|✖|not ok\b|AssertionError\b|TypeError\b|SyntaxError\b)/i

function linesOf(out, err) {
  return `${out ?? ""}\n${err ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function explainPushFailure({ out = "", err = "", logPath }) {
  const lines = linesOf(out, err)
  const text = lines.join("\n")
  const refused = lines.find((line) => /^REFUSED\s+\S+:/.test(line)) ?? ""
  const refusedName = refused.match(/^REFUSED\s+(\S+):/)?.[1] ?? ""
  const quickName =
    text.match(/the quick checks failed:\s*([^\n.]+)/)?.[1]?.trim() ?? ""
  const fileName = text.match(/\S+\.(?:test|spec)\.[cm]?[jt]sx?/)?.[0] ?? ""
  const hookName =
    lines.find((line) => HOOK_NAME.test(line))?.match(HOOK_NAME)?.[1] ?? ""
  const guard = refusedName
    ? quickName
      ? `${refusedName} (${quickName})`
      : refusedName
    : quickName || fileName || hookName || "pre-push"
  const first =
    lines.find((line) => ERROR_LINE.test(line)) ?? lines[0] ?? "(no output)"
  const shown = first.length > 300 ? `${first.slice(0, 300)}…` : first
  return `push failed (the pre-push checks may have found a problem; your commit is safe locally): ${guard}: ${shown} Full log: ${logPath}`
}

export function throwPushFailure(ctx, result) {
  const stamp = new Date(ctx.now()).toISOString().replace(/[:.]/g, "-")
  const logPath = ctx.writeScratch(
    `push/${stamp}.log`,
    `stdout:\n${result.out ?? ""}\nstderr:\n${result.err ?? ""}\n`
  )
  throw new Error(
    explainPushFailure({
      out: result.out,
      err: result.err,
      logPath,
    })
  )
}
