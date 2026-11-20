const blankHeaderFields = [
  "name",
  "headline",
  "email",
  "phone",
  "city",
  "linkedin",
] as const

export function emptyPaper(kind: "cv" | "letter") {
  return {
    version: 3 as const,
    kind,
    blocks: [
      {
        id: kind === "letter" ? "letter-1" : "paragraph-1",
        type: "paragraph" as const,
        content: [],
      },
    ],
    clashes: [],
  }
}

export function emptyRichPaper(kind: "cv" | "letter") {
  const page = {
    width: 12240,
    height: 15840,
    orientation: "portrait" as const,
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  }
  const header =
    kind === "cv"
      ? [
          {
            id: "header",
            type: "header" as const,
            children: blankHeaderFields.map((fieldKey) => ({
              id: `header-${fieldKey}`,
              type: "cvField" as const,
              ownerId: "header",
              fieldKey,
              paragraph: {},
              content: [],
            })),
          },
        ]
      : []
  return {
    version: 4 as const,
    schemaRevision: 2 as const,
    profile: "private-layout-3" as const,
    kind,
    presentation: {
      codecVersion: 1 as const,
      page,
      inline: { fontId: "liberation-serif", size: 240 },
      paragraph: {},
      styles: [],
    },
    flow: {
      id: "flow",
      type: "flow" as const,
      children: [
        {
          id: "section-1",
          type: "flowSection" as const,
          start: "continuous" as const,
          page,
          columns: { count: 1 as const, gap: 0 },
          children: [
            ...header,
            {
              id: kind === "letter" ? "letter-1" : "paragraph-1",
              type: "paragraph" as const,
              paragraph: {},
              content: [],
            },
          ],
        },
      ],
    },
  }
}
