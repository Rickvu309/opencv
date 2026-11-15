import { createHash } from "node:crypto"
import { copyFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { withTempDir } from "../lib/temp-dir.mjs"

export const RELEASE_ASSET_LIMIT = 1000
const RELEASE_BUCKET_LIMIT = 64
const NOTES = "Pictures for issues and pull requests. Not a product release."

export function shotPlacement(item, assets) {
  const same = assets.find((asset) => asset.name === item.asset)
  if (same?.digest === item.digest) return { item, exists: true }
  const asset = same
    ? item.asset.replace(/\.[^.]+$/, `-${item.digest.slice(7)}.${item.type}`)
    : item.asset
  const found = assets.find((entry) => entry.name === asset)
  if (found && found.digest !== item.digest)
    throw new Error(`Screenshot asset ${asset} already has different bytes`)
  return {
    item: { ...item, asset },
    exists: Boolean(found),
    full: !found && assets.length >= RELEASE_ASSET_LIMIT,
  }
}

function uploadShot(gh, item, dir) {
  for (let bucket = 1; bucket <= RELEASE_BUCKET_LIMIT; bucket++) {
    const tag = bucket === 1 ? "screenshots" : `screenshots-${bucket}`
    for (let attempt = 0; attempt < 3; attempt++) {
      let assets = gh.releaseAssets(tag)
      if (assets === null) {
        try {
          gh.releaseCreate(tag, { title: tag, notes: NOTES, target: "main" })
          assets = []
        } catch (error) {
          assets = gh.releaseAssets(tag)
          if (assets === null) throw error
        }
      }
      const placement = shotPlacement(item, assets)
      if (placement.full) break
      const placed = { ...placement.item, release: tag }
      if (placement.exists) return placed
      const file = join(dir, placed.asset)
      copyFileSync(item.file, file)
      try {
        gh.releaseUpload(tag, [file], { clobber: false })
        return placed
      } catch (error) {
        if (
          !/HTTP 422/.test(error.message) ||
          !/file_count|already_exists/.test(error.message)
        )
          throw error
        if (attempt === 2) throw error
      }
    }
  }
  throw new Error(
    `Screenshot storage has filled all ${RELEASE_BUCKET_LIMIT} releases. Increase RELEASE_BUCKET_LIMIT in scripts/ocv-tools/shot-release.mjs and retry`
  )
}

export function uploadShots(gh, items, root) {
  return withTempDir(
    "upload-",
    (dir) =>
      items.map((item) =>
        uploadShot(
          gh,
          {
            ...item,
            digest: `sha256:${createHash("sha256").update(readFileSync(item.file)).digest("hex")}`,
          },
          dir
        )
      ),
    root
  )
}
