import { recorded, task, snapshot, proofPath, run, refuse } from "./common.mjs"

export function check(ctx) {
  return recorded(ctx, "check", () => {
    const t = task(ctx)
    const before = snapshot(ctx, t)
    ctx.writeFile(proofPath(t), "null\n")
    const r = run(ctx, "node", ["scripts/check.mjs"], {
      env: {
        CHECK_DRY_RUN: "",
        CHECK_BASE_REF: "origin/main",
        SKIP_CHECKS: "",
        PR_RESULT_ID: t.branch,
      },
    })
    let adopted = {}
    const resultFile = r.out.match(/(?:^|\n)RESULT_JSON: (.+)(?:\n|$)/)?.[1]
    if (resultFile) {
      try {
        const record = JSON.parse(ctx.readFile(resultFile))
        if (record.schema === 1 && record.script === "check") adopted = record
      } catch {
        /* Keep the captured output when the child record is unavailable. */
      }
    }
    const log = ctx.writeScratch(
      `checks/${before.tree}.log`,
      `${r.out}\n${r.err}\n`
    )
    if (!r.ok)
      return {
        exit: 1,
        cause: adopted.cause || "test",
        retried: adopted.retried,
        files: adopted.files,
        lines: [`Quick check failed. Log: ${log}`],
        log,
        next: "scripts/ocv-tools.mjs check",
      }
    const after = snapshot(ctx, t)
    if (JSON.stringify(before) !== JSON.stringify(after))
      refuse(
        "STALE_CHECK",
        "The saved work changed during the check. Run check again."
      )
    const proof = {
      schema: 1,
      script: "check",
      status: "ok",
      ...before,
      log,
      retried: adopted.retried ?? [],
      checkedAt: new Date(ctx.now()).toISOString(),
    }
    ctx.writeFile(proofPath(t), JSON.stringify(proof) + "\n")
    return {
      retried: adopted.retried,
      lines: [`Quick check passed for tree ${before.tree}. Log: ${log}`],
      log,
      next: "scripts/ocv-tools.mjs finish --body-file <file> --draft",
    }
  })
}
