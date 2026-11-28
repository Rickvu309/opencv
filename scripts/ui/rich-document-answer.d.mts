export declare const RICH_DOCUMENT_ID: string

export type RichDocumentAnswer = {
  ok: boolean
  data: {
    id: string
    name: string
    kind: string
    format: "rich"
    updatedAt: string
  }
}

export declare function richDocumentAnswer(): RichDocumentAnswer
