import { Schema, type NodeSpec, type MarkSpec } from "prosemirror-model"

const blockId = { id: { default: "", validate: "string" } }

const textBlockAttrs = {
  ...blockId,
  kind: { default: "paragraph" },
  list: { default: null },
  level: { default: 0 },
  align: { default: "left" },
  lineSpacing: { default: null },
  keepWithNext: { default: null },
  rightTabMpt: { default: null },
}

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: "block+",
    attrs: { schema: { default: 1 }, page: {}, template: {} },
  },
  text_block: {
    group: "block",
    content: "inline*",
    marks: "_",
    attrs: textBlockAttrs,
  },
  image: {
    group: "block",
    atom: true,
    attrs: {
      ...blockId,
      fileId: {},
      widthMpt: {},
      heightMpt: {},
      align: { default: "left" },
      alt: { default: "" },
    },
  },
  table: {
    group: "block",
    content: "table_row+",
    isolating: true,
    attrs: { ...blockId, columnsMpt: {}, borders: { default: "none" } },
  },
  table_row: { content: "table_cell+", isolating: true },
  table_cell: { content: "inline*", marks: "_", isolating: true },
  divider: { group: "block", atom: true, attrs: blockId },
  page_break: { group: "block", atom: true, attrs: blockId },
  text: { group: "inline" },
  hard_break: { group: "inline", inline: true },
}

const marks: Record<string, MarkSpec> = {
  bold: {},
  italic: {},
  underline: {},
  strike: {},
  link: { attrs: { href: { validate: "string" } }, inclusive: false },
  color: { attrs: { value: { validate: "string" } } },
  font: { attrs: { family: { validate: "string" } } },
  size: { attrs: { mpt: { validate: "number" } } },
}

export const paperSchema = new Schema({ nodes, marks, topNode: "doc" })
