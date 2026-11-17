import { afterEach, expect, it } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { render } from "@/test/render-with-client.tsx"

import { LetterStoppedNotice } from "./paper-letter-stopped.tsx"
import {
  clearStoppedLetter,
  rememberStoppedLetter,
  stoppedLetter,
} from "./paper-letter-resume.ts"

const DOC = "11111111-1111-4111-8111-111111111111"

afterEach(() => {
  clearStoppedLetter()
  cleanup()
})

it("shows Continue drafting when Coach stopped before any words", () => {
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a cover letter",
    jobId: null,
  })
  render(<LetterStoppedNotice docId={DOC} pageText="" />)
  expect(screen.getByRole("status")).toHaveTextContent(
    "Coach stopped before writing."
  )
  expect(
    screen.getByRole("button", { name: "Continue drafting" })
  ).toBeEnabled()
})

it("hides that note once the letter has words", () => {
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a cover letter",
    jobId: "job-1",
  })
  render(<LetterStoppedNotice docId={DOC} pageText="Dear hiring team," />)
  expect(screen.queryByText("Coach stopped before writing.")).toBeNull()
  expect(stoppedLetter()).toBeNull()
})

it("stays hidden when this page was not stopped", () => {
  render(<LetterStoppedNotice docId={DOC} pageText="" />)
  expect(screen.queryByRole("button", { name: "Continue drafting" })).toBeNull()
})

it("restores the stopped notice from session state after a reload", async () => {
  sessionStorage.setItem(
    "opencv-stopped-letter",
    JSON.stringify({
      docId: DOC,
      chatId: "saved-chat",
      prompt: "Draft a cover letter",
      jobId: null,
    })
  )
  render(<LetterStoppedNotice docId={DOC} pageText="" />)
  expect(
    screen.getByRole("button", { name: "Continue drafting" })
  ).toBeEnabled()
  expect(stoppedLetter()?.chatId).toBe("saved-chat")
})
