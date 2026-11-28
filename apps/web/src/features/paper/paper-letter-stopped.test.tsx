import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"

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
  vi.unstubAllGlobals()
})

it("shows Continue drafting when Coach stopped before any words", () => {
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a cover letter",
    jobId: null,
  })
  render(<LetterStoppedNotice docId={DOC} pageText="" onWritten={vi.fn()} />)
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
  render(
    <LetterStoppedNotice
      docId={DOC}
      pageText="Dear hiring team,"
      onWritten={vi.fn()}
    />
  )
  expect(screen.queryByText("Coach stopped before writing.")).toBeNull()
  expect(stoppedLetter()).toBeNull()
})

it("stays hidden when this page was not stopped", () => {
  const { container } = render(
    <LetterStoppedNotice docId={DOC} pageText="" onWritten={vi.fn()} />
  )
  expect(screen.queryByRole("button", { name: "Continue drafting" })).toBeNull()
  expect(
    container.querySelector('[data-slot="letter-stopped-notice"]')
  ).toBeNull()
})

it("keeps the stopped notice row during typing and releases it on another document", () => {
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a cover letter",
    jobId: null,
  })
  const view = render(
    <LetterStoppedNotice docId={DOC} pageText="" onWritten={vi.fn()} />
  )
  const row = view.container.querySelector(
    '[data-slot="letter-stopped-notice"]'
  )
  expect(row).toHaveClass("min-h-24", "md:min-h-16")
  const contents = row?.innerHTML
  view.rerender(
    <LetterStoppedNotice docId={DOC} pageText="M" onWritten={vi.fn()} />
  )
  expect(
    view.container.querySelector('[data-slot="letter-stopped-notice"]')
  ).toBe(row)
  expect(row).toHaveAttribute("aria-hidden", "true")
  expect(row).toHaveClass("min-h-24", "md:min-h-16", "invisible")
  expect(row?.innerHTML).toBe(contents)
  expect(screen.queryByRole("button", { name: "Continue drafting" })).toBeNull()
  view.rerender(
    <LetterStoppedNotice
      docId={DOC}
      pageText="My opening"
      onWritten={vi.fn()}
    />
  )
  expect(
    view.container.querySelector('[data-slot="letter-stopped-notice"]')
  ).toBe(row)
  view.rerender(
    <LetterStoppedNotice
      docId="another-document"
      pageText=""
      onWritten={vi.fn()}
    />
  )
  expect(
    view.container.querySelector('[data-slot="letter-stopped-notice"]')
  ).toBeNull()
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
  render(<LetterStoppedNotice docId={DOC} pageText="" onWritten={vi.fn()} />)
  expect(
    screen.getByRole("button", { name: "Continue drafting" })
  ).toBeEnabled()
  expect(stoppedLetter()?.chatId).toBe("saved-chat")
})

it("keeps Stop available after typing until the stream ends and clears its alert on the next edit", async () => {
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a cover letter",
    jobId: null,
  })
  const generation = Promise.withResolvers<Response>()
  const started = Promise.withResolvers<void>()
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turns")) {
      started.resolve()
      return generation.promise
    }
    return Response.json({ ok: true, data: {} })
  })
  const view = render(
    <LetterStoppedNotice docId={DOC} pageText="" onWritten={vi.fn()} />
  )
  fireEvent.click(screen.getByRole("button", { name: "Continue drafting" }))
  await started.promise
  view.rerender(
    <LetterStoppedNotice
      docId={DOC}
      pageText="My opening"
      onWritten={vi.fn()}
    />
  )
  expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled()
  expect(screen.getByRole("status")).toHaveTextContent("Coach is writing…")
  await act(async () => {
    generation.resolve(
      new Response(
        `event: text-delta\ndata: ${JSON.stringify({ text: "Generated letter" })}\n\n`
      )
    )
  })
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your text is unchanged"
  )
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Continue drafting" })).toBeNull()
  view.rerender(
    <LetterStoppedNotice
      docId={DOC}
      pageText="My opening sentence"
      onWritten={vi.fn()}
    />
  )
  expect(screen.queryByRole("alert")).toBeNull()
})

it("can stop the stream after typing removes the stopped-letter record", async () => {
  rememberStoppedLetter({
    docId: DOC,
    chatId: "stopped-chat",
    prompt: "Draft a cover letter",
    jobId: null,
  })
  const generation = Promise.withResolvers<Response>()
  const started = Promise.withResolvers<void>()
  vi.stubGlobal("fetch", async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turns")) {
      started.resolve()
      return generation.promise
    }
    return Response.json({ ok: true, data: {} })
  })
  const written = vi.fn()
  const view = render(
    <LetterStoppedNotice docId={DOC} pageText="" onWritten={written} />
  )
  fireEvent.click(screen.getByRole("button", { name: "Continue drafting" }))
  await started.promise
  view.rerender(
    <LetterStoppedNotice
      docId={DOC}
      pageText="My opening"
      onWritten={written}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "Stop" }))
  await act(async () => generation.resolve(new Response("")))
  expect(written).not.toHaveBeenCalled()
  expect(screen.queryByRole("alert")).toBeNull()
  expect(screen.queryByRole("status")).toBeNull()
})
