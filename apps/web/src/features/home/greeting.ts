export type GreetingPhrase = "Good morning" | "Good afternoon" | "Good evening"

export function greetingPhrase(now: Date = new Date()): GreetingPhrase {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function homeGreeting(name: string, now: Date = new Date()) {
  return `${greetingPhrase(now)}, ${name}`
}
