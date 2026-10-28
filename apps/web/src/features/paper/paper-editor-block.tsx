import { useState, type ReactNode } from "react"
import { blockEntry, type CvBlock } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { GripVertical, MoreHorizontal } from "lucide-react"
import { BlockField } from "./paper-canvas-field.tsx"
import {
  makeId,
  blockTypeOf,
  turnBlockInto,
  duplicateBlock,
} from "./paper-block-operations.ts"

type Props = {
  sectionId: string
  block: CvBlock
  index: number
  updateBlock: (
    sectionId: string,
    blockId: string,
    update: (block: CvBlock) => CvBlock
  ) => void
  updateSection: (
    sectionId: string,
    update: (blocks: CvBlock[]) => CvBlock[]
  ) => void
  moveBlock: (sectionId: string, blockId: string, offset: number) => void
  dropBlock: (sectionId: string, targetId: string) => void
  setDragBlock: (id: string | null) => void
  onAskCoach: () => void
}
export function PaperEditorBlock({
  sectionId,
  block,
  index,
  updateBlock,
  updateSection,
  moveBlock,
  dropBlock,
  setDragBlock,
  onAskCoach,
}: Props) {
  const [menuBlock, setMenuBlock] = useState<string | null>(null)
  const updateText = (field: "text", value: string) =>
    updateBlock(sectionId, block.id, (current) =>
      current.type === "text" || current.type === "heading"
        ? { ...current, [field]: value }
        : current
    )
  const actions = (
    <div className="relative flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Drag ${block.type} block`}
        draggable
        onDragStart={() => setDragBlock(block.id)}
        onDragEnd={() => setDragBlock(null)}
        className="cursor-grab text-muted-foreground"
      >
        <GripVertical className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Actions for ${block.type} block`}
        aria-expanded={menuBlock === block.id}
        onClick={() => setMenuBlock(menuBlock === block.id ? null : block.id)}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {menuBlock === block.id ? (
        <div
          role="menu"
          aria-label="Block actions"
          className="absolute top-full right-0 z-10 flex w-48 flex-col rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Turn into
          </p>
          {blockEntry(block.type).turnInto.map((value) => {
            const type = blockTypeOf(value)
            if (!type) return null
            return (
              <Button
                key={type}
                type="button"
                role="menuitem"
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  const converted = turnBlockInto(block, type)
                  if (converted)
                    updateBlock(sectionId, block.id, () => converted)
                  setMenuBlock(null)
                }}
              >
                {type.replaceAll("-", " ")}
              </Button>
            )
          })}
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            className="justify-start"
            onClick={() => {
              const copy = duplicateBlock(block)
              updateSection(sectionId, (blocks) => [
                ...blocks.slice(0, index + 1),
                copy,
                ...blocks.slice(index + 1),
              ])
              setMenuBlock(null)
            }}
          >
            Duplicate
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            className="justify-start"
            onClick={() => {
              moveBlock(sectionId, block.id, -1)
              setMenuBlock(null)
            }}
          >
            Move up
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            className="justify-start"
            onClick={() => {
              moveBlock(sectionId, block.id, 1)
              setMenuBlock(null)
            }}
          >
            Move down
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            className="justify-start"
            onClick={() => {
              onAskCoach()
              setMenuBlock(null)
            }}
          >
            Ask Coach
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            className="justify-start text-destructive"
            onClick={() => {
              updateSection(sectionId, (blocks) =>
                blocks.filter((item) => item.id !== block.id)
              )
              setMenuBlock(null)
            }}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  )

  let content: ReactNode
  switch (block.type) {
    case "text":
    case "heading":
      content = (
        <BlockField
          label={block.type === "heading" ? "Heading text" : "Text block"}
          value={block.text}
          multiline
          onChange={(value) => updateText("text", value)}
        />
      )
      break
    case "bulleted-list":
    case "numbered-list":
      content = (
        <div className="flex w-full flex-col gap-1">
          {block.items.map((item, itemIndex) => (
            <BlockField
              key={item.id}
              label={`${block.type === "bulleted-list" ? "Bullet" : "List item"} ${itemIndex + 1}`}
              value={item.text}
              onChange={(value) =>
                updateBlock(sectionId, block.id, (current) =>
                  current.type === block.type
                    ? {
                        ...current,
                        items: current.items.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, text: value }
                            : entry
                        ),
                      }
                    : current
                )
              }
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === block.type
                  ? {
                      ...current,
                      items: [...current.items, { id: makeId(), text: "" }],
                    }
                  : current
              )
            }
          >
            Add item
          </Button>
        </div>
      )
      break
    case "experience-entry":
      content = (
        <div className="grid w-full gap-1 sm:grid-cols-2">
          <BlockField
            label="Role"
            value={block.role}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "experience-entry"
                  ? { ...current, role: value }
                  : current
              )
            }
          />
          <BlockField
            label="Company"
            value={block.company}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "experience-entry"
                  ? { ...current, company: value }
                  : current
              )
            }
          />
          <BlockField
            label="Period"
            value={block.period}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "experience-entry"
                  ? { ...current, period: value }
                  : current
              )
            }
          />
          <BlockField
            label="Location"
            value={block.location ?? ""}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "experience-entry"
                  ? { ...current, location: value }
                  : current
              )
            }
          />
          <div className="sm:col-span-2">
            {block.bullets.map((item, itemIndex) => (
              <BlockField
                key={item.id}
                label={`Experience bullet ${itemIndex + 1}`}
                value={item.text}
                onChange={(value) =>
                  updateBlock(sectionId, block.id, (current) =>
                    current.type === "experience-entry"
                      ? {
                          ...current,
                          bullets: current.bullets.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, text: value }
                              : entry
                          ),
                        }
                      : current
                  )
                }
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                updateBlock(sectionId, block.id, (current) =>
                  current.type === "experience-entry"
                    ? {
                        ...current,
                        bullets: [
                          ...current.bullets,
                          { id: makeId(), text: "" },
                        ],
                      }
                    : current
                )
              }
            >
              Add bullet
            </Button>
          </div>
        </div>
      )
      break
    case "education-entry":
      content = (
        <div className="grid w-full gap-1 sm:grid-cols-2">
          <BlockField
            label="School"
            value={block.school}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "education-entry"
                  ? { ...current, school: value }
                  : current
              )
            }
          />
          <BlockField
            label="Degree"
            value={block.degree}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "education-entry"
                  ? { ...current, degree: value }
                  : current
              )
            }
          />
          <BlockField
            label="Period"
            value={block.period}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "education-entry"
                  ? { ...current, period: value }
                  : current
              )
            }
          />
          <BlockField
            label="Details"
            value={block.detail}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "education-entry"
                  ? { ...current, detail: value }
                  : current
              )
            }
          />
        </div>
      )
      break
    case "skills-group":
      content = (
        <div className="grid w-full gap-1 sm:grid-cols-2">
          <BlockField
            label="Skills heading"
            value={block.label}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "skills-group"
                  ? { ...current, label: value }
                  : current
              )
            }
          />
          <BlockField
            label="Skills, comma separated"
            value={block.items.join(",")}
            onChange={(value) =>
              updateBlock(sectionId, block.id, (current) =>
                current.type === "skills-group"
                  ? {
                      ...current,
                      items: value.split(","),
                    }
                  : current
              )
            }
          />
        </div>
      )
      break
    case "divider":
      content = (
        <div aria-label="Divider block" className="h-px w-full bg-border" />
      )
      break
  }

  return (
    <div
      key={block.id}
      draggable
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => dropBlock(sectionId, block.id)}
      data-block-id={block.id}
      className="group flex items-start gap-2 rounded-md border border-transparent p-1 focus-within:border-border hover:border-border"
    >
      {actions}
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  )
}
