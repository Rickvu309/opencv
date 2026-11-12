import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export async function expectedCatalog(root) {
  const load = (rel) => import(pathToFileURL(path.join(root, rel)).href)
  const { discoverCatalog } = await load("scripts/lib/catalog-discovery.mjs")
  const { detect, renderCatalog } = await load(
    "scripts/lib/operation-catalog.mjs"
  )
  const { formatOutputs } = await load("scripts/catalog.mjs")
  const snapshot = await discoverCatalog(root)
  const errors = detect(snapshot)
  if (errors.length) throw errors[0]
  return formatOutputs(renderCatalog(snapshot))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? process.cwd())
  try {
    console.log(JSON.stringify({ expected: await expectedCatalog(root) }))
  } catch (error) {
    console.log(
      JSON.stringify({ error: String(error?.message ?? error).split("\n")[0] })
    )
  }
}
