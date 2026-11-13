import { posix } from "node:path"

const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/

export function guardFilesOf(ledgerTexts) {
  const files = []
  for (const text of ledgerTexts) {
    try {
      const value = JSON.parse(text)
      if (Array.isArray(value))
        files.push(...value.filter((v) => typeof v === "string"))
      else if (typeof value?.file === "string") files.push(value.file)
    } catch {
      continue
    }
  }
  return files
}

const OWNER_WHATS = new Set([
  "ratchet-raised",
  "bound-loosened",
  "scanner-dropped",
  "skipped",
])
const OWNER_KINDS = new Set(["ledger", "checker-config", "ratchet", "bound"])

export function standingPromise(item) {
  if (OWNER_WHATS.has(item.what)) return `${item.what} (${item.kind})`
  if (OWNER_KINDS.has(item.kind)) return `a ${item.kind} ${item.what}`
  if (
    item.kind === "guard" &&
    (item.what === "case-removed" || item.what === "file-removed")
  )
    return `a guard ${item.what}`
  return null
}

const SHARED_LIBS =
  /(?:^|\/)(?:test|tests|fixtures?|__tests__)(?:\/|$)|-fixtures?$|\.fixture$/
const NAMED = /^(?:[a-z]+(?:\.[a-zA-Z]+)+|\/[a-z][\w/-]*)$/

function subjectsOf(path, text) {
  const out = new Set()
  for (const m of String(text).matchAll(
    /(?:from|import\()\s*["']([^"']+)["']/g
  )) {
    const spec = m[1]
    if (spec.startsWith(".")) {
      const id = posix
        .join(posix.dirname(path), spec)
        .replace(/\.[cm]?[jt]sx?$/, "")
      if (!SHARED_LIBS.test(id) && !TEST.test(`${id}.ts`))
        out.add(`module:${id}`)
    } else if (/^(?:@\/|@workspace\/)/.test(spec) && !SHARED_LIBS.test(spec))
      out.add(`module:${spec}`)
  }
  for (const m of String(text).matchAll(/["'`]([^"'`\n]{3,80})["'`]/g))
    if (NAMED.test(m[1])) out.add(`name:${m[1]}`)
  return out
}

export function coversSubject(oldPath, oldText, newPath, newText) {
  if (oldPath === newPath) return true
  const before = subjectsOf(oldPath, oldText)
  for (const item of subjectsOf(newPath, newText))
    if (before.has(item)) return true
  return false
}

export function retirementClass(item, retirement, files) {
  if (!retirement.replacedBy)
    return { class: "owner", because: "no replacement test" }
  const promise = standingPromise(item)
  if (promise) return { class: "owner", because: promise }
  const was = files.get(item.path)
  const now = files.get(retirement.replacedBy)
  if (
    !now?.headText ||
    !coversSubject(
      item.path,
      was?.baseText ?? "",
      retirement.replacedBy,
      now.headText
    )
  )
    return {
      class: "owner",
      because: `${retirement.replacedBy} shares no module, command or route with ${item.path}`,
    }
  return { class: "self" }
}
