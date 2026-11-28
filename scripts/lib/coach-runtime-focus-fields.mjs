import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

export const RUNTIME_FILE = "apps/api/src/coach/task-runtime.ts"
export const CONSUMER_FILE = "apps/api/src/coach/fake.ts"

const workingTree = {
  read: (name) =>
    existsSync(path.join(root, name))
      ? readFileSync(path.join(root, name), "utf8")
      : null,
}

function balancedFrom(source, open) {
  let depth = 0
  for (let at = open; at < source.length; at += 1) {
    if (source[at] === "(") depth += 1
    else if (source[at] === ")") {
      depth -= 1
      if (depth === 0) return source.slice(open, at + 1)
    }
  }
  return null
}

export function runtimeFocusKeys(source) {
  const start = source.search(/focusDoc:\s*z\s*\.object\(/)
  if (start < 0) return null
  const body = balancedFrom(source, source.indexOf("(", start))
  if (!body) return null
  const inner = body.slice(body.indexOf("{") + 1)
  const keys = new Set()
  let depth = 0
  for (const match of inner.matchAll(/[{}()[\]]|\b([A-Za-z_]\w*)\s*:/g)) {
    const token = match[0]
    if ("{([".includes(token)) depth += 1
    else if ("})]".includes(token)) depth -= 1
    else if (depth === 0 && match[1]) keys.add(match[1])
  }
  return keys
}

export function consumerFocusKeys(source) {
  const match =
    /fakePaperEdit\(\s*focus:\s*Pick<\s*CoachFocusDoc,([^>]*)>/.exec(source)
  if (!match) return null
  return new Set([...match[1].matchAll(/"([^"]+)"/g)].map((each) => each[1]))
}

export function detect(source, file = RUNTIME_FILE, io = workingTree) {
  const kept = runtimeFocusKeys(source)
  const needed = consumerFocusKeys(io.read(CONSUMER_FILE) ?? "")
  if (!kept || !needed) return []
  return [...needed]
    .filter((key) => !kept.has(key))
    .map(
      (key) =>
        `${file} parses the Coach focus without "${key}", so the field ${CONSUMER_FILE} reads is stripped before the runtime uses it`
    )
}
