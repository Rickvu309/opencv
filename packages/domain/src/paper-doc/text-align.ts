const MAX_CELLS = 4_000_000

export function matchSequences(
  left: readonly string[],
  right: readonly string[]
): number[] | null {
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
