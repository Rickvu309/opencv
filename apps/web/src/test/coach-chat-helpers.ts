import { expect } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"

export const idleHeading = "How can I help?"

export async function expectCoachIdle() {
  expect(
    await screen.findByRole("heading", { level: 2, name: idleHeading })
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

export function stepName(text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(escaped)
}

export async function expectChatText(text: string) {
  const logs = await screen.findAllByRole("log", { name: "Chat" })
  expect(logs[0]).toBeInTheDocument()
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
}
