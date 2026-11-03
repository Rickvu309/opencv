import { useLayoutEffect, useReducer, useRef, type ReactNode } from "react"
import type { BlockType, CvBlock, CvSectionKind } from "@workspace/domain"

import {
  EducationBlockField,
  ExperienceBlockField,
  SkillsBlockField,
} from "./paper-block-entries.tsx"
import { BlockField, type BlockFieldProps } from "./paper-block-field.tsx"
import { newId } from "./paper-block-ops.ts"

function keepId(id: string) {
  return id
}

function textLabel(kind: CvSectionKind, type: "text" | "heading") {
  if (kind === "summary" && type === "heading") return "Headline"
  if (kind === "summary" && type === "text") return "Summary"
  return type === "heading" ? "Heading" : "Text"
}

export function blockPlaceholder(block: CvBlock, sectionKind: CvSectionKind) {
  if (block.type === "text" || block.type === "heading") {
    return textLabel(sectionKind, block.type)
  }
  if (block.type === "experience-entry") return "Role, company"
  if (block.type === "education-entry") return "School, degree"
  if (block.type === "skills-group") return "Tools, software and languages"
  if (block.type === "divider") return "Divider"
  return "List item"
}

function TextBlockField({
  block,
  sectionKind,
  editing,
  onChange,
  onSlash,
}: BlockFieldProps) {
  if (block.type !== "text" && block.type !== "heading") return null
  const label = textLabel(sectionKind, block.type)
  return (
    <BlockField
      label={label}
      value={block.text}
      placeholder={label}
      tabIndex={editing ? 0 : -1}
      onChange={(text) => onChange({ ...block, text })}
      onSlash={onSlash}
    />
  )
}

function ListBlockField({
  block,
  editing,
  onChange,
  onCommit,
  onSlash,
}: BlockFieldProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const row = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-list-item-id]") ??
        []
    ).find((node) => node.dataset.listItemId === pendingFocus.current)
    const field = row?.querySelector<HTMLElement>('[role="textbox"]')
    if (!field) return
    field.focus()
    pendingFocus.current = null
  }, [block])
  const [draftId] = useReducer(keepId, undefined, newId)
  if (block.type !== "bulleted-list" && block.type !== "numbered-list") {
    return null
  }
  const items =
    block.items.length > 0 ? block.items : [{ id: draftId, text: "" }]
  return (
    <div ref={listRef} className="flex min-w-0 flex-1 flex-col gap-1">
      {items.map((item, index) => (
        <div
          key={item.id}
          data-list-item-id={item.id}
          className="flex items-start gap-2"
        >
          <span className="pt-0.5 text-sm text-muted-foreground" aria-hidden>
            {block.type === "numbered-list" ? `${index + 1}.` : "•"}
          </span>
          <BlockField
            label="List item"
            value={item.text}
            placeholder="List item"
            tabIndex={editing ? 0 : -1}
            onSlash={onSlash}
            onEnter={() => {
              const next = items.slice()
              const id = newId()
              pendingFocus.current = id
              next.splice(index + 1, 0, { id, text: "" })
              onCommit({ ...block, items: next })
            }}
            onChange={(text) =>
              onChange({
                ...block,
                items: items.map((row) =>
                  row.id === item.id ? { ...row, text } : row
                ),
              })
            }
          />
        </div>
      ))}
    </div>
  )
}

function DividerBlockField() {
  return <hr className="my-1 w-full border-border" />
}

export const blockFields: Record<
  BlockType,
  (props: BlockFieldProps) => ReactNode
> = {
  text: (props) => <TextBlockField {...props} />,
  heading: (props) => <TextBlockField {...props} />,
  "bulleted-list": (props) => <ListBlockField {...props} />,
  "numbered-list": (props) => <ListBlockField {...props} />,
  divider: () => <DividerBlockField />,
  "experience-entry": (props) => <ExperienceBlockField {...props} />,
  "education-entry": (props) => <EducationBlockField {...props} />,
  "skills-group": (props) => <SkillsBlockField {...props} />,
}

const HEADER: {
  key: "name" | "email" | "phone" | "city" | "linkedin"
  label: string
}[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "linkedin", label: "LinkedIn" },
]

export function PaperBlockHeader({
  header,
  onChange,
}: {
  header: {
    name: string
    email: string
    phone: string
    city: string
    linkedin: string
  }
  onChange: (
    key: "name" | "email" | "phone" | "city" | "linkedin",
    value: string
  ) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1>
        <BlockField
          label="Name"
          value={header.name}
          placeholder="Name"
          tabIndex={0}
          onChange={(value) => onChange("name", value)}
        />
      </h1>
      <div className="flex flex-wrap gap-2">
        {HEADER.filter((field) => field.key !== "name").map((field) => (
          <BlockField
            key={field.key}
            label={field.label}
            value={header[field.key]}
            placeholder={field.label}
            tabIndex={0}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  )
}
