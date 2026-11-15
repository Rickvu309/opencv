import {
  BlockNoteSchema,
  createBlockSpec,
  createBulletListItemBlockConfig,
  createDividerBlockConfig,
  createHeadingBlockConfig,
  createHeadingBlockSpec,
  createNumberedListItemBlockConfig,
  createParagraphBlockConfig,
  defaultBlockSpecs,
  defaultStyleSpecs,
  type Block,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"

const text = (name: string) => ({ [name]: { default: "" } })

export const paperBlockConfigs = {
  paragraph: createParagraphBlockConfig(),
  heading: createHeadingBlockConfig({ levels: [2, 3], defaultLevel: 2 }),
  bulletListItem: createBulletListItemBlockConfig(),
  numberedListItem: createNumberedListItemBlockConfig(),
  divider: createDividerBlockConfig(),
  paperHeader: {
    type: "paperHeader",
    content: "none",
    propSchema: {
      ...text("name"),
      ...text("email"),
      ...text("phone"),
      ...text("city"),
      ...text("linkedin"),
      ...text("photo"),
    },
  },
  paperSection: {
    type: "paperSection",
    content: "inline",
    propSchema: {
      kind: {
        default: "summary",
        values: [
          "summary",
          "experience",
          "education",
          "skills",
          "projects",
          "activities",
          "awards",
          "languages",
        ],
      },
    },
  },
  paperExperience: {
    type: "paperExperience",
    content: "none",
    propSchema: {
      ...text("role"),
      ...text("company"),
      ...text("period"),
      ...text("location"),
    },
  },
  paperEducation: {
    type: "paperEducation",
    content: "none",
    propSchema: {
      ...text("school"),
      ...text("degree"),
      ...text("period"),
      ...text("detail"),
    },
  },
  paperSkills: {
    type: "paperSkills",
    content: "none",
    propSchema: { ...text("label") },
  },
  paperSkillItem: {
    type: "paperSkillItem",
    content: "inline",
    propSchema: {},
  },
} as const

function headlessRender(): never {
  throw new Error("The server schema never renders")
}

const paperBlockSpecs = {
  paragraph: defaultBlockSpecs.paragraph,
  heading: createHeadingBlockSpec({ levels: [2, 3], defaultLevel: 2 }),
  bulletListItem: defaultBlockSpecs.bulletListItem,
  numberedListItem: defaultBlockSpecs.numberedListItem,
  divider: defaultBlockSpecs.divider,
  paperHeader: createBlockSpec(paperBlockConfigs.paperHeader, {
    render: headlessRender,
  })(),
  paperSection: createBlockSpec(paperBlockConfigs.paperSection, {
    render: headlessRender,
  })(),
  paperExperience: createBlockSpec(paperBlockConfigs.paperExperience, {
    render: headlessRender,
  })(),
  paperEducation: createBlockSpec(paperBlockConfigs.paperEducation, {
    render: headlessRender,
  })(),
  paperSkills: createBlockSpec(paperBlockConfigs.paperSkills, {
    render: headlessRender,
  })(),
  paperSkillItem: createBlockSpec(paperBlockConfigs.paperSkillItem, {
    render: headlessRender,
  })(),
}

export const paperSchema = BlockNoteSchema.create({
  blockSpecs: paperBlockSpecs,
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
  },
})

export const nativePaperSchema = BlockNoteSchema.create({
  blockSpecs: paperBlockSpecs,
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
  },
})

type Schema = typeof paperSchema
type PaperBlockSchema = Schema["blockSchema"]
type PaperInlineSchema = Schema["inlineContentSchema"]
type PaperStyleSchema = Schema["styleSchema"]
export type PaperEditor = BlockNoteEditor<
  PaperBlockSchema,
  PaperInlineSchema,
  PaperStyleSchema
>
export type PaperEditorBlock = Block<
  PaperBlockSchema,
  PaperInlineSchema,
  PaperStyleSchema
>
export type PaperPartialBlock = PartialBlock<
  PaperBlockSchema,
  PaperInlineSchema,
  PaperStyleSchema
>

export const letterSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({ levels: [2, 3], defaultLevel: 2 }),
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    divider: defaultBlockSpecs.divider,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
  },
})

export const nativeLetterSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({ levels: [2, 3], defaultLevel: 2 }),
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    divider: defaultBlockSpecs.divider,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
  },
})
