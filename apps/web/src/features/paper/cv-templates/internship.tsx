import {
  CvType,
  EditableField,
  type TemplateProps,
  ContactLine,
  SectionTitle,
} from "./cv-parts.tsx"
import { ExperienceList, EducationList, SkillChips } from "./cv-entries.tsx"

export function InternshipCv({
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
