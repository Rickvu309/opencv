import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react"
import { useBlockNoteEditor } from "@blocknote/react"
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

type CvChrome = {
  showPhoto: boolean
  askCoach: (text: string) => void
}

export const CvChromeContext = createContext<CvChrome>({
  showPhoto: false,
  askCoach: () => undefined,
})

let coachAsk: (text: string) => void = () => undefined

export function bindCvCoach(next: (text: string) => void) {
  coachAsk = next
}

export function askCvCoach(text: string) {
  coachAsk(text)
}

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
        {(
          [
            ["email", "Email"],
            ["phone", "Phone"],
            ["city", "City"],
            ["linkedin", "LinkedIn"],
          ] as const
        ).map(([name, label], index) => (
          <span
            key={name}
            className="inline-flex items-center gap-x-2 whitespace-nowrap"
          >
            {index > 0 ? <span aria-hidden="true">|</span> : null}
            <CvField
              blockId={block.id}
              name={name}
              label={label}
              value={prop(block, name)}
              placeholder={label}
              size="contact"
            />
          </span>
        ))}
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

type SectionEditor = {
  document: { id: string; type: string; children?: { id: string }[] }[]
  insertBlocks: (
    blocks: unknown[],
    ref: string,
    placement: "after"
  ) => { id: string; children?: { id: string }[] }[]
  setTextCursorPosition: (id: string, pos: "start" | "end") => void
  focus: () => void
  onChange: (callback: () => void) => () => void
}

function SectionView({ block, contentRef }: ViewProps) {
  const editor = useBlockNoteEditor() as unknown as SectionEditor
  const [, bump] = useReducer((tick: number) => tick + 1, 0)
  useEffect(() => editor.onChange(() => bump()), [editor])
  const index = editor.document.findIndex((item) => item.id === block.id)
  const next = editor.document[index + 1]
  const empty =
    !next || next.type === "paperSection" || next.type === "paperHeader"
  const kind = block.props.kind ?? ""
  const placeholder =
    kind === "experience"
      ? "Role, company"
      : kind === "education"
        ? "School, degree"
        : kind === "skills"
          ? "Tools, software and languages"
          : "Add a line"
  const add = () => {
    const follow =
      kind === "experience"
        ? { type: "paperExperience" }
        : kind === "education"
          ? { type: "paperEducation" }
          : kind === "skills"
            ? {
                type: "paperSkills",
                children: [{ type: "paperSkillItem" }],
              }
            : { type: "paragraph" }
    const created = editor.insertBlocks([follow], block.id, "after")
    const holder = created[0]
    if (!holder) return
    const item =
      kind === "skills"
        ? (editor.document.find((entry) => entry.id === holder.id)
            ?.children?.[0]?.id ?? holder.children?.[0]?.id)
        : undefined
    if (item) {
      editor.setTextCursorPosition(item, "start")
      editor.focus()
      return
    }
    const field = document.querySelector<HTMLElement>(
      `[data-cv-block-fields="${CSS.escape(holder.id)}"] [data-cv-field]`
    )
    if (field) {
      field.focus()
      return
    }
    editor.setTextCursorPosition(holder.id, "start")
    editor.focus()
  }
  return (
    <div className="flex flex-col gap-1">
      <div
        ref={contentRef}
        data-cv-size="section"
        className="font-medium tracking-wide uppercase"
      />
      <div className="h-px bg-foreground/80" />
      {empty ? (
        <button
          type="button"
          data-cv-section={block.id}
          className="h-11 text-start text-muted-foreground md:h-7"
          onClick={add}
        >
          {placeholder}
        </button>
      ) : null}
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
      className="flex w-full flex-wrap items-baseline gap-x-2"
    >
      <span className="inline-flex items-baseline whitespace-nowrap">
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
      </span>
      <span className="ms-auto inline-flex whitespace-nowrap">
        <CvField
          blockId={block.id}
          name="period"
          label="Dates"
          value={prop(block, "period")}
          placeholder="Dates"
          size="dates"
        />
      </span>
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
