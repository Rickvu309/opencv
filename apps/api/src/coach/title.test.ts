import {
  DEFAULT_THREAD_TITLE,
  deterministicThreadTitle,
  isAutoTitleEligible,
  sanitizeThreadTitle,
  shouldAutoTitleThread,
  titleFrom,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import {
  resolveThreadTitle,
  THREAD_TITLE_SYSTEM_PROMPT,
  threadTitleUserPrompt,
} from "./title.js"

describe("titleFrom", () => {
  it("keeps short text and trims long titles", () => {
    expect(titleFrom("  Help me plan the week  ")).toBe("Help me plan the week")
    expect(titleFrom("x".repeat(40))).toBe(`${"x".repeat(36)}…`)
  })
})

describe("isAutoTitleEligible", () => {
  it("allows the default title and a first-line title", () => {
    expect(isAutoTitleEligible(DEFAULT_THREAD_TITLE, "Help me plan the week")).toBe(
      true
    )
    expect(
      isAutoTitleEligible("Help me plan the week", "Help me plan the week")
    ).toBe(true)
    expect(isAutoTitleEligible("Weekly plan", "Help me plan the week")).toBe(
      false
    )
  })
})

describe("shouldAutoTitleThread", () => {
  it("runs only on the first completed turn of a default or first-line title", () => {
    expect(
      shouldAutoTitleThread({
        currentTitle: DEFAULT_THREAD_TITLE,
        messages: [{ role: "user", text: "Help me plan the week" }],
        status: "final",
      })
    ).toEqual({ userText: "Help me plan the week" })

    expect(
      shouldAutoTitleThread({
        currentTitle: "Help me plan the week",
        messages: [{ role: "user", text: "Help me plan the week" }],
        status: "final",
      })
    ).toEqual({ userText: "Help me plan the week" })
  })

  it("leaves user-renamed titles and later turns alone", () => {
    expect(
      shouldAutoTitleThread({
        currentTitle: "Keep this name",
        messages: [{ role: "user", text: "Help me plan the week" }],
        status: "final",
      })
    ).toBeNull()

    expect(
      shouldAutoTitleThread({
        currentTitle: DEFAULT_THREAD_TITLE,
        messages: [
          { role: "user", text: "Help me plan the week" },
          { role: "coach", text: "Prep Apply next.", status: "final" },
        ],
        status: "final",
      })
    ).toBeNull()
  })

  it("skips aborted and error turns, and treats seed coach rows as already titled", () => {
    expect(
      shouldAutoTitleThread({
        currentTitle: DEFAULT_THREAD_TITLE,
        messages: [{ role: "user", text: "Help me plan the week" }],
        status: "aborted",
      })
    ).toBeNull()

    expect(
      shouldAutoTitleThread({
        currentTitle: "Welcome to OpenPath",
        messages: [
          { role: "coach", text: "Hey. I'm your OpenPath Coach." },
          { role: "user", text: "Help me plan the week" },
        ],
        status: "final",
      })
    ).toBeNull()
  })
})

describe("sanitizeThreadTitle", () => {
  it("strips hype, quotes, and claimed actions", () => {
    expect(sanitizeThreadTitle("  Plan the week!  ")).toBe("Plan the week")
    expect(sanitizeThreadTitle('"Finish the CV"')).toBe("Finish the CV")
    expect(sanitizeThreadTitle("Moved your card to Prep")).toBe("")
    expect(sanitizeThreadTitle("I created a Proof")).toBe("")
  })
})

describe("deterministicThreadTitle", () => {
  it("uses an honest topic from the user text", () => {
    expect(
      deterministicThreadTitle({
        userText: "Should I finish my CV first?",
        coachText: "I looked at Apply. Prep the starred one next.",
      })
    ).toBe("Finish my CV first")
    expect(
      deterministicThreadTitle({
        userText: "Help me plan the week",
        coachText: "I looked at Apply. Prep the starred one next.",
      })
    ).toBe("Plan the week")
    expect(
      deterministicThreadTitle({
        userText: "Keep this Thread",
        coachText: "I looked at Apply. Prep the starred one next.",
      })
    ).toBe("Keep this Thread")
  })

  it("falls back to the coach topic for greetings", () => {
    expect(
      deterministicThreadTitle({
        userText: "hi",
        coachText: "Prep the starred Apply card next.",
      })
    ).toBe("Prep the starred Apply card next")
  })

  it("never uses exclamation marks or claimed actions", () => {
    const title = deterministicThreadTitle({
      userText: "Move the intern card to Prep!",
      coachText: "I moved it.",
    })
    expect(title).not.toMatch(/!/)
    expect(title).not.toMatch(/^I moved/i)
    expect(title).toBe("Move the intern card to Prep")
  })
})

describe("resolveThreadTitle", () => {
  it("uses a Light-tier generator when it returns a valid title", async () => {
    await expect(
      resolveThreadTitle({
        userText: "Help me plan the week",
        coachText: "Prep the starred one next.",
        generateTitle: async () => "Weekly plan from Apply",
      })
    ).resolves.toBe("Weekly plan from Apply")
  })

  it("falls back when the generator throws or returns a claimed action", async () => {
    await expect(
      resolveThreadTitle({
        userText: "Help me plan the week",
        coachText: "Prep the starred one next.",
        generateTitle: async () => {
          throw new Error("light model down")
        },
      })
    ).resolves.toBe("Plan the week")

    await expect(
      resolveThreadTitle({
        userText: "Help me plan the week",
        coachText: "Prep the starred one next.",
        generateTitle: async () => "Moved your Apply card!",
      })
    ).resolves.toBe("Plan the week")
  })
})

describe("thread title prompt", () => {
  it("encodes the product voice for the Light-tier call", () => {
    expect(THREAD_TITLE_SYSTEM_PROMPT).toMatch(/No exclamation marks/)
    expect(THREAD_TITLE_SYSTEM_PROMPT).toMatch(/Do not claim any action/)
    expect(THREAD_TITLE_SYSTEM_PROMPT).not.toMatch(/!/)
    expect(
      threadTitleUserPrompt("Help me plan the week", "Prep Apply next.")
    ).toContain("User:\nHelp me plan the week")
  })
})
