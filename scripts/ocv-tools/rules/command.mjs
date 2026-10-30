// ocv-tools rules [--write|--check|--list]
import { EXIT } from "../result.mjs"
import { RULE_GUIDES, applyRulesDoc } from "./doc.mjs"
import { RULES } from "./index.mjs"

function listResult() {
  return {
    lines: RULES.map((row) => `${row.id}: ${row.says}`),
    next: "scripts/ocv-tools.mjs rules --check",
  }
}

export function rulesJob(ctx, { flags = {} } = {}) {
  if (flags["--write"]) {
    for (const { path, table } of RULE_GUIDES) {
      const next = applyRulesDoc(ctx.ports.fs.read(path), table).text
      ctx.ports.fs.write(path, next)
    }
    return {
      lines: ["Wrote the rules block."],
      next: "scripts/ocv-tools.mjs rules --check",
    }
  }
  if (flags["--check"]) {
    const stale = RULE_GUIDES.find(
      ({ path, table }) => !applyRulesDoc(ctx.ports.fs.read(path), table).ok
    )
    if (stale)
      return {
        exit: EXIT.error,
        lines: [`The rules block in ${stale.path} does not match the table.`],
        fix: "Run: scripts/ocv-tools.mjs rules --write",
      }
    return {
      lines: ["Rules doc matches the table."],
      next: "scripts/ocv-tools.mjs rules --list",
    }
  }
  return listResult()
}
