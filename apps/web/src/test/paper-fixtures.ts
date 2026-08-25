import { PAPER_CONTENT_VERSION, type PaperDoc } from "@workspace/domain"

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"
import { defaultCvData } from "@/features/paper/paper-cv-types.ts"
import { profileFirstName } from "@/features/paper/paper-data.ts"
import {
  DEFAULT_CHECKOUT_PROOF,
  DEFAULT_ONBOARDING_PROOF,
} from "@/features/paper/paper-proof-types.ts"

function iso(daysAgo: number) {
  return new Date(Date.UTC(2026, 7, 25 - daysAgo, 12, 0, 0)).toISOString()
}

function letterMarkdown(profile: typeof SAMPLE_AUTHOR, body: string) {
  const firstName = profileFirstName(profile)
  return `${body}

Best,
${firstName}`
}

export function samplePaperDocs(
  profile: typeof SAMPLE_AUTHOR = SAMPLE_AUTHOR
): PaperDoc[] {
  return [
    {
      id: "11111111-1111-7111-8111-111111111111",
      name: "PM track CV",
      kind: "cv",
      status: "draft",
      content: defaultCvData(profile),
      contentVersion: PAPER_CONTENT_VERSION,
      createdAt: iso(0),
      updatedAt: iso(0),
    },
    {
      id: "22222222-2222-7222-8222-222222222222",
      name: "Cover: Associate PM intern",
      kind: "letter",
      status: "draft",
      content: {
        markdown: letterMarkdown(
          profile,
          `Dear hiring team,

I am applying for the associate product manager intern role at Local startup. I am in my final year at UIT studying Information Systems and spend most of my free time on small product experiments—not coursework summaries.

Last month I ran a checkout card resize study on a major e-commerce app. I tested two layouts with 12 users and documented an 18% lift in add-to-cart taps. I linked that work as a Proof card on my CV.

I would welcome a short conversation about where I can help your team this summer.`
        ),
      },
      contentVersion: PAPER_CONTENT_VERSION,
      createdAt: iso(1),
      updatedAt: iso(1),
    },
    {
      id: "33333333-3333-7333-8333-333333333333",
      name: "Checkout card resize study",
      kind: "proof",
      status: "ready",
      content: DEFAULT_CHECKOUT_PROOF,
      contentVersion: PAPER_CONTENT_VERSION,
      createdAt: iso(3),
      updatedAt: iso(3),
    },
    {
      id: "44444444-4444-7444-8444-444444444444",
      name: "Wallet onboarding audit",
      kind: "proof",
      status: "draft",
      content: DEFAULT_ONBOARDING_PROOF,
      contentVersion: PAPER_CONTENT_VERSION,
      createdAt: iso(7),
      updatedAt: iso(7),
    },
    {
      id: "55555555-5555-7555-8555-555555555555",
      name: "Cover: Product intern",
      kind: "letter",
      status: "draft",
      content: {
        markdown: letterMarkdown(
          profile,
          `Dear Fintech scale-up team,

I am interested in the product intern role. I have been tearing down mobile wallet onboarding flows for a side project and prototyping a shorter KYC path with classmates.

I would like to learn how your team validates experiments in production and how interns contribute to discovery work.

Thank you for considering my application.`
        ),
      },
      contentVersion: PAPER_CONTENT_VERSION,
      createdAt: iso(7),
      updatedAt: iso(7),
    },
  ]
}
