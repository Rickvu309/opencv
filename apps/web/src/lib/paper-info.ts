import { catalog } from "@workspace/domain/kernel"
import { paperDocumentInfoSchema } from "@workspace/domain/paper-doc"

import { catalogClient } from "./contract-client.ts"

export async function readPaperInfo(docId: string) {
  return paperDocumentInfoSchema.parse(
    await catalogClient.read(catalog["paper.read"].name, {
      view: "info",
      docId,
    })
  )
}
