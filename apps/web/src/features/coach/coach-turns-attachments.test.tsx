import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { CoachTurns } from "@/features/coach/coach-turns.tsx"
import { ChatLog } from "@/components/ai-elements/chat.tsx"

afterEach(cleanup)

describe("Coach user message attachments", () => {
  it("shows resolved job, Paper, and link labels on the message", () => {
    render(
      <ChatLog>
        <CoachTurns
          messages={[
            {
              id: "user-1",
              role: "user",
              text: "Help me prepare",
              attachments: [
                {
                  kind: "job",
                  id: "job-1",
                  label: "Product role at Northwind",
                },
                { kind: "paper", id: "paper-1", label: "Journey CV" },
                {
                  kind: "link",
                  id: "https://example.com/guide",
                  label: "example.com",
                },
              ],
            },
          ]}
        />
      </ChatLog>
    )

    expect(screen.getByText("Product role at Northwind")).toBeInTheDocument()
    expect(screen.getByText("Journey CV")).toBeInTheDocument()
    expect(screen.getByText("example.com")).toBeInTheDocument()
  })
})
