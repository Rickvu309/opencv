export const SESSION_CHECK_SOURCE = "apps/web/src/lib/session-check.ts"

const WEB_SOURCE = /^apps\/web\/src\/.*\.tsx?$/
const TEST_SOURCE = /(?:\.test\.tsx?$|^apps\/web\/src\/test\/)/
const DIRECT_SESSION_READ = /\.getSession\s*\(/

export function detectDirectSessionRead(text, path = "") {
  if (path === SESSION_CHECK_SOURCE) return []
  if (!WEB_SOURCE.test(path) || TEST_SOURCE.test(path)) return []
  return String(text)
    .split("\n")
    .flatMap((line, index) =>
      DIRECT_SESSION_READ.test(line)
        ? [{ line: index + 1, text: line.trim() }]
        : []
    )
}
