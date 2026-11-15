import { flowDocumentSchema } from "@workspace/domain/internal/paper-presentation"
import { layoutFixture } from "./layout-fixture.js"

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
