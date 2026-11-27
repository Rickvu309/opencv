export const KEYSTROKE_PROBE = () => {
  window.__walkKeys = []
  window.__walkEventTimings = []
  document.addEventListener(
    "keydown",
    (event) => {
      const started = event.timeStamp
      requestAnimationFrame(() => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () =>
          window.__walkKeys.push(performance.now() - started)
        channel.port2.postMessage(0)
      })
    },
    true
  )
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.name === "keydown")
          window.__walkEventTimings.push(entry.duration)
    }).observe({ type: "event", durationThreshold: 16, buffered: true })
  } catch {
    window.__walkEventTimings = null
  }
}

export function percentile(sorted, fraction) {
  if (sorted.length === 0) return null
  const at = Math.min(
    sorted.length - 1,
    Math.ceil(fraction * sorted.length) - 1
  )
  return sorted[Math.max(0, at)]
}

const round = (value) => (value === null ? null : Math.round(value))

export function keystrokeStats(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    keys: sorted.length,
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted.at(-1) ?? null),
  }
}

const CV_WORDS = [
  "led",
  "built",
  "shipped",
  "measured",
  "designed",
  "taught",
  "grew",
  "reduced",
]

export const lineStart = (line) => `${CV_WORDS[line % CV_WORDS.length]}${line}`

export function cvText({ lines, wordsPerLine }) {
  return Array.from({ length: lines }, (_, line) =>
    Array.from(
      { length: wordsPerLine },
      (_, at) => `${CV_WORDS[(line + at) % CV_WORDS.length]}${line}`
    ).join(" ")
  ).join("\n")
}
