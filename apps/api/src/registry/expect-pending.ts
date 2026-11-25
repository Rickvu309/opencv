export const REVERSAL_EXPECT_PENDING = {
  issue: 958,
  expires: "2026-12-15",
  commands: [
    "job.linkPaper",
    "paper.create",
    "paper.duplicate",
    "paper.edit",
    "paper.rename",
    "paper.setTemplate",
    "paper.share",
  ],
} as const

export type ReversalExpectPending =
  (typeof REVERSAL_EXPECT_PENDING.commands)[number]

export function reversalExpectPendingExpired(today: Date) {
  return today.toISOString().slice(0, 10) > REVERSAL_EXPECT_PENDING.expires
}
