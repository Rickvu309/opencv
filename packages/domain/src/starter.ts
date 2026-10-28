import type { CvDocument } from "./paper-codecs.js"

/** Drive name for the sample CV created at signup. Wipeable. */
export const STARTER_CV_NAME = "Sample internship CV"

/** The sample CV starts with an empty name field, labelled "Your name" in the editor. */
const STARTER_CV_PERSON_NAME = ""

/** Name text that sample CVs created before the empty field still carry. */
export const LEGACY_STARTER_CV_PERSON_NAME = "Your name"

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
