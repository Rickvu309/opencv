import { useState, type KeyboardEvent } from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  plainTextOf,
  type BlockType,
  type CvBlock,
  type CvBlockDocument,
  type CvSectionKind,
} from "@workspace/domain"

import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { PaperBlockMenu } from "./paper-block-menu.tsx"
import { PaperSlashMenu, type SlashChoice } from "./paper-slash-menu.tsx"
import { blockFields, PaperBlockHeader } from "./paper-block-fields.tsx"
import { reducedMotion } from "./paper-block-field.tsx"
import {
  blockFromPlain,
  deleteBlock,
  dropBlock,
  duplicateBlock,
  editorSections,
  insertSection,
  isStarterKind,
  moveBlock,
  newId,
  patchBlock,
  patchHeader,
  placeBlock,
  replaceBlock,
} from "./paper-block-ops.ts"

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

const DRAFTS: Partial<Record<CvSectionKind, (id: string) => CvBlock>> = {
  experience: (id) => ({
    id,
    type: "experience-entry",
    role: "",
    company: "",
    period: "",
    bullets: [],
  }),
  education: (id) => ({
    id,
    type: "education-entry",
    school: "",
    degree: "",
    period: "",
    detail: "",
  }),
  skills: (id) => ({ id, type: "skills-group", label: "", items: [] }),
}

export type BlockCommit = "drop" | "delete" | "change"

type SlashState = {
  sectionId: string
  blockId: string | null
  query: string
  index: number
  side: "top" | "bottom"
}

export function PaperBlocks({
  document,
  onChange,
  onCommit,
  onAskCoach,
}: {
  document: CvBlockDocument
  onChange: (next: CvBlockDocument) => void
  onCommit: (next: CvBlockDocument, kind: BlockCommit) => void
  onAskCoach: (text: string) => void
}) {
  const [slash, setSlash] = useState<SlashState | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  )
  const sections = editorSections(document)

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : ""
    const next = dropBlock(document, String(event.active.id), overId)
    if (next === document) return
    onCommit(next, "drop")
  }

  function openSlash(sectionId: string, blockId: string | null, node: HTMLElement) {
    const space = window.innerHeight - node.getBoundingClientRect().bottom
    setSlash({
      sectionId,
      blockId,
      query: "",
      index: 0,
      side: space < 280 ? "top" : "bottom",
    })
  }

  function pick(choice: SlashChoice) {
    if (!slash) return
    const current = slash
    setSlash(null)
    if (choice.group === "section") {
      onCommit(insertSection(document, current.sectionId, choice.kind), "change")
      return
    }
    const section = sections.find((item) => item.id === current.sectionId)
    const stored =
      current.blockId != null &&
      document.sections.some((item) =>
        item.blocks.some((block) => block.id === current.blockId)
      )
    if (current.blockId && stored) {
      onCommit(replaceBlock(document, current.blockId, choice.type), "change")
      return
    }
    if (!section) return
    onCommit(
      placeBlock(
        document,
        section.id,
        section.kind,
        blockFromPlain(choice.type, newId(), "")
      ),
      "change"
    )
  }

  return (
    <CvA4Canvas>
      <div className="flex flex-col gap-4 p-6">
        <PaperBlockHeader
          header={document.header}
          onChange={(key, value) => onChange(patchHeader(document, key, value))}
        />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              document={document}
              section={section}
              slash={slash}
              onChange={onChange}
              onCommit={onCommit}
              onAskCoach={onAskCoach}
              onOpenSlash={openSlash}
              onSlashQuery={(query) =>
                setSlash((current) => (current ? { ...current, query, index: 0 } : current))
              }
              onSlashActive={(index) =>
                setSlash((current) => (current ? { ...current, index } : current))
              }
              onPick={pick}
              onCloseSlash={() => setSlash(null)}
            />
          ))}
        </DndContext>
      </div>
    </CvA4Canvas>
  )
}

function SectionBlock({
  document,
  section,
  slash,
  onChange,
  onCommit,
  onAskCoach,
  onOpenSlash,
  onSlashQuery,
  onSlashActive,
  onPick,
  onCloseSlash,
}: {
  document: CvBlockDocument
  section: CvBlockDocument["sections"][number]
  slash: SlashState | null
  onChange: (next: CvBlockDocument) => void
  onCommit: (next: CvBlockDocument, kind: BlockCommit) => void
  onAskCoach: (text: string) => void
  onOpenSlash: (sectionId: string, blockId: string | null, node: HTMLElement) => void
  onSlashQuery: (query: string) => void
  onSlashActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onCloseSlash: () => void
}) {
  const { setNodeRef } = useDroppable({ id: `section:${section.id}` })
  const draftOf = DRAFTS[section.kind]
  const draft =
    section.blocks.length === 0 && isStarterKind(section.kind) && draftOf
      ? draftOf(`draft-${section.id}`)
      : null
  const blocks = draft ? [draft] : section.blocks

  function write(block: CvBlock) {
    const stored = section.blocks.some((item) => item.id === block.id)
    onChange(
      stored
        ? patchBlock(document, block)
        : placeBlock(document, section.id, section.kind, block)
    )
  }

  return (
    <div ref={setNodeRef} data-section={section.kind} className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{SECTION_LABEL[section.kind]}</h2>
      <SortableContext
        items={blocks.map((block) => block.id)}
        strategy={verticalListSortingStrategy}
      >
        {blocks.map((block) => (
          <SortableBlock
            key={block.id}
            block={block}
            sectionKind={section.kind}
            slash={slash?.blockId === block.id ? slash : null}
            onChange={write}
            onCommit={(next) => {
              const stored = section.blocks.some((item) => item.id === next.id)
              onCommit(
                stored
                  ? patchBlock(document, next)
                  : placeBlock(document, section.id, section.kind, next),
                "change"
              )
            }}
            onOpenSlash={(node) => onOpenSlash(section.id, block.id, node)}
            onSlashQuery={onSlashQuery}
            onSlashActive={onSlashActive}
            onPick={onPick}
            onCloseSlash={onCloseSlash}
            onDuplicate={() =>
              onCommit(duplicateBlock(document, block.id), "change")
            }
            onMove={(direction) =>
              onCommit(moveBlock(document, block.id, direction), "change")
            }
            onDelete={() => onCommit(deleteBlock(document, block.id), "delete")}
            onTurnInto={(type) =>
              onCommit(
                section.blocks.some((item) => item.id === block.id)
                  ? replaceBlock(document, block.id, type)
                  : placeBlock(
                      document,
                      section.id,
                      section.kind,
                      blockFromPlain(type, block.id, "")
                    ),
                "change"
              )
            }
            onAskCoach={() => onAskCoach(plainTextOf(block))}
          />
        ))}
      </SortableContext>
    </div>
  )
}

function SortableBlock({
  block,
  sectionKind,
  slash,
  onChange,
  onCommit,
  onOpenSlash,
  onSlashQuery,
  onSlashActive,
  onPick,
  onCloseSlash,
  onDuplicate,
  onMove,
  onDelete,
  onTurnInto,
  onAskCoach,
}: {
  block: CvBlock
  sectionKind: CvSectionKind
  slash: SlashState | null
  onChange: (block: CvBlock) => void
  onCommit: (block: CvBlock) => void
  onOpenSlash: (node: HTMLElement) => void
  onSlashQuery: (query: string) => void
  onSlashActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onCloseSlash: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onTurnInto: (type: BlockType) => void
  onAskCoach: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
  })
  const style = reducedMotion()
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition }
  const Field = blockFields[block.type]
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    const meta = event.metaKey || event.ctrlKey
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.querySelector<HTMLElement>("[role='textbox']")?.focus()
    } else if (meta && event.key.toLowerCase() === "d") {
      event.preventDefault()
      onDuplicate()
    } else if (meta && event.shiftKey && event.key === "ArrowUp") {
      event.preventDefault()
      onMove(-1)
    } else if (meta && event.shiftKey && event.key === "ArrowDown") {
      event.preventDefault()
      onMove(1)
    } else if (event.key === "Delete") {
      event.preventDefault()
      onDelete()
    }
  }
  return (
    <div
      ref={setNodeRef}
      data-sortable-block={block.id}
      style={style}
      tabIndex={0}
      aria-label={plainTextOf(block) || "Empty block"}
      className="relative flex items-start gap-1"
      onKeyDown={onKeyDown}
    >
      <PaperBlockMenu
        type={block.type}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
        onTurnInto={onTurnInto}
        onDuplicate={onDuplicate}
        onMoveUp={() => onMove(-1)}
        onMoveDown={() => onMove(1)}
        onAskCoach={onAskCoach}
        onDelete={onDelete}
      />
      <Field
        block={block}
        sectionKind={sectionKind}
        onChange={onChange}
        onCommit={onCommit}
        onSlash={onOpenSlash}
      />
      {slash ? (
        <PaperSlashMenu
          query={slash.query}
          activeIndex={slash.index}
          side={slash.side}
          onQuery={onSlashQuery}
          onActive={onSlashActive}
          onPick={onPick}
          onClose={onCloseSlash}
        />
      ) : null}
    </div>
  )
}
