import { cn } from "@workspace/ui/lib/utils"
import { X } from "lucide-react"
import { removeEducation } from "./cv-edits.ts"
import {
  CvType,
  EditableField,
  PAPER_CANVAS_BLOCK_CLASS,
  type TemplateProps,
  ContactLine,
  CanvasAffordance,
  CvSection,
  cvSectionFilled,
  EducationEmptyCta,
  SectionTitle,
} from "./cv-parts.tsx"
import { ExperienceList, SkillChips } from "./cv-entries.tsx"
import {
  ActivitiesAndAwards,
  LanguagesBlock,
  SummaryBlock,
} from "./cv-lines.tsx"

export function AcademicCv({
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
              aria-label="Name"
              placeholder="Name"
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

      <CvSection className="mb-5" filled={cvSectionFilled(data, "education")}>
        <SectionTitle kind="education">Education</SectionTitle>
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
                onClick={() => setEducation(removeEducation(data.education, i))}
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
      </CvSection>

      {data.projects?.length ? (
        <section className="mb-5">
          <SectionTitle kind="projects">Projects & campus</SectionTitle>
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
      <SummaryBlock data={data} />
      <LanguagesBlock data={data} />
      <ActivitiesAndAwards data={data} />

      <CvSection className="mb-5" filled={cvSectionFilled(data, "experience")}>
        <SectionTitle kind="experience">Experience</SectionTitle>
        <ExperienceList
          experience={data.experience}
          setExperience={setExperience}
          patchExperience={patchExperience}
        />
      </CvSection>

      <CvSection filled={cvSectionFilled(data, "skills")}>
        <SectionTitle kind="skills">Skills & languages</SectionTitle>
        <SkillChips
          groups={data.skills}
          onChange={setSkills}
          variant="dashed"
        />
      </CvSection>
    </div>
  )
}
