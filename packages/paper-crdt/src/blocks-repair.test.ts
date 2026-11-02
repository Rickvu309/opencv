import { describe, expect, it } from "vitest"

import { repairBlocks } from "./blocks-repair.js"

const text = (value: string) => [{ type: "text", text: value, styles: {} }]

describe("repairBlocks", () => {
  it("moves the header first and keeps the words of an extra header", () => {
    const { blocks, repaired } = repairBlocks("cv", [
      { id: "p", type: "paragraph", content: text("Hi"), children: [] },
      {
        id: "header",
        type: "paperHeader",
        props: { name: "Ada" },
        children: [],
      },
      { id: "h2", type: "paperHeader", props: { name: "Grace" }, children: [] },
    ])
    expect(repaired).toBe(true)
    expect(blocks.map((b) => b.type)).toEqual([
      "paperHeader",
      "paragraph",
      "paragraph",
    ])
    expect(JSON.stringify(blocks)).toContain("Grace")
  })

  it("adds a blank header when none is left", () => {
    const { blocks } = repairBlocks("cv", [
      { id: "p", type: "paragraph", content: text("Hi"), children: [] },
    ])
    expect(blocks[0]).toMatchObject({ id: "header", type: "paperHeader" })
  })

  it("lifts what a block cannot hold to a sibling after it", () => {
    const { blocks } = repairBlocks("letter", [
      {
        id: "l1",
        type: "bulletListItem",
        content: text("One"),
        children: [
          { id: "x", type: "paragraph", content: text("Stray"), children: [] },
          {
            id: "l2",
            type: "bulletListItem",
            content: text("Two"),
            children: [],
          },
        ],
      },
      {
        id: "p",
        type: "paragraph",
        content: text("Own"),
        children: [
          { id: "c", type: "paragraph", content: text("Kid"), children: [] },
        ],
      },
    ])
    expect(blocks.map((b) => b.id)).toEqual(["l1", "x", "p", "c"])
    expect(blocks[0]!.children!.map((b) => b.id)).toEqual(["l2"])
    expect(blocks[2]!.children).toEqual([])
  })

  it("turns a skill item outside skills into a paragraph", () => {
    const { blocks } = repairBlocks("letter", [
      { id: "s", type: "paperSkillItem", content: text("Go"), children: [] },
    ])
    expect(blocks[0]).toMatchObject({ type: "paragraph" })
  })
})
