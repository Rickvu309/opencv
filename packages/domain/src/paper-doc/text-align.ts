const MAX_CELLS = 4_000_000

export function matchIndexes(a: string, b: string): number[] | null {
  const left = [...a]
  const right = [...b]
  let head = 0
  while (
    head < left.length &&
    head < right.length &&
    left[head] === right[head]
  ) {
    head += 1
  }
  let tail = 0
  while (
    tail < left.length - head &&
    tail < right.length - head &&
    left[left.length - 1 - tail] === right[right.length - 1 - tail]
  ) {
    tail += 1
  }
  const midA = left.slice(head, left.length - tail)
  const midB = right.slice(head, right.length - tail)
  if ((midA.length + 1) * (midB.length + 1) > MAX_CELLS) return null
  const width = midB.length + 1
  const table = new Uint16Array((midA.length + 1) * width)
  for (let i = midA.length - 1; i >= 0; i -= 1) {
    for (let j = midB.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        midA[i] === midB[j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!)
    }
  }
  const matches = left.map(() => -1)
  for (let i = 0; i < head; i += 1) matches[i] = i
  for (let k = 0; k < tail; k += 1) {
    matches[left.length - 1 - k] = right.length - 1 - k
  }
  let i = 0
  let j = 0
  while (i < midA.length && j < midB.length) {
    if (midA[i] === midB[j]) {
      matches[head + i] = head + j
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      i += 1
    } else {
      j += 1
    }
  }
  return matches
}

export function insertedRuns(before: string, after: string): string[] | null {
  const matches = matchIndexes(after, before)
  if (!matches) return null
  const chars = [...after]
  const runs: string[] = []
  let current = ""
  chars.forEach((char, index) => {
    if (matches[index] === -1) {
      current += char
    } else if (current) {
      runs.push(current)
      current = ""
    }
  })
  if (current) runs.push(current)
  return runs
}

export function isSubsequence(wanted: string, text: string): boolean {
  const chars = [...text]
  let at = 0
  for (const char of wanted) {
    while (at < chars.length && chars[at] !== char) at += 1
    if (at === chars.length) return false
    at += 1
  }
  return true
}

export function countOf(text: string, run: string): number {
  if (!run) return 0
  let count = 0
  for (let at = text.indexOf(run); at !== -1; at = text.indexOf(run, at + 1)) {
    count += 1
  }
  return count
}

export function inverseText(
  pre: string,
  post: string,
  live: string
): string | null {
  const preToPost = matchIndexes(pre, post)
  const postToLive = matchIndexes(post, live)
  if (!preToPost || !postToLive) return null
  const liveChars = [...live]
  const preChars = [...pre]
  const fromPre = new Set(preToPost.filter((index) => index !== -1))
  const liveToPost = liveChars.map(() => -1)
  postToLive.forEach((at, index) => {
    if (at !== -1) liveToPost[at] = index
  })
  const keep = liveChars.map((_char, index) => {
    const origin = liveToPost[index]!
    return origin === -1 || fromPre.has(origin)
  })
  const restored = new Map<number, string>()
  let run = ""
  let anchorPost = -1
  const flush = () => {
    if (!run) return
    let anchor = -1
    for (let i = anchorPost; i >= 0; i -= 1) {
      if (postToLive[i] !== -1) {
        anchor = postToLive[i]!
        break
      }
    }
    restored.set(anchor, (restored.get(anchor) ?? "") + run)
    run = ""
  }
  preChars.forEach((char, index) => {
    const at = preToPost[index]!
    if (at === -1) {
      run += char
    } else {
      flush()
      anchorPost = at
    }
  })
  flush()
  let result = restored.get(-1) ?? ""
  liveChars.forEach((char, index) => {
    if (keep[index]) result += char
    result += restored.get(index) ?? ""
  })
  return result
}
