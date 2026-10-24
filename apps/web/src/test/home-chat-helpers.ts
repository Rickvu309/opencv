import { expect } from "vitest"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { HISTORY_PREVIEW_COUNT } from "@/features/home/threads.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"

export const idleHeading = new RegExp(
  `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
)

export async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", { level: 1, name: idleHeading })
  ).toBeInTheDocument()
}

export async function expectHistoryTitles() {
  const history = await screen.findByRole("navigation", { name: "History" })
  for (const thread of FIXTURE_THREADS.slice(0, HISTORY_PREVIEW_COUNT)) {
    expect(
      await within(history).findByRole("button", { name: thread.title })
    ).toBeInTheDocument()
  }
  return history
}

export async function sendMessage(text: string) {
  const composer = await screen.findByRole("textbox", { name: "Message Coach" })
  fireEvent.change(composer, { target: { value: text } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

export async function expectSendSettled(text: string) {
  expect(await screen.findByRole("log", { name: "Thread" })).toHaveTextContent(
    text
  )
  await waitFor(() => {
    expect(screen.queryByText("Thinking")).not.toBeInTheDocument()
  })
}

export function stepButton(text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(escaped)
}

export async function expectThreadText(text: string) {
  expect(await screen.findByRole("log", { name: "Thread" })).toBeInTheDocument()
  expect(await screen.findByText(text)).toBeInTheDocument()
}
