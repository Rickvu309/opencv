import { flowDocumentSchema } from "@workspace/domain/internal/paper-presentation"
import { cvSlots, richPaperDocumentSchema } from "@workspace/domain/paper-doc"
import { layoutFixture } from "./layout-fixture.js"
import { photoFixture } from "./photo-fixture.js"

export function flowFixture() {
  const base = layoutFixture()
  return flowDocumentSchema.parse({
    ...base,
    profile: "private-layout-3",
    flow: {
      ...base.flow,
      children: [
        {
          id: "section-1",
          type: "flowSection",
          start: "continuous",
          page: base.presentation.page,
          columns: { count: 1, gap: 360 },
          children: base.flow.children,
        },
      ],
    },
  })
}

export function storedFlowFixture(kind: "cv" | "letter" = "letter") {
  const flow = flowFixture()
  const section = flow.flow.children[0]!
  const header = {
    id: "header",
    type: "header",
    children: cvSlots.header.map((fieldKey) => ({
      id: `header-${fieldKey}`,
      type: "cvField",
      ownerId: "header",
      fieldKey,
      paragraph: {},
      content: [
        { text: fieldKey === "name" ? "Linh 😀" : "", bold: true },
      ].filter((run) => run.text),
    })),
  }
  return richPaperDocumentSchema.parse({
    ...flow,
    version: 4,
    schemaRevision: 2,
    kind,
    flow: {
      ...flow.flow,
      children: [
        {
          ...section,
          children: [
            ...(kind === "cv" ? [header] : []),
            ...section.children,
            { id: "break", type: "pageBreak" },
            photoFixture(),
          ],
        },
      ],
    },
  })
}
