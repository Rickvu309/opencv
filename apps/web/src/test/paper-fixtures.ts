import { type PaperDoc, type ProofDocument } from "@workspace/domain"

const PAPER_CONTENT_VERSION = 1

import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"
import { defaultCvData } from "@/features/paper/cv-templates/cv-types.ts"

const DEFAULT_CHECKOUT_PROOF: ProofDocument = {
  viewMode: "chain",
  title: "Product card resize study",
  subtitle: "E-commerce checkout · Side project",
  steps: [
    {
      id: "s1",
      type: "context",
      title: "Context",
      body: "Checkout product cards felt tall on mobile; users scrolled past key items and missed the add-to-cart button on smaller screens.",
      time: "14:00",
      date: "Saturday 12 Jul",
      photos: [
        {
          id: "p1",
          url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop",
          caption: "Before: tall card chrome",
        },
      ],
    },
    {
      id: "s2",
      type: "action",
      title: "What I did",
      body: "Measured card height, image ratio, and CTA placement against two competitors. Built variant A (status quo) and variant B (shorter card, sticky CTA) in Figma and ran a 12-person hallway test.",
      time: "15:30",
      date: "Saturday 12 Jul",
      photos: [
        {
          id: "p2",
          url: "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=400&h=300&fit=crop",
          caption: "Variant B wireframes",
        },
        {
          id: "p3",
          url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop",
          caption: "Tap heat notes",
        },
      ],
    },
    {
      id: "s3",
      type: "outcome",
      title: "Outcome",
      body: "Variant B cut average time-to-tap on add-to-cart by 1.4s and raised successful taps from 67% to 85% in the hallway study. Wrote a one-page recommendation with before/after screenshots.",
      time: "18:00",
      date: "Saturday 12 Jul",
      photos: [],
    },
    {
      id: "s4",
      type: "note",
      title: "Next step",
      body: "Share the write-up with UIT Product Club and link this Proof on my PM track CV.",
      time: "18:15",
      date: "Saturday 12 Jul",
      photos: [],
    },
  ],
}

const DEFAULT_ONBOARDING_PROOF: ProofDocument = {
  viewMode: "timeline",
  title: "Mobile wallet onboarding audit",
  subtitle: "Fintech competitor teardown · Side project",
  steps: [
    {
      id: "s1",
      type: "context",
      title: "Context",
      body: "Three local wallet apps ask for KYC upfront; classmates abandoned signup before linking a bank card.",
      time: "09:00",
      date: "Monday 6 Oct",
      photos: [],
    },
    {
      id: "s2",
      type: "action",
      title: "What I did",
      body: "Screen-recorded onboarding for App A, B, and C. Logged 14 friction points (permissions, copy, error states) in a Notion table and sketched a leaner 5-step flow.",
      time: "11:00",
      date: "Monday 6 Oct",
      photos: [
        {
          id: "p1",
          url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=300&fit=crop",
          caption: "Flow map in Figma",
        },
      ],
    },
    {
      id: "s3",
      type: "outcome",
      title: "Outcome",
      body: "Recommended deferring KYC until after first successful top-up. Five peers who tried the prototype flow finished signup in under 3 minutes vs. 7+ on the live apps.",
      time: "16:30",
      date: "Tuesday 7 Oct",
      photos: [],
    },
  ],
}

function iso(daysAgo: number) {
  return new Date(Date.UTC(2026, 7, 25 - daysAgo, 12, 0, 0)).toISOString()
}

function letterMarkdown(profile: typeof SAMPLE_AUTHOR, body: string) {
  const firstName = profile.name.trim().split(/\s+/)[0]
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
      applyCardId: null,
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
      applyCardId: "01900000-0000-7000-8000-000000000001",
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
      applyCardId: null,
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
      applyCardId: null,
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
      applyCardId: "01900000-0000-7000-8000-000000000002",
      createdAt: iso(7),
      updatedAt: iso(7),
    },
  ]
}
