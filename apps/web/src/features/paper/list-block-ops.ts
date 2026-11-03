import type {
  Block,
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core"

type AnyEditor = BlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>
type AnyBlock = Block<BlockSchema, InlineContentSchema, StyleSchema>

export const LIST_TYPES = new Set(["bulletListItem", "numberedListItem"])

export type BlockTarget = {
  type: string
  props?: Record<string, unknown>
}

export function selectedBlocks(source: object): AnyBlock[] {
  const editor = source as unknown as AnyEditor
  const picked = editor.getSelection()?.blocks
  if (picked && picked.length > 0) return picked
  return [editor.getTextCursorPosition().block]
}

function isNestedList(editor: AnyEditor, block: AnyBlock) {
  return (
    LIST_TYPES.has(block.type) && editor.getParentBlock(block) !== undefined
  )
}

export function isNestedListItem(source: object): boolean {
  const editor = source as unknown as AnyEditor
  return selectedBlocks(editor).some((block) => isNestedList(editor, block))
}

export function convertListParent(
  source: object,
  block: AnyBlock,
  target: BlockTarget
) {
  const editor = source as unknown as AnyEditor
  const kids = block.children
  editor.transact(() => {
    editor.removeBlocks(kids)
    editor.updateBlock(block, {
      type: target.type,
      props: target.props ?? {},
    } as never)
    if (kids.length > 0) editor.insertBlocks(kids as never, block, "after")
  })
  editor.setTextCursorPosition(block, "start")
}

function changeOne(editor: AnyEditor, block: AnyBlock, target: BlockTarget) {
  const toList = LIST_TYPES.has(target.type)
  if (LIST_TYPES.has(block.type) && !toList) {
    if (editor.getParentBlock(block)) return false
    if (block.children.length > 0) {
      convertListParent(editor, block, target)
      return true
    }
  }
  editor.updateBlock(block, {
    type: target.type,
    props: target.props ?? {},
  } as never)
  return true
}

export function changeBlockType(source: object, target: BlockTarget) {
  const editor = source as unknown as AnyEditor
  const ids = selectedBlocks(editor).map((block) => block.id)
  let changed = false
  editor.transact(() => {
    for (const id of ids) {
      const live = editor.getBlock(id)
      if (live && changeOne(editor, live, target)) changed = true
    }
  })
  return changed
}

export function backspaceAtListStart(source: object): boolean {
  const editor = source as unknown as AnyEditor
  const { selection } = editor.prosemirrorState
  if (!selection.empty || selection.$from.parentOffset !== 0) return false
  const block = editor.getTextCursorPosition().block
  if (!LIST_TYPES.has(block.type)) return false
  if (editor.getParentBlock(block)) {
    editor.unnestBlock()
    return true
  }
  if (block.children.length === 0) return false
  convertListParent(editor, block, { type: "paragraph" })
  return true
}
