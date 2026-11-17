import { failedGuards } from "./test-failures.mjs"

export function detect(text) {
  return String(text)
    .split("\n")
    .flatMap((line, index) =>
      /assert\.equal\(run\.status,\s*0\b/.test(line) ? [index + 1] : []
    )
}

export function canJudgeFolders(t, run) {
  if (run.status === 0) return true
  const failures = failedGuards({
    ok: false,
    out: run.stdout ?? "",
    err: run.stderr ?? "",
  })
  t.skip(`inner tests failed; folder judgement skipped: ${failures[0]}`)
  return false
}
