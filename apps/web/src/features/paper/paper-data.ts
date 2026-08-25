import {
  getDevProfile,
  type DevProfile,
} from "@/features/app-shell/dev-profile.ts"

import { defaultCvData, serializeCvContent } from "./paper-cv-types.ts"
import {
  DEFAULT_CHECKOUT_PROOF,
  DEFAULT_ONBOARDING_PROOF,
  serializeProofContent,
} from "./paper-proof-types.ts"

export type DocType = "cv" | "letter" | "proof"
export type DocStatus = "draft" | "ready" | "published"

export type PaperDoc = {
  id: string
  name: string
  type: DocType
  status: DocStatus
  updated: string
  applyLink?: string
  content: string
}

export const TYPE_LABEL: Record<DocType, string> = {
  cv: "CV",
  letter: "Letter",
  proof: "Proof",
}

export function profileFirstName(profile: DevProfile) {
  return profile.name.trim().split(/\s+/).filter(Boolean)[0] ?? profile.name
}

function seedLetter(profile: DevProfile, body: string) {
  const firstName = profileFirstName(profile)
  return `${body}

Best,
${firstName}`
}

export function seedPaperDocs(
  profile: DevProfile = getDevProfile()
): PaperDoc[] {
  return [
    {
      id: "d1",
      name: "PM track CV",
      type: "cv",
      status: "draft",
      updated: "Today",
      content: serializeCvContent(defaultCvData(profile)),
    },
    {
      id: "d2",
      name: "Cover: Associate PM intern",
      type: "letter",
      status: "draft",
      updated: "Yesterday",
      applyLink: "Local startup",
      content: seedLetter(
        profile,
        `Dear hiring team,

I am applying for the associate product manager intern role at Local startup. I am in my final year at UIT studying Information Systems and spend most of my free time on small product experiments—not coursework summaries.

Last month I ran a checkout card resize study on a major e-commerce app. I tested two layouts with 12 users and documented an 18% lift in add-to-cart taps. I linked that work as a Proof card on my CV.

I would welcome a short conversation about where I can help your team this summer.`
      ),
    },
    {
      id: "d3",
      name: "Checkout card resize study",
      type: "proof",
      status: "ready",
      updated: "3 days ago",
      content: serializeProofContent(DEFAULT_CHECKOUT_PROOF),
    },
    {
      id: "d4",
      name: "Wallet onboarding audit",
      type: "proof",
      status: "draft",
      updated: "Last week",
      content: serializeProofContent(DEFAULT_ONBOARDING_PROOF),
    },
    {
      id: "d5",
      name: "Cover: Product intern",
      type: "letter",
      status: "draft",
      updated: "Last week",
      applyLink: "Fintech scale-up",
      content: seedLetter(
        profile,
        `Dear Fintech scale-up team,

I am interested in the product intern role. I have been tearing down mobile wallet onboarding flows for a side project and prototyping a shorter KYC path with classmates.

I would like to learn how your team validates experiments in production and how interns contribute to discovery work.

Thank you for considering my application.`
      ),
    },
  ]
}

export const PAPER_SUMMARY = [
  { label: "CVs", value: "1", hint: "1 draft" },
  { label: "Letters", value: "2", hint: "All drafts" },
  { label: "Proof", value: "2", hint: "1 ready" },
  { label: "Linked to Apply", value: "2", hint: "Roles tied" },
]
