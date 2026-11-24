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
