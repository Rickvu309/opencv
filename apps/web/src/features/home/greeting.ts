export type GreetingPhrase = "Good morning" | "Good afternoon" | "Good evening"

/** Product-pinned zone from Settings → General (core user is ICT). */
const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"

export function greetingPhrase(now: Date = new Date()): GreetingPhrase {
  const hour = hourInTimeZone(now, PRODUCT_TIME_ZONE)
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function homeGreeting(name: string, now: Date = new Date()) {
  return `${greetingPhrase(now)}, ${name}`
}

function hourInTimeZone(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value
  return Number.parseInt(hour ?? "0", 10)
}
