export const RICH_DOCUMENT_ID = "16590000-0000-4000-8000-000000000001"

export function richDocumentAnswer() {
  return {
    ok: true,
    data: {
      id: RICH_DOCUMENT_ID,
      name: "Product designer CV",
      kind: "cv",
      format: "rich",
      updatedAt: new Date().toISOString(),
    },
  }
}
