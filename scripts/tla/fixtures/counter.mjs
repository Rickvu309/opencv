export function increment(count, max) {
  return count < max ? count + 1 : count
}

export function reset(count, max) {
  return count === max ? 0 : count
}
