import { describe, expect, it } from "vitest"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import {
  buildMockContributions,
  getMockGithubProfile,
  MOCK_GITHUB_CONTRIBUTIONS,
} from "@/features/pitch/pitch-github-mock.ts"
import { pitchHandle } from "@/features/pitch/pitch-types.ts"

describe("pitch GitHub mock", () => {
  it("builds a year of contribution cells without network", () => {
    const days = buildMockContributions()
    expect(days.length).toBe(365)
    expect(MOCK_GITHUB_CONTRIBUTIONS).toHaveLength(365)
    expect(days[0]).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      count: expect.any(Number),
      level: expect.any(Number),
    })
    expect(days.some((day) => day.count > 0)).toBe(true)
  })

  it("uses the session User handle, not the demo persona", () => {
    const mock = getMockGithubProfile(SAMPLE_AUTHOR_NAME)
    const handle = pitchHandle(SAMPLE_AUTHOR_NAME)

    expect(mock.username).toBe(`${handle}-uit`)
    expect(mock.username).not.toMatch(/eric/i)
    expect(mock.profileUrl).toBe(`https://github.com/${mock.username}`)
    expect(mock.totalLastYear).toBe(284)
  })
})
