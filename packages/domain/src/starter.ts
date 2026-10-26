import type { ApplyStage, ApplyTrackKind } from "./apply.js"
import { decodePaperContent, type CvDocument } from "./paper-codecs.js"
import { PAPER_CONTENT_VERSION } from "./paper.js"

/** Drive name for the sample CV created at signup. Wipeable. */
export const STARTER_CV_NAME = "Sample internship CV"

/** The sample CV starts with an empty name field, labelled "Your name" in the editor. */
export const STARTER_CV_PERSON_NAME = ""

/** Name text that sample CVs created before the empty field still carry. */
export const LEGACY_STARTER_CV_PERSON_NAME = "Your name"

/** Seeded Inbox card Home pokes for the first Apply win (QVE-226). */
export const STARTER_GUIDED_APPLY_TITLE = "Associate PM intern"
export const STARTER_GUIDED_APPLY_COMPANY = "Local startup"

/** History title for the Coach Thread created at signup. Wipeable. */
export const STARTER_THREAD_TITLE = "Welcome to OpenCV"

/**
 * Neutral sample CV — product voice, never a named persona.
 * Name/contact stay generic so a real account does not inherit a fake identity.
 */
export function starterCvDocument(): CvDocument {
  return {
    templateId: "internship",
    name: STARTER_CV_PERSON_NAME,
    headline: "Early-career product intern",
    contact: {
      email: "",
      phone: "",
      location: "Ho Chi Minh City, Vietnam",
    },
    summary:
      "Year-4 Information Systems student targeting associate product manager internships. I learn by shipping small experiments: teardowns, UI refinements, and specs backed by user notes — not slide decks alone. Replace this sample with your own story.",
    experience: [
      {
        role: "Product discovery lead",
        company: "Campus product club",
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
          "Measured scan time and tap accuracy after shrinking card chrome; documented findings as a Proof.",
      },
    ],
  }
}

export function starterCvContent(): Record<string, unknown> {
  const content = starterCvDocument()
  const decoded = decodePaperContent("cv", PAPER_CONTENT_VERSION, content)
  if (!decoded.ok) {
    throw new Error(`Starter CV failed the codec: ${decoded.message}`)
  }
  return decoded.data as Record<string, unknown>
}

export type StarterApplyCardDraft = {
  title: string
  company: string
  note: string
  stage: ApplyStage
  starred: boolean
  jobUrl: string | null
  /** Always true — signup samples, never personal jobs (QVE-240). */
  demo: true
  trackKind: ApplyTrackKind
  /** Days from seed time. Negative is in the past. */
  trackOffsetDays: number
}

/**
 * A few Apply cards across Stages so the board demos itself.
 * Notes are second-person product voice; companies are generic.
 * No posting URL — jobs.example.com NXDOMAINs and looks like a real JD (QVE-217).
 * `demo: true` so the board and drawer label them Demo, not personal jobs (QVE-240).
 */
export function starterApplyCards(): StarterApplyCardDraft[] {
  return [
    {
      title: STARTER_GUIDED_APPLY_TITLE,
      company: STARTER_GUIDED_APPLY_COMPANY,
      note: "JD wants discovery notes and one shipped experiment. Starred so it stays on top.",
      stage: "inbox",
      starred: true,
      jobUrl: null,
      demo: true,
      trackKind: "followup",
      trackOffsetDays: 1,
    },
    {
      title: "Business analyst intern",
      company: "Regional bank",
      note: "Emphasize SQL and flow mapping before you send.",
      stage: "prep",
      starred: false,
      jobUrl: null,
      demo: true,
      trackKind: "followup",
      trackOffsetDays: -10,
    },
    {
      title: "Product analyst intern",
      company: "E-commerce co.",
      note: "You sent this. The checkout Proof is a strong hook if they reply.",
      stage: "sent",
      starred: false,
      jobUrl: null,
      demo: true,
      trackKind: "applied",
      trackOffsetDays: -5,
    },
    {
      title: "UX research intern",
      company: "Agency",
      note: "They passed. Keep the research samples and move on.",
      stage: "closed",
      starred: false,
      jobUrl: null,
      demo: true,
      trackKind: "applied",
      trackOffsetDays: -15,
    },
  ]
}

export const STARTER_THREAD_COACH_TEXT =
  "Paper has one sample CV you can replace. Apply has a few example cards labeled Demo across Stages so the board isn't empty. Delete any of it when you are ready. None of it is a real person.\n\nI haven't edited Paper or Apply, and I haven't run any Commands. This workspace was seeded for you. Ask here when you want a next step, or open those surfaces yourself."

export function starterThread() {
  return {
    title: STARTER_THREAD_TITLE,
    coachText: STARTER_THREAD_COACH_TEXT,
  }
}

export function isoDateFromOffset(now: Date, offsetDays: number): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}
