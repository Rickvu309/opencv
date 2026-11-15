import { formattingConfigs } from "./native-formatting-config.js"
import {
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"

import { formattingStyles } from "./native-formatting-styles.js"
import { engineProps } from "./native-formatting-props.js"
import { renderFormattingBlock as render } from "./native-formatting-render.js"
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
    paragraph: createBlockSpec(formattingConfigs.paragraph, {
      render,
      parse: (element) =>
        element.tagName === "P" ? paragraphFromHTML(element) : undefined,
    })(),
    heading: createBlockSpec(formattingConfigs.heading, {
      render,
      parse: (element) =>
        /^H[1-6]$/.test(element.tagName)
          ? {
              ...paragraphFromHTML(element),
              level: Number(element.tagName[1]) <= 2 ? 2 : 3,
            }
          : undefined,
    })(),
    bulletListItem: createBlockSpec(formattingConfigs.bulletListItem, {
      render,
      parse: (element) =>
        element.tagName === "LI" && element.closest("ul, ol")?.tagName === "UL"
          ? paragraphFromHTML(element)
          : undefined,
      parseContent:
        defaultBlockSpecs.bulletListItem.implementation.parseContent,
    })(),
    numberedListItem: createBlockSpec(formattingConfigs.numberedListItem, {
      render,
      parse: (element) =>
        element.tagName === "LI" && element.closest("ul, ol")?.tagName === "OL"
          ? paragraphFromHTML(element)
          : undefined,
      parseContent:
        defaultBlockSpecs.numberedListItem.implementation.parseContent,
    })(),
    divider: createBlockSpec(formattingConfigs.divider, { render })(),
    paperCvHeader: createBlockSpec(formattingConfigs.paperCvHeader, {
      render,
    })(),
    paperCvSection: createBlockSpec(formattingConfigs.paperCvSection, {
      render,
    })(),
    paperCvExperience: createBlockSpec(formattingConfigs.paperCvExperience, {
      render,
    })(),
    paperCvEducation: createBlockSpec(formattingConfigs.paperCvEducation, {
      render,
    })(),
    paperCvSkills: createBlockSpec(formattingConfigs.paperCvSkills, {
      render,
    })(),
    paperCvField: createBlockSpec(formattingConfigs.paperCvField, { render })(),
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
