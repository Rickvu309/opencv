import { useReducer, useRef } from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  plainTextOf,
  type CvBlock,
  type CvBlockDocument,
  type CvSectionKind,
} from "@workspace/domain"

import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { type SlashChoice } from "./paper-slash-menu.tsx"
import { PaperBlockHeader } from "./paper-block-fields.tsx"
import { SortableBlock } from "./paper-sortable-block.tsx"
import {
  blockFromPlain,
  deleteBlock,
  duplicateBlock,
  editorSections,
  insertSection,
  moveBlock,
  newId,
  patchBlock,
  patchHeader,
  placeBlock,
  replaceBlock,
  starterBlock,
} from "./paper-block-ops.ts"
import { dropBlock } from "./paper-block-drop.ts"

export const headingPointerCollision: CollisionDetection = (args) => {
  const pointer = args.pointerCoordinates
  if (pointer) {
    for (const container of args.droppableContainers) {
      if (!String(container.id).startsWith("section:") || container.disabled)
        continue
      const rect = container.node.current?.getBoundingClientRect()
      if (
        rect &&
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        return [{ id: container.id }]
      }
    }
  }
  return closestCenter(args)
}

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

export type BlockCommit = "drop" | "delete" | "change"

type SlashState = {
  sectionId: string
  blockId: string | null
  query: string
  index: number
  side: "top" | "bottom"
}

type SlashAction =
  | { type: "opened"; slash: SlashState }
  | { type: "query_typed"; query: string }
  | { type: "item_highlighted"; index: number }
  | { type: "closed" }

function slashReducer(
  state: SlashState | null,
  action: SlashAction
): SlashState | null {
  switch (action.type) {
    case "opened":
      return action.slash
    case "query_typed":
      return state ? { ...state, query: action.query, index: 0 } : state
    case "item_highlighted":
      return state ? { ...state, index: action.index } : state
    case "closed":
      return null
  }
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
  const releasedHeading = useRef<string | null>(null)
  const [slash, dispatchSlash] = useReducer(slashReducer, null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  )
  const sections = editorSections(document)

  function onDragEnd(event: DragEndEvent) {
    const overId =
      releasedHeading.current ?? (event.over ? String(event.over.id) : "")
    releasedHeading.current = null
    const next = dropBlock(document, String(event.active.id), overId)
    if (next === document) return
    onCommit(next, "drop")
  }

  function openSlash(
    sectionId: string,
    blockId: string | null,
    node: HTMLElement
  ) {
    const space = window.innerHeight - node.getBoundingClientRect().bottom
    dispatchSlash({
      type: "opened",
      slash: {
        sectionId,
        blockId,
        query: "",
        index: 0,
        side: space < 280 ? "top" : "bottom",
      },
    })
  }

  function pick(choice: SlashChoice) {
    if (!slash) return
    const current = slash
    dispatchSlash({ type: "closed" })
    if (choice.group === "section") {
      onCommit(
        insertSection(document, current.sectionId, choice.kind),
        "change"
      )
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
      <div
        className="flex flex-col gap-4 p-6"
        onPointerUpCapture={(event) => {
          releasedHeading.current = null
          for (const heading of event.currentTarget.querySelectorAll<HTMLElement>(
            "[data-section-drop]"
          )) {
            const rect = heading.getBoundingClientRect()
            if (
              event.clientX >= rect.left &&
              event.clientX <= rect.right &&
              event.clientY >= rect.top &&
              event.clientY <= rect.bottom
            ) {
              releasedHeading.current = heading.dataset.sectionDrop ?? null
              break
            }
          }
        }}
      >
        <PaperBlockHeader
          header={document.header}
          onChange={(key, value) => onChange(patchHeader(document, key, value))}
        />
        <DndContext
          sensors={sensors}
          onDragStart={() => {
            releasedHeading.current = null
          }}
          collisionDetection={headingPointerCollision}
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
                dispatchSlash({ type: "query_typed", query })
              }
              onSlashActive={(index) =>
                dispatchSlash({ type: "item_highlighted", index })
              }
              onPick={pick}
              onCloseSlash={() => dispatchSlash({ type: "closed" })}
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
  onOpenSlash: (
    sectionId: string,
    blockId: string | null,
    node: HTMLElement
  ) => void
  onSlashQuery: (query: string) => void
  onSlashActive: (index: number) => void
  onPick: (choice: SlashChoice) => void
  onCloseSlash: () => void
}) {
  const { setNodeRef } = useDroppable({ id: `section:${section.id}` })
  const starter = starterBlock(section.kind, `draft-${section.id}`)
  const draft = section.blocks.length === 0 && starter ? starter : null
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
    <div data-section={section.kind} className="flex flex-col gap-2">
      <h2
        ref={setNodeRef}
        data-section-drop={`section:${section.id}`}
        className="-my-1 py-1 text-sm font-medium"
      >
        {SECTION_LABEL[section.kind]}
      </h2>
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
            onDuplicate={() => {
              if (!section.blocks.some((item) => item.id === block.id)) return
              onCommit(duplicateBlock(document, block.id), "change")
            }}
            onMove={(direction) => {
              if (!section.blocks.some((item) => item.id === block.id)) return
              onCommit(moveBlock(document, block.id, direction), "change")
            }}
            onDelete={() => {
              if (!section.blocks.some((item) => item.id === block.id)) return
              onCommit(deleteBlock(document, block.id), "delete")
            }}
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
