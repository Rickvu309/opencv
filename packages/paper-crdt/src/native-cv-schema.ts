import {
  BlockNoteSchema,
  createBlockSpec,
  defaultStyleSpecs,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"

function render(): never {
  throw new Error("Private CV schema is headless")
}
const text = { default: "" } as const
const inline = { content: "inline", propSchema: {} } as const
const owner = { content: "none", propSchema: {} } as const

export const nativeCvSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: createBlockSpec({ type: "paragraph", ...inline }, { render })(),
    heading: createBlockSpec(
      {
        type: "heading",
        content: "inline",
        propSchema: { level: { default: 2, values: [2, 3] } },
      },
      { render }
    )(),
    bulletListItem: createBlockSpec(
      { type: "bulletListItem", ...inline },
      { render }
    )(),
    numberedListItem: createBlockSpec(
      { type: "numberedListItem", ...inline },
      { render }
    )(),
    divider: createBlockSpec({ type: "divider", ...owner }, { render })(),
    paperCvHeader: createBlockSpec(
      { type: "paperCvHeader", content: "none", propSchema: { photo: text } },
      { render }
    )(),
    paperCvSection: createBlockSpec(
      { type: "paperCvSection", content: "none", propSchema: { kind: text } },
      { render }
    )(),
    paperCvExperience: createBlockSpec(
      { type: "paperCvExperience", ...owner },
      { render }
    )(),
    paperCvEducation: createBlockSpec(
      { type: "paperCvEducation", ...owner },
      { render }
    )(),
    paperCvSkills: createBlockSpec(
      { type: "paperCvSkills", ...owner },
      { render }
    )(),
    paperCvField: createBlockSpec(
      {
        type: "paperCvField",
        content: "inline",
        propSchema: { ownerId: text, fieldKey: text, itemId: text },
      },
      { render }
    )(),
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
  },
})
type Schema = typeof nativeCvSchema
export type NativeCvEditor = BlockNoteEditor<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>
export type NativeCvPartialBlock = PartialBlock<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>
