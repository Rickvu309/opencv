import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
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

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { CvPhoto } from "./cv-templates/cv-parts.tsx"
import { CvField } from "./cv-field.tsx"
import "./cv-editor.css"
import "./design/cv-editor.pen.css"

type CvChrome = {
  showPhoto: boolean
  askCoach: (text: string) => void
  seedName: string
}

export const CvChromeContext = createContext<CvChrome>({
  showPhoto: false,
  askCoach: () => undefined,
  seedName: "",
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
  content?: unknown
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

const SECTION_LABEL: Record<string, string> = {
  Summary: "SUMMARY",
  Experience: "EXPERIENCE",
  Education: "EDUCATION",
  Skills: "SKILLS",
  Projects: "PROJECTS",
  Activities: "ACTIVITIES",
  Awards: "AWARDS",
  Languages: "LANGUAGES",
}

function inlineText(content: unknown) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((item) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "text" in item)
        return String((item as { text?: string }).text ?? "")
      return ""
    })
    .join("")
}

type SectionEditor = {
  document: { id: string; type: string; children?: { id: string }[] }[]
  insertBlocks: (
    blocks: unknown[],
    ref: string,
    placement: "after"
  ) => { id: string; children?: { id: string }[] }[]
  updateBlock: (id: string, update: unknown) => void
  getBlock: (id: string) => FieldBlock | undefined
  getParentBlock: (block: FieldBlock) => { children?: { id: string }[] } | null
  setTextCursorPosition: (id: string, pos: "start" | "end") => void
  focus: () => void
  onChange: (callback: () => void) => () => void
}

const CONTACT = [
  ["email", "Email"],
  ["phone", "Phone"],
  ["city", "City"],
  ["linkedin", "LinkedIn"],
] as const

function HeaderView({ block }: ViewProps) {
  const chrome = useContext(CvChromeContext)
  const editor = useBlockNoteEditor() as unknown as SectionEditor
  const seeded = useRef(false)
  const name = prop(block, "name")
  useEffect(() => {
    if (seeded.current) return
    const next = chrome.seedName.trim()
    if (!next || next === "Account") return
    const live = editor.getBlock(block.id)
    if (!live || String(live.props.name ?? "").trim() !== "") {
      seeded.current = true
      return
    }
    seeded.current = true
    editor.updateBlock(block.id, { props: { ...live.props, name: next } })
  }, [block.id, chrome.seedName, editor])
  const [contactOpen, setContactOpen] = useState(false)
  const values = CONTACT.map(([field]) => prop(block, field))
  const showAll = contactOpen || values.every((value) => value.trim() === "")
  const visible = CONTACT.filter((_, index) => showAll || values[index]?.trim())
  return (
    <div data-cv-block-fields={block.id} className="flex flex-col">
      <h1>
        <CvField
          blockId={block.id}
          name="name"
          label="Full name"
          value={name}
          placeholder="Name"
          size="name"
        />
      </h1>
      <div
        data-cv-contact=""
        className="flex flex-wrap items-center"
        onFocus={() => setContactOpen(true)}
        onBlur={(event) => {
          const next = event.relatedTarget
          if (next instanceof Node && event.currentTarget.contains(next)) return
          setContactOpen(false)
        }}
      >
        {visible.map(([field, label], index) => (
          <span
            key={field}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {index > 0 ? (
              <span aria-hidden="true" data-cv-size="contact" data-cv-pipe="">
                |
              </span>
            ) : null}
            <CvField
              blockId={block.id}
              name={field}
              label={label}
              value={prop(block, field)}
              placeholder={label}
              size="contact"
            />
          </span>
        ))}
      </div>
      {chrome.showPhoto ? (
        <CvPhoto
          url={prop(block, "photo") || undefined}
          name={name}
          onChange={() => undefined}
        />
      ) : null}
    </div>
  )
}

function focusCreated(id: string | undefined) {
  if (!id) return
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(
        `[data-cv-block-fields="${CSS.escape(id)}"] [data-cv-field]`
      )
      ?.focus()
  })
}

function ExperienceGhost({
  blockId,
  editor,
}: {
  blockId: string
  editor: SectionEditor
}) {
  const made = useRef(false)
  const datesRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLInputElement>(null)
  const create = () => {
    if (made.current) return
    const role = roleRef.current?.value ?? ""
    const period = datesRef.current?.value ?? ""
    if (!role && !period) return
    made.current = true
    const created = editor.insertBlocks(
      [
        {
          type: "paperExperience",
          props: { role, company: "", period, location: "" },
        },
      ],
      blockId,
      "after"
    )
    focusCreated(created[0]?.id)
  }
  return (
    <div className="mt-[9px] flex w-full flex-col gap-1">
      <div className="flex w-full items-baseline">
        <Input
          ref={roleRef}
          size={1}
          aria-label="Role"
          placeholder="Role, company"
          data-cv-section={blockId}
          data-cv-size="entry"
          data-cv-field="role"
          className="h-auto min-h-0 w-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
          onInput={create}
        />
        <span className="ms-auto inline-grid w-max shrink-0">
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 text-[10.5px] leading-[12.5px] whitespace-pre"
          >
            Dates
          </span>
          <Input
            ref={datesRef}
            size={1}
            aria-label="Dates"
            placeholder="Dates"
            data-cv-size="dates"
            data-cv-field="period"
            className="col-start-1 row-start-1 h-auto min-h-0 w-full min-w-0 rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
            onInput={create}
          />
        </span>
      </div>
      <div className="flex items-baseline gap-[7px]">
        <span data-cv-bullet="ghost" aria-hidden="true">
          •
        </span>
        <span data-cv-ghost-line="">
          What you did, and what changed because of it
        </span>
      </div>
    </div>
  )
}

function PlainGhost({
  blockId,
  editor,
  label,
  placeholder,
  follow,
}: {
  blockId: string
  editor: SectionEditor
  label: string
  placeholder: string
  follow: Record<string, unknown>
}) {
  const made = useRef(false)
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      data-cv-section={blockId}
      data-cv-size="note"
      className="mt-[9px] h-auto min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
      onInput={(event) => {
        if (made.current) return
        const value = event.currentTarget.value
        if (!value) return
        made.current = true
        const block =
          follow.type === "paperEducation"
            ? {
                ...follow,
                props: { school: value, degree: "", period: "", detail: "" },
              }
            : follow.type === "paperSkills"
              ? {
                  type: "paperSkills",
                  children: value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .map((text) => ({ type: "paperSkillItem", content: text })),
                }
              : { type: "paragraph", content: value }
        const created = editor.insertBlocks([block], blockId, "after")
        focusCreated(created[0]?.id)
      }}
    />
  )
}

function SectionView({ block, contentRef }: ViewProps) {
  const editor = useBlockNoteEditor() as unknown as SectionEditor
  const [, bump] = useReducer((tick: number) => tick + 1, 0)
  useEffect(() => editor.onChange(() => bump()), [editor])
  const title = inlineText(block.content)
  const shown = SECTION_LABEL[title] ?? title
  const index = editor.document.findIndex((item) => item.id === block.id)
  let occupied = false
  for (let cursor = index + 1; cursor < editor.document.length; cursor += 1) {
    const item = editor.document[cursor]
    if (!item || item.type === "paperSection" || item.type === "paperHeader")
      break
    if (item.type !== "paragraph") occupied = true
  }
  const empty = !occupied
  const kind = block.props.kind ?? ""
  return (
    <div className="flex w-full flex-col" data-cv-kind={kind}>
      <div className="relative">
        <div ref={contentRef} data-cv-size="section" className="sr-only" />
        <div data-cv-size="section">{shown}</div>
      </div>
      <div data-cv-rule="" />
      {empty && kind === "experience" ? (
        <ExperienceGhost blockId={block.id} editor={editor} />
      ) : null}
      {empty && kind === "education" ? (
        <PlainGhost
          blockId={block.id}
          editor={editor}
          label="School"
          placeholder="School, degree"
          follow={{ type: "paperEducation" }}
        />
      ) : null}
      {empty && kind === "skills" ? (
        <PlainGhost
          blockId={block.id}
          editor={editor}
          label="Skills"
          placeholder="Tools, software and languages"
          follow={{ type: "paperSkills" }}
        />
      ) : null}
      {empty &&
      kind !== "experience" &&
      kind !== "education" &&
      kind !== "skills" ? (
        <Button
          type="button"
          variant="ghost"
          data-cv-section={block.id}
          className="mt-[9px] h-11 w-full justify-start rounded-none px-0 text-start font-normal whitespace-normal shadow-none md:h-7"
          onClick={() => {
            const created = editor.insertBlocks(
              [{ type: "paragraph" }],
              block.id,
              "after"
            )
            const holder = created[0]
            if (!holder) return
            editor.setTextCursorPosition(holder.id, "start")
            editor.focus()
          }}
        >
          Add a line
        </Button>
      ) : null}
    </div>
  )
}

function BulletView({ contentRef }: ViewProps) {
  return (
    <div className="flex items-baseline gap-[7px]">
      <span data-cv-bullet="" aria-hidden="true">
        •
      </span>
      <div ref={contentRef} className="min-w-0 flex-1" />
    </div>
  )
}

function SkillItemView({ block, contentRef }: ViewProps) {
  const editor = useBlockNoteEditor() as unknown as SectionEditor
  const parent = editor.getParentBlock(block)
  const kids = parent?.children ?? []
  const last = kids.length === 0 || kids[kids.length - 1]?.id === block.id
  return (
    <span>
      <span ref={contentRef} />
      {last ? null : <span aria-hidden="true">, </span>}
    </span>
  )
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
  datesPlaceholder,
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
  datesPlaceholder: string
}) {
  const [focus, dispatch] = useReducer(focusReducer, {
    right: false,
    extra: false,
  })
  const leftValue = prop(block, left)
  const rightValue = prop(block, right)
  const extraValue = prop(block, extraName)
  const empty = leftValue === "" && rightValue === ""
  const editing = focus.right
  const showCombined = !empty && !editing
  const joined = empty && !editing
  const combined = [leftValue, rightValue].filter(Boolean).join(", ")
  return (
    <div
      data-cv-block-fields={block.id}
      className="flex w-full flex-wrap items-baseline"
    >
      {showCombined ? (
        <Button
          type="button"
          variant="ghost"
          data-cv-joined=""
          className="h-auto min-h-0 justify-start rounded-none p-0 text-start shadow-none"
          onClick={(event) => {
            dispatch({ type: "right", on: true })
            const row = event.currentTarget.parentElement
            requestAnimationFrame(() =>
              row
                ?.querySelector<HTMLElement>(`[data-cv-field="${left}"]`)
                ?.focus()
            )
          }}
        >
          {combined}
        </Button>
      ) : null}
      <span
        className={
          showCombined
            ? "inline-block size-0 overflow-hidden"
            : "inline-flex items-baseline whitespace-nowrap"
        }
      >
        <CvField
          blockId={block.id}
          name={left}
          label={leftLabel}
          value={leftValue}
          placeholder={joined ? joint : leftLabel}
          size="entry"
          onFocusChange={(on) => dispatch({ type: "right", on })}
        />
        {joined || showCombined ? null : (
          <span aria-hidden="true" data-cv-size="entry">
            ,{" "}
          </span>
        )}
        <span
          className={
            joined || showCombined
              ? "inline-block size-0 overflow-hidden"
              : undefined
          }
        >
          <CvField
            blockId={block.id}
            name={right}
            label={rightLabel}
            value={rightValue}
            placeholder={joined ? "" : rightLabel}
            size="entry"
            compact={joined}
            onFocusChange={(on) => dispatch({ type: "right", on })}
          />
        </span>
      </span>
      <span className="ms-auto inline-flex whitespace-nowrap">
        <CvField
          blockId={block.id}
          name="period"
          label="Dates"
          value={prop(block, "period")}
          placeholder={datesPlaceholder}
          size="dates"
        />
      </span>
      <CvField
        blockId={block.id}
        name={extraName}
        label={extraLabel}
        value={extraValue}
        placeholder={extraPlaceholder}
        className={
          extraValue.trim()
            ? undefined
            : "size-0 overflow-hidden p-0 focus:size-auto focus:h-auto focus:w-full focus:overflow-visible"
        }
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
      datesPlaceholder="Dates"
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
      datesPlaceholder="Years"
    />
  )
}

function SkillsView({ block }: ViewProps) {
  return (
    <div data-cv-block-fields={block.id}>
      <CvField
        blockId={block.id}
        name="label"
        label="Skills label"
        value={prop(block, "label")}
        placeholder=""
        className="hidden"
      />
    </div>
  )
}

const cvBlockSpecs = {
  paragraph: defaultBlockSpecs.paragraph,
  heading: createHeadingBlockSpec({ levels: [2, 3], defaultLevel: 2 }),
  bulletListItem: reactSpec(
    defaultBlockSpecs.bulletListItem.config,
    BulletView
  ),
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
