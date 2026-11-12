export const PARSE_WORKER_SOURCE = "apps/api/src/paper/import-text-worker.ts"

const API_SOURCE = /^apps\/api\/src\/.*\.tsx?$/
const TEST_SOURCE = /\.test\.tsx?$/
const PARSER_IMPORT =
  /(?:\bimport\s*\(\s*|\bfrom\s+|\bimport\s+)["'](?:unpdf|mammoth|pdfjs-dist)(?:\/[^"']*)?["']/

export function detectRequestThreadParser(text, path = "") {
  if (path === PARSE_WORKER_SOURCE) return []
  if (!API_SOURCE.test(path) || TEST_SOURCE.test(path)) return []
  return String(text)
    .split("\n")
    .flatMap((line, index) =>
      PARSER_IMPORT.test(line) ? [{ line: index + 1, text: line.trim() }] : []
    )
}
