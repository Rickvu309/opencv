import { z } from "zod"

export const STARTING_LINE_LIMITS = Object.freeze({
  lines: 100,
  lineBytes: 8 * 1024,
  totalBytes: 64 * 1024,
})

function encodedBytes(value: string) {
  let bytes = 0
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

function holdsControlCode(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) return true
  }
  return false
}

const startingLineSchema = z
  .string()
  .refine(
    (value) => !holdsControlCode(value),
    "A line must not hold control characters."
  )
  .refine(
    (value) => encodedBytes(value) <= STARTING_LINE_LIMITS.lineBytes,
    "A line exceeds 8 KiB."
  )

export const startingLinesSchema = z
  .array(startingLineSchema)
  .min(1)
  .max(STARTING_LINE_LIMITS.lines)
  .refine(
    (lines) =>
      lines.reduce((total, line) => total + encodedBytes(line), 0) <=
      STARTING_LINE_LIMITS.totalBytes,
    "The starting text exceeds 64 KiB."
  )
