import {
  getDevProfile,
  type DevProfile,
} from "@/features/app-shell/dev-profile.ts"

export type CvTemplateId =
  | "internship"
  | "product"
  | "service"
  | "academic"
  | "photo"

export type CvContact = {
  email: string
  phone: string
  location: string
  linkedin?: string
}

export type CvEducation = {
  school: string
  degree: string
  period: string
  detail?: string
}

export type CvExperience = {
  role: string
  company: string
  period: string
  location?: string
  bullets: string[]
}

export type CvSkillGroup = {
  label: string
  items: string[]
}

export type CvProject = {
  name: string
  detail: string
}

export type CvData = {
  templateId: CvTemplateId
  name: string
  headline: string
  contact: CvContact
  summary: string
  experience: CvExperience[]
  education: CvEducation[]
  skills: CvSkillGroup[]
  projects?: CvProject[]
  languages?: string[]
  photoUrl?: string
}

export type CvTemplateMeta = {
  id: CvTemplateId
  name: string
  useCase: string
  description: string
}

export const CV_TEMPLATES: CvTemplateMeta[] = [
  {
    id: "internship",
    name: "Classic internship",
    useCase: "General internships",
    description: "Single-column layout hiring managers scan in 30 seconds.",
  },
  {
    id: "product",
    name: "Product & design",
    useCase: "UX · product · startup",
    description: "Sidebar for skills and contact; story-led main column.",
  },
  {
    id: "service",
    name: "Project-led",
    useCase: "Side projects · clubs",
    description:
      "Leads with shipped work when full-time experience is still thin.",
  },
  {
    id: "academic",
    name: "Campus & projects",
    useCase: "Clubs · coursework · hackathons",
    description: "Education and projects up front for early-career roles.",
  },
  {
    id: "photo",
    name: "With photo",
    useCase: "Formal · corporate · office",
    description: "Passport-size headshot beside your name and contact details.",
  },
]

const CV_PREFIX = "cv:v1:"

export function isCvContent(content: string): boolean {
  return content.startsWith(CV_PREFIX)
}

export function parseCvContent(content: string): CvData {
  if (isCvContent(content)) {
    try {
      return JSON.parse(content.slice(CV_PREFIX.length)) as CvData
    } catch {
      return DEFAULT_CV_DATA
    }
  }
  return migrateMarkdownCv()
}

export function serializeCvContent(data: CvData): string {
  return `${CV_PREFIX}${JSON.stringify(data)}`
}

export function defaultCvData(profile: DevProfile = getDevProfile()): CvData {
  return {
    templateId: "product",
    name: profile.name,
    headline: "Aspiring Product Manager · Year 4",
    contact: {
      email: profile.email,
      phone: "+84 90 123 4567",
      location: "Ho Chi Minh City, Vietnam",
      linkedin: "linkedin.com/in/openpath-dev",
    },
    summary:
      "Year-4 Information Systems student targeting associate product manager roles. I learn by shipping small product experiments: teardowns, UI refinements, and specs backed by user notes—not slide decks alone.",
    experience: [
      {
        role: "Product discovery lead",
        company: "UIT Product Club",
        period: "2024 – Present",
        location: "Volunteer",
        bullets: [
          "Ran weekly problem interviews with 8 classmates; turned themes into a one-page PRD for a campus expense app.",
          "Facilitated prioritization workshops using RICE; team shipped a clickable Figma prototype in 3 weeks.",
        ],
      },
      {
        role: "Side project · Checkout UX",
        company: "Personal",
        period: "2025",
        location: "Remote",
        bullets: [
          "Audited product card density on a top e-commerce app; proposed tighter card height and clearer CTA hierarchy.",
          "Tested two layouts with 12 users; variant B improved add-to-cart taps by 18% in a hallway study.",
        ],
      },
    ],
    education: [
      {
        school: "University of Information Technology (UIT)",
        degree: "B.Sc. Information Systems",
        period: "2022 – 2026",
        detail:
          "Relevant: systems analysis, databases, HCI, agile project course",
      },
    ],
    skills: [
      {
        label: "Product",
        items: ["User interviews", "PRDs", "Roadmaps", "Prioritization"],
      },
      {
        label: "Tools",
        items: ["Figma", "Notion", "Miro", "Google Sheets", "SQL basics"],
      },
      {
        label: "Languages",
        items: ["Vietnamese (native)", "English (fluent)"],
      },
    ],
    projects: [
      {
        name: "Mobile wallet onboarding audit",
        detail:
          "Mapped 14 friction points across three competitor apps; shipped a recommended flow with annotated wireframes.",
      },
      {
        name: "Product card resize study",
        detail:
          "Measured scan time and tap accuracy after shrinking card chrome; documented findings as a Proof card.",
      },
    ],
  }
}

export const DEFAULT_CV_DATA: CvData = defaultCvData()

function migrateMarkdownCv(): CvData {
  return { ...DEFAULT_CV_DATA }
}
