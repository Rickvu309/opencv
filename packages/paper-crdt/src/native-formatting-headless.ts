import {
  BlockNoteSchema,
  createBlockSpec,
  createStyleSpec,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"
import {
  formattingConfigs as block,
  layoutConfigs as layout,
  formattingStyleConfigs as style,
} from "./native-formatting-config.js"

const implementation = {
  render(): never {
    throw new Error("The storage schema never renders")
  },
}
const layoutImplementation = {
  renderFrame(): never {
    throw new Error("The storage schema never renders")
  },
  meta: { isolating: true, draggable: false },
  experimental_keyboard: { emptyChildEnter: "stay" },
} as const
const styleSpecs = {
  bold: createStyleSpec(style.bold, implementation),
  italic: createStyleSpec(style.italic, implementation),
  underline: createStyleSpec(style.underline, implementation),
  strike: createStyleSpec(style.strike, implementation),
  color: createStyleSpec(style.color, implementation),
  highlight: createStyleSpec(style.highlight, implementation),
  fontId: createStyleSpec(style.fontId, implementation),
  size: createStyleSpec(style.size, implementation),
  characterStyle: createStyleSpec(style.characterStyle, implementation),
}
const blockSpecs = {
  paragraph: createBlockSpec(block.paragraph, implementation)(),
  heading: createBlockSpec(block.heading, implementation)(),
  bulletListItem: createBlockSpec(block.bulletListItem, implementation)(),
  numberedListItem: createBlockSpec(block.numberedListItem, implementation)(),
  divider: createBlockSpec(block.divider, implementation)(),
  paperCvHeader: createBlockSpec(block.paperCvHeader, implementation)(),
  paperCvSection: createBlockSpec(block.paperCvSection, implementation)(),
  paperCvExperience: createBlockSpec(block.paperCvExperience, implementation)(),
  paperCvEducation: createBlockSpec(block.paperCvEducation, implementation)(),
  paperCvSkills: createBlockSpec(block.paperCvSkills, implementation)(),
  paperCvField: createBlockSpec(block.paperCvField, implementation)(),
}
export const headlessFormattingSchema = BlockNoteSchema.create({
  blockSpecs,
  styleSpecs,
})
export const headlessLayoutSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...blockSpecs,
    paperPhoto: createBlockSpec(layout.paperPhoto, implementation)(),
    paperPageBreak: createBlockSpec(layout.paperPageBreak, implementation)(),
    paperFlow: createBlockSpec(layout.paperFlow, layoutImplementation)(),
    paperFlowSection: createBlockSpec(
      layout.paperFlowSection,
      layoutImplementation
    )(),
    paperTable: createBlockSpec(layout.paperTable, layoutImplementation)(),
    paperRow: createBlockSpec(layout.paperRow, layoutImplementation)(),
    paperCell: createBlockSpec(layout.paperCell, layoutImplementation)(),
  },
  styleSpecs,
})
type Formatting = typeof headlessFormattingSchema
type Layout = typeof headlessLayoutSchema
export type HeadlessFormattingEditor = BlockNoteEditor<
  Formatting["blockSchema"],
  Formatting["inlineContentSchema"],
  Formatting["styleSchema"]
>
export type HeadlessFormattingBlock = PartialBlock<
  Formatting["blockSchema"],
  Formatting["inlineContentSchema"],
  Formatting["styleSchema"]
>
export type HeadlessLayoutEditor = BlockNoteEditor<
  Layout["blockSchema"],
  Layout["inlineContentSchema"],
  Layout["styleSchema"]
>
export type HeadlessLayoutBlock = PartialBlock<
  Layout["blockSchema"],
  Layout["inlineContentSchema"],
  Layout["styleSchema"]
>
