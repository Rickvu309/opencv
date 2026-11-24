import { EXIT } from "../result.mjs"
import { RULES } from "./index.mjs"

export function rulesJob(ctx, { flags = {} } = {}) {
  if (flags["--write"] || flags["--check"])
    return {
      exit: EXIT.error,
      lines: [
        "rules --check and --write are retired because the generated workflow guides were removed.",
      ],
      fix: "Run: scripts/ocv-tools.mjs rules --list to inspect the current workflow rules.",
    }
  return {
    lines: RULES.map((row) => `${row.id}: ${row.says}`),
    next: "scripts/ocv-tools.mjs help",
  }
}
