import { useState } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  type CvBlock,
  type CvBlockDocument,
  type CvSectionKind,
} from "@workspace/domain"

import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { PaperBlockMenu } from "./paper-block-menu.tsx"
import {
  PaperSlashMenu,
  type SlashBlockType,
  type SlashChoice,
} from "./paper-slash-menu.tsx"

const SECTION_LABEL: Record<CvSectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  activities: "Activities",
  awards: "Awards",
  languages: "Languages",
}

const BLANK_PLACEHOLDER: Record<string, string> = {
  "block-role": "Role, company",
  "block-dates": "Dates",
  "block-impact": "What you did, and what changed because of it",
  "block-school": "School, degree",
  "block-tools": "Tools, software and languages",
}

const HEADER_FIELDS = [
  ["name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["city", "City"],
  ["linkedin", "LinkedIn"],
] as const

function newId() {
  return crypto.randomUUID()
}

function placeholderFor(block: CvBlock) {
  if (BLANK_PLACEHOLDER[block.id]) return BLANK_PLACEHOLDER[block.id]
  if (block.type === "heading") return "Heading"
  if (block.type === "divider") return "Divider"
  return "Text"
}

function plainText(block: CvBlock) {
  if (block.type === "divider") return ""
  if ("items" in block) return block.items.map((item) => item.text).join("\n")
  return block.text
}

function cloneBlock(block: CvBlock): CvBlock {
  if (block.type === "divider") return { id: newId(), type: "divider" }
  if ("items" in block) {
    return {
      id: newId(),
      type: block.type,
      items: block.items.map((item) => ({ id: newId(), text: item.text })),
    }
  }
  return { id: newId(), type: block.type, text: block.text }
}

function mapSections(
  document: CvBlockDocument,
  map: (
    section: CvBlockDocument["sections"][number]
  ) => CvBlockDocument["sections"][number]
) {
  return { ...document, sections: document.sections.map(map) }
}

export function insertSection(
  document: CvBlockDocument,
  afterSectionId: string,
  kind: CvSectionKind
): CvBlockDocument {
  const section = {
    id: newId(),
    kind,
    blocks: [{ id: newId(), type: "text" as const, text: "" }],
  }
  const sections = [...document.sections]
  const index = sections.findIndex((item) => item.id === afterSectionId)
  sections.splice(index + 1, 0, section)
  return { ...document, sections }
}

export function convertBlock(
  document: CvBlockDocument,
  blockId: string,
  type: SlashBlockType
): CvBlockDocument {
  return mapSections(document, (section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.id !== blockId) return block
      if (type === "divider") return { id: block.id, type: "divider" as const }
      if (type === "bulleted-list" || type === "numbered-list") {
        return {
          id: block.id,
          type,
          items: [{ id: newId(), text: plainText(block) }],
        }
      }
      return { id: block.id, type, text: plainText(block) }
    }),
  }))
}

export function duplicateBlock(document: CvBlockDocument, blockId: string) {
  return mapSections(document, (section) => {
    const index = section.blocks.findIndex((block) => block.id === blockId)
    if (index < 0) return section
    const blocks = [...section.blocks]
    const source = blocks[index]
    if (!source) return section
    blocks.splice(index + 1, 0, cloneBlock(source))
    return { ...section, blocks }
  })
}

export function moveBlockInSection(
  document: CvBlockDocument,
  blockId: string,
  direction: -1 | 1
) {
  return mapSections(document, (section) => {
    const index = section.blocks.findIndex((block) => block.id === blockId)
    const next = index + direction
    if (index < 0 || next < 0 || next >= section.blocks.length) return section
    const blocks = [...section.blocks]
    const [item] = blocks.splice(index, 1)
    if (!item) return section
    blocks.splice(next, 0, item)
    return { ...section, blocks }
  })
}

export function deleteBlock(document: CvBlockDocument, blockId: string) {
  const sections = document.sections.flatMap((section) => {
    if (!section.blocks.some((block) => block.id === blockId)) return [section]
    const blocks = section.blocks.filter((block) => block.id !== blockId)
    if (
      blocks.length === 0 &&
      section.kind !== "experience" &&
      section.kind !== "education" &&
      section.kind !== "skills"
    ) {
      return []
    }
    return [{ ...section, blocks }]
  })
  return { ...document, sections }
}

function blockPlace(document: CvBlockDocument, blockId: string) {
  for (
    let sectionIndex = 0;
    sectionIndex < document.sections.length;
    sectionIndex++
  ) {
    const section = document.sections[sectionIndex]
    if (!section) continue
    const blockIndex = section.blocks.findIndex((block) => block.id === blockId)
    if (blockIndex < 0) continue
    const block = section.blocks[blockIndex]
    if (!block) continue
    return { sectionIndex, blockIndex, block }
  }
  return null
}

function blockOrder(sections: CvBlockDocument["sections"]) {
  return sections
    .map((section) => section.blocks.map((block) => block.id).join(","))
    .join("|")
}

function keptSections(sections: CvBlockDocument["sections"]) {
  return sections.flatMap((section) => {
    if (
      section.blocks.length === 0 &&
      section.kind !== "experience" &&
      section.kind !== "education" &&
      section.kind !== "skills"
    ) {
      return []
    }
    return [section]
  })
}

export function dropBlock(
  document: CvBlockDocument,
  activeId: string,
  overId: string
): CvBlockDocument | null {
  if (activeId === overId) return null
  const from = blockPlace(document, activeId)
  if (!from) return null
  let sections: CvBlockDocument["sections"]
  if (overId.startsWith("section:")) {
    const sectionId = overId.slice("section:".length)
    sections = document.sections.map((section) => ({
      ...section,
      blocks: section.blocks.filter((block) => block.id !== activeId),
    }))
    const target = sections.find((section) => section.id === sectionId)
    if (!target) return null
    target.blocks.push(from.block)
    sections = keptSections(sections)
  } else {
    const to = blockPlace(document, overId)
    if (!to) return null
    if (from.sectionIndex === to.sectionIndex) {
      const current = document.sections[from.sectionIndex]
      if (!current) return null
      const blocks = arrayMove(current.blocks, from.blockIndex, to.blockIndex)
      sections = document.sections.map((section, index) =>
        index === from.sectionIndex ? { ...section, blocks } : section
      )
    } else {
      sections = document.sections.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.id !== activeId),
      }))
      const target = sections[to.sectionIndex]
      if (!target) return null
      target.blocks.splice(to.blockIndex, 0, from.block)
      sections = keptSections(sections)
    }
  }
  if (blockOrder(sections) === blockOrder(document.sections)) return null
  return { ...document, sections }
}

function updateBlockText(
  document: CvBlockDocument,
  blockId: string,
  text: string
) {
  return mapSections(document, (section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.id !== blockId) return block
      if (block.type === "heading" || block.type === "text") {
        return { ...block, text }
      }
      return block
    }),
  }))
}

function updateItemText(
  document: CvBlockDocument,
  blockId: string,
  itemId: string,
  text: string
) {
  return mapSections(document, (section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.id !== blockId) return block
      if (block.type !== "bulleted-list" && block.type !== "numbered-list") {
        return block
      }
      return {
        ...block,
        items: block.items.map((item) =>
          item.id === itemId ? { ...item, text } : item
        ),
      }
    }),
  }))
}

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

function menuSide(node: HTMLElement) {
  const space = window.innerHeight - node.getBoundingClientRect().bottom
  return space < 280 ? "top" : "bottom"
}

export function PaperBlocks({
  document,
  onChange,
  onCommit,
  onAskCoach,
}: {
  document: CvBlockDocument
  onChange: (next: CvBlockDocument) => void
  onCommit: (next: CvBlockDocument) => void
  onAskCoach: (text: string) => void
}) {
  const [slash, setSlash] = useState<{
    sectionId: string
    blockId: string
    side: "top" | "bottom"
    query: string
    active: number
  } | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const reduced = reducedMotion()

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over?.id
    if (!overId) return
    const next = dropBlock(document, String(event.active.id), String(overId))
    if (next) onCommit(next)
  }

  function pick(choice: SlashChoice) {
    if (!slash) return
    const next =
      choice.group === "section"
        ? insertSection(document, slash.sectionId, choice.kind)
        : convertBlock(document, slash.blockId, choice.type)
    setSlash(null)
    onChange(next)
  }

  return (
    <CvA4Canvas>
      <div className="cv-template-root flex flex-col gap-6">
        <div className="flex flex-wrap gap-3">
          {HEADER_FIELDS.map(([key, label]) => (
            <BlockField
              key={key}
              label={document.header[key].trim() || label}
              value={document.header[key]}
              placeholder={label}
              header={key}
              onChange={(value) =>
                onChange({
                  ...document,
                  header: { ...document.header, [key]: value },
                })
              }
            />
          ))}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          {document.sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              reduced={reduced}
              slash={slash}
              onSlash={setSlash}
              onQuery={(query) =>
                setSlash((current) =>
                  current ? { ...current, query, active: 0 } : current
                )
              }
              onActive={(active) =>
                setSlash((current) =>
                  current ? { ...current, active } : current
                )
              }
              onPick={pick}
              onClose={() => setSlash(null)}
              onChange={onChange}
              onAskCoach={onAskCoach}
              document={document}
            />
          ))}
        </DndContext>
      </div>
    </CvA4Canvas>
  )
}

function SectionBlock({
  section,
  document,
  reduced,
  slash,
  onSlash,
  onQuery,
  onActive,
  onPick,
  onClose,
  onChange,
  onAskCoach,
}: {
  section: CvBlockDocument["sections"][number]
  document: CvBlockDocument
  reduced: boolean
  slash: {
    sectionId: string
    blockId: string
    side: "top" | "bottom"
    query: string
    active: number
  } | null
  onSlash: (value: NonNullable<typeof slash>) => void
  onQuery: (query: string) => void
  onActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onClose: () => void
  onChange: (next: CvBlockDocument) => void
  onAskCoach: (text: string) => void
}) {
  const { setNodeRef } = useDroppable({ id: `section:${section.id}` })
  return (
    <section data-section={section.kind} className="flex flex-col gap-2">
      <div ref={setNodeRef}>
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {SECTION_LABEL[section.kind]}
        </h2>
      </div>
      <SortableContext items={section.blocks.map((block) => block.id)}>
        {section.blocks.map((block) => (
          <SortableBlock
            key={block.id}
            block={block}
            reduced={reduced}
            slash={slash?.blockId === block.id ? slash : null}
            onOpenSlash={(node) =>
              onSlash({
                sectionId: section.id,
                blockId: block.id,
                side: menuSide(node),
                query: "",
                active: 0,
              })
            }
            onQuery={onQuery}
            onActive={onActive}
            onPick={onPick}
            onClose={onClose}
            onText={(text) =>
              onChange(updateBlockText(document, block.id, text))
            }
            onItem={(itemId, text) =>
              onChange(updateItemText(document, block.id, itemId, text))
            }
            onTurnInto={(type) =>
              onChange(convertBlock(document, block.id, type))
            }
            onDuplicate={() => onChange(duplicateBlock(document, block.id))}
            onMoveUp={() =>
              onChange(moveBlockInSection(document, block.id, -1))
            }
            onMoveDown={() =>
              onChange(moveBlockInSection(document, block.id, 1))
            }
            onDelete={() => onChange(deleteBlock(document, block.id))}
            onAskCoach={() => onAskCoach(plainText(block))}
          />
        ))}
      </SortableContext>
    </section>
  )
}

function SortableBlock({
  block,
  reduced,
  slash,
  onOpenSlash,
  onQuery,
  onActive,
  onPick,
  onClose,
  onText,
  onItem,
  onTurnInto,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAskCoach,
}: {
  block: CvBlock
  reduced: boolean
  slash: {
    query: string
    active: number
    side: "top" | "bottom"
  } | null
  onOpenSlash: (node: HTMLElement) => void
  onQuery: (query: string) => void
  onActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onClose: () => void
  onText: (text: string) => void
  onItem: (itemId: string, text: string) => void
  onTurnInto: (type: SlashBlockType) => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onAskCoach: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
    })
  const style = reduced
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-sortable-block={block.id}
      className="relative flex items-start gap-2"
    >
      <PaperBlockMenu
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
        onTurnInto={onTurnInto}
        onDuplicate={onDuplicate}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onAskCoach={onAskCoach}
        onDelete={onDelete}
      />
      <div className="min-w-0 flex-1">
        <BlockBody
          block={block}
          onOpenSlash={onOpenSlash}
          onText={onText}
          onItem={onItem}
        />
        {slash ? (
          <PaperSlashMenu
            query={slash.query}
            activeIndex={slash.active}
            side={slash.side}
            onQuery={onQuery}
            onActive={onActive}
            onPick={onPick}
            onClose={onClose}
          />
        ) : null}
      </div>
    </div>
  )
}

function BlockBody({
  block,
  onOpenSlash,
  onText,
  onItem,
}: {
  block: CvBlock
  onOpenSlash: (node: HTMLElement) => void
  onText: (text: string) => void
  onItem: (itemId: string, text: string) => void
}) {
  if (block.type === "divider") {
    return (
      <div
        tabIndex={0}
        aria-label="Divider"
        data-block-id={block.id}
        className="mt-3 border-t border-border"
      />
    )
  }
  if ("items" in block) {
    return (
      <div className="flex flex-col gap-1" data-block-id={block.id}>
        {block.items.map((item, index) => (
          <BlockField
            key={item.id}
            label={item.text.trim() || "List item"}
            value={item.text}
            placeholder="List item"
            prefix={block.type === "numbered-list" ? `${index + 1}.` : "•"}
            onChange={(text) => onItem(item.id, text)}
          />
        ))}
      </div>
    )
  }
  const placeholder = placeholderFor(block)
  return (
    <BlockField
      label={block.text.trim() || placeholder}
      value={block.text}
      placeholder={placeholder}
      blockId={block.id}
      onSlash={block.type === "text" ? onOpenSlash : undefined}
      onChange={onText}
    />
  )
}

function BlockField({
  label,
  value,
  placeholder,
  blockId,
  header,
  prefix,
  onSlash,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  blockId?: string
  header?: string
  prefix?: string
  onSlash?: (node: HTMLElement) => void
  onChange: (value: string) => void
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      {prefix ? (
        <span className="text-sm text-muted-foreground">{prefix}</span>
      ) : null}
      <span
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-label={label}
        data-placeholder={placeholder}
        data-block-id={blockId}
        data-paper-header={header}
        className="block min-h-6 min-w-0 flex-1 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
        onKeyDown={(event) => {
          if (
            onSlash &&
            event.key === "/" &&
            (event.currentTarget.textContent ?? "") === ""
          ) {
            event.preventDefault()
            onSlash(event.currentTarget)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        ref={(node) => {
          if (
            node &&
            node.textContent !== value &&
            document.activeElement !== node
          ) {
            node.textContent = value
          }
        }}
      />
    </div>
  )
}
