import { cn } from "@workspace/ui/lib/utils"
import { X } from "lucide-react"
import { removeEducation } from "./cv-edits.ts"
import {
  CvType,
  EditableField,
  PAPER_CANVAS_BLOCK_CLASS,
  type TemplateProps,
  CanvasAffordance,
  EducationEmptyCta,
  SectionTitle,
  useCvPlaceholders,
} from "./cv-parts.tsx"
import { ExperienceList, SkillChips } from "./cv-entries.tsx"
import { ActivitiesAndAwards, LanguagesBlock } from "./cv-lines.tsx"

export function ProductCv({
  data,
  patch,
  patchExperience,
  patchEducation,
  setExperience,
  setEducation,
  setSkills,
}: TemplateProps) {
  const placeholders = useCvPlaceholders()
  return (
    <div className="cv-template-root cv-template-root--product cv-template-product">
      <aside className="cv-template-product-sidebar bg-[#1e293b] text-white">
        <CvType role="page-title" as="h1">
          <EditableField
            aria-label="Name"
            placeholder="Name"
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
              placeholder={placeholders ? "Email" : undefined}
              value={data.contact.email}
              className="block text-white/75"
              onChange={(email) => patch("contact", { ...data.contact, email })}
            />
            <EditableField
              aria-label="Phone"
              placeholder={placeholders ? "Phone" : undefined}
              value={data.contact.phone}
              className="block text-white/75"
              onChange={(phone) => patch("contact", { ...data.contact, phone })}
            />
            <EditableField
              aria-label={placeholders ? "City" : "Location"}
              placeholder={placeholders ? "City" : undefined}
              value={data.contact.location}
              className="block text-white/75"
              onChange={(location) =>
                patch("contact", { ...data.contact, location })
              }
            />
            {placeholders || data.contact.linkedin ? (
              <EditableField
                aria-label="LinkedIn"
                placeholder={placeholders ? "LinkedIn" : undefined}
                value={data.contact.linkedin ?? ""}
                className="block text-white/75"
                onChange={(linkedin) =>
                  patch("contact", { ...data.contact, linkedin })
                }
              />
            ) : null}
          </CvType>
        </div>

        <div className="mt-6">
          <SectionTitle kind="skills" dark>
            Skills
          </SectionTitle>
          <SkillChips
            groups={data.skills}
            onChange={setSkills}
            variant="sidebar"
            grouped
            dark
          />
        </div>

        <div className="mt-6">
          <SectionTitle kind="education" dark>
            Education
          </SectionTitle>
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
            dark
          />
        </div>
      </aside>

      <main className="cv-template-product-main">
        <section>
          <SectionTitle kind="summary">Profile</SectionTitle>
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
          <SectionTitle kind="experience">Experience</SectionTitle>
          <ExperienceList
            experience={data.experience}
            setExperience={setExperience}
            patchExperience={patchExperience}
          />
        </section>

        {data.projects?.length ? (
          <section className="mt-6">
            <SectionTitle kind="projects">Selected work</SectionTitle>
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
        <LanguagesBlock data={data} />
        <ActivitiesAndAwards data={data} />
      </main>
    </div>
  )
}
