// The one list of issue fields. The issue form (.github/ISSUE_TEMPLATE/task.yml), `file` and the
// plain-words lint all read it, and fields.test.mjs fails when the form drifts from it.
// `exempt` sections skip every plain-words check.
export const TYPES = ["feat", "fix", "hotfix", "refactor", "chore", "docs"]
export const RISKS = ["low", "normal", "high"]

export const TEMPLATE_FIELDS = [
  {
    id: "type",
    label: "Type",
    flag: "--type",
    kind: "dropdown",
    required: true,
    exempt: true,
    options: TYPES,
  },
  {
    id: "what",
    label: "What and why",
    flag: "--what",
    kind: "textarea",
    required: true,
  },
  {
    id: "done",
    label: "Done when",
    flag: "--done",
    kind: "textarea",
    required: true,
  },
  {
    id: "risk",
    label: "Risk",
    flag: "--risk",
    kind: "dropdown",
    required: true,
    options: RISKS,
  },
  {
    id: "could-go-wrong",
    label: "What could go wrong",
    flag: "--could-go-wrong",
    kind: "textarea",
    required: false,
    requiredForRisk: "high",
  },
  {
    id: "questions",
    label: "Questions for you",
    flag: "--questions",
    kind: "textarea",
    required: false,
  },
  {
    id: "out-of-scope",
    label: "Out of scope",
    flag: "--out-of-scope",
    kind: "textarea",
    required: false,
  },
  {
    id: "details",
    label: "Details for the agent",
    flag: "--details",
    kind: "textarea",
    required: false,
    exempt: true,
  },
]

export const RISK_LABELS = RISKS.map((risk) => `risk:${risk}`)
