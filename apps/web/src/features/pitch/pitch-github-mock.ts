/**
 * Fictional GitHub integration data. No live API calls — PRODUCT.md q.2
 * stays open. Handle comes from the session User, never a demo persona.
 */
import { pitchHandle } from "@/features/pitch/pitch-types.ts"

export type GithubContribution = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`
}

function levelFromCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 9) return 3
  return 4
}

export function getMockGithubUsername(name: string) {
  const handle = pitchHandle(name) || "you"
  return `${handle}-uit`
}

export function getMockGithubProfile(name: string, avatarUrl = "") {
  const username = getMockGithubUsername(name)

  return {
    username,
    avatarUrl,
    profileUrl: `https://github.com/${username}`,
    publicRepos: 14,
    followers: 28,
    memberSince: 2022,
    totalLastYear: MOCK_GITHUB_CONTRIBUTIONS.reduce(
      (sum, day) => sum + day.count,
      0
    ),
    streak: 11,
    topLanguage: "TypeScript",
  }
}

/** Last 52 weeks — weekday-heavy, lighter holidays, one quiet week. */
export function buildMockContributions(): GithubContribution[] {
  const out: GithubContribution[] = []
  const end = new Date(2026, 7, 24)
  const start = new Date(end)
  start.setDate(start.getDate() - 364)

  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    const iso = toIso(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      cursor.getDate()
    )
    const month = cursor.getMonth()
    const day = cursor.getDate()

    let count: number
    if (month === 11 && day >= 22) count = 0
    else if (month === 0 && day <= 3) count = 0
    else if (dow === 0 || dow === 6) {
      const w = (iso.charCodeAt(5) + dow) % 5
      count = w === 0 ? 1 : 0
    } else {
      const roll = (iso.charCodeAt(8) + iso.charCodeAt(9) + dow) % 12
      if (roll < 2) count = 0
      else if (roll < 5) count = 1 + (roll % 3)
      else if (roll < 9) count = 3 + (roll % 4)
      else count = 5 + (roll % 6)
    }

    out.push({ date: iso, count, level: levelFromCount(count) })
    cursor.setDate(cursor.getDate() + 1)
  }

  return out
}

export const MOCK_GITHUB_CONTRIBUTIONS = buildMockContributions()
