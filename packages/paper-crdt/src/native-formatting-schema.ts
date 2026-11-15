import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"

import { formattingStyles } from "./native-formatting-styles.js"
import { engineProps, formattingProps } from "./native-formatting-props.js"
import { renderFormattingBlock as render } from "./native-formatting-render.js"
const text = { default: "" } as const
const inline = { content: "inline", propSchema: formattingProps } as const
const owner = { content: "none", propSchema: {} } as const
function paragraphFromHTML(element: HTMLElement) {
  const alignment = element.style.textAlign
  return alignment === "left" ||
    alignment === "center" ||
    alignment === "right" ||
    alignment === "justify"
    ? engineProps({ alignment })
    : {}
}

export const nativeFormattingSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: createBlockSpec(
      { type: "paragraph", ...inline },
      {
        render,
        parse: (element) =>
          element.tagName === "P" ? paragraphFromHTML(element) : undefined,
      }
    )(),
    heading: createBlockSpec(
      {
        type: "heading",
        content: "inline",
        propSchema: {
          ...formattingProps,
          level: { default: 2, values: [2, 3] },
        },
      },
      {
        render,
        parse: (element) =>
          /^H[1-6]$/.test(element.tagName)
            ? {
                ...paragraphFromHTML(element),
                level: Number(element.tagName[1]) <= 2 ? 2 : 3,
              }
            : undefined,
      }
    )(),
    bulletListItem: createBlockSpec(
      { type: "bulletListItem", ...inline },
      {
        render,
        parse: (element) =>
          element.tagName === "LI" &&
          element.closest("ul, ol")?.tagName === "UL"
            ? paragraphFromHTML(element)
            : undefined,
        parseContent:
          defaultBlockSpecs.bulletListItem.implementation.parseContent,
      }
    )(),
    numberedListItem: createBlockSpec(
      { type: "numberedListItem", ...inline },
      {
        render,
        parse: (element) =>
          element.tagName === "LI" &&
          element.closest("ul, ol")?.tagName === "OL"
            ? paragraphFromHTML(element)
            : undefined,
        parseContent:
          defaultBlockSpecs.numberedListItem.implementation.parseContent,
      }
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
