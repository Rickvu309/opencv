import {
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
} from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ImagePlus, Plus, User } from "lucide-react"
import { addEducation, EMPTY_SECTION_CTA } from "../paper-cv-edits.ts"
import { handleCanvasFieldKeyDown } from "../paper-cv-keyboard.ts"
import {
  cvTypeClass,
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvSkillGroup,
  type CvTypeRole,
} from "../paper-cv-types.ts"

export function CvType({
  role,
  as: Tag = "p",
  className,
  children,
}: {
  role: CvTypeRole
  as?: ElementType
  className?: string
  children: ReactNode
}) {
  return (
    <Tag data-cv-type={role} className={cn(cvTypeClass(role), className)}>
      {children}
    </Tag>
  )
}

/** QVE-206: structured canvas field hook — chrome lives in `paper.css`. */
export const PAPER_CANVAS_FIELD_CLASS = "paper-canvas-field"
/** QVE-207: hover/focus-within block for quiet add/remove chrome. */
export const PAPER_CANVAS_BLOCK_CLASS = "paper-canvas-block"
export const PAPER_CANVAS_AFFORDANCE_CLASS = "paper-canvas-affordance"
/** QVE-209: always-visible next step on an empty section (not hover-hidden). */
export const PAPER_CANVAS_NEXT_STEP_CLASS = "paper-canvas-next-step"

export const CvHistoryRevisionContext = createContext(0)

type FieldProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  multiline?: boolean
  sectionId?: string
  historyRevision?: number
  "aria-label": string
}

export function EditableField({
  value,
  onChange,
  className,
  multiline,
  sectionId,
  historyRevision,
  "aria-label": ariaLabel,
}: FieldProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const Tag = "span"
  const contextRevision = useContext(CvHistoryRevisionContext)
  const revision = historyRevision ?? contextRevision
  const lastRevision = useRef(revision)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fromHistory = revision !== lastRevision.current
    lastRevision.current = revision
    if (!fromHistory && document.activeElement === el) return
    if (el.textContent !== value) el.textContent = value
  }, [value, revision])

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      role="textbox"
      aria-label={ariaLabel}
      data-paper-section={
        sectionId ?? ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      }
      data-paper-canvas-field=""
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        handleCanvasFieldKeyDown(event)
      }}
      className={cn(
        PAPER_CANVAS_FIELD_CLASS,
        "empty:before:text-muted-foreground/50 empty:before:content-[attr(data-placeholder)]",
        multiline && "block",
        className
      )}
      data-placeholder="Add text…"
    />
  )
}

export type PatchProps = {
  data: CvData
  patch: <K extends keyof CvData>(key: K, value: CvData[K]) => void
  patchExperience: (index: number, next: Partial<CvExperience>) => void
  patchEducation: (index: number, next: Partial<CvEducation>) => void
}

export type TemplateProps = PatchProps & {
  setExperience: (experience: CvExperience[]) => void
  setEducation: (education: CvEducation[]) => void
  setSkills: (
    skills: CvSkillGroup[] | ((current: CvSkillGroup[]) => CvSkillGroup[])
  ) => void
}

export function ContactLine({
  data,
  patch,
  className,
}: PatchProps & { className?: string }) {
  const { contact } = data
  const parts = [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin,
  ].filter(Boolean)

  return (
    <CvType role="micro" className={cn("leading-relaxed", className)}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? <span className="mx-1.5 text-border">|</span> : null}
          <EditableField
            aria-label="Contact detail"
            value={part ?? ""}
            onChange={(value) => {
              const keys: (keyof typeof contact)[] = [
                "email",
                "phone",
                "location",
                "linkedin",
              ]
              const key = keys[i]
              if (key) patch("contact", { ...contact, [key]: value })
            }}
          />
        </span>
      ))}
    </CvType>
  )
}

export function CanvasAffordance({
  label,
  onClick,
  dark,
  children,
}: {
  label: string
  onClick: () => void
  dark?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-label={label}
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        PAPER_CANVAS_AFFORDANCE_CLASS,
        "h-6 gap-1 px-1.5 text-2xs font-medium",
        dark
          ? "text-white/65 hover:bg-white/10 hover:text-white"
          : "text-muted-foreground"
      )}
    >
      {children}
    </Button>
  )
}

export function SectionNextStep({
  label,
  onClick,
  dark,
}: {
  label: string
  onClick: () => void
  dark?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-label={label}
      data-paper-section-cta=""
      onClick={onClick}
      className={cn(
        PAPER_CANVAS_NEXT_STEP_CLASS,
        "h-6 gap-1 px-1.5 text-2xs font-medium",
        dark
          ? "text-white/65 hover:bg-white/10 hover:text-white"
          : "text-muted-foreground"
      )}
    >
      <Plus className="size-3" />
      {label}
    </Button>
  )
}

export function EducationEmptyCta({
  education,
  setEducation,
  dark,
}: {
  education: CvEducation[]
  setEducation: (education: CvEducation[]) => void
  dark?: boolean
}) {
  if (education.length > 0) return null
  return (
    <SectionNextStep
      label={EMPTY_SECTION_CTA.education}
      dark={dark}
      onClick={() => setEducation(addEducation(education))}
    />
  )
}

export function SectionTitle({
  children,
  dark,
}: {
  children: ReactNode
  dark?: boolean
}) {
  return (
    <CvType
      role="section-title"
      as="h3"
      className={cn(
        "mb-2 border-b pb-1",
        dark
          ? "border-white/20 text-white/70"
          : "border-foreground/15 text-foreground/55"
      )}
    >
      {children}
    </CvType>
  )
}

export function CvPhoto({
  url,
  onChange,
}: {
  url?: string
  onChange: (url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(URL.createObjectURL(file))
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="ghost"
        onClick={() => inputRef.current?.click()}
        aria-label={url ? "Change profile photo" : "Add profile photo"}
        className="group cv-template-photo-slot relative h-auto shrink-0 overflow-hidden rounded-md border border-foreground/15 bg-muted/30 p-0 hover:border-foreground/30 hover:bg-muted/50"
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <User className="size-6 opacity-50" strokeWidth={1.5} />
            <ImagePlus className="size-3.5 opacity-60" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-1 py-0.5 text-3xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
          {url ? "Change" : "Add photo"}
        </span>
      </Button>
    </>
  )
}
