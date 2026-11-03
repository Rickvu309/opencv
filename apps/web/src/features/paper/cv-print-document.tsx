/**
 * CV print-paper templates. Shared type roles live in paper.css (print-scaled).
 * The product-sidebar hex lives in cv-templates/product.tsx on purpose;
 * print layout is the CV print-paper exception in AGENTS.md. Focus/selection chrome
 * is QVE-206 (`paper-canvas-field` in paper.css). Café Tab/Esc is QVE-208.
 * Empty-section next steps are QVE-209 (`paper-canvas-next-step`).
 * Honest undo/redo of structured fields is QVE-210.
 */
import { useEffect, useRef } from "react"
import {
  type CvData,
  type CvEducation,
  type CvExperience,
  type CvSkillGroup,
} from "./paper-cv-types.ts"
import {
  CvHistoryRevisionContext,
  CvPlaceholderContext,
  CvSectionTitleContext,
  type TemplateProps,
} from "./cv-templates/cv-parts.tsx"
import { AcademicCv } from "./cv-templates/academic.tsx"
import { InternshipCv } from "./cv-templates/internship.tsx"
import { PhotoCv } from "./cv-templates/photo.tsx"
import { ProductCv } from "./cv-templates/product.tsx"
import { ServiceCv } from "./cv-templates/service.tsx"
export {
  EditableField,
  PAPER_CANVAS_AFFORDANCE_CLASS,
  PAPER_CANVAS_BLOCK_CLASS,
  PAPER_CANVAS_FIELD_CLASS,
  PAPER_CANVAS_NEXT_STEP_CLASS,
} from "./cv-templates/cv-parts.tsx"

type Props = {
  data: CvData
  onChange: (data: CvData) => void
  historyRevision?: number
  placeholders?: boolean
}

export function CvDocument({
  data,
  onChange,
  historyRevision = 0,
  placeholders = false,
}: Props) {
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
    skills: CvSkillGroup[] | ((current: CvSkillGroup[]) => CvSkillGroup[])
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

  const sectionTitles = (
    data as { sectionTitles?: Partial<Record<string, string>> }
  ).sectionTitles
  return (
    <CvSectionTitleContext.Provider value={sectionTitles}>
      <CvPlaceholderContext.Provider value={placeholders}>
        <CvHistoryRevisionContext.Provider value={historyRevision}>
          {tree}
        </CvHistoryRevisionContext.Provider>
      </CvPlaceholderContext.Provider>
    </CvSectionTitleContext.Provider>
  )
}
