import type { TemplateLine } from "./template.js"

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
const XML_UNSAFE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/gu
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/u
const PHONE = /(?:\+?\d[\s().+-]*){6}\d/u
const PROFILE_LINK = /linkedin|github|https?:\/\/|www\./iu
const CONTACT_SEPARATOR = /\s[|·•]\s/u
const WORD = /[\p{L}\p{N}]+/gu

export function wordsOf(text: string): string[] {
  return text.match(WORD) ?? []
}

function cleanLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/gu, "\n")
    .replace(/\t/gu, " ")
    .replace(XML_UNSAFE, " ")
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

function splitLong(line: TemplateLine): TemplateLine[] {
  const encoder = new TextEncoder()
  if (encoder.encode(line.text).byteLength <= IMPORT_LINE_BYTES) return [line]
  const pieces: TemplateLine[] = []
  let current = ""
  for (const word of line.text.split(" ")) {
    const next = current === "" ? word : `${current} ${word}`
    if (encoder.encode(next).byteLength <= IMPORT_LINE_BYTES) {
      current = next
      continue
    }
    if (current !== "") pieces.push({ ...line, text: current })
    current = word
    while (encoder.encode(current).byteLength > IMPORT_LINE_BYTES) {
      const cut = Array.from(current)
      const half = cut.slice(0, Math.floor(cut.length / 2)).join("")
      pieces.push({ ...line, text: half })
      current = current.slice(half.length)
    }
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

export function importedTextLines(raw: string): ImportedLines {
  const lines = classify(cleanLines(raw)).flatMap(splitLong)
  if (lines.length === 0)
    return {
      ok: false,
      message:
        "This file has no text we can read. Import a PDF, Word or text file with your CV text in it.",
    }
  if (lines.length > IMPORT_LINE_CAP)
    return {
      ok: false,
      message: `This file has more than ${IMPORT_LINE_CAP.toLocaleString("en-US")} lines of text. Import a shorter CV.`,
    }
  return { ok: true, lines }
}
