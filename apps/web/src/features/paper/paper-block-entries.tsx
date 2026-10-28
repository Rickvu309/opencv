import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
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
import { GripVertical } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { BlockField, reducedMotion, type BlockFieldProps } from "./paper-block-field.tsx"
import { moveBullet, newId } from "./paper-block-ops.ts"

export function ExperienceBlockField({
  block,
  onChange,
  onCommit,
  onSlash,
}: BlockFieldProps) {
  if (block.type !== "experience-entry") return null
  const empty =
    !block.role && !block.company && !block.period && block.bullets.length === 0
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {empty || !block.company ? (
        <BlockField
          label={block.role ? "Role" : "Role, company"}
          value={block.role}
          placeholder="Role, company"
          className="block"
          onSlash={onSlash}
          onChange={(value) => {
            const comma = value.indexOf(",")
            if (comma < 0) onChange({ ...block, role: value })
            else {
              onChange({
                ...block,
                role: value.slice(0, comma).trim(),
                company: value.slice(comma + 1).trim(),
              })
            }
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <BlockField
            label="Role"
            value={block.role}
            placeholder="Role, company"
            className="block"
            onChange={(role) => onChange({ ...block, role })}
          />
          <BlockField
            label="Company"
            value={block.company}
            placeholder="Company"
            onChange={(company) => onChange({ ...block, company })}
          />
        </div>
      )}
      <BlockField
        label={block.period ? "Period" : "Dates"}
        value={block.period}
        placeholder="Dates"
        className="block"
        onChange={(period) => onChange({ ...block, period })}
      />
      <BulletList
        bullets={block.bullets}
        onChange={(bullets) => onChange({ ...block, bullets })}
        onCommit={(bullets) => onCommit({ ...block, bullets })}
        onSlash={onSlash}
      />
    </div>
  )
}

function BulletList({
  bullets,
  onChange,
  onCommit,
  onSlash,
}: {
  bullets: { id: string; text: string }[]
  onChange: (bullets: { id: string; text: string }[]) => void
  onCommit: (bullets: { id: string; text: string }[]) => void
  onSlash?: (node: HTMLElement) => void
}) {
  const shown = bullets.length > 0 ? bullets : [{ id: "draft-bullet", text: "" }]
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function stored(next: { id: string; text: string }[]) {
    return next.map((bullet) =>
      bullet.id === "draft-bullet" ? { id: newId(), text: bullet.text } : bullet
    )
  }
  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : ""
    const current = {
      id: "x",
      type: "experience-entry" as const,
      role: "",
      company: "",
      period: "",
      bullets,
    }
    const moved = moveBullet(current, String(event.active.id), overId)
    if (moved !== current) onCommit(moved.bullets)
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={shown.map((bullet) => bullet.id)}
        strategy={verticalListSortingStrategy}
      >
        {shown.map((bullet, index) => (
          <BulletRow
            key={bullet.id}
            bullet={bullet}
            onSlash={onSlash}
            onEnter={() => {
              const next = shown.slice()
              next.splice(index + 1, 0, { id: newId(), text: "" })
              onCommit(stored(next))
            }}
            onChange={(text) =>
              onChange(
                stored(
                  shown.map((row) =>
                    row.id === bullet.id ? { ...row, text } : row
                  )
                )
              )
            }
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function BulletRow({
  bullet,
  onChange,
  onEnter,
  onSlash,
}: {
  bullet: { id: string; text: string }
  onChange: (text: string) => void
  onEnter: () => void
  onSlash?: (node: HTMLElement) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: bullet.id })
  const style = reducedMotion()
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition }
  const label = bullet.text
    ? "Bullet point"
    : "What you did, and what changed because of it"
  // The handle is not a tab stop. dnd-kit's attributes include tabIndex 0.
  const drag: Record<string, unknown> = { ...attributes }
  delete drag.tabIndex
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Reorder bullet"
        {...drag}
        {...listeners}
        tabIndex={-1}
      >
        <GripVertical />
      </Button>
      <BlockField
        label={label}
        value={bullet.text}
        placeholder="What you did, and what changed because of it"
        onChange={onChange}
        onEnter={onEnter}
        onSlash={onSlash}
      />
    </div>
  )
}

export function EducationBlockField({ block, onChange, onSlash }: BlockFieldProps) {
  if (block.type !== "education-entry") return null
  // Stay on one field until a comma splits school and degree, so the caret
  // is not dropped on the first letter.
  const simple = !block.degree && !block.period && !block.detail
  if (simple) {
    return (
      <BlockField
        label="School, degree"
        value={block.school}
        placeholder="School, degree"
        onSlash={onSlash}
        onChange={(value) => {
          const comma = value.indexOf(",")
          onChange({
            ...block,
            school: comma < 0 ? value : value.slice(0, comma).trim(),
            degree: comma < 0 ? "" : value.slice(comma + 1).trim(),
          })
        }}
      />
    )
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <BlockField
          label="School"
          value={block.school}
          placeholder="School, degree"
          onChange={(school) => onChange({ ...block, school })}
        />
        <BlockField
          label="Degree"
          value={block.degree}
          placeholder="Degree"
          onChange={(degree) => onChange({ ...block, degree })}
        />
      </div>
      <BlockField
        label={block.period ? "Period" : "Dates"}
        value={block.period}
        placeholder="Dates"
        onChange={(period) => onChange({ ...block, period })}
      />
      <BlockField
        label="Education detail"
        value={block.detail}
        placeholder="Education detail"
        onChange={(detail) => onChange({ ...block, detail })}
      />
    </div>
  )
}

export function SkillsBlockField({ block, onChange, onSlash }: BlockFieldProps) {
  if (block.type !== "skills-group") return null
  if (!block.label && block.items.length <= 1) {
    return (
      <BlockField
        label="Tools, software and languages"
        value={block.items[0] ?? ""}
        placeholder="Tools, software and languages"
        onSlash={onSlash}
        onChange={(value) =>
          onChange({
            ...block,
            items: value
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item.length > 0),
          })
        }
      />
    )
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <BlockField
        label="Skill group"
        value={block.label}
        placeholder="Skill group"
        onChange={(label) => onChange({ ...block, label })}
      />
      {block.items.map((item, index) => (
        <BlockField
          key={`${block.id}-${index}`}
          label="Skill"
          value={item}
          placeholder="Skill"
          onChange={(text) =>
            onChange({
              ...block,
              items: block.items.map((row, rowIndex) =>
                rowIndex === index ? text : row
              ),
            })
          }
        />
      ))}
    </div>
  )
}
