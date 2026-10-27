/** Lexicographic alphabet for fractional-index `position` keys. */
export const POSITION_DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

const BASE = POSITION_DIGITS.length

function digitIndex(char: string): number {
  const index = POSITION_DIGITS.indexOf(char)
  if (index === -1) {
    throw new RangeError(`Invalid position character: ${char}`)
  }
  return index
}

function incrementKey(key: string): string {
  for (let i = key.length - 1; i >= 0; i--) {
    const index = digitIndex(key[i]!)
    if (index < BASE - 1) {
      return (
        key.slice(0, i) +
        POSITION_DIGITS[index + 1] +
        POSITION_DIGITS[0]!.repeat(key.length - i - 1)
      )
    }
  }
  return `${key}V`
}

function midpoint(left: string, right: string): string {
  let result = ""
  let i = 0
  while (true) {
    const leftDigit = i < left.length ? digitIndex(left[i]!) : 0
    const rightDigit = i < right.length ? digitIndex(right[i]!) : BASE
    if (leftDigit < rightDigit - 1) {
      return result + POSITION_DIGITS[Math.floor((leftDigit + rightDigit) / 2)]
    }
    if (leftDigit === rightDigit) {
      result += POSITION_DIGITS[leftDigit]!
      i += 1
      continue
    }
    result += POSITION_DIGITS[leftDigit]!
    i += 1
    while (true) {
      const rest = i < left.length ? digitIndex(left[i]!) : 0
      if (BASE - rest > 1) {
        return result + POSITION_DIGITS[Math.floor((rest + BASE) / 2)]
      }
      result += POSITION_DIGITS[rest]!
      i += 1
    }
  }
}

/**
 * Next fractional-index key strictly between `left` and `right`.
 * A null side means open-ended (start or end of a Stage column).
 */
export function generateKeyBetween(
  left: string | null | undefined,
  right: string | null | undefined
): string {
  if (left != null && right != null && left >= right) {
    throw new RangeError("left position must be less than right")
  }
  if (left == null && right == null) return "a0"
  if (left == null) return midpoint("", right!)
  if (right == null) return incrementKey(left)
  return midpoint(left, right)
}
