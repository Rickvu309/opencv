import { generatedDirectories } from "../../lib/catalog-freshness.mjs"
import { staleFiles } from "../../lib/catalog-stale.mjs"
import { run } from "./common.mjs"

export const CATALOG_INPUTS =
  /^packages\/domain\/src\/|^apps\/api\/src\/[^/]+\/operations\/|^apps\/api\/src\/registry\/generated\//

export function touchesCatalog(files) {
  return files.some((file) => CATALOG_INPUTS.test(file))
}

export function catalogFacts(ctx, top, files) {
  if (!touchesCatalog(files)) return {}
  const r = run(
    ctx,
    "node",
    [`${top}/scripts/ocv-tools/catalog-expected.mjs`, top],
    { cwd: top }
  )
  let parsed
  try {
    parsed = JSON.parse(String(r.out).trim().split("\n").at(-1))
  } catch {
    return { error: String(r.err || r.out || "no output").split("\n")[0] }
  }
  if (parsed.error) return { error: parsed.error }
  const current = {}
  for (const folder of generatedDirectories(parsed.expected)) {
    const listed = run(ctx, "git", ["ls-files", "-z", "--", folder], {
      cwd: top,
      raw: true,
    })
    for (const file of String(listed.out).split("\0").filter(Boolean)) {
      const blob = run(ctx, "git", ["show", `:${file}`], {
        cwd: top,
        raw: true,
      })
      current[file] = blob.ok ? blob.out : null
    }
  }
  return { stale: staleFiles(parsed.expected, current) }
}
