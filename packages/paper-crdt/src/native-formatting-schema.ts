import {
  BlockNoteSchema,
  createBlockSpec,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"

import { formattingStyles } from "./native-formatting-styles.js"
import { formattingProps } from "./native-formatting-props.js"

function render(): never {
  throw new Error("Private CV schema is headless")
}
const text = { default: "" } as const
const inline = { content: "inline", propSchema: formattingProps } as const
const owner = { content: "none", propSchema: {} } as const

export const nativeFormattingSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: createBlockSpec({ type: "paragraph", ...inline }, { render })(),
    heading: createBlockSpec(
      {
        type: "heading",
        content: "inline",
        propSchema: {
          ...formattingProps,
          level: { default: 2, values: [2, 3] },
        },
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
        propSchema: {
          ...formattingProps,
          ownerId: text,
          fieldKey: text,
          itemId: text,
        },
      },
      { render }
    )(),
  },
  styleSpecs: formattingStyles,
})
type Schema = typeof nativeFormattingSchema
export type PrivateFormattingEditor = BlockNoteEditor<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>
export type PrivateFormattingBlock = PartialBlock<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>
