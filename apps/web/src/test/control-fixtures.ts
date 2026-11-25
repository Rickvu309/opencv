export function undoneActivityRow(id = "01900000-0000-7000-8000-00000000ac71") {
  const at = "2026-01-01T00:00:00.000Z"
  return {
    id,
    userId: "owner",
    createdAt: at,
    actor: "person" as const,
    command: "job.move",
    subjectKind: "job",
    subjectId: "01900000-0000-7000-8000-00000000a0b1",
    summary: "Moved",
    detail: null,
    result: null,
    reversalCommand: null,
    reversalInput: null,
    reversalExpect: null,
    undoneAt: at,
    idempotencyKey: null,
    turnId: null,
  }
}

export function activityFeedRow(patch: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    createdAt: "2026-11-01T00:00:00.000Z",
    actor: "person",
    command: "paper.delete",
    subjectKind: "paper",
    subjectId: "doc",
    summary: "You deleted it",
    undoneAt: null,
    reversible: true,
    ...patch,
  }
}
