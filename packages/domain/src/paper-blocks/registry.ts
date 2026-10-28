import type { ZodType } from "zod"

import { bulletedListBlock } from "./blocks/bulleted-list.js"
import { dividerBlock } from "./blocks/divider.js"
import { educationEntryBlock } from "./blocks/education-entry.js"
import { experienceEntryBlock } from "./blocks/experience-entry.js"
import { headingBlock } from "./blocks/heading.js"
import { numberedListBlock } from "./blocks/numbered-list.js"
import { skillsGroupBlock } from "./blocks/skills-group.js"
import { textBlock } from "./blocks/text.js"
import type {
  BlockRegistryEntry,
  BlockShape,
  BlockType,
  PreviewFragment,
} from "./types.js"

type RawEntry<T extends BlockShape> = {
  type: T["type"]
  schema: ZodType<T>
  empty: () => T
  slash?: BlockRegistryEntry["slash"]
  print: (block: T) => PreviewFragment
  plainText: (block: T) => string
  turnInto: readonly BlockType[]
}

function defineBlock<const T extends BlockShape>(
  entry: RawEntry<T>
): RawEntry<T> & BlockRegistryEntry {
  return {
    type: entry.type,
    schema: entry.schema as ZodType<T> & ZodType<BlockShape>,
    empty: () => entry.empty(),
    slash: entry.slash,
    print: (block) => entry.print(block as T),
    plainText: (block) => entry.plainText(block as T),
    turnInto: entry.turnInto,
  }
}

export const blockRegistry: readonly BlockRegistryEntry[] = [
  defineBlock(textBlock),
  defineBlock(headingBlock),
  defineBlock(bulletedListBlock),
  defineBlock(numberedListBlock),
  defineBlock(dividerBlock),
  defineBlock(experienceEntryBlock),
  defineBlock(educationEntryBlock),
  defineBlock(skillsGroupBlock),
]

export const BLOCK_TYPES: readonly BlockType[] = blockRegistry.map(
  (entry) => entry.type
)

const byType = new Map(blockRegistry.map((entry) => [entry.type, entry]))

export function blockEntry(type: BlockType): BlockRegistryEntry {
  const entry = byType.get(type)
  if (!entry) throw new Error(`Unknown block type ${type}`)
  return entry
}

export function printBlock(block: BlockShape): PreviewFragment {
  return blockEntry(block.type).print(block)
}

export function plainTextOf(block: BlockShape): string {
  return blockEntry(block.type).plainText(block)
}
