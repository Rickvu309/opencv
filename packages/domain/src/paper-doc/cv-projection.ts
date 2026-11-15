import {
  nativeCvDocumentSchema,
  type NativeCvDocument,
  type CvBody,
  type CvOwner,
} from "./native-cv.js"
import type { CvField } from "./cv-fields.js"
import type { CvSectionKind, NodeId } from "./nodes.js"

export type CvProjection = {
  header: CvOwner
  leadingBody: (CvBody | CvOwner)[]
  sections: {
    id: NodeId
    kind: CvSectionKind
    title: CvField
    children: (CvBody | CvOwner)[]
  }[]
}

export function projectCvDocument(document: NativeCvDocument): CvProjection {
  const checked = nativeCvDocumentSchema.parse(document)
  const result: CvProjection = {
    header: checked.header,
    leadingBody: [],
    sections: [],
  }
  let children = result.leadingBody
  for (const block of checked.blocks) {
    if (block.type !== "section") children.push(block)
    else {
      const title = block.children[0]
      if (!title || title.type !== "cvField" || !block.kind)
        throw new Error("Invalid section occurrence")
      const section = {
        id: block.id,
        kind: block.kind,
        title,
        children: [] as (CvBody | CvOwner)[],
      }
      result.sections.push(section)
      children = section.children
    }
  }
  return result
}
