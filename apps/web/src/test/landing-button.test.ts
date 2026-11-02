// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const landingDir = fileURLToPath(
  new URL("../features/landing", import.meta.url)
)
const owner = "features/landing/landing-button.ts"
const CONTROL_TAGS = new Set(["Link", "a", "button", "Button"])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function isIdent(ch: string | undefined): boolean {
  return Boolean(ch && /[A-Za-z0-9_$]/.test(ch))
}

function keywordAt(source: string, index: number, word: string): boolean {
  if (!source.startsWith(word, index)) return false
  if (isIdent(source[index - 1])) return false
  if (isIdent(source[index + word.length])) return false
  return true
}

function endOfQuoted(source: string, start: number): number {
  const quote = source[start]
  let i = start + 1
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2
      continue
    }
    if (source[i] === quote) return i + 1
    i++
  }
  return source.length
}

function readImportClause(source: string, start: number): string {
  let i = start + "import".length
  let brace = 0
  let seenFrom = false
  while (i < source.length) {
    const ch = source[i]
    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i)
      i = nl < 0 ? source.length : nl + 1
      continue
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2)
      i = end < 0 ? source.length : end + 2
      continue
    }
    if (ch === "'" || ch === '"') {
      const end = endOfQuoted(source, i)
      if (seenFrom && brace === 0) return source.slice(start, end)
      i = end
      continue
    }
    if (ch === "{") brace++
    else if (ch === "}") brace = Math.max(0, brace - 1)
    else if (ch === ";" && brace === 0) return source.slice(start, i + 1)
    else if (brace === 0 && keywordAt(source, i, "from")) {
      seenFrom = true
      i += "from".length
      continue
    }
    i++
  }
  return source.slice(start, i)
}

function clauseNamesButtonVariants(clause: string): boolean {
  const named = clause.match(/\{([\s\S]*)\}/)
  if (!named) return false
  const body = named[1]
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
  for (const part of body.split(",")) {
    const match = part
      .trim()
      .match(/^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/)
    if (match?.[1] === "buttonVariants") return true
  }
  return false
}

function importsButtonVariants(source: string): boolean {
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i)
      i = nl < 0 ? source.length : nl
      continue
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2)
      i = end < 0 ? source.length : end + 1
      continue
    }
    if (ch === "'" || ch === '"') {
      i = endOfQuoted(source, i) - 1
      continue
    }
    if (!keywordAt(source, i, "import")) continue
    let j = i + "import".length
    while (j < source.length && /\s/.test(source[j])) j++
    if (source[j] === "(") continue
    const clause = readImportClause(source, i)
    if (clauseNamesButtonVariants(clause)) return true
    i += Math.max(clause.length - 1, "import".length)
  }
  return false
}

type Frame = {
  name: string
  brace: number
  classBrace: number | null
  expectValue: boolean
}

type Mode =
  | { kind: "code"; expr: number | null; exempt: boolean }
  | { kind: "tpl"; chunk: string; exempt: boolean }

type Hit = { value: string; exemptGradient: boolean }

function startsJsx(source: string, index: number): boolean {
  const next = source[index + 1]
  if (!next || !/[A-Za-z_]/.test(next)) return false
  let j = index - 1
  while (j >= 0 && /[ \t]/.test(source[j])) j--
  if (j < 0 || source[j] === "\n" || source[j] === "\r") return true
  if ("(>{[=?:;,|&!".includes(source[j])) return true
  if (!isIdent(source[j])) return false
  let k = j
  while (k >= 0 && isIdent(source[k])) k--
  const word = source.slice(k + 1, j + 1)
  return word === "return" || word === "throw" || word === "yield"
}

function classStringsNamingLandingPillOrGradient(source: string): Hit[] {
  const hits: Hit[] = []
  const stack: Frame[] = []
  const modes: Mode[] = [{ kind: "code", expr: null, exempt: false }]
  const n = source.length

  const frame = () => stack[stack.length - 1]
  const record = (value: string, exemptGradient: boolean) => {
    if (/landing-(?:pill|gradient)/.test(value)) {
      hits.push({ value, exemptGradient })
    }
  }
  const gradientExempt = () => {
    const mode = modes[modes.length - 1]
    if (mode.kind === "code" && mode.exempt) return true
    const current = frame()
    if (!current || CONTROL_TAGS.has(current.name)) return false
    if (current.expectValue) return true
    return current.classBrace !== null && current.brace >= current.classBrace
  }

  for (let i = 0; i < n; i++) {
    const mode = modes[modes.length - 1]
    const ch = source[i]
    if (mode.kind === "tpl") {
      if (ch === "\\") {
        mode.chunk += source[i + 1] ?? ""
        i++
        continue
      }
      if (ch === "`") {
        record(mode.chunk, mode.exempt)
        modes.pop()
        const current = frame()
        if (current?.expectValue) current.expectValue = false
        continue
      }
      if (ch === "$" && source[i + 1] === "{") {
        record(mode.chunk, mode.exempt)
        mode.chunk = ""
        modes.push({ kind: "code", expr: 0, exempt: mode.exempt })
        i++
        continue
      }
      mode.chunk += ch
      continue
    }
    if (ch === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i)
      i = nl < 0 ? n : nl
      continue
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2)
      i = end < 0 ? n : end + 1
      continue
    }
    if (ch === "'" || ch === '"') {
      const end = endOfQuoted(source, i)
      record(source.slice(i + 1, end - 1), gradientExempt())
      const current = frame()
      if (current?.expectValue) current.expectValue = false
      i = end - 1
      continue
    }
    if (ch === "`") {
      modes.push({ kind: "tpl", chunk: "", exempt: gradientExempt() })
      continue
    }
    if (ch === "<" && startsJsx(source, i)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_$.]/.test(source[j])) j++
      stack.push({
        name: source.slice(i + 1, j),
        brace: 0,
        classBrace: null,
        expectValue: false,
      })
      i = j - 1
      continue
    }
    const current = frame()
    if (ch === "{") {
      if (current) {
        current.brace++
        if (current.expectValue) {
          current.classBrace = current.brace
          current.expectValue = false
        }
      }
      if (mode.expr !== null) mode.expr++
      continue
    }
    if (ch === "}") {
      if (current && current.brace > 0) {
        current.brace--
        if (current.classBrace !== null && current.brace < current.classBrace) {
          current.classBrace = null
        }
      }
      if (mode.expr === null) continue
      if (mode.expr > 0) mode.expr--
      else modes.pop()
      continue
    }
    if (!current || current.brace !== 0) continue
    if (ch === ">" || (ch === "/" && source[i + 1] === ">")) {
      stack.pop()
      if (ch === "/") i++
      continue
    }
    if (!/[A-Za-z_]/.test(ch)) continue
    let j = i + 1
    while (j < n && /[A-Za-z0-9_-]/.test(source[j])) j++
    const name = source.slice(i, j)
    let k = j
    while (k < n && /[ \t\n]/.test(source[k])) k++
    if (source[k] !== "=") {
      i = j - 1
      continue
    }
    if (name === "className") current.expectValue = true
    i = k
  }
  return hits
}

describe("every marketing call to action is built with landingButton", () => {
  it("builds every landing call to action with landingButton", () => {
    const violations: string[] = []
    for (const file of sourceFiles(landingDir)) {
      if (path.basename(file) === "landing-button.ts") continue
      const text = readFileSync(file, "utf8")
      const rel = path.relative(landingDir, file).replaceAll("\\", "/")
      if (/buttonVariants\s*\(/.test(text)) {
        violations.push(
          `${rel} calls buttonVariants(). Use landingButton() from ${owner}.`
        )
      }
      if (importsButtonVariants(text)) {
        violations.push(
          `${rel} imports buttonVariants. Use landingButton() from ${owner}.`
        )
      }
      for (const tag of text.matchAll(/<(?:Link|a|button|Button)\b[^>]*>/g)) {
        if (/landing-(?:pill|gradient)/.test(tag[0])) {
          violations.push(
            `${rel} uses landing-pill or landing-gradient on a link or button. Use landingButton() from ${owner}.`
          )
        }
      }
      for (const hit of classStringsNamingLandingPillOrGradient(text)) {
        const pill = hit.value.includes("landing-pill")
        const gradient = hit.value.includes("landing-gradient")
        if (!pill && !(gradient && !hit.exemptGradient)) continue
        violations.push(
          `${rel} puts landing-pill or landing-gradient in a string. Use landingButton() from ${owner}.`
        )
      }
    }
    expect(
      violations,
      `Use landingButton() from ${owner}.\n${violations.join("\n")}`
    ).toEqual([])
  })
})
