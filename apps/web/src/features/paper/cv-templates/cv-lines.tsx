import type { CvData } from "../paper-cv-types.ts"
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

function LineSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="mt-5">
      <SectionTitle>{title}</SectionTitle>
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
      <LineSection title="Activities" items={linesOf(data, "activities")} />
      <LineSection title="Awards" items={linesOf(data, "awards")} />
    </>
  )
}
