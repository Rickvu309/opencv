// ocv-tools rules [--write|--check|--list]
import { EXIT } from "../result.mjs"
import { RULES_DOC, applyRulesDoc } from "./doc.mjs"
import { RULES } from "./table.mjs"

function listResult() {
  return {
    lines: RULES.map((row) => `${row.id}: ${row.says}`),
    next: "scripts/ocv-tools.mjs rules --check",
  }
}

export function rulesJob(ctx, { flags = {} } = {}) {
  if (flags["--write"]) {
    const next = applyRulesDoc(ctx.ports.fs.read(RULES_DOC)).text
    ctx.ports.fs.write(RULES_DOC, next)
    return {
      lines: ["Wrote the rules block."],
      next: "scripts/ocv-tools.mjs rules --check",
    }
  }
  if (flags["--check"]) {
    const applied = applyRulesDoc(ctx.ports.fs.read(RULES_DOC))
    if (!applied.ok)
      return {
        exit: EXIT.error,
        lines: [
          "The rules block in docs/git-workflow/rule-enforcement.md does not match the table.",
        ],
        fix: "Run: scripts/ocv-tools.mjs rules --write",
      }
    return {
      lines: ["Rules doc matches the table."],
      next: "scripts/ocv-tools.mjs rules --list",
    }
  }
  return listResult()
}
