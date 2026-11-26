import { IMPORT_TEXT_LIMITS } from "./import-limits.js"
import type { TemplateLine } from "@workspace/domain/paper-doc"

export const IMPORT_LINE_CAP = 2000
export const IMPORT_LINE_BYTES = 6000

export type ImportedLines =
  | { readonly ok: true; readonly lines: readonly TemplateLine[] }
  | { readonly ok: false; readonly message: string }

const SECTION_TITLES = new Set([
  "summary",
  "professional summary",
  "profile",
  "about",
  "about me",
  "objective",
  "career objective",
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "employment history",
  "work history",
  "education",
  "skills",
  "technical skills",
  "key skills",
  "projects",
  "selected projects",
  "certifications",
  "certificates",
  "awards",
  "honors",
  "honours",
  "languages",
  "activities",
  "extracurricular activities",
  "volunteering",
  "volunteer experience",
  "leadership",
  "publications",
  "interests",
  "references",
  "contact",
  "thông tin cá nhân",
  "mục tiêu nghề nghiệp",
  "giới thiệu",
  "kinh nghiệm",
  "kinh nghiệm làm việc",
  "học vấn",
  "kỹ năng",
  "dự án",
  "chứng chỉ",
  "giải thưởng",
  "hoạt động",
  "ngoại ngữ",
  "sở thích",
])

const GLYPH_BULLET = /^[•●○◦▪▫■□‣⁃∙➢►✓✔]\s*/u
const ASCII_BULLET = /^[-–*]\s+/u
const LONE_GLYPH = /^[•●○◦▪▫■□‣⁃∙➢►✓✔]$/u
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/u
const PHONE = /(?:\+?\d[\s().+-]*){6}\d/u
const PROFILE_LINK = /linkedin|github|https?:\/\/|www\./iu
const CONTACT_SEPARATOR = /\s[|\u00B7•]\s/u
const WORD = /[\p{L}\p{N}]+/gu

export function wordsOf(text: string): string[] {
  return text.match(WORD) ?? []
}

function xmlSafe(text: string) {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? 0
    const control = code < 0x20 && code !== 0x0a && code !== 0x0d
    return control || code === 0xfffe || code === 0xffff ? " " : char
  }).join("")
}

function cleanLines(raw: string): string[] {
  return xmlSafe(raw)
    .replace(/\r\n?/gu, "\n")
    .replace(/\t/gu, " ")
    .split("\n")
    .map((line) => line.replace(/ {2,}/gu, " ").trim())
    .filter((line) => line !== "")
}

function sectionTitle(line: string) {
  const bare = line.replace(/:$/u, "").trim().toLocaleLowerCase()
  if (SECTION_TITLES.has(bare)) return true
  const words = wordsOf(line)
  return (
    words.length > 0 &&
    words.length <= 5 &&
    line.length <= 40 &&
    !/\d/u.test(line) &&
    /\p{L}{2}/u.test(line) &&
    line === line.toLocaleUpperCase() &&
    line !== line.toLocaleLowerCase()
  )
}

function looksLikeName(line: string) {
  const words = wordsOf(line)
  return (
    words.length > 0 &&
    words.length <= 5 &&
    line.length <= 60 &&
    !/[\d@/:|]/u.test(line) &&
    !SECTION_TITLES.has(line.replace(/:$/u, "").trim().toLocaleLowerCase())
  )
}

function looksLikeContact(line: string) {
  if (line.length > IMPORT_TEXT_LIMITS.contactLineChars) return false
  return (
    EMAIL.test(line) ||
    PHONE.test(line) ||
    PROFILE_LINK.test(line) ||
    (CONTACT_SEPARATOR.test(line) && wordsOf(line).length <= 16)
  )
}

function bulletText(line: string) {
  if (GLYPH_BULLET.test(line)) return line.replace(GLYPH_BULLET, "")
  if (ASCII_BULLET.test(line)) return line.replace(ASCII_BULLET, "")
  return null
}

function utf8Bytes(char: string) {
  const code = char.codePointAt(0) ?? 0
  if (code < 0x80) return 1
  if (code < 0x800) return 2
  if (code < 0x10000) return 3
  return 4
}

function splitWord(word: string): string[] {
  const pieces: string[] = []
  let piece = ""
  let size = 0
  for (const char of word) {
    const bytes = utf8Bytes(char)
    if (size + bytes > IMPORT_LINE_BYTES) {
      pieces.push(piece)
      piece = ""
      size = 0
    }
    piece += char
    size += bytes
  }
  if (piece !== "") pieces.push(piece)
  return pieces
}

function splitLong(line: TemplateLine): TemplateLine[] {
  const encoder = new TextEncoder()
  if (encoder.encode(line.text).byteLength <= IMPORT_LINE_BYTES) return [line]
  const pieces: TemplateLine[] = []
  let current = ""
  let size = 0
  for (const word of line.text.split(" ")) {
    const bytes = encoder.encode(word).byteLength
    if (current !== "" && size + 1 + bytes <= IMPORT_LINE_BYTES) {
      current += ` ${word}`
      size += 1 + bytes
      continue
    }
    if (current !== "") pieces.push({ ...line, text: current })
    const parts = bytes > IMPORT_LINE_BYTES ? splitWord(word) : [word]
    for (const part of parts.slice(0, -1)) pieces.push({ ...line, text: part })
    current = parts.at(-1) ?? ""
    size = encoder.encode(current).byteLength
  }
  if (current !== "") pieces.push({ ...line, text: current })
  return pieces
}

function classify(lines: readonly string[]): TemplateLine[] {
  const out: TemplateLine[] = []
  let index = 0
  if (lines[0] !== undefined && looksLikeName(lines[0])) {
    out.push({ style: "Title", text: lines[0], center: true })
    index = 1
    while (
      index < lines.length &&
      index <= 3 &&
      looksLikeContact(lines[index]!) &&
      !sectionTitle(lines[index]!)
    ) {
      out.push({ style: "Normal", text: lines[index]!, center: true })
      index += 1
    }
  }
  let bulletNext = false
  for (; index < lines.length; index += 1) {
    const line = lines[index]!
    if (LONE_GLYPH.test(line)) {
      bulletNext = true
      continue
    }
    const bullet = bulletText(line)
    if (bulletNext || bullet !== null) {
      out.push({ style: "ListBullet", text: bullet ?? line })
      bulletNext = false
      continue
    }
    out.push({ style: sectionTitle(line) ? "Heading1" : "Normal", text: line })
  }
  return out
}

const TOO_MANY_LINES = `This file has more than ${IMPORT_LINE_CAP.toLocaleString("en-US")} lines of text. Import a shorter CV.`

function refusedBeforeWork(raw: string, cleaned: readonly string[] | null) {
  if (raw.length > IMPORT_TEXT_LIMITS.textChars)
    return `This file has more than ${IMPORT_TEXT_LIMITS.textChars.toLocaleString("en-US")} characters of text. Import a shorter CV.`
  if (!cleaned) return null
  if (cleaned.length > IMPORT_LINE_CAP) return TOO_MANY_LINES
  if (cleaned.some((line) => line.length > IMPORT_TEXT_LIMITS.lineChars))
    return `This file has a line longer than ${IMPORT_TEXT_LIMITS.lineChars.toLocaleString("en-US")} characters. Import a CV with shorter lines.`
  return null
}

export function importedTextLines(raw: string): ImportedLines {
  const early = refusedBeforeWork(raw, null)
  if (early) return { ok: false, message: early }
  const cleaned = cleanLines(raw)
  const refusal = refusedBeforeWork(raw, cleaned)
  if (refusal) return { ok: false, message: refusal }
  const lines = classify(cleaned).flatMap(splitLong)
  if (lines.length === 0)
    return {
      ok: false,
      message:
        "This file has no text we can read. Import a PDF, Word or text file with your CV text in it.",
    }
  if (lines.length > IMPORT_LINE_CAP)
    return {
      ok: false,
      message: TOO_MANY_LINES,
    }
  return { ok: true, lines }
}
