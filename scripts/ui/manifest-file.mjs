import { join, resolve } from "node:path"
import { UsageError } from "./args.mjs"
import { compareDir } from "./before-after.mjs"

export function readManifest(ctx, flag) {
  const file = resolve(
    flag ?? join(compareDir(ctx.scratchRoot, ctx.repo), "manifest.json")
  )
  if (!ctx.fs.exists(file))
    throw new UsageError(
      `no compare manifest at ${file}; run node scripts/ui.mjs compare <screen...>`
    )
  return { file, manifest: JSON.parse(ctx.fs.read(file)) }
}

export function mergeBaseWithMain(ctx) {
  try {
    return ctx.git(["merge-base", "HEAD", "origin/main"], ctx.repo)
  } catch {
    return null
  }
}
