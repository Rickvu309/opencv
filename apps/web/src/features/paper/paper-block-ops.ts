import {
  blankBlockDocument,
  blockRegistry,
  cvCodecToBlocks,
  isCvBlockDocument,
  isCvDocument,
  plainTextOf,
  type BlockType,
  type CvBlock,
  type CvBlockDocument,
  type CvSectionKind,
} from "@workspace/domain"

const KEEPERS = new Set<CvSectionKind>(["experience", "education", "skills"])
const STARTERS = ["experience", "education", "skills"] as const

export function newId() {
  return crypto.randomUUID()
}

export function readEditorDocument(document: unknown): CvBlockDocument {
  if (isCvBlockDocument(document)) return document
  if (isCvDocument(document)) return cvCodecToBlocks(document)
  return blankBlockDocument()
}

export function editorSections(document: CvBlockDocument) {
  const seen = new Set(document.sections.map((section) => section.kind))
  const sections = document.sections.slice()
  for (const kind of STARTERS) {
    if (!seen.has(kind)) {
      sections.push({ id: `ghost-${kind}`, kind, blocks: [] })
    }
  }
  return sections
}

export function isStarterKind(kind: CvSectionKind) {
  return KEEPERS.has(kind)
}

function prune(document: CvBlockDocument): CvBlockDocument {
  return {
    ...document,
    sections: document.sections.filter(
      (section) => section.blocks.length > 0 || KEEPERS.has(section.kind)
    ),
  }
}

function withBlock(
  document: CvBlockDocument,
  blockId: string,
  next: CvBlock | null
): CvBlockDocument {
  return prune({
    ...document,
    sections: document.sections.map((section) => {
      if (!section.blocks.some((block) => block.id === blockId)) return section
      const blocks = next
        ? section.blocks.map((block) => (block.id === blockId ? next : block))
        : section.blocks.filter((block) => block.id !== blockId)
      return { ...section, blocks }
    }),
  })
}

export function patchHeader(
  document: CvBlockDocument,
  key: "name" | "email" | "phone" | "city" | "linkedin",
  value: string
): CvBlockDocument {
  return { ...document, header: { ...document.header, [key]: value } }
}

export function patchBlock(
  document: CvBlockDocument,
  block: CvBlock
): CvBlockDocument {
  return withBlock(document, block.id, block)
}

export const blockMakers: Record<BlockType, () => CvBlock> = Object.fromEntries(
  blockRegistry.map((entry) => [entry.type, () => entry.empty()])
) as Record<BlockType, () => CvBlock>

function withPlainText(block: CvBlock, text: string): CvBlock {
  if (!text) return block
  if (block.type === "text" || block.type === "heading") return { ...block, text }
  if (block.type === "bulleted-list" || block.type === "numbered-list") {
    return { ...block, items: [{ id: newId(), text }] }
  }
  if (block.type === "experience-entry") return { ...block, role: text }
  if (block.type === "education-entry") return { ...block, school: text }
  if (block.type === "skills-group") return { ...block, items: [text] }
  return block
}

export function blockMakerKeys() {
  return blockRegistry.map((entry) => entry.type)
}

export function blockFromPlain(
  type: BlockType,
  id: string,
  text: string
): CvBlock {
  return withPlainText({ ...blockMakers[type](), id }, text)
}

export function placeBlock(
  document: CvBlockDocument,
  sectionId: string,
  kind: CvSectionKind,
  block: CvBlock
): CvBlockDocument {
  if (!document.sections.some((section) => section.id === sectionId)) {
    return {
      ...document,
      sections: [...document.sections, { id: newId(), kind, blocks: [block] }],
    }
  }
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId
        ? { ...section, blocks: [...section.blocks, block] }
        : section
    ),
  }
}

export function insertSection(
  document: CvBlockDocument,
  afterSectionId: string | null,
  kind: CvSectionKind
): CvBlockDocument {
  const section = {
    id: newId(),
    kind,
    blocks: [blockFromPlain("text", newId(), "")],
  }
  const index = document.sections.findIndex(
    (item) => item.id === afterSectionId
  )
  const at = index < 0 ? document.sections.length : index + 1
  const sections = document.sections.slice()
  sections.splice(at, 0, section)
  return { ...document, sections }
}

function mapTo(
  document: CvBlockDocument,
  blockId: string,
  change: (block: CvBlock) => CvBlock
): CvBlockDocument {
  const current = document.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.id === blockId)
  if (!current) return document
  return withBlock(document, blockId, change(current))
}

export function replaceBlock(
  document: CvBlockDocument,
  blockId: string,
  type: BlockType
): CvBlockDocument {
  return mapTo(document, blockId, (block) =>
    blockFromPlain(type, block.id, plainTextOf(block))
  )
}

function cloneBlock(block: CvBlock): CvBlock {
  const copy = structuredClone(block) as CvBlock & {
    bullets?: { id: string; text: string }[]
    items?: ({ id: string; text: string } | string)[]
  }
  copy.id = newId()
  if (copy.bullets) {
    copy.bullets = copy.bullets.map((bullet) => ({ ...bullet, id: newId() }))
  }
  if (Array.isArray(copy.items) && typeof copy.items[0] === "object") {
    copy.items = copy.items.map((item) =>
      typeof item === "string" ? item : { ...item, id: newId() }
    )
  }
  return copy
}

export function duplicateBlock(
  document: CvBlockDocument,
  blockId: string
): CvBlockDocument {
  return {
    ...document,
    sections: document.sections.map((section) => {
      const index = section.blocks.findIndex((block) => block.id === blockId)
      if (index < 0) return section
      const blocks = section.blocks.slice()
      const source = section.blocks[index]
      if (!source) return section
      blocks.splice(index + 1, 0, cloneBlock(source))
      return { ...section, blocks }
    }),
  }
}

function reorder<T>(items: T[], from: number, to: number) {
  const next = items.slice()
  const [item] = next.splice(from, 1)
  if (item === undefined) return items
  next.splice(to, 0, item)
  return next
}

export function moveBlock(
  document: CvBlockDocument,
  blockId: string,
  direction: -1 | 1
): CvBlockDocument {
  return {
    ...document,
    sections: document.sections.map((section) => {
      const index = section.blocks.findIndex((block) => block.id === blockId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= section.blocks.length) {
        return section
      }
      return { ...section, blocks: reorder(section.blocks, index, target) }
    }),
  }
}

export function deleteBlock(
  document: CvBlockDocument,
  blockId: string
): CvBlockDocument {
  return withBlock(document, blockId, null)
}

function sectionOf(document: CvBlockDocument, blockId: string) {
  return document.sections.find((section) =>
    section.blocks.some((block) => block.id === blockId)
  )
}

export function dropBlock(
  document: CvBlockDocument,
  activeId: string,
  overId: string
): CvBlockDocument {
  if (!overId || activeId === overId) return document
  const from = sectionOf(document, activeId)
  const block = from?.blocks.find((item) => item.id === activeId)
  if (!from || !block) return document

  if (!overId.startsWith("section:")) {
    const overSection = sectionOf(document, overId)
    if (overSection?.id === from.id) {
      const oldIndex = from.blocks.findIndex((item) => item.id === activeId)
      const newIndex = from.blocks.findIndex((item) => item.id === overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return document
      return {
        ...document,
        sections: document.sections.map((section) =>
          section.id === from.id
            ? { ...section, blocks: reorder(section.blocks, oldIndex, newIndex) }
            : section
        ),
      }
    }
  }

  const stripped = prune({
    ...document,
    sections: document.sections.map((section) =>
      section.id === from.id
        ? {
            ...section,
            blocks: section.blocks.filter((item) => item.id !== activeId),
          }
        : section
    ),
  })

  if (overId.startsWith("section:ghost-")) {
    const kind = overId.slice("section:ghost-".length) as CvSectionKind
    return {
      ...stripped,
      sections: [...stripped.sections, { id: newId(), kind, blocks: [block] }],
    }
  }

  if (overId.startsWith("section:")) {
    const sectionId = overId.slice("section:".length)
    if (!stripped.sections.some((section) => section.id === sectionId)) {
      return document
    }
    return {
      ...stripped,
      sections: stripped.sections.map((section) =>
        section.id === sectionId
          ? { ...section, blocks: [...section.blocks, block] }
          : section
      ),
    }
  }

  const target = sectionOf(stripped, overId)
  if (!target) return document
  return {
    ...stripped,
    sections: stripped.sections.map((section) => {
      if (section.id !== target.id) return section
      const index = section.blocks.findIndex((item) => item.id === overId)
      const blocks = section.blocks.slice()
      blocks.splice(index < 0 ? blocks.length : index, 0, block)
      return { ...section, blocks }
    }),
  }
}

export function moveBullet(
  block: Extract<CvBlock, { type: "experience-entry" }>,
  activeId: string,
  overId: string
) {
  const oldIndex = block.bullets.findIndex((bullet) => bullet.id === activeId)
  const newIndex = block.bullets.findIndex((bullet) => bullet.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return block
  return { ...block, bullets: reorder(block.bullets, oldIndex, newIndex) }
}
