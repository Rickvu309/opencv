import { expect } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"

export const idleHeading = new RegExp(
  `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
)

export async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", { level: 1, name: idleHeading })
  ).toBeInTheDocument()
}

export async function sendMessage(text: string) {
  const composer = await screen.findByRole("textbox", { name: "Message Coach" })
  fireEvent.change(composer, { target: { value: text } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
}

export async function expectSendSettled(text: string) {
  expect(await screen.findByRole("log", { name: "Chat" })).toHaveTextContent(
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

export async function expectChatText(text: string) {
  const logs = await screen.findAllByRole("log", { name: "Chat" })
  expect(logs[0]).toBeInTheDocument()
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
}
