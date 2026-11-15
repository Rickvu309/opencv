import { cvSlots } from "@workspace/domain"

export function presentation() {
  return {
    codecVersion: 1,
    page: {
      width: 11906,
      height: 16838,
      orientation: "portrait",
      top: 1134,
      end: 1134,
      bottom: 1134,
      start: 1134,
    },
    inline: {},
    paragraph: {},
    styles: [],
  }
}

export function paragraph(id: string, text = id, values = {}) {
  return {
    id,
    type: "paragraph",
    content: text ? [{ text }] : [],
    paragraph: values,
  }
}

export function letter(
  blocks: unknown[] = [paragraph("first")],
  appearance: unknown = presentation()
) {
  return {
    profile: "private-formatting-1",
    kind: "letter",
    presentation: appearance,
    blocks,
  }
}

export function owner(type: keyof typeof cvSlots, id: string) {
  return {
    id,
    type,
    ...(type === "section" ? { kind: "experience" } : {}),
    children: cvSlots[type].map((fieldKey) => ({
      id: `${id}-${fieldKey}`,
      type: "cvField",
      ownerId: id,
      fieldKey,
      content: fieldKey === "phone" ? [] : [{ text: `${id} ${fieldKey} Việt` }],
      paragraph: {},
    })),
  }
}

export function cv() {
  return {
    profile: "private-formatting-1",
    kind: "cv",
    presentation: presentation(),
    header: owner("header", "contact"),
    blocks: [
      owner("section", "career"),
      {
        ...owner("experience", "work"),
        children: [
          ...owner("experience", "work").children,
          paragraph("work-body"),
        ],
      },
      owner("education", "study"),
      {
        ...owner("skills", "skills"),
        children: [
          ...owner("skills", "skills").children,
          {
            id: "skills-item-field",
            type: "cvField",
            ownerId: "skills",
            fieldKey: "item",
            itemId: "skills-item",
            content: [{ text: "TypeScript & Vietnamese" }],
            paragraph: {},
          },
        ],
      },
    ],
  }
}
