import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Copy, Plus, X } from "lucide-react"
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
} from "../paper-cv-edits.ts"
import {
  type CvEducation,
  type CvExperience,
  type CvSkillGroup,
} from "../paper-cv-types.ts"
import {
  CvType,
  EditableField,
  PAPER_CANVAS_BLOCK_CLASS,
  PAPER_CANVAS_AFFORDANCE_CLASS,
  CanvasAffordance,
  SectionNextStep,
} from "./cv-parts.tsx"

export function ExperienceList({
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

export function ExperienceBlock({
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

export function EducationBlock({
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

export function EducationList({
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

export function SkillChips({
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
      variant === "pill" && "rounded-full bg-foreground px-2.5 text-background",
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
        onClick={() => onChange((current) => addSkillItem(current, groupIndex))}
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
      className={cn(
        PAPER_CANVAS_BLOCK_CLASS,
        "flex flex-wrap items-center gap-1.5"
      )}
    >
      {groups.flatMap((group, gi) =>
        group.items.map((item, ii) => renderChip(gi, ii, item))
      )}
      {addButton()}
    </div>
  )
}
