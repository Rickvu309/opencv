import { formattingProps } from "./native-formatting-props.js"

const text = { default: "" } as const
const inline = { content: "inline", propSchema: formattingProps } as const
const owner = { content: "none", propSchema: {} } as const

export const formattingConfigs = {
  paragraph: { type: "paragraph", ...inline },
  heading: {
    type: "heading",
    content: "inline",
    propSchema: { ...formattingProps, level: { default: 2, values: [2, 3] } },
  },
  bulletListItem: { type: "bulletListItem", ...inline },
  numberedListItem: { type: "numberedListItem", ...inline },
  divider: { type: "divider", ...owner },
  paperCvHeader: {
    type: "paperCvHeader",
    content: "none",
    propSchema: { photo: text },
  },
  paperCvSection: {
    type: "paperCvSection",
    content: "none",
    propSchema: { kind: text },
  },
  paperCvExperience: { type: "paperCvExperience", ...owner },
  paperCvEducation: { type: "paperCvEducation", ...owner },
  paperCvSkills: { type: "paperCvSkills", ...owner },
  paperCvField: {
    type: "paperCvField",
    content: "inline",
    propSchema: {
      ...formattingProps,
      ownerId: text,
      fieldKey: text,
      itemId: text,
    },
  },
} as const

export const layoutConfigs = {
  paperPhoto: {
    type: "paperPhoto",
    content: "none",
    propSchema: { photo: text },
  },
  paperPageBreak: { type: "paperPageBreak", content: "none", propSchema: {} },
  paperFlowSection: {
    type: "paperFlowSection",
    content: "none",
    layoutOnly: true,
    propSchema: { settings: text },
    children: { allow: "blocks", exclude: ["paperFlow", "paperFlowSection"] },
  },
  paperFlow: {
    type: "paperFlow",
    content: "none",
    layoutOnly: true,
    propSchema: {},
    children: { allow: "blocks", exclude: ["paperFlow"] },
  },
  paperTable: {
    type: "paperTable",
    content: "none",
    layoutOnly: true,
    propSchema: { columns: text, borders: text },
    children: { allow: ["paperRow"], min: 1, dissolve: false },
  },
  paperRow: {
    type: "paperRow",
    content: "none",
    layoutOnly: true,
    placeable: "namedOnly",
    propSchema: {},
    children: { allow: ["paperCell"], min: 1, dissolve: false },
  },
  paperCell: {
    type: "paperCell",
    content: "none",
    layoutOnly: true,
    placeable: "namedOnly",
    propSchema: { columnId: text },
    children: { allow: "blocks", exclude: ["paperFlow", "paperTable"] },
  },
} as const

export const formattingStyleConfigs = {
  bold: { type: "bold", propSchema: "string" },
  italic: { type: "italic", propSchema: "string" },
  underline: { type: "underline", propSchema: "string" },
  strike: { type: "strike", propSchema: "string" },
  color: { type: "color", propSchema: "string" },
  highlight: { type: "highlight", propSchema: "string" },
  fontId: { type: "fontId", propSchema: "string" },
  size: { type: "size", propSchema: "string" },
  characterStyle: { type: "characterStyle", propSchema: "string" },
} as const
