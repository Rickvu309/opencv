export function wordPageReceipt(fields: {
  docId: string
  revision: string
  name?: string
  kind?: "cv" | "letter"
}) {
  return {
    generation: "package",
    name: "Page.docx",
    kind: "cv",
    packageHash: "ab".repeat(32),
    byteSize: 128,
    incarnation: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    restore: null,
    ...fields,
  }
}
