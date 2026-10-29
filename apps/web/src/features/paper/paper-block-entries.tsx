import { useReducer } from "react"
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

import {
  BlockField,
  useReducedMotion,
  type BlockFieldProps,
} from "./paper-block-field.tsx"
import { moveBullet, newId } from "./paper-block-ops.ts"

function keepId(id: string) {
  return id
}

function stop(editing: boolean) {
  return editing ? 0 : -1
}

export function ExperienceBlockField({
  block,
  editing,
  onChange,
  onCommit,
  onSlash,
}: BlockFieldProps) {
  if (block.type !== "experience-entry") return null
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <BlockField
          label="Role"
          value={block.role}
          placeholder="Role, company"
          className="block"
          tabIndex={stop(editing)}
          onSlash={onSlash}
          onChange={(role) => onChange({ ...block, role })}
        />
        <BlockField
          label="Company"
          value={block.company}
          placeholder="Company"
          tabIndex={stop(editing)}
          onChange={(company) => onChange({ ...block, company })}
        />
      </div>
      <BlockField
        label={block.period ? "Period" : "Dates"}
        value={block.period}
        placeholder="Dates"
        className="block"
        tabIndex={stop(editing)}
        onChange={(period) => onChange({ ...block, period })}
      />
      <BulletList
        bullets={block.bullets}
        editing={editing}
        onChange={(bullets) => onChange({ ...block, bullets })}
        onCommit={(bullets) => onCommit({ ...block, bullets })}
        onSlash={onSlash}
      />
      <BlockField
        label="Location"
        value={block.location ?? ""}
        placeholder="Location"
        tabIndex={stop(editing)}
        onChange={(location) => onChange({ ...block, location })}
      />
    </div>
  )
}

function BulletList({
  bullets,
  editing,
  onChange,
  onCommit,
  onSlash,
}: {
  bullets: { id: string; text: string }[]
  editing: boolean
  onChange: (bullets: { id: string; text: string }[]) => void
  onCommit: (bullets: { id: string; text: string }[]) => void
  onSlash?: (node: HTMLElement) => void
}) {
  const [draftId] = useReducer(keepId, undefined, newId)
  const shown = bullets.length > 0 ? bullets : [{ id: draftId, text: "" }]
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
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
            editing={editing}
            onSlash={onSlash}
            onEnter={() => {
              const next = shown.slice()
              next.splice(index + 1, 0, { id: newId(), text: "" })
              onCommit(next)
            }}
            onChange={(text) =>
              onChange(
                shown.map((row) =>
                  row.id === bullet.id ? { ...row, text } : row
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
  editing,
  onChange,
  onEnter,
  onSlash,
}: {
  bullet: { id: string; text: string }
  editing: boolean
  onChange: (text: string) => void
  onEnter: () => void
  onSlash?: (node: HTMLElement) => void
}) {
  const reduced = useReducedMotion()
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: bullet.id })
  const style = reduced
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition }
  const label = bullet.text
    ? "Bullet point"
    : "What you did, and what changed because of it"
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
        tabIndex={stop(editing)}
        onChange={onChange}
        onEnter={onEnter}
        onSlash={onSlash}
      />
    </div>
  )
}

export function EducationBlockField({
  block,
  editing,
  onChange,
  onSlash,
}: BlockFieldProps) {
  if (block.type !== "education-entry") return null
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <BlockField
          label="School"
          value={block.school}
          placeholder="School, degree"
          tabIndex={stop(editing)}
          onSlash={onSlash}
          onChange={(school) => onChange({ ...block, school })}
        />
        <BlockField
          label="Degree"
          value={block.degree}
          placeholder="Degree"
          tabIndex={stop(editing)}
          onChange={(degree) => onChange({ ...block, degree })}
        />
      </div>
      <BlockField
        label={block.period ? "Period" : "Dates"}
        value={block.period}
        placeholder="Dates"
        tabIndex={stop(editing)}
        onChange={(period) => onChange({ ...block, period })}
      />
      <BlockField
        label="Education detail"
        value={block.detail}
        placeholder="Education detail"
        tabIndex={stop(editing)}
        onChange={(detail) => onChange({ ...block, detail })}
      />
    </div>
  )
}

export function SkillsBlockField({
  block,
  editing,
  onChange,
  onSlash,
}: BlockFieldProps) {
  if (block.type !== "skills-group") return null
  if (!block.label && block.items.length <= 1) {
    return (
      <BlockField
        label="Tools, software and languages"
        value={block.items[0] ?? ""}
        placeholder="Tools, software and languages"
        tabIndex={stop(editing)}
        onSlash={onSlash}
        onChange={(value) =>
          onChange({ ...block, items: value.length > 0 ? [value] : [] })
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
        tabIndex={stop(editing)}
        onChange={(label) => onChange({ ...block, label })}
      />
      {block.items.map((item, index) => (
        <BlockField
          key={`${block.id}-skill-${index}`}
          label="Skill"
          value={item}
          placeholder="Skill"
          tabIndex={stop(editing)}
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
