import { createContext, useContext, useReducer, type ReactNode } from "react"
import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from "@blocknote/core"
import { createReactBlockSpec } from "@blocknote/react"
import { paperBlockConfigs } from "@workspace/paper-crdt"

import { CvPhoto } from "./cv-templates/cv-parts.tsx"
import { CvField } from "./cv-field.tsx"
import "./cv-editor.css"

export const CvChromeContext = createContext({ showPhoto: false })

type FieldBlock = {
  id: string
  type: string
  props: Record<string, string>
  children: { id: string }[]
}

type ViewProps = {
  block: FieldBlock
  contentRef?: (node: HTMLElement | null) => void
}

type FocusState = { right: boolean; extra: boolean }
type FocusAction = { type: "right" | "extra"; on: boolean }

function focusReducer(state: FocusState, action: FocusAction): FocusState {
  return { ...state, [action.type]: action.on }
}

function reactSpec(config: object, render: (props: ViewProps) => ReactNode) {
  return createReactBlockSpec(config as never, { render: render as never })()
}

function prop(block: FieldBlock, name: string) {
  return block.props[name] ?? ""
}

function HeaderView({ block }: ViewProps) {
  const chrome = useContext(CvChromeContext)
  return (
    <div data-cv-block-fields={block.id} className="flex flex-col gap-1">
      <CvField
        blockId={block.id}
        name="name"
        label="Full name"
        value={prop(block, "name")}
        placeholder="Full name"
        size="name"
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CvField
          blockId={block.id}
          name="email"
          label="Email"
          value={prop(block, "email")}
          placeholder="Email"
          size="contact"
        />
        <span aria-hidden="true">|</span>
        <CvField
          blockId={block.id}
          name="phone"
          label="Phone"
          value={prop(block, "phone")}
          placeholder="Phone"
          size="contact"
        />
        <span aria-hidden="true">|</span>
        <CvField
          blockId={block.id}
          name="city"
          label="City"
          value={prop(block, "city")}
          placeholder="City"
          size="contact"
        />
        <span aria-hidden="true">|</span>
        <CvField
          blockId={block.id}
          name="linkedin"
          label="LinkedIn"
          value={prop(block, "linkedin")}
          placeholder="LinkedIn"
          size="contact"
        />
      </div>
      {chrome.showPhoto ? (
        <CvPhoto
          url={prop(block, "photo") || undefined}
          name={prop(block, "name")}
          onChange={() => undefined}
        />
      ) : null}
    </div>
  )
}

function SectionView({ contentRef }: ViewProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        ref={contentRef}
        className="text-[9.5px] font-medium tracking-wide uppercase"
      />
      <div className="h-px bg-foreground/80" />
    </div>
  )
}

function SkillItemView({ contentRef }: ViewProps) {
  return <span ref={contentRef} />
}

function EntryRow({
  block,
  left,
  right,
  joint,
  leftLabel,
  rightLabel,
  extraName,
  extraLabel,
  extraPlaceholder,
}: {
  block: FieldBlock
  left: string
  right: string
  joint: string
  leftLabel: string
  rightLabel: string
  extraName: string
  extraLabel: string
  extraPlaceholder: string
}) {
  const [focus, dispatch] = useReducer(focusReducer, {
    right: false,
    extra: false,
  })
  const leftValue = prop(block, left)
  const rightValue = prop(block, right)
  const extraValue = prop(block, extraName)
  const joined = leftValue === "" && rightValue === "" && !focus.right
  const extraShown = extraValue.trim() !== "" || focus.extra
  return (
    <div
      data-cv-block-fields={block.id}
      className="flex flex-wrap items-baseline gap-x-2"
    >
      <CvField
        blockId={block.id}
        name={left}
        label={leftLabel}
        value={leftValue}
        placeholder={joined ? joint : leftLabel}
      />
      {joined ? null : <span aria-hidden="true">, </span>}
      <CvField
        blockId={block.id}
        name={right}
        label={rightLabel}
        value={rightValue}
        placeholder={joined ? "" : rightLabel}
        compact={joined}
        onFocusChange={(on) => dispatch({ type: "right", on })}
      />
      <CvField
        blockId={block.id}
        name="period"
        label="Dates"
        value={prop(block, "period")}
        placeholder="Dates"
        size="dates"
        className="ms-auto"
      />
      <CvField
        blockId={block.id}
        name={extraName}
        label={extraLabel}
        value={extraValue}
        placeholder={extraPlaceholder}
        className={extraShown ? undefined : "sr-only"}
        onFocusChange={(on) => dispatch({ type: "extra", on })}
      />
    </div>
  )
}

function ExperienceView({ block }: ViewProps) {
  return (
    <EntryRow
      block={block}
      left="role"
      right="company"
      joint="Role, company"
      leftLabel="Role"
      rightLabel="Company"
      extraName="location"
      extraLabel="Location"
      extraPlaceholder="Location"
    />
  )
}

function EducationView({ block }: ViewProps) {
  return (
    <EntryRow
      block={block}
      left="school"
      right="degree"
      joint="School, degree"
      leftLabel="School"
      rightLabel="Degree"
      extraName="detail"
      extraLabel="Detail"
      extraPlaceholder="Detail"
    />
  )
}

function SkillsView({ block }: ViewProps) {
  return (
    <div data-cv-block-fields={block.id}>
      <CvField
        blockId={block.id}
        name="label"
        label="Skills"
        value={prop(block, "label")}
        placeholder="Skills"
      />
    </div>
  )
}

const cvBlockSpecs = {
  paragraph: defaultBlockSpecs.paragraph,
  heading: createHeadingBlockSpec({ levels: [2, 3], defaultLevel: 2 }),
  bulletListItem: defaultBlockSpecs.bulletListItem,
  numberedListItem: defaultBlockSpecs.numberedListItem,
  divider: defaultBlockSpecs.divider,
  paperHeader: reactSpec(paperBlockConfigs.paperHeader, HeaderView),
  paperSection: reactSpec(paperBlockConfigs.paperSection, SectionView),
  paperExperience: reactSpec(paperBlockConfigs.paperExperience, ExperienceView),
  paperEducation: reactSpec(paperBlockConfigs.paperEducation, EducationView),
  paperSkills: reactSpec(paperBlockConfigs.paperSkills, SkillsView),
  paperSkillItem: reactSpec(paperBlockConfigs.paperSkillItem, SkillItemView),
} satisfies Record<keyof typeof paperBlockConfigs, object>

export const cvSchema = BlockNoteSchema.create({
  blockSpecs: cvBlockSpecs,
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
  },
})
