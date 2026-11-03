import { WORKTREE_PORTS } from "../../packages/domain/src/local-ports.ts"

export const PORT_SOURCE = "packages/domain/src/local-ports.ts"

export const FIX = `compare against WORKTREE_PORTS (${WORKTREE_PORTS.first} to ${WORKTREE_PORTS.last}) from ${PORT_SOURCE}, and take the port from the worktree .env`

const LOWEST_USER_PORT = 1024
const HIGHEST_PORT = 65535
const NEARBY_LINES = 2

const NAMES_A_PORT = /(?<![A-Za-z])[Pp]orts?(?![a-z])|PORT|[a-z]Ports?\b/
const COMPARED_LITERALS = [
  /(?:(?<![=<>-])[<>]=?|-(?:ge|gt|le|lt)\s)\s*\(?\s*(\d{4,5})\b/g,
  /\b(\d{4,5})\s*(?:[<>](?![>=])|[<>]=)/g,
]
const ALLOCATED_LITERAL = /\b(\d{4,5})\s*\+\s*\(?\s*[\w.]+\s*%/g
const SPOKEN_RANGE = /\b(\d{4,5})\s*(?:to|through|-|–)\s*(\d{4,5})\b/g
const FIXED_PORT_COMMAND = /\bPORT=(\d{4,5})\s+pnpm\b/g

const isPortNumber = (digits) => {
  const value = Number(digits)
  return value >= LOWEST_USER_PORT && value <= HIGHEST_PORT
}

function literalsOn(line) {
  const found = []
  for (const pattern of [...COMPARED_LITERALS, ALLOCATED_LITERAL])
    for (const match of line.matchAll(pattern)) found.push(match[1])
  for (const match of line.matchAll(SPOKEN_RANGE))
    found.push(match[1], match[2])
  return found.filter(isPortNumber)
}

function nearPortName(lines, index) {
  const from = Math.max(0, index - NEARBY_LINES)
  return lines
    .slice(from, index + NEARBY_LINES + 1)
    .some((line) => NAMES_A_PORT.test(line))
}

function codeHits(lines) {
  return lines.flatMap((line, index) => {
    const ports = literalsOn(line)
    if (ports.length === 0 || !nearPortName(lines, index)) return []
    return [{ line: index + 1, text: line.trim(), ports }]
  })
}

function docHits(lines) {
  return lines.flatMap((line, index) => {
    const ports = [...line.matchAll(FIXED_PORT_COMMAND)].map((m) => m[1])
    return ports.length === 0
      ? []
      : [{ line: index + 1, text: line.trim(), ports }]
  })
}

export function detect(text, path = "") {
  if (path === PORT_SOURCE) return []
  const lines = String(text).split("\n")
  return path.endsWith(".md") ? docHits(lines) : codeHits(lines)
}
