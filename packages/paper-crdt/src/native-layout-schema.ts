import { layoutConfigs } from "./native-formatting-config.js"
import {
  BlockNoteSchema,
  createBlockSpec,
  type BlockNoteEditor,
  type PartialBlock,
} from "@blocknote/core"
import { photoBlockSpec } from "./native-photo-render.js"
import { nativeFormattingSchema } from "./native-formatting-schema.js"
import { formattingStyles } from "./native-formatting-styles.js"

function frame(block: { id: string; type: string }) {
  const dom = document.createElement("div")
  const slot = document.createElement("div")
  dom.dataset.paperLayout = block.type
  dom.dataset.paperId = block.id
  if (["paperFlow", "paperCell", "paperFlowSection"].includes(block.type)) {
    slot.dataset.paperWrapSlot = ""
    const style = document.createElement("style")
    const scope =
      '[data-paper-wrap-slot]:has(> [data-paper-photo-placement="wrap"]) > [data-node-type="blockOuter"]'
    const text =
      '.bn-block-content:is([data-content-type="paragraph"],[data-content-type="heading"])'
    style.textContent = `${scope}:has(> .bn-block > ${text}),${scope} > .bn-block:has(> ${text}),${scope} > .bn-block > ${text}{display:block}`
    dom.append(style)
  }
  if (block.type === "paperTable") {
    dom.style.width = "var(--paper-table-width)"
    dom.style.maxWidth = "100%"
  }
  if (block.type === "paperRow") {
    slot.style.display = "grid"
    slot.style.gridAutoFlow = "column"
    slot.style.gridAutoColumns = "minmax(0, 1fr)"
    slot.style.gridTemplateColumns = "var(--paper-table-columns)"
  }
  if (block.type === "paperCell") {
    slot.style.boxSizing = "border-box"
    slot.style.minWidth = "0"
    slot.style.overflowWrap = "anywhere"
    slot.style.padding = "6pt"
    slot.style.boxShadow = "inset 0 0 0 1px var(--border)"
  }
  dom.append(slot)
  return { dom, slot }
}
const implementation = {
  meta: { isolating: true, draggable: false },
  experimental_keyboard: { emptyChildEnter: "stay" },
  renderFrame: frame,
} as const
export const nativeLayoutSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...nativeFormattingSchema.blockSpecs,
    paperPhoto: photoBlockSpec,
    paperPageBreak: createBlockSpec(layoutConfigs.paperPageBreak, {
      render() {
        const dom = document.createElement("div")
        dom.dataset.paperPageBreak = ""
        dom.setAttribute("aria-label", "Page break")
        dom.setAttribute("role", "separator")
        return { dom }
      },
    })(),
    paperFlowSection: createBlockSpec(
      layoutConfigs.paperFlowSection,
      implementation
    )(),
    paperFlow: createBlockSpec(layoutConfigs.paperFlow, implementation)(),
    paperTable: createBlockSpec(layoutConfigs.paperTable, implementation)(),
    paperRow: createBlockSpec(layoutConfigs.paperRow, implementation)(),
    paperCell: createBlockSpec(layoutConfigs.paperCell, implementation)(),
  },
  styleSpecs: formattingStyles,
})
type Schema = typeof nativeLayoutSchema
export type PrivateLayoutEditor = BlockNoteEditor<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>
export type PrivateLayoutBlock = PartialBlock<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>
