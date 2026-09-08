/**
 * CV print-paper templates. Shared type roles live in paper.css (ADR-0010
 * names, print-scaled). The product-sidebar hex stays here on purpose —
 * print layout is a documented ADR-0010 exception. Focus/selection chrome
 * is QVE-206 (`paper-canvas-field` in paper.css). Café Tab/Esc is QVE-208.
 * Empty-section next steps are QVE-209 (`paper-canvas-next-step`).
 * Honest undo/redo of structured fields is QVE-210.
 */
import type { ElementType, KeyboardEvent, ReactNode } from "react"
import { createContext, useContext, useEffect, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Copy, ImagePlus, Plus, User, X } from "lucide-react"

import {
  addEducation,
  addExperienceBullet,
  addExperienceRole,
  addSkillItem,
  duplicateExperienceRole,
  EMPTY_SECTION_CTA,
  removeEducation,
  removeExperienceBullet,
  removeExperienceRole,
  removeSkillItem,
  renameSkillGroup,
  renameSkillItem,
} from "./paper-cv-edits.ts"
import { handleCanvasFieldKeyDown } from "./paper-cv-keyboard.ts"
import {
  cvTypeClass,
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvSkillGroup,
  type CvTypeRole,
} from "./paper-cv-types.ts"

function CvType({
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

const CvHistoryRevisionContext = createContext(0)

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

type Props = {
  data: CvData
  onChange: (data: CvData) => void
  historyRevision?: number
}

export function CvDocument({ data, onChange, historyRevision = 0 }: Props) {
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data, historyRevision])

  function patch<K extends keyof CvData>(key: K, value: CvData[K]) {
    const next = { ...dataRef.current, [key]: value }
    dataRef.current = next
    onChange(next)
  }

  function patchExperience(index: number, next: Partial<CvExperience>) {
    const experience = dataRef.current.experience.map((item, i) =>
      i === index ? { ...item, ...next } : item
    )
    patch("experience", experience)
  }

  function patchEducation(index: number, next: Partial<CvEducation>) {
    const education = dataRef.current.education.map((item, i) =>
      i === index ? { ...item, ...next } : item
    )
    patch("education", education)
  }

  function setExperience(experience: CvExperience[]) {
    patch("experience", experience)
  }

  function setEducation(education: CvEducation[]) {
    patch("education", education)
  }

  function setSkills(
    skills:
      | CvSkillGroup[]
      | ((current: CvSkillGroup[]) => CvSkillGroup[])
  ) {
    const next =
      typeof skills === "function" ? skills(dataRef.current.skills) : skills
    patch("skills", next)
  }

  const templateProps: TemplateProps = {
    data,
    patch,
    patchExperience,
    patchEducation,
    setExperience,
    setEducation,
    setSkills,
  }

  let tree
  switch (data.templateId) {
    case "product":
      tree = <ProductCv {...templateProps} />
      break
    case "service":
      tree = <ServiceCv {...templateProps} />
      break
    case "academic":
      tree = <AcademicCv {...templateProps} />
      break
    case "photo":
      tree = <PhotoCv {...templateProps} />
      break
    default:
      tree = <InternshipCv {...templateProps} />
  }

  return (
    <CvHistoryRevisionContext.Provider value={historyRevision}>
      {tree}
    </CvHistoryRevisionContext.Provider>
  )
}

type PatchProps = {
  data: CvData
  patch: <K extends keyof CvData>(key: K, value: CvData[K]) => void
  patchExperience: (index: number, next: Partial<CvExperience>) => void
  patchEducation: (index: number, next: Partial<CvEducation>) => void
}

type TemplateProps = PatchProps & {
  setExperience: (experience: CvExperience[]) => void
  setEducation: (education: CvEducation[]) => void
  setSkills: (
    skills: CvSkillGroup[] | ((current: CvSkillGroup[]) => CvSkillGroup[])
  ) => void
}

function ContactLine({
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

function CanvasAffordance({
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

function SectionNextStep({
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

function ExperienceList({
  experience,
  setExperience,
  patchExperience,
  dark,
}: {
  experience: CvExperience[]
  setExperience: (experience: CvExperience[]) => void
  patchExperience: (index: number, next: Partial<CvExperience>) => void
  dark?: boolean
}) {
  if (experience.length === 0) {
    return (
      <SectionNextStep
        label={EMPTY_SECTION_CTA.experience}
        dark={dark}
        onClick={() => setExperience(addExperienceRole(experience))}
      />
    )
  }

  return experience.map((item, i) => (
    <ExperienceBlock
      key={i}
      item={item}
      index={i}
      experience={experience}
      setExperience={setExperience}
      patchExperience={patchExperience}
      dark={dark}
    />
  ))
}

function ExperienceBlock({
  item,
  index,
  experience,
  setExperience,
  patchExperience,
  dark,
}: {
  item: CvExperience
  index: number
  experience: CvExperience[]
  setExperience: (experience: CvExperience[]) => void
  patchExperience: (index: number, next: Partial<CvExperience>) => void
  dark?: boolean
}) {
  return (
    <div
      className={cn(PAPER_CANVAS_BLOCK_CLASS, "mb-3 last:mb-0")}
      data-paper-section={`experience-${index}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <CvType role="label" className={cn(dark && "text-white")}>
          <EditableField
            aria-label="Role"
            value={item.role}
            onChange={(role) => patchExperience(index, { role })}
          />
          <span
            className={cn(
              "font-normal",
              dark ? "text-white/60" : "text-muted-foreground"
            )}
          >
            {" "}
            ·{" "}
          </span>
          <EditableField
            aria-label="Company"
            value={item.company}
            onChange={(company) => patchExperience(index, { company })}
          />
        </CvType>
        <CvType
          role="micro"
          className={cn(
            "shrink-0 font-medium tracking-wide uppercase",
            dark ? "text-white/50" : "text-muted-foreground"
          )}
        >
          <EditableField
            aria-label="Period"
            value={item.period}
            onChange={(period) => patchExperience(index, { period })}
          />
        </CvType>
      </div>
      {item.location ? (
        <CvType
          role="micro"
          className={cn(
            "mt-0.5",
            dark ? "text-white/50" : "text-muted-foreground"
          )}
        >
          <EditableField
            aria-label="Location"
            value={item.location}
            onChange={(location) => patchExperience(index, { location })}
          />
        </CvType>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-0.5">
        <CanvasAffordance
          label="Duplicate role"
          dark={dark}
          onClick={() =>
            setExperience(duplicateExperienceRole(experience, index))
          }
        >
          <Copy className="size-3" />
          Duplicate
        </CanvasAffordance>
        <CanvasAffordance
          label="Remove role"
          dark={dark}
          onClick={() => setExperience(removeExperienceRole(experience, index))}
        >
          <X className="size-3" />
          Remove
        </CanvasAffordance>
      </div>
      <ul
        className={cn(
          "mt-2 space-y-1.5",
          dark ? "text-white/85" : "text-foreground/85"
        )}
      >
        {item.bullets.map((bullet, bi) => (
          <li
            key={bi}
            data-paper-section={`experience-${index}-bullet-${bi}`}
            className="flex gap-2"
          >
            <span
              className={cn(
                "mt-2 size-1 shrink-0 rounded-full",
                dark ? "bg-white/50" : "bg-foreground/40"
              )}
            />
            <CvType role="body" as="span" className="min-w-0 flex-1">
              <EditableField
                aria-label="Bullet point"
                sectionId={`experience-${index}-bullet-${bi}`}
                value={bullet}
                multiline
                className="flex-1"
                onChange={(value) => {
                  const bullets = [...item.bullets]
                  bullets[bi] = value
                  patchExperience(index, { bullets })
                }}
              />
            </CvType>
            <CanvasAffordance
              label="Remove bullet"
              dark={dark}
              onClick={() =>
                setExperience(removeExperienceBullet(experience, index, bi))
              }
            >
              <X className="size-3" />
            </CanvasAffordance>
          </li>
        ))}
      </ul>
      <CanvasAffordance
        label="Add bullet"
        dark={dark}
        onClick={() => setExperience(addExperienceBullet(experience, index))}
      >
        <Plus className="size-3" />
        Add a line
      </CanvasAffordance>
    </div>
  )
}

function EducationBlock({
  item,
  index,
  education,
  setEducation,
  patchEducation,
}: {
  item: CvEducation
  index: number
  education: CvEducation[]
  setEducation: (education: CvEducation[]) => void
  patchEducation: (index: number, next: Partial<CvEducation>) => void
}) {
  return (
    <div
      className={cn(PAPER_CANVAS_BLOCK_CLASS, "mb-3 last:mb-0")}
      data-paper-section={`education-${index}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CvType role="label">
          <EditableField
            aria-label="School"
            value={item.school}
            onChange={(school) => patchEducation(index, { school })}
          />
        </CvType>
        <CvType
          role="micro"
          className="font-medium tracking-wide text-muted-foreground uppercase"
        >
          <EditableField
            aria-label="Period"
            value={item.period}
            onChange={(period) => patchEducation(index, { period })}
          />
        </CvType>
      </div>
      <CvType role="body" className="text-muted-foreground">
        <EditableField
          aria-label="Degree"
          value={item.degree}
          onChange={(degree) => patchEducation(index, { degree })}
        />
      </CvType>
      {item.detail ? (
        <CvType role="micro" className="mt-1 text-muted-foreground">
          <EditableField
            aria-label="Education detail"
            value={item.detail}
            onChange={(detail) => patchEducation(index, { detail })}
          />
        </CvType>
      ) : null}
      <CanvasAffordance
        label="Remove school"
        onClick={() => setEducation(removeEducation(education, index))}
      >
        <X className="size-3" />
        Remove
      </CanvasAffordance>
    </div>
  )
}

function EducationList({
  education,
  setEducation,
  patchEducation,
}: {
  education: CvEducation[]
  setEducation: (education: CvEducation[]) => void
  patchEducation: (index: number, next: Partial<CvEducation>) => void
}) {
  if (education.length === 0) {
    return (
      <SectionNextStep
        label={EMPTY_SECTION_CTA.education}
        onClick={() => setEducation(addEducation(education))}
      />
    )
  }

  return education.map((item, i) => (
    <EducationBlock
      key={i}
      item={item}
      index={i}
      education={education}
      setEducation={setEducation}
      patchEducation={patchEducation}
    />
  ))
}

function EducationEmptyCta({
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

function SkillChips({
  groups,
  onChange,
  variant = "tag",
  grouped = false,
  dark = false,
}: {
  groups: CvSkillGroup[]
  onChange: (
    groups: CvSkillGroup[] | ((current: CvSkillGroup[]) => CvSkillGroup[])
  ) => void
  variant?: "tag" | "pill" | "dashed" | "sidebar"
  grouped?: boolean
  dark?: boolean
}) {
  const chipClass = (variant: "tag" | "pill" | "dashed" | "sidebar") =>
    cn(
      "inline-flex max-w-full items-center gap-0.5 px-2 py-0.5 font-medium",
      variant === "tag" && "rounded-md border border-border bg-muted/40",
      variant === "pill" &&
        "rounded-full bg-foreground px-2.5 text-background",
      variant === "dashed" && "rounded border border-dashed border-border",
      variant === "sidebar" && "rounded bg-white/10 px-1.5 text-white/85"
    )

  function renderChip(groupIndex: number, itemIndex: number, skill: string) {
    return (
      <CvType
        key={`${groupIndex}-${itemIndex}`}
        role="micro"
        as="span"
        className={chipClass(variant)}
      >
        <EditableField
          aria-label="Skill"
          sectionId="skills"
          value={skill}
          className={cn(
            "min-w-[1ch]",
            variant === "pill" && "text-background",
            variant === "sidebar" && "text-white/85"
          )}
          onChange={(value) =>
            onChange((current) =>
              renameSkillItem(current, groupIndex, itemIndex, value)
            )
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Remove skill"
          tabIndex={-1}
          onClick={() =>
            onChange((current) =>
              removeSkillItem(current, groupIndex, itemIndex)
            )
          }
          className={cn(
            PAPER_CANVAS_AFFORDANCE_CLASS,
            "size-4 text-current hover:bg-transparent",
            variant === "pill" && "text-background/80",
            variant === "sidebar" && "text-white/70 hover:text-white"
          )}
        >
          <X className="size-2.5" />
        </Button>
      </CvType>
    )
  }

  function addButton(groupIndex?: number) {
    return (
      <CanvasAffordance
        label="Add skill"
        dark={dark}
        onClick={() =>
          onChange((current) => addSkillItem(current, groupIndex))
        }
      >
        <Plus className="size-3" />
        Add skill
      </CanvasAffordance>
    )
  }

  if (groups.length === 0) {
    return (
      <div data-paper-section="skills">
        <SectionNextStep
          label={EMPTY_SECTION_CTA.skills}
          dark={dark}
          onClick={() => onChange((current) => addSkillItem(current))}
        />
      </div>
    )
  }

  if (grouped) {
    return (
      <div data-paper-section="skills" className="space-y-3">
        {groups.map((group, gi) => (
          <div key={gi} className={PAPER_CANVAS_BLOCK_CLASS}>
            <CvType
              role="micro"
              className={cn(
                "mb-1.5 font-semibold tracking-wide uppercase",
                dark ? "text-white/45" : "text-muted-foreground"
              )}
            >
              <EditableField
                aria-label="Skill group"
                value={group.label}
                className={dark ? "text-white/45" : undefined}
                onChange={(label) =>
                  onChange((current) => renameSkillGroup(current, gi, label))
                }
              />
            </CvType>
            <div className="flex flex-wrap items-center gap-1">
              {group.items.map((item, ii) => renderChip(gi, ii, item))}
              {addButton(gi)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      data-paper-section="skills"
      className={cn(PAPER_CANVAS_BLOCK_CLASS, "flex flex-wrap items-center gap-1.5")}
    >
      {groups.flatMap((group, gi) =>
        group.items.map((item, ii) => renderChip(gi, ii, item))
      )}
      {addButton()}
    </div>
  )
}

function SectionTitle({
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

function CvPhoto({
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

function InternshipCv({
  data,
  patch,
  patchExperience,
  patchEducation,
  setExperience,
  setEducation,
  setSkills,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-internship">
      <header className="border-b border-foreground/10 pb-4 text-center">
        <CvType role="page-title" as="h1">
          <EditableField
            aria-label="Full name"
            sectionId="name"
            value={data.name}
            onChange={(name) => patch("name", name)}
          />
        </CvType>
        <CvType role="body" className="mt-1 text-muted-foreground">
          <EditableField
            aria-label="Headline"
            value={data.headline}
            onChange={(headline) => patch("headline", headline)}
          />
        </CvType>
        <ContactLine
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
          className="mt-3 justify-center text-muted-foreground"
        />
      </header>

      <section className="mt-5">
        <SectionTitle>Summary</SectionTitle>
        <CvType role="body" as="div" className="text-foreground/90">
          <EditableField
            aria-label="Summary"
            value={data.summary}
            multiline
            onChange={(summary) => patch("summary", summary)}
          />
        </CvType>
      </section>

      <section className="mt-5">
        <SectionTitle>Experience</SectionTitle>
        <ExperienceList
          experience={data.experience}
          setExperience={setExperience}
          patchExperience={patchExperience}
        />
      </section>

      <section className="mt-5">
        <SectionTitle>Education</SectionTitle>
        <EducationList
          education={data.education}
          setEducation={setEducation}
          patchEducation={patchEducation}
        />
      </section>

      <section className="mt-5">
        <SectionTitle>Skills</SectionTitle>
        <SkillChips groups={data.skills} onChange={setSkills} />
      </section>
    </div>
  )
}

function PhotoCv({
  data,
  patch,
  patchExperience,
  patchEducation,
  setExperience,
  setEducation,
  setSkills,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-photo">
      <header className="mb-5 flex gap-4 border-b border-foreground/10 pb-4">
        <CvPhoto
          url={data.photoUrl}
          onChange={(photoUrl) => patch("photoUrl", photoUrl)}
        />
        <div className="min-w-0 flex-1">
          <CvType role="page-title" as="h1">
            <EditableField
              aria-label="Full name"
              sectionId="name"
              value={data.name}
              onChange={(name) => patch("name", name)}
            />
          </CvType>
          <CvType role="body" className="mt-1 text-muted-foreground">
            <EditableField
              aria-label="Headline"
              value={data.headline}
              onChange={(headline) => patch("headline", headline)}
            />
          </CvType>
          <ContactLine
            data={data}
            patch={patch}
            patchExperience={patchExperience}
            patchEducation={patchEducation}
            className="mt-2.5 text-muted-foreground"
          />
        </div>
      </header>

      <section className="mb-5">
        <SectionTitle>Summary</SectionTitle>
        <CvType role="body" as="div" className="text-foreground/90">
          <EditableField
            aria-label="Summary"
            value={data.summary}
            multiline
            onChange={(summary) => patch("summary", summary)}
          />
        </CvType>
      </section>

      <section className="mb-5">
        <SectionTitle>Experience</SectionTitle>
        <ExperienceList
          experience={data.experience}
          setExperience={setExperience}
          patchExperience={patchExperience}
        />
      </section>

      <section className="mb-5">
        <SectionTitle>Education</SectionTitle>
        <EducationList
          education={data.education}
          setEducation={setEducation}
          patchEducation={patchEducation}
        />
      </section>

      <section>
        <SectionTitle>Skills</SectionTitle>
        <SkillChips groups={data.skills} onChange={setSkills} />
      </section>
    </div>
  )
}

function ProductCv({
  data,
  patch,
  patchExperience,
  patchEducation,
  setExperience,
  setEducation,
  setSkills,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-root--product cv-template-product">
      <aside className="cv-template-product-sidebar bg-[#1e293b] text-white">
        <CvType role="page-title" as="h1">
          <EditableField
            aria-label="Full name"
            sectionId="name"
            value={data.name}
            className="text-white"
            onChange={(name) => patch("name", name)}
          />
        </CvType>
        <CvType role="body" className="mt-2 text-white/70">
          <EditableField
            aria-label="Headline"
            value={data.headline}
            className="text-white/70"
            onChange={(headline) => patch("headline", headline)}
          />
        </CvType>

        <div className="mt-6 space-y-1.5 text-white/75">
          <CvType role="micro" as="div">
            <EditableField
              aria-label="Email"
              value={data.contact.email}
              className="block text-white/75"
              onChange={(email) => patch("contact", { ...data.contact, email })}
            />
            <EditableField
              aria-label="Phone"
              value={data.contact.phone}
              className="block text-white/75"
              onChange={(phone) => patch("contact", { ...data.contact, phone })}
            />
            <EditableField
              aria-label="Location"
              value={data.contact.location}
              className="block text-white/75"
              onChange={(location) =>
                patch("contact", { ...data.contact, location })
              }
            />
            {data.contact.linkedin ? (
              <EditableField
                aria-label="LinkedIn"
                value={data.contact.linkedin}
                className="block text-white/75"
                onChange={(linkedin) =>
                  patch("contact", { ...data.contact, linkedin })
                }
              />
            ) : null}
          </CvType>
        </div>

        <div className="mt-6">
          <SectionTitle dark>Skills</SectionTitle>
          <SkillChips
            groups={data.skills}
            onChange={setSkills}
            variant="sidebar"
            grouped
            dark
          />
        </div>

        <div className="mt-6">
          <SectionTitle dark>Education</SectionTitle>
          {data.education.map((item, i) => (
            <div
              key={i}
              data-paper-section={`education-${i}`}
              className={cn(PAPER_CANVAS_BLOCK_CLASS, "mb-3 text-white/80")}
            >
              <CvType role="label" className="text-white">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  className="text-white"
                  onChange={(school) => patchEducation(i, { school })}
                />
              </CvType>
              <CvType role="body" className="text-white/60">
                <EditableField
                  aria-label="Degree"
                  value={item.degree}
                  className="text-white/60"
                  onChange={(degree) => patchEducation(i, { degree })}
                />
              </CvType>
              <CvType role="micro" className="text-white/45">
                <EditableField
                  aria-label="Period"
                  value={item.period}
                  className="text-white/45"
                  onChange={(period) => patchEducation(i, { period })}
                />
              </CvType>
              <CanvasAffordance
                label="Remove school"
                dark
                onClick={() =>
                  setEducation(removeEducation(data.education, i))
                }
              >
                <X className="size-3" />
                Remove
              </CanvasAffordance>
            </div>
          ))}
          <EducationEmptyCta
            education={data.education}
            setEducation={setEducation}
            dark
          />
        </div>
      </aside>

      <main className="cv-template-product-main">
        <section>
          <SectionTitle>Profile</SectionTitle>
          <CvType role="body" as="div" className="text-foreground/90">
            <EditableField
              aria-label="Summary"
              value={data.summary}
              multiline
              onChange={(summary) => patch("summary", summary)}
            />
          </CvType>
        </section>

        <section className="mt-6">
          <SectionTitle>Experience</SectionTitle>
          <ExperienceList
            experience={data.experience}
            setExperience={setExperience}
            patchExperience={patchExperience}
          />
        </section>

        {data.projects?.length ? (
          <section className="mt-6">
            <SectionTitle>Selected work</SectionTitle>
            {data.projects.map((project, i) => (
              <div key={i} data-paper-section={`project-${i}`} className="mb-3">
                <CvType role="label">
                  <EditableField
                    aria-label="Project name"
                    value={project.name}
                    onChange={(name) => {
                      const projects = [...(data.projects ?? [])]
                      projects[i] = { ...project, name }
                      patch("projects", projects)
                    }}
                  />
                </CvType>
                <CvType role="body" className="mt-0.5 text-muted-foreground">
                  <EditableField
                    aria-label="Project detail"
                    value={project.detail}
                    multiline
                    onChange={(detail) => {
                      const projects = [...(data.projects ?? [])]
                      projects[i] = { ...project, detail }
                      patch("projects", projects)
                    }}
                  />
                </CvType>
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  )
}

function ServiceCv({
  data,
  patch,
  patchExperience,
  patchEducation,
  setExperience,
  setEducation,
  setSkills,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-service">
      <header className="mb-5">
        <CvType role="page-title" as="h1">
          <EditableField
            aria-label="Full name"
            sectionId="name"
            value={data.name}
            onChange={(name) => patch("name", name)}
          />
        </CvType>
        <CvType role="body" className="mt-1 text-foreground/70">
          <EditableField
            aria-label="Headline"
            value={data.headline}
            onChange={(headline) => patch("headline", headline)}
          />
        </CvType>
        <ContactLine
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
          className="mt-2 text-muted-foreground"
        />
      </header>

      <section className="rounded-lg border border-foreground/10 bg-muted/20 p-4">
        <SectionTitle>Work experience</SectionTitle>
        <ExperienceList
          experience={data.experience}
          setExperience={setExperience}
          patchExperience={patchExperience}
        />
      </section>

      <section className="mt-5">
        <SectionTitle>About</SectionTitle>
        <CvType role="body" as="div">
          <EditableField
            aria-label="Summary"
            value={data.summary}
            multiline
            onChange={(summary) => patch("summary", summary)}
          />
        </CvType>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <section>
          <SectionTitle>Education</SectionTitle>
          {data.education.map((item, i) => (
            <div
              key={i}
              data-paper-section={`education-${i}`}
              className={cn(PAPER_CANVAS_BLOCK_CLASS, "mb-2")}
            >
              <CvType role="label">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  onChange={(school) => patchEducation(i, { school })}
                />
              </CvType>
              <CvType role="body" className="text-muted-foreground">
                <EditableField
                  aria-label="Degree"
                  value={item.degree}
                  onChange={(degree) => patchEducation(i, { degree })}
                />
              </CvType>
              <CvType role="micro" className="text-muted-foreground">
                <EditableField
                  aria-label="Period"
                  value={item.period}
                  onChange={(period) => patchEducation(i, { period })}
                />
              </CvType>
              <CanvasAffordance
                label="Remove school"
                onClick={() =>
                  setEducation(removeEducation(data.education, i))
                }
              >
                <X className="size-3" />
                Remove
              </CanvasAffordance>
            </div>
          ))}
          <EducationEmptyCta
            education={data.education}
            setEducation={setEducation}
          />
        </section>
        <section>
          <SectionTitle>Skills</SectionTitle>
          <SkillChips
            groups={data.skills}
            onChange={setSkills}
            variant="pill"
          />
        </section>
      </div>
    </div>
  )
}

function AcademicCv({
  data,
  patch,
  patchExperience,
  patchEducation,
  setExperience,
  setEducation,
  setSkills,
}: TemplateProps) {
  return (
    <div className="cv-template-root cv-template-academic">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-3">
        <div>
          <CvType role="page-title" as="h1">
            <EditableField
              aria-label="Full name"
              sectionId="name"
              value={data.name}
              onChange={(name) => patch("name", name)}
            />
          </CvType>
          <CvType role="body" className="mt-0.5 text-muted-foreground">
            <EditableField
              aria-label="Headline"
              value={data.headline}
              onChange={(headline) => patch("headline", headline)}
            />
          </CvType>
        </div>
        <ContactLine
          data={data}
          patch={patch}
          patchExperience={patchExperience}
          patchEducation={patchEducation}
          className="text-right text-muted-foreground"
        />
      </header>

      <section className="mb-5">
        <SectionTitle>Education</SectionTitle>
        {data.education.map((item, i) => (
          <div
            key={i}
            data-paper-section={`education-${i}`}
            className={cn(PAPER_CANVAS_BLOCK_CLASS, "mb-3 flex gap-4")}
          >
            <CvType
              role="micro"
              className="w-24 shrink-0 font-medium tracking-wide text-muted-foreground uppercase"
            >
              <EditableField
                aria-label="Period"
                value={item.period}
                onChange={(period) => patchEducation(i, { period })}
              />
            </CvType>
            <div>
              <CvType role="label">
                <EditableField
                  aria-label="School"
                  value={item.school}
                  onChange={(school) => patchEducation(i, { school })}
                />
              </CvType>
              <CvType role="body" className="text-muted-foreground">
                <EditableField
                  aria-label="Degree"
                  value={item.degree}
                  onChange={(degree) => patchEducation(i, { degree })}
                />
              </CvType>
              {item.detail ? (
                <CvType role="micro" className="mt-1 text-muted-foreground">
                  <EditableField
                    aria-label="Education detail"
                    value={item.detail}
                    onChange={(detail) => patchEducation(i, { detail })}
                  />
                </CvType>
              ) : null}
              <CanvasAffordance
                label="Remove school"
                onClick={() =>
                  setEducation(removeEducation(data.education, i))
                }
              >
                <X className="size-3" />
                Remove
              </CanvasAffordance>
            </div>
          </div>
        ))}
        <EducationEmptyCta
          education={data.education}
          setEducation={setEducation}
        />
      </section>

      {data.projects?.length ? (
        <section className="mb-5">
          <SectionTitle>Projects & campus</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {data.projects.map((project, i) => (
              <div
                key={i}
                data-paper-section={`project-${i}`}
                className="rounded-lg border border-border bg-muted/20 p-3"
              >
                <CvType role="label">
                  <EditableField
                    aria-label="Project name"
                    value={project.name}
                    onChange={(name) => {
                      const projects = [...(data.projects ?? [])]
                      projects[i] = { ...project, name }
                      patch("projects", projects)
                    }}
                  />
                </CvType>
                <CvType role="body" className="mt-1 text-muted-foreground">
                  <EditableField
                    aria-label="Project detail"
                    value={project.detail}
                    multiline
                    onChange={(detail) => {
                      const projects = [...(data.projects ?? [])]
                      projects[i] = { ...project, detail }
                      patch("projects", projects)
                    }}
                  />
                </CvType>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-5">
        <SectionTitle>Experience</SectionTitle>
        <ExperienceList
          experience={data.experience}
          setExperience={setExperience}
          patchExperience={patchExperience}
        />
      </section>

      <section>
        <SectionTitle>Skills & languages</SectionTitle>
        <SkillChips
          groups={data.skills}
          onChange={setSkills}
          variant="dashed"
        />
      </section>
    </div>
  )
}
