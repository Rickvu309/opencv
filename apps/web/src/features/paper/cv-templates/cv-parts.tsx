import {
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useReducer,
} from "react"
import {
  type CvPrintModel,
  type CvSectionKind,
} from "@workspace/domain/paper-doc"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ImagePlus, Plus, User } from "lucide-react"

import { HiddenFilePicker } from "@/components/hidden-file-picker.tsx"
import { resolvePhotoSrc } from "@/lib/requests.ts"

import { cvPhotoRejection } from "../paper-api.ts"
import { addEducation, EMPTY_SECTION_CTA } from "./cv-edits.ts"
import { handleCanvasFieldKeyDown } from "./cv-keyboard.ts"
import {
  cvTypeClass,
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvSkillGroup,
  type CvTypeRole,
} from "./cv-types.ts"

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

export const PAPER_CANVAS_FIELD_CLASS = "paper-canvas-field"
export const PAPER_CANVAS_BLOCK_CLASS = "paper-canvas-block"
export const PAPER_CANVAS_AFFORDANCE_CLASS = "paper-canvas-affordance"
export const PAPER_CANVAS_NEXT_STEP_CLASS = "paper-canvas-next-step"

export const CvHistoryRevisionContext = createContext(0)

export const CvSectionTitleContext = createContext<
  CvPrintModel["sectionTitles"] | undefined
>(undefined)

export const CvPlaceholderContext = createContext(false)

export function useCvPlaceholders() {
  return useContext(CvPlaceholderContext)
}

export function cvSectionFilled(
  data: CvData,
  kind: "summary" | "experience" | "education" | "skills"
) {
  if (kind === "summary") return data.summary.trim().length > 0
  if (kind === "experience") return data.experience.length > 0
  if (kind === "education") return data.education.length > 0
  return data.skills.some(
    (group) =>
      group.label.trim().length > 0 ||
      group.items.some((item) => item.trim().length > 0)
  )
}

export function CvSection({
  className,
  filled,
  as: Tag = "section",
  children,
}: {
  className?: string
  filled: boolean
  as?: "section" | "div"
  children: ReactNode
}) {
  const placeholders = useCvPlaceholders()
  if (!placeholders && !filled) return null
  return <Tag className={className}>{children}</Tag>
}

type FieldProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  multiline?: boolean
  sectionId?: string
  historyRevision?: number
  placeholder?: string
  "aria-label": string
}

export function EditableField({
  value,
  onChange,
  className,
  multiline,
  sectionId,
  historyRevision,
  placeholder = "Add text…",
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
      data-placeholder={placeholder}
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

const CONTACT_PLACEHOLDERS = [
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "City"],
  ["linkedin", "LinkedIn"],
] as const

export function ContactLine({
  data,
  patch,
  className,
}: PatchProps & { className?: string }) {
  const { contact } = data
  const placeholders = useCvPlaceholders()
  if (placeholders) {
    return (
      <CvType role="micro" className={cn("leading-relaxed", className)}>
        {CONTACT_PLACEHOLDERS.map(([key, label], index) => (
          <span key={key}>
            {index > 0 ? (
              <span className="mx-1.5 text-border" aria-hidden="true">
                |
              </span>
            ) : null}
            <EditableField
              aria-label={label}
              placeholder={label}
              value={contact[key] ?? ""}
              onChange={(value) =>
                patch("contact", { ...contact, [key]: value })
              }
            />
          </span>
        ))}
      </CvType>
    )
  }
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
          {i > 0 ? (
            <span className="mx-1.5 text-border" aria-hidden="true">
              |
            </span>
          ) : null}
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
  const placeholders = useCvPlaceholders()
  if (!placeholders) return null
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
        "h-11 gap-1 px-1.5 text-xs font-medium md:h-6",
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
  const placeholders = useCvPlaceholders()
  if (!placeholders) return null
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
        "h-11 gap-1 px-1.5 text-xs font-medium md:h-6",
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
  kind,
}: {
  children: ReactNode
  dark?: boolean
  kind: CvSectionKind
}) {
  const custom = useContext(CvSectionTitleContext)
  const label = custom?.[kind] ?? children
  return (
    <CvType
      role="section-title"
      as="h3"
      className={cn(
        "mb-2 border-b pb-1",
        dark
          ? "border-white/20 text-white/70"
          : "border-foreground/15 text-foreground/60"
      )}
    >
      {label}
    </CvType>
  )
}

export type CvPhotoFrameValue = {
  docId?: string
  shareToken?: string
  beforePhoto?: () => Promise<void>
  afterPhoto?: () => void | Promise<void>
  notePhoto?: (ref: string | undefined, version: number) => void
}

function photoAlt(name?: string) {
  const trimmed = name?.trim()
  return trimmed ? trimmed : "Photo"
}

const CvPhotoFrameContext = createContext<CvPhotoFrameValue>({})

export function CvPhotoFrame({
  value,
  children,
}: {
  value: CvPhotoFrameValue
  children: ReactNode
}) {
  return (
    <CvPhotoFrameContext.Provider value={value}>
      {children}
    </CvPhotoFrameContext.Provider>
  )
}

function PhotoSlot({
  src,
  url,
  name,
  error,
  onPick,
}: {
  src?: string
  url?: string
  name?: string
  error?: string
  onPick: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <HiddenFilePicker ref={inputRef} accept="image/*" onFile={onPick} />
      <Button
        type="button"
        variant="ghost"
        onClick={() => inputRef.current?.click()}
        aria-label={url ? "Change profile photo" : "Add profile photo"}
        className="group cv-template-photo-slot relative h-auto min-h-11 shrink-0 overflow-hidden rounded-md border border-foreground/15 bg-muted/30 p-0 hover:border-foreground/30 hover:bg-muted/50 md:min-h-0"
      >
        {src ? (
          <img
            src={src}
            alt={photoAlt(name)}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <User className="size-6 opacity-50" strokeWidth={1.5} />
            <ImagePlus className="size-3.5 opacity-60" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-1 py-0.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
          {url ? "Change" : "Add photo"}
        </span>
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </>
  )
}

type PhotoErrorAction =
  { type: "error_shown"; message: string } | { type: "error_cleared" }

function photoErrorReducer(
  _: string | undefined,
  action: PhotoErrorAction
): string | undefined {
  return action.type === "error_shown" ? action.message : undefined
}

function CvPhotoDisplay({
  url,
  name,
  shareToken,
}: {
  url?: string
  name?: string
  shareToken?: string
}) {
  const [error, dispatchError] = useReducer(photoErrorReducer, undefined)
  return (
    <PhotoSlot
      src={resolvePhotoSrc(url, shareToken)}
      url={url}
      name={name}
      error={error}
      onPick={(file) => {
        dispatchError({
          type: "error_shown",
          message: cvPhotoRejection(file) ?? "Open this CV to add a photo.",
        })
      }}
    />
  )
}

export function CvPhoto({ url, name }: { url?: string; name?: string }) {
  const frame = useContext(CvPhotoFrameContext)
  return <CvPhotoDisplay url={url} name={name} shareToken={frame.shareToken} />
}
