import { fileURLToPath } from "node:url"
import { discoverTests, FILE_TIMEOUT_MS, runFiles } from "./run-tests.mjs"

export const TEMP_DIRS = "scripts/temp-dirs.test.mjs"

export function testGroup(files, group) {
  if (group !== "ordinary" && group !== "temp-dirs")
    throw new Error(`unknown guards group: ${group}`)
  return files.filter(
    (file) => (file === TEMP_DIRS) === (group === "temp-dirs")
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = testGroup(discoverTests(), process.argv[2])
  const timeoutMs =
    Number(process.env.GUARDS_FILE_TIMEOUT_MS) || FILE_TIMEOUT_MS
  const results = await runFiles(files, { timeoutMs })
  for (const result of results)
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.file} ${result.ms} ms`)
  process.exit(results.every((result) => result.ok) ? 0 : 1)
}
