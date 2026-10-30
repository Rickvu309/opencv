// Preconditions raised by delivery jobs at their effect boundaries.
const MERGE_ROWS = [
  "DRAFT",
  "NEEDS_HUMAN_REVIEW",
  "BAD_BRANCH",
  "CLOSED_PR",
  "CI_REQUIRED",
  "LEFT_QUEUE",
  "QUEUE_TIMEOUT",
  "HEAD_MOVED",
  "CI_FAILED",
]

export const jobRows = Object.entries({
  STALE_CHECK: "The saved work changed during check or push.",
  BAD_BODY: "The PR body is missing required content.",
  BAD_TITLE: "The PR title does not match the branch and issue.",
  NO_COMMITS: "There are no commits beyond origin/main.",
  CHECK_REQUIRED: "A passing check for this saved tree and base is required.",
  DRAFT: "A draft PR cannot merge.",
  NEEDS_HUMAN_REVIEW: "An agent never merges a PR needing human review.",
  BAD_BRANCH: "The PR branch must name its issue.",
  CLOSED_PR: "The PR must be open or already merged.",
  CI_REQUIRED: "The newest ci check must succeed on the PR head.",
  LEFT_QUEUE: "The PR must stay in the queue until it merges.",
  QUEUE_TIMEOUT: "The queue must merge the PR within 45 minutes.",
  HEAD_MOVED: "The PR head must stay the commit ci passed.",
  CI_FAILED: "The newest ci check on the PR head must succeed.",
}).map(([id, says]) => ({
  id,
  kind: "precondition",
  section: MERGE_ROWS.includes(id) ? "6" : "4",
  says,
  jobs: MERGE_ROWS.includes(id)
    ? ["merge"]
    : id === "STALE_CHECK"
      ? ["check", "finish"]
      : ["finish"],
  needs: ["delivery"],
  check: ({ delivery }) =>
    delivery.id === id ? delivery.message || says : null,
  fix: ({ delivery } = {}) =>
    delivery?.fix ||
    "Run scripts/ocv-tools.mjs check before finish; wait for ci before merge.",
}))
