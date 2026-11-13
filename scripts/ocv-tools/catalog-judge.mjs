import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { staleFiles } from "../lib/catalog-stale.mjs"

export async function judgeTree(directory) {
  const { judgeCatalog } = await import(
    pathToFileURL(path.join(directory, "scripts/catalog.mjs")).href
  )
  const { expected, current } = await judgeCatalog(directory)
  return staleFiles(expected, current)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(
      JSON.stringify({ stale: await judgeTree(path.resolve(process.argv[2])) })
    )
  } catch (error) {
    console.log(
      JSON.stringify({ error: String(error?.message ?? error).split("\n")[0] })
    )
  }
}
