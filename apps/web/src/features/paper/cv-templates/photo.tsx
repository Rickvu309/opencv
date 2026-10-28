import {
  CvType,
  EditableField,
  type TemplateProps,
  ContactLine,
  SectionTitle,
  CvPhoto,
} from "./cv-parts.tsx"
import { ExperienceList, EducationList, SkillChips } from "./cv-entries.tsx"
import { ActivitiesAndAwards, LanguagesBlock, ProjectsBlock } from "./cv-lines.tsx"

export function PhotoCv({
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
          name={data.name}
          onChange={(photoUrl) => patch("photoUrl", photoUrl)}
        />
        <div className="min-w-0 flex-1">
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
      <ProjectsBlock data={data} />
      <LanguagesBlock data={data} />
      <ActivitiesAndAwards data={data} />
    </div>
  )
}
