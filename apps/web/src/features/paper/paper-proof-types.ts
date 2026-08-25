export type ProofViewMode = "chain" | "timeline"

export type ProofStepType = "context" | "action" | "outcome" | "note"

export type ProofPhoto = {
  id: string
  url: string
  caption?: string
}

export type ProofStep = {
  id: string
  type: ProofStepType
  title: string
  body: string
  time?: string
  date?: string
  photos: ProofPhoto[]
}

export type ProofData = {
  viewMode: ProofViewMode
  title: string
  subtitle?: string
  steps: ProofStep[]
}

const PROOF_PREFIX = "proof:v1:"

export const PROOF_STEP_LABEL: Record<ProofStepType, string> = {
  context: "Context",
  action: "What I did",
  outcome: "Outcome",
  note: "Note",
}

export function isProofContent(content: string): boolean {
  return content.startsWith(PROOF_PREFIX)
}

export function parseProofContent(content: string): ProofData {
  if (isProofContent(content)) {
    try {
      return JSON.parse(content.slice(PROOF_PREFIX.length)) as ProofData
    } catch {
      return DEFAULT_CHECKOUT_PROOF
    }
  }
  return migrateMarkdownProof(content)
}

export function serializeProofContent(data: ProofData): string {
  return `${PROOF_PREFIX}${JSON.stringify(data)}`
}

export const DEFAULT_CHECKOUT_PROOF: ProofData = {
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

/** @deprecated Use DEFAULT_CHECKOUT_PROOF */
export const DEFAULT_CAFE_PROOF = DEFAULT_CHECKOUT_PROOF

export const DEFAULT_ONBOARDING_PROOF: ProofData = {
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

/** @deprecated Use DEFAULT_ONBOARDING_PROOF */
export const DEFAULT_CAMPUS_PROOF = DEFAULT_ONBOARDING_PROOF

function migrateMarkdownProof(content: string): ProofData {
  const data = {
    ...DEFAULT_CHECKOUT_PROOF,
    steps: [...DEFAULT_CHECKOUT_PROOF.steps],
  }
  const sections = content.split(/\*\*(.+?)\*\*/).filter(Boolean)
  for (let i = 0; i < sections.length; i += 2) {
    const label = sections[i]?.trim().toLowerCase()
    const body = sections[i + 1]?.trim()
    if (!label || !body) continue
    const step = data.steps.find((s) => s.title.toLowerCase() === label)
    if (step) step.body = body
  }
  return data
}

export function newProofStep(type: ProofStepType = "note"): ProofStep {
  return {
    id: `step-${Date.now()}`,
    type,
    title: PROOF_STEP_LABEL[type],
    body: "",
    time: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
    }),
    photos: [],
  }
}
