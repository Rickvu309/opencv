import { blankCv, paperNodeSpecs, paperDocumentSchema } from "@workspace/domain"

export function structuredCv() {
  const paper = paperDocumentSchema.parse({
    ...blankCv(),
    header: paperNodeSpecs.header.blank(),
    blocks: (["experience", "education", "skills"] as const).map((kind) => ({
      id: `section-${kind}`,
      type: "section",
      kind,
      title: kind[0].toUpperCase() + kind.slice(1),
    })),
  })
  if (paper.kind !== "cv") throw new Error("Expected CV fixture")
  return paper
}
