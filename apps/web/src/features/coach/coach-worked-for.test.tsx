import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { CoachPart } from "./coach-parts.ts"
import { splitReadTraces, traceSteps } from "./coach-read-trace.ts"
import { CoachWorkFold } from "./coach-work-fold.tsx"

function tool(
  key: string,
  name: string,
  part: Record<string, unknown> = {}
): CoachPart {
  return {
    kind: "tool",
    key,
    name,
    label: name,
    status: "done",
    part: { type: "tool", name, ok: true, toolCallId: key, ...part },
  } as CoachPart
}

const text: CoachPart = { kind: "text", key: "t", markdown: "Prep the Job." }

describe("Coach worked-for disclosure", () => {
  it("moves finished reads into the trace and keeps the answer clean", () => {
    const { traces, answer } = splitReadTraces([tool("a", "job.list"), text])
    expect(traces).toEqual([{ key: "a", label: "Looked at your Jobs" }])
    expect(answer).toEqual([text])
  })

  it("never hides an approval, a failed read, an undone step or a change", () => {
    const kept = [
      tool("p", "job.list", { pendingActionId: "pa_1" }),
      tool("q", "paper.edit", { approval: "pending" }),
      tool("f", "job.list", { ok: false }),
      tool("u", "job.list", { undone: true }),
      tool("m", "job.move"),
    ]
    const { traces, answer } = splitReadTraces(kept)
    expect(traces).toEqual([])
    expect(answer).toEqual(kept)
  })

  it("shows a plain line when there is nothing to disclose", () => {
    render(<CoachWorkFold steps={[]} live={false} workedMs={1800} />)
    expect(screen.getByText("Worked for 2s")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("opens the trace from the Worked for button", () => {
    render(
      <CoachWorkFold
        steps={traceSteps([{ key: "a", label: "Looked at your Jobs" }])}
        live={false}
        workedMs={2000}
      />
    )
    const trigger = screen.getByRole("button", { name: "Worked for 2s" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Looked at your Jobs")).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Looked at your Jobs")).toBeVisible()
  })
})
