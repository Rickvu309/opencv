import { describe, expect, it } from "vitest"
import { chatToolNameSchema } from "@workspace/domain/coach"
import {
  COACH_TOOL_LABELS,
  coachToolLabel,
  coachReadLabel,
  humanToolText,
} from "./coach-tool-labels.ts"

describe("Coach tool labels", () => {
  it("preserves links and email addresses in surrounding prose", () => {
    expect(humanToolText("Read example.com or person@example.com")).toBe(
      "Read example.com or person@example.com"
    )
  })
  it("labels every ChatToolName in plain words", () => {
    expect(Object.keys(COACH_TOOL_LABELS).sort()).toEqual(
      [...chatToolNameSchema.options].sort()
    )
    for (const name of chatToolNameSchema.options) {
      expect(coachToolLabel(name)).toMatch(/^[A-Z][a-z]/)
      expect(coachToolLabel(name)).not.toMatch(/[a-z]+\.[a-z]+/)
    }
  })

  it("turns a completed read into one past-tense line", () => {
    expect(coachReadLabel("job.list")).toBe("Looked at your Jobs")
    expect(coachReadLabel("paper.edit")).toBeUndefined()
  })

  it("replaces technical names in progress and receipt copy", () => {
    expect(humanToolText("Running paper.edit after job.list")).toBe(
      "Running Edit your Paper after Look at your Jobs"
    )
    expect(coachToolLabel("unknown.tool")).toBe("Coach action")
  })
})
