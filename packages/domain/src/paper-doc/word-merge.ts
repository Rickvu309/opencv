import { normalizeRuns, type RichText, type TextRun } from "./rich-text.js"
import { matchSequences } from "./text-align.js"

type Cell = {
  ch: string
  bold: boolean
  italic: boolean
  underline: boolean
  href: string
}

type Token = { key: string; core: Cell[]; tail: Cell[] }

function cellsOf(runs: readonly TextRun[] | undefined): Cell[] {
  const out: Cell[] = []
  for (const run of runs ?? []) {
    for (const ch of run.text) {
      out.push({
        ch,
        bold: run.bold === true,
        italic: run.italic === true,
        underline: run.underline === true,
        href: run.href ?? "",
      })
    }
  }
  return out
}

function runsOfCells(cells: readonly Cell[]): RichText {
  const runs: TextRun[] = []
  for (const cell of cells) {
    const last = runs.at(-1)
    if (
      last &&
      (last.bold === true) === cell.bold &&
      (last.italic === true) === cell.italic &&
      (last.underline === true) === cell.underline &&
      (last.href ?? "") === cell.href
    ) {
      last.text += cell.ch
      continue
    }
    const run: TextRun = { text: cell.ch }
    if (cell.bold) run.bold = true
    if (cell.italic) run.italic = true
    if (cell.underline) run.underline = true
    if (cell.href) run.href = cell.href as never
    runs.push(run)
  }
  return normalizeRuns(runs)
}

const SPACE = /\s/u

function tokensOf(cells: readonly Cell[]): Token[] {
  const out: Token[] = []
  let at = 0
  const take = (wanted: boolean) => {
    const from = at
    while (at < cells.length && SPACE.test(cells[at]!.ch) === wanted) at += 1
    return cells.slice(from, at)
  }
  const lead = take(true)
  if (lead.length > 0) out.push({ key: "", core: [], tail: lead })
  while (at < cells.length) {
    const core = take(false)
    out.push({
      key: core.map((cell) => cell.ch).join(""),
      core,
      tail: take(true),
    })
  }
  return out
}

function marksOf(cells: readonly Cell[]) {
  return cells
    .map(
      (cell) =>
        `${cell.bold ? 1 : 0}${cell.italic ? 1 : 0}${cell.underline ? 1 : 0}${cell.href}`
    )
    .join(",")
}

function spaceOf(cells: readonly Cell[]) {
  return cells.map((cell) => `${cell.ch}${marksOf([cell])}`).join(",")
}

type Side = {
  readonly kept: Map<number, Token>
  readonly inserted: Map<number, Token[]>
}

function sideOf(matches: readonly number[], tokens: readonly Token[]): Side {
  const owner = new Map<number, number>()
  matches.forEach((at, from) => {
    if (at >= 0) owner.set(at, from)
  })
  const kept = new Map<number, Token>()
  const inserted = new Map<number, Token[]>()
  let gap = 0
  tokens.forEach((token, at) => {
    const from = owner.get(at)
    if (from === undefined) {
      inserted.set(gap, [...(inserted.get(gap) ?? []), token])
      return
    }
    kept.set(from, token)
    gap = from + 1
  })
  return { kept, inserted }
}

function keysOf(tokens: readonly Token[]) {
  return tokens.map((token) => token.key)
}

function startsWithKeys(whole: readonly Token[], part: readonly Token[]) {
  const wanted = keysOf(part)
  return (
    part.length <= whole.length &&
    keysOf(whole.slice(0, part.length)).every((key, at) => key === wanted[at])
  )
}

function endsWithKeys(whole: readonly Token[], part: readonly Token[]) {
  return startsWithKeys(whole.slice(whole.length - part.length), part)
}

function unionOf(theirs: readonly Token[], ours: readonly Token[]): Token[] {
  if (theirs.length === 0) return [...ours]
  if (ours.length === 0) return [...theirs]
  if (ours.length >= theirs.length) {
    if (startsWithKeys(ours, theirs) || endsWithKeys(ours, theirs)) {
      return [...ours]
    }
  } else if (startsWithKeys(theirs, ours)) {
    return [...ours, ...theirs.slice(ours.length)]
  } else if (endsWithKeys(theirs, ours)) {
    return [...theirs.slice(0, theirs.length - ours.length), ...ours]
  }
  return [...theirs, ...ours]
}

function lcsUnion(theirs: readonly Token[], ours: readonly Token[]): Token[] {
  const matches = matchSequences(keysOf(theirs), keysOf(ours))
  if (!matches) return [...theirs, ...ours]
  const out: Token[] = []
  let fromTheirs = 0
  let fromOurs = 0
  matches.forEach((j, i) => {
    if (j < 0) return
    out.push(...theirs.slice(fromTheirs, i), ...ours.slice(fromOurs, j))
    out.push(ours[j]!)
    fromTheirs = i + 1
    fromOurs = j + 1
  })
  out.push(...theirs.slice(fromTheirs), ...ours.slice(fromOurs))
  return out
}

function survivor(base: Token, mine: Token, other: Token): Token {
  const coreChanged = marksOf(mine.core) !== marksOf(base.core)
  const tailChanged = spaceOf(mine.tail) !== spaceOf(base.tail)
  return {
    key: base.key,
    core: coreChanged ? mine.core : other.core,
    tail: tailChanged ? mine.tail : other.tail,
  }
}

function separated(tokens: readonly Token[]): Token[] {
  return tokens.map((token, at) => {
    const next = tokens[at + 1]
    const last = token.core.at(-1)
    if (!next || !last || token.tail.length > 0) return token
    const first = next.core[0]
    const shared =
      first !== undefined && marksOf([first]) === marksOf([last])
        ? last
        : { ...last, bold: false, italic: false, underline: false, href: "" }
    return { ...token, tail: [{ ...shared, ch: " " }] }
  })
}

function flat(tokens: readonly Token[]): Cell[] {
  return tokens.flatMap((token) => [...token.core, ...token.tail])
}

function sameCells(a: readonly Cell[], b: readonly Cell[]) {
  return (
    a.length === b.length &&
    a.every(
      (cell, at) =>
        cell.ch === b[at]!.ch && marksOf([cell]) === marksOf([b[at]!])
    )
  )
}

function pairedByText(
  matches: readonly number[],
  base: readonly Token[],
  side: readonly Token[]
): number[] {
  const paired = [...matches]
  const taken = new Set(matches.filter((at) => at >= 0))
  paired.forEach((at, from) => {
    if (at >= 0) return
    let low = -1
    for (let back = from - 1; back >= 0; back -= 1) {
      if (paired[back]! >= 0) {
        low = paired[back]!
        break
      }
    }
    let high = side.length
    for (let next = from + 1; next < paired.length; next += 1) {
      if (paired[next]! >= 0) {
        high = paired[next]!
        break
      }
    }
    for (let candidate = low + 1; candidate < high; candidate += 1) {
      if (!taken.has(candidate) && side[candidate]!.key === base[from]!.key) {
        paired[from] = candidate
        taken.add(candidate)
        return
      }
    }
  })
  return paired
}

function mergeCells(
  baseCells: Cell[],
  ourCells: Cell[],
  theirCells: Cell[]
): Cell[] | null {
  if (sameCells(ourCells, baseCells)) return theirCells
  if (sameCells(theirCells, baseCells) || sameCells(ourCells, theirCells)) {
    return ourCells
  }
  const baseTokens = tokensOf(baseCells)
  const ourTokens = tokensOf(ourCells)
  const theirTokens = tokensOf(theirCells)
  if (baseTokens.length === 0) {
    return flat(separated(lcsUnion(theirTokens, ourTokens)))
  }
  const markedKey = (token: Token) => `${token.key}\u0000${marksOf(token.core)}`
  const keys = baseTokens.map(markedKey)
  const matchedOurs = matchSequences(keys, ourTokens.map(markedKey))
  const matchedTheirs = matchSequences(keys, theirTokens.map(markedKey))
  if (!matchedOurs || !matchedTheirs) return null
  const toOurs = pairedByText(matchedOurs, baseTokens, ourTokens)
  const toTheirs = pairedByText(matchedTheirs, baseTokens, theirTokens)
  const mine = sideOf(toOurs, ourTokens)
  const other = sideOf(toTheirs, theirTokens)
  const out: Token[] = []
  for (let gap = 0; gap <= baseTokens.length; gap += 1) {
    out.push(
      ...unionOf(other.inserted.get(gap) ?? [], mine.inserted.get(gap) ?? [])
    )
    const original = baseTokens[gap]
    const mineKept = mine.kept.get(gap)
    const theirKept = other.kept.get(gap)
    if (original && mineKept && theirKept) {
      out.push(survivor(original, mineKept, theirKept))
    }
  }
  return flat(separated(out))
}

export function mergeWords(
  base: readonly TextRun[] | undefined,
  ours: readonly TextRun[] | undefined,
  theirs: readonly TextRun[] | undefined
): RichText | null {
  const merged = mergeCells(cellsOf(base), cellsOf(ours), cellsOf(theirs))
  return merged ? runsOfCells(merged) : null
}

function runIndex(host: readonly Token[], run: readonly Token[]) {
  const wanted = keysOf(run)
  for (let at = 0; at + wanted.length <= host.length; at += 1) {
    if (wanted.every((key, n) => host[at + n]!.key === key)) return at
  }
  return -1
}

function gluedIndex(host: readonly Token[], run: readonly Token[]) {
  const wanted = keysOf(run)
  const first = wanted[0]
  if (first === undefined) return -1
  for (let at = 0; at + wanted.length <= host.length; at += 1) {
    const token = host[at]!
    if (
      token.key.length > first.length &&
      token.key.endsWith(first) &&
      wanted.slice(1).every((key, n) => host[at + 1 + n]!.key === key)
    ) {
      return at
    }
  }
  return -1
}

function wordTokens(runs: readonly TextRun[] | undefined) {
  return tokensOf(cellsOf(runs)).filter((token) => token.key !== "")
}

export function containsRun(
  host: readonly TextRun[] | undefined,
  run: readonly TextRun[] | undefined
): boolean {
  const wanted = wordTokens(run)
  const tokens = wordTokens(host)
  return (
    wanted.length > 0 &&
    (runIndex(tokens, wanted) >= 0 || gluedIndex(tokens, wanted) >= 0)
  )
}

export function graftRun(
  base: readonly TextRun[] | undefined,
  replacement: readonly TextRun[] | undefined,
  host: readonly TextRun[] | undefined,
  replacementIsOurs: boolean
): RichText | null {
  const wanted = wordTokens(base)
  const tokens = wordTokens(host)
  if (wanted.length === 0) return null
  const exact = runIndex(tokens, wanted)
  const glued = exact >= 0 ? -1 : gluedIndex(tokens, wanted)
  if (exact < 0 && glued < 0) return null
  const at = exact >= 0 ? exact : glued
  const lead: Token[] = []
  if (glued >= 0) {
    const token = tokens[glued]!
    const kept = [...token.key].length - [...wanted[0]!.key].length
    lead.push({
      key: [...token.key].slice(0, kept).join(""),
      core: token.core.slice(0, kept),
      tail: [],
    })
  }
  const hostRun =
    glued >= 0
      ? [
          {
            ...tokens[glued]!,
            core: tokens[glued]!.core.slice(lead[0]!.core.length),
          },
          ...tokens.slice(glued + 1, glued + wanted.length),
        ]
      : tokens.slice(at, at + wanted.length)
  const replacementCells = flat(wordTokens(replacement))
  const hostCells = flat(hostRun)
  const baseCells = flat(wanted)
  const joined =
    (replacementIsOurs
      ? mergeCells(baseCells, replacementCells, hostCells)
      : mergeCells(baseCells, hostCells, replacementCells)) ?? replacementCells
  return runsOfCells(
    flat(
      separated([
        ...tokens.slice(0, at),
        ...lead,
        ...tokensOf(joined),
        ...tokens.slice(at + wanted.length),
      ])
    )
  )
}

type SplitText = { head: RichText; tail: RichText }

export function splitMerge(
  base: readonly TextRun[] | undefined,
  splitHead: readonly TextRun[] | undefined,
  splitTail: readonly TextRun[] | undefined,
  other: readonly TextRun[] | undefined,
  splitIsOurs: boolean
): SplitText | null {
  const baseTokens = wordTokens(base)
  const head = wordTokens(splitHead)
  const tail = wordTokens(splitTail)
  for (let cut = 1; cut < baseTokens.length; cut += 1) {
    const baseTail = baseTokens.slice(cut)
    if (runIndex(tail, baseTail) < 0 || runIndex(head, baseTail) >= 0) {
      continue
    }
    const otherTokens = wordTokens(other)
    const matches = matchSequences(keysOf(baseTokens), keysOf(otherTokens))
    if (!matches) return null
    const first = matches.findIndex((at, from) => from >= cut && at >= 0)
    const split = first < 0 ? otherTokens.length : matches[first]!
    const baseHead = flat(baseTokens.slice(0, cut))
    const baseTailCells = flat(baseTail)
    const otherHead = flat(otherTokens.slice(0, split))
    const otherTail = flat(otherTokens.slice(split))
    const joinedHead = splitIsOurs
      ? mergeCells(baseHead, flat(head), otherHead)
      : mergeCells(baseHead, otherHead, flat(head))
    const joinedTail = splitIsOurs
      ? mergeCells(baseTailCells, flat(tail), otherTail)
      : mergeCells(baseTailCells, otherTail, flat(tail))
    if (!joinedHead || !joinedTail) return null
    return { head: runsOfCells(joinedHead), tail: runsOfCells(joinedTail) }
  }
  return null
}

export function wordsOf(runs: readonly TextRun[] | undefined): string[] {
  return tokensOf(cellsOf(runs))
    .map((token) => token.key)
    .filter((key) => key !== "")
}
