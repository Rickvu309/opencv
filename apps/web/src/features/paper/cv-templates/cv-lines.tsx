import type { CvSectionKind } from "@workspace/domain"

import type { CvData } from "./cv-types.ts"
import { CvType, SectionTitle } from "./cv-parts.tsx"

type WithLines = CvData & {
  activities?: string[]
  awards?: string[]
}

function linesOf(data: CvData, key: "activities" | "awards"): string[] {
  const value = (data as WithLines)[key]
  if (!Array.isArray(value)) return []
  return value.filter((line) => line.trim().length > 0)
}

function LineSection({
  title,
  kind,
  items,
}: {
  title: string
  kind: CvSectionKind
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <section className="mt-5">
      <SectionTitle kind={kind}>{title}</SectionTitle>
      <ul className="space-y-1">
        {items.map((line, index) => (
          <li key={`${title}-${index}`}>
            <CvType role="body">{line}</CvType>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ActivitiesAndAwards({ data }: { data: CvData }) {
  return (
    <>
      <LineSection
        title="Activities"
        kind="activities"
        items={linesOf(data, "activities")}
      />
      <LineSection
        title="Awards"
        kind="awards"
        items={linesOf(data, "awards")}
      />
    </>
  )
}

/** Summary sentence for layouts that do not already print data.summary. */
export function SummaryBlock({ data }: { data: CvData }) {
  if (!data.summary.trim()) return null
  return (
    <section className="mt-5">
      <SectionTitle kind="summary">Summary</SectionTitle>
      <CvType role="body">{data.summary}</CvType>
    </section>
  )
}

/** Projects for layouts that do not already print data.projects. */
export function ProjectsBlock({ data }: { data: CvData }) {
  const projects = (data.projects ?? []).filter(
    (project) =>
      project.name.trim().length > 0 || project.detail.trim().length > 0
  )
  if (projects.length === 0) return null
  return (
    <section className="mt-5">
      <SectionTitle kind="projects">Projects</SectionTitle>
      {projects.map((project) => (
        <div key={`${project.name}-${project.detail}`}>
          <CvType role="label">{project.name}</CvType>
          <CvType role="body">{project.detail}</CvType>
        </div>
      ))}
    </section>
  )
}

/** Languages for every layout. None of the five templates printed this field. */
export function LanguagesBlock({ data }: { data: CvData }) {
  const languages = (data.languages ?? []).filter(
    (language) => language.trim().length > 0
  )
  if (languages.length === 0) return null
  return (
    <section className="mt-5">
      <SectionTitle kind="languages">Languages</SectionTitle>
      <CvType role="body">{languages.join(", ")}</CvType>
    </section>
  )
}
