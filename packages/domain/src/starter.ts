import type { ApplyStage, ApplyTrackKind } from "./apply.js"
import { decodePaperContent, type CvDocument } from "./paper-codecs.js"
import { PAPER_CONTENT_VERSION } from "./paper.js"
import {
  decodePitchContent,
  DEFAULT_PITCH_BLOCKS,
  STARTER_PITCH_ABOUT_LEAD,
  STARTER_PITCH_HEADLINE,
  type PitchDocument,
} from "./pitch-codecs.js"
import { PITCH_CONTENT_KIND, PITCH_CONTENT_VERSION } from "./pitch.js"

/** Drive name for the sample CV created at signup. Wipeable. */
export const STARTER_CV_NAME = "Sample internship CV"

/** Seeded Inbox card Home pokes for the first Apply win (QVE-226). */
export const STARTER_GUIDED_APPLY_TITLE = "Associate PM intern"
export const STARTER_GUIDED_APPLY_COMPANY = "Local startup"

/** History title for the Coach Thread created at signup. Wipeable. */
export const STARTER_THREAD_TITLE = "Welcome to OpenPath"

/**
 * Neutral sample CV — product voice, never a named persona.
 * Name/contact stay generic so a real account does not inherit a fake identity.
 */
export function starterCvDocument(): CvDocument {
  return {
    templateId: "internship",
    name: "Your name",
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

/**
 * Opening Coach message. Honest: the workspace was seeded by the product,
 * not by a Command the Coach ran.
 */
/**
 * Neutral Pitch page — product voice, never a named persona.
 * Identity (name, email, avatar) is overlaid from the session User.
 * `demo: true` so the page is labeled Demo content, not a fake UIT/PM self.
 */
export function starterPitchDocument(): PitchDocument {
  return {
    headline: STARTER_PITCH_HEADLINE,
    location: "HCMC · open to intern roles",
    status: "Sample — open to intern roles · Summer 2026",
    about: `${STARTER_PITCH_ABOUT_LEAD}

I learn product by shipping small experiments — checkout UX studies, onboarding teardowns, and club-led discovery sprints. Looking for a team that values evidence over slide decks.`,
    published: false,
    demo: true,
    github: {
      username: "",
      connected: true,
    },
    blocks: DEFAULT_PITCH_BLOCKS,
    achievements: [
      {
        id: "a1",
        year: "2025",
        title: "Checkout card resize study",
        context: "Side project",
        description:
          "Ran a 12-person hallway test on two mobile checkout layouts. Shorter card + sticky CTA lifted add-to-cart taps by 18%. Documented as a Proof chain.",
        proofId: "checkout",
        tag: "UX research",
      },
      {
        id: "a2",
        year: "2025",
        title: "Wallet onboarding audit",
        context: "Fintech teardown",
        description:
          "Mapped friction across three wallet apps, then prototyped a shorter KYC path with classmates. Presented findings at UIT Product Club.",
        tag: "Product critique",
      },
      {
        id: "a3",
        year: "2024",
        title: "Campus expense app",
        context: "UIT Product Club",
        description:
          "Led discovery for a student expense splitter — 8 interviews, PRD, and a shipped Figma prototype in three weeks.",
        tag: "Shipped prototype",
      },
    ],
    experience: [
      {
        id: "e1",
        period: "2024 – now",
        title: "Product discovery lead",
        org: "UIT Product Club",
        summary:
          "Weekly user interviews, prioritisation workshops, and PRDs for campus-side projects.",
      },
      {
        id: "e2",
        period: "2023 – 2024",
        title: "Information Systems",
        org: "University of Information Technology",
        summary:
          "GPA 3.4 · focus on systems analysis, SQL, and product electives.",
      },
    ],
    storyHighlights: [
      {
        id: "sh-checkout",
        label: "Checkout",
        coverTone: "emerald",
        coverImage: "/pitch/stories/mobile-checkout.jpg",
        slides: [
          {
            id: "s1",
            caption: "Hallway test setup",
            detail: "12 participants · two mobile layouts · 15 min each",
            tone: "warm",
            image: "/pitch/stories/hallway-test.jpg",
          },
          {
            id: "s2",
            caption: "Variant B — shorter card",
            detail: "Sticky CTA + tighter image ratio",
            tone: "neutral",
            image: "/pitch/stories/phone-ui.jpg",
          },
          {
            id: "s3",
            caption: "+18% add-to-cart taps",
            detail: "Documented as a Proof chain on Paper",
            tone: "emerald",
            durationMs: 6000,
            image: "/pitch/stories/team-win.jpg",
          },
        ],
      },
      {
        id: "sh-wallet",
        label: "Wallet audit",
        coverTone: "cool",
        coverImage: "/pitch/stories/whiteboard.jpg",
        slides: [
          {
            id: "s4",
            caption: "Friction map",
            detail: "Compared 3 wallet apps · flagged KYC drop-off",
            tone: "cool",
            image: "/pitch/stories/whiteboard.jpg",
          },
          {
            id: "s5",
            caption: "Shorter KYC prototype",
            detail: "Sketched a 4-step path with classmates",
            tone: "neutral",
            image: "/pitch/stories/team-laptop.jpg",
          },
        ],
      },
      {
        id: "sh-club",
        label: "Club sprint",
        coverTone: "warm",
        coverImage: "/pitch/stories/sprint-board.jpg",
        slides: [
          {
            id: "s6",
            caption: "Sprint board",
            detail: "UIT Product Club · week 3 of discovery",
            tone: "warm",
            image: "/pitch/stories/sprint-board.jpg",
          },
          {
            id: "s7",
            caption: "Shipped prototype",
            detail: "Campus expense app · demo day with the club",
            tone: "cool",
            image: "/pitch/stories/award-trophy.jpg",
          },
          {
            id: "s8",
            caption: "Team after demo",
            detail: "Gift from mentors · proud of the sprint",
            tone: "warm",
            image: "/pitch/stories/gift-celebration.jpg",
          },
        ],
      },
    ],
    bento: [
      {
        id: "b1",
        kind: "visual",
        title: "Your name",
        body: "Sample · campus club",
        tone: "warm",
        span: "normal",
        image: "/pitch/stories/team-meeting.jpg",
      },
      {
        id: "b2",
        kind: "quote",
        title: "I ship small experiments",
        body: "Checkout UX, onboarding teardowns, club-led discovery.",
        span: "normal",
      },
      {
        id: "b3",
        kind: "stat",
        title: "+18%",
        body: "add-to-cart lift",
        meta: "Checkout study · 2025",
        tone: "emerald",
        span: "normal",
      },
      {
        id: "b4",
        kind: "story",
        title: "Checkout",
        body: "Hallway test setup",
        tone: "cool",
        span: "tall",
        storyHighlightId: "sh-checkout",
        image: "/pitch/stories/hallway-test.jpg",
      },
      {
        id: "b5",
        kind: "link",
        title: "@github",
        body: "GitHub · mock",
        meta: "github.com",
        tone: "dark",
        span: "wide",
      },
    ],
    gallery: [
      { id: "g1", caption: "Hallway test", tone: "warm" },
      { id: "g2", caption: "Sprint board", tone: "cool" },
      { id: "g3", caption: "Flow maps", tone: "neutral" },
    ],
    files: [
      {
        id: "f1",
        name: "Sample internship CV.pdf",
        meta: "142 KB",
        kind: "pdf",
      },
      {
        id: "f2",
        name: "Checkout study deck.fig",
        meta: "Figma",
        kind: "fig",
      },
    ],
    links: [
      {
        id: "l1",
        label: "GitHub",
        href: "https://github.com",
        icon: "github",
      },
      {
        id: "l2",
        label: "LinkedIn",
        href: "https://linkedin.com",
        icon: "linkedin",
      },
      {
        id: "l3",
        label: "Email",
        href: "mailto:",
        icon: "mail",
      },
    ],
    workDocs: [
      {
        id: "d1",
        name: "PM track CV",
        type: "cv",
        status: "draft",
        updated: "Today",
      },
      {
        id: "d3",
        name: "Checkout card resize study",
        type: "proof",
        status: "ready",
        updated: "3 days ago",
      },
      {
        id: "d4",
        name: "Wallet onboarding audit",
        type: "proof",
        status: "draft",
        updated: "Last week",
      },
    ],
  }
}

export function starterPitchContent(): Record<string, unknown> {
  const content = starterPitchDocument()
  const decoded = decodePitchContent(
    PITCH_CONTENT_KIND,
    PITCH_CONTENT_VERSION,
    content
  )
  if (!decoded.ok) {
    throw new Error(`Starter Pitch failed the codec: ${decoded.message}`)
  }
  return decoded.data as Record<string, unknown>
}

export const STARTER_THREAD_COACH_TEXT =
  "Paper has one sample CV you can replace. Apply has a few example cards labeled Demo across Stages so the board isn't empty. Pitch has a sample page labeled Demo content — edit it or clear the demo when you want it to be yours. Delete any of it when you are ready — none of it is a real person.\n\nI haven't edited Paper, Apply, or Pitch, and I haven't run any Commands — this workspace was seeded for you. Ask here when you want a next step, or open those surfaces yourself."

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
