import type { ReactNode } from "react"
import type { BlockType, CvBlock, CvSectionKind } from "@workspace/domain"

import {
  EducationBlockField,
  ExperienceBlockField,
  SkillsBlockField,
} from "./paper-block-entries.tsx"
import { BlockField, type BlockFieldProps } from "./paper-block-field.tsx"
import { newId } from "./paper-block-ops.ts"

function textLabel(kind: CvSectionKind, type: "text" | "heading") {
  if (kind === "summary" && type === "heading") return "Headline"
  if (kind === "summary" && type === "text") return "Summary"
  return type === "heading" ? "Heading" : "Text"
}

function TextBlockField({ block, sectionKind, onChange, onSlash }: BlockFieldProps) {
  if (block.type !== "text" && block.type !== "heading") return null
  const label = textLabel(sectionKind, block.type)
  return (
    <BlockField
      label={label}
      value={block.text}
      placeholder={label}
      onChange={(text) => onChange({ ...block, text })}
      onSlash={onSlash}
    />
  )
}

function ListBlockField({ block, onChange, onCommit, onSlash }: BlockFieldProps) {
  if (block.type !== "bulleted-list" && block.type !== "numbered-list") {
    return null
  }
  const items = block.items.length > 0 ? block.items : [{ id: "draft-item", text: "" }]
  function write(next: { id: string; text: string }[]) {
    const stored = next.filter((item) => item.id !== "draft-item" || item.text)
    const normalized = stored.map((item) =>
      item.id === "draft-item" ? { id: newId(), text: item.text } : item
    )
    onChange({ ...block, items: normalized } as CvBlock)
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-start gap-2">
          <span className="pt-0.5 text-sm text-muted-foreground" aria-hidden>
            {block.type === "numbered-list" ? `${index + 1}.` : "•"}
          </span>
          <BlockField
            label="List item"
            value={item.text}
            placeholder="List item"
            onSlash={onSlash}
            onEnter={() => {
              const next = items.slice()
              next.splice(index + 1, 0, { id: newId(), text: "" })
              onCommit({ ...block, items: next } as CvBlock)
            }}
            onChange={(text) =>
              write(items.map((row) => (row.id === item.id ? { ...row, text } : row)))
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

export const blockFields: Record<BlockType, (props: BlockFieldProps) => ReactNode> = {
  text: (props) => <TextBlockField {...props} />,
  heading: (props) => <TextBlockField {...props} />,
  "bulleted-list": (props) => <ListBlockField {...props} />,
  "numbered-list": (props) => <ListBlockField {...props} />,
  divider: () => <DividerBlockField />,
  "experience-entry": (props) => <ExperienceBlockField {...props} />,
  "education-entry": (props) => <EducationBlockField {...props} />,
  "skills-group": (props) => <SkillsBlockField {...props} />,
}

const HEADER: { key: "name" | "email" | "phone" | "city" | "linkedin"; label: string }[] = [
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
  onChange: (key: "name" | "email" | "phone" | "city" | "linkedin", value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1>
        <BlockField
          label="Name"
          value={header.name}
          placeholder="Name"
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
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  )
}
