export type Clock = {
  now(): number
  at(ms: number, run: () => void): () => void
}

export function systemClock(): Clock {
  return {
    now: () => Date.now(),
    at(ms, run) {
      const timer = setTimeout(run, ms)
      timer.unref?.()
      return () => clearTimeout(timer)
    },
  }
}

export function virtualClock(start = 0): Clock & { advance(ms: number): void } {
  let now = start
  const pending: { at: number; run: () => void; dead: boolean }[] = []
  return {
    now: () => now,
    at(ms, run) {
      const item = { at: now + ms, run, dead: false }
      pending.push(item)
      pending.sort((left, right) => left.at - right.at)
      return () => {
        item.dead = true
      }
    },
    advance(ms) {
      const end = now + ms
      for (;;) {
        const next = pending.find((item) => !item.dead)
        if (!next || next.at > end) break
        pending.splice(pending.indexOf(next), 1)
        now = next.at
        next.run()
      }
      now = end
    },
  }
}
