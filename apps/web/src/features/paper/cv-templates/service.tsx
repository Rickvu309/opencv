import { cn } from "@workspace/ui/lib/utils"
import { X } from "lucide-react"
import { removeEducation } from "./row-edits.ts"
import {
  CvType,
  EditableField,
  PAPER_CANVAS_BLOCK_CLASS,
  type TemplateProps,
  ContactLine,
  CanvasAffordance,
  EducationEmptyCta,
  SectionTitle,
} from "./cv-parts.tsx"
import { ExperienceList, SkillChips } from "./cv-entries.tsx"

export function ServiceCv({
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
            aria-label="Name"
            placeholder="Name"
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
                onClick={() => setEducation(removeEducation(data.education, i))}
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
