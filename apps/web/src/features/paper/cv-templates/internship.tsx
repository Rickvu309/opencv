import {
  CvType,
  EditableField,
  type TemplateProps,
  ContactLine,
  CvSection,
  cvSectionFilled,
  SectionTitle,
} from "./cv-parts.tsx"
import { ExperienceList, EducationList, SkillChips } from "./cv-entries.tsx"
import {
  ActivitiesAndAwards,
  LanguagesBlock,
  ProjectsBlock,
} from "./cv-lines.tsx"

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
            aria-label="Name"
            placeholder="Name"
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

      <CvSection className="mt-5" filled={cvSectionFilled(data, "summary")}>
        <SectionTitle kind="summary">Summary</SectionTitle>
        <CvType role="body" as="div" className="text-foreground/90">
          <EditableField
            aria-label="Summary"
            value={data.summary}
            multiline
            onChange={(summary) => patch("summary", summary)}
          />
        </CvType>
      </CvSection>

      <CvSection className="mt-5" filled={cvSectionFilled(data, "experience")}>
        <SectionTitle kind="experience">Experience</SectionTitle>
        <ExperienceList
          experience={data.experience}
          setExperience={setExperience}
          patchExperience={patchExperience}
        />
      </CvSection>

      <CvSection className="mt-5" filled={cvSectionFilled(data, "education")}>
        <SectionTitle kind="education">Education</SectionTitle>
        <EducationList
          education={data.education}
          setEducation={setEducation}
          patchEducation={patchEducation}
        />
      </CvSection>

      <CvSection className="mt-5" filled={cvSectionFilled(data, "skills")}>
        <SectionTitle kind="skills">Skills</SectionTitle>
        <SkillChips groups={data.skills} onChange={setSkills} />
      </CvSection>
      <ProjectsBlock data={data} />
      <LanguagesBlock data={data} />
      <ActivitiesAndAwards data={data} />
    </div>
  )
}
